// ============================================================================
// STRIPE WEBHOOK HANDLER — STRIPE-FIRST FLOW
// ============================================================================
// In the Stripe-first flow, the user does NOT exist before checkout.
// This webhook is the PRIMARY ENGINE that:
//   1. checkout.session.completed — Create user, link Stripe, upsert subscription, send password email
//   2. invoice.paid              — Confirm subscription active, update period
//   3. customer.subscription.updated — Sync plan/status/seats/cancellation
//   4. customer.subscription.deleted — Mark subscription canceled
//
// Flow: Pricing → Stripe Checkout → Webhook → User Creation → Password Email → Login
// ============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { logSystemEvent } from "../_shared/system-health-logger.ts";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ||
  Deno.env.get("CORE314_STRIPE_SECRET_KEY") || "";
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") ||
  Deno.env.get("CORE314_STRIPE_WEBHOOK_SECRET") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// ============================================================================
// PLAN MAPPING
// ============================================================================
const PRICE_TO_PLAN: Record<string, string> = {
  "price_1TCq6Q9s9Vjc0ojFG4t15gOO": "intelligence",
  "price_1TCq6a9s9Vjc0ojFifJOG9IY": "command_center",
};

const PLAN_SEATS: Record<string, number> = {
  intelligence: 5,
  command_center: 25,
};

// ============================================================================
// CLIENTS
// ============================================================================
const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ============================================================================
// STRUCTURED LOGGING
// ============================================================================
function log(level: "info" | "warn" | "error", message: string, data?: Record<string, unknown>) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    service: "stripe-webhook",
    message,
    ...data,
  };
  if (level === "error") {
    console.error(JSON.stringify(entry));
  } else if (level === "warn") {
    console.warn(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

// ============================================================================
// RESOLVE PLAN FROM METADATA OR PRICE ID
// ============================================================================
function resolvePlan(
  metadataPlan: string | undefined,
  priceId: string | undefined
): string | null {
  if (metadataPlan) {
    const normalized = metadataPlan.toLowerCase().replace(/\s+/g, "");
    if (normalized === "intelligence") return "intelligence";
    if (normalized === "commandcenter" || normalized === "command_center") return "command_center";
  }
  if (priceId && PRICE_TO_PLAN[priceId]) {
    return PRICE_TO_PLAN[priceId];
  }
  return null;
}

// ============================================================================
// HANDLER 1: checkout.session.completed (PRIMARY ENGINE)
// ============================================================================
// Stripe-first flow:
//   1. Extract email, customer_id, subscription_id, plan
//   2. Check if user exists → IF NOT create via Supabase Admin API
//   3. Link Stripe customer to profile
//   4. Upsert subscription record (plan, status, seats)
//   5. Send password setup email
// ============================================================================
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  log("info", "Processing checkout.session.completed", {
    session_id: session.id,
    customer_email: session.customer_details?.email || session.customer_email,
  });

  const email = session.customer_details?.email || session.customer_email;
  const stripeCustomerId = session.customer as string;
  const subscriptionId = session.subscription as string;

  if (!email) {
    log("error", "No email found in checkout session", { session_id: session.id });
    await logSystemEvent(supabaseAdmin, "stripe_webhook", "failure", "No email found in checkout session", { session_id: session.id });
    return;
  }

  // ---- Resolve plan ----
  const metadataPlan = session.metadata?.plan;
  let plan = resolvePlan(metadataPlan, undefined);

  // Fallback: resolve from subscription's price ID
  if (!plan && subscriptionId) {
    try {
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      const priceId = sub.items.data[0]?.price?.id;
      plan = resolvePlan(undefined, priceId);
    } catch (err) {
      log("warn", "Failed to retrieve subscription for plan resolution", { error: String(err) });
    }
  }

  if (!plan) {
    log("error", "Could not resolve plan from checkout session", {
      session_id: session.id,
      metadata: session.metadata,
    });
    await logSystemEvent(supabaseAdmin, "stripe_webhook", "failure", "Could not resolve plan from checkout session", { session_id: session.id, metadata: session.metadata as Record<string, unknown> });
    return;
  }

  const seatsAllowed = PLAN_SEATS[plan] || 1;

  // ---- STEP 2: Check if user exists, create if not ----
  let userId: string | null = null;

  // Check if user already exists by email
  const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
  if (listError) {
    log("error", "Failed to list users for duplicate check", { error: String(listError) });
  } else {
    const existing = users.find((u: { email?: string }) => u.email?.toLowerCase() === email.toLowerCase());
    if (existing) {
      userId = existing.id;
      log("info", "User already exists — reusing", { user_id: userId, email });
      await logSystemEvent(supabaseAdmin, "user_creation", "success", "Duplicate prevented — existing user reused", { user_id: userId, email });
    }
  }

  // Create new user if not found
  if (!userId) {
    // Generate a random temporary password (user will set their own via password reset email)
    const tempPassword = crypto.randomUUID() + crypto.randomUUID();

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true, // Auto-confirm — they already verified via Stripe payment
      user_metadata: {
        plan,
        signup_source: "stripe_checkout",
      },
    });

    if (createError) {
      log("error", "Failed to create user via Admin API", {
        error: String(createError),
        email,
      });
      await logSystemEvent(supabaseAdmin, "user_creation", "failure", `Failed to create user: ${String(createError)}`, { email, session_id: session.id });
      return;
    }

    userId = newUser.user.id;
    log("info", "User created via Supabase Admin API", { user_id: userId, email });
    await logSystemEvent(supabaseAdmin, "user_creation", "success", "User created via Stripe checkout", { user_id: userId, email, plan });
  }

  // ---- STEP 3: Link Stripe customer to profile ----
  try {
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ stripe_customer_id: stripeCustomerId })
      .eq("id", userId);

    if (profileError) {
      log("warn", "Failed to update profile with stripe_customer_id", {
        error: String(profileError),
        user_id: userId,
      });
    }
  } catch (err) {
    log("warn", "Profile update exception (non-fatal)", { error: String(err) });
  }

  // ---- STEP 4: Upsert subscription ----
  const subscriptionData = {
    user_id: userId,
    stripe_customer_id: stripeCustomerId,
    stripe_subscription_id: subscriptionId,
    plan,
    status: "active",
    seats_allowed: seatsAllowed,
    cancel_at_period_end: false,
    updated_at: new Date().toISOString(),
  };

  const { error: upsertError } = await supabaseAdmin
    .from("subscriptions")
    .upsert(subscriptionData, { onConflict: "user_id" });

  if (upsertError) {
    log("error", "Failed to upsert subscription", {
      error: String(upsertError),
      user_id: userId,
      plan,
    });
    await logSystemEvent(supabaseAdmin, "stripe_webhook", "failure", `Failed to upsert subscription: ${String(upsertError)}`, { user_id: userId, plan });
    return;
  }

  log("info", "Subscription created", {
    user_id: userId,
    plan,
    seats_allowed: seatsAllowed,
    stripe_subscription_id: subscriptionId,
  });

  // ---- STEP 5: Send branded welcome email (with password setup link) ----
  try {
    // Generate a secure password recovery link using Supabase Admin API
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: {
        redirectTo: "https://app.core314.com/reset-password",
      },
    });

    let passwordSetupLink: string | undefined;
    if (linkError || !linkData?.properties?.action_link) {
      log("warn", "Failed to generate password setup link — welcome email will be sent without it", {
        error: linkError ? String(linkError) : "No action_link returned",
        email,
      });
    } else {
      passwordSetupLink = linkData.properties.action_link;
      log("info", "Password setup link generated", { email });
    }

    // Fetch user's full_name from profile (may have been set by handle_new_user trigger)
    let userName = "there";
    try {
      const { data: profileData } = await supabaseAdmin
        .from("profiles")
        .select("full_name")
        .eq("id", userId)
        .single();
      if (profileData?.full_name) {
        userName = profileData.full_name;
      }
    } catch (_) { /* non-fatal */ }

    // Call the send-welcome-email edge function
    const welcomePayload = {
      email,
      name: userName,
      plan,
      password_setup_link: passwordSetupLink,
    };

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || SUPABASE_URL;
    const welcomeResponse = await fetch(`${supabaseUrl}/functions/v1/send-welcome-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify(welcomePayload),
    });

    if (!welcomeResponse.ok) {
      const errBody = await welcomeResponse.text();
      log("error", "Welcome email function call failed", {
        status: welcomeResponse.status,
        body: errBody,
        email,
      });
      await logSystemEvent(supabaseAdmin, "email_send", "failure", `Welcome email function error: ${welcomeResponse.status}`, { email });
    } else {
      log("info", "Welcome email sent successfully", { email, plan });
      await logSystemEvent(supabaseAdmin, "email_send", "success", "Welcome email sent via send-welcome-email function", { email, plan });
    }
  } catch (err) {
    log("error", "Exception sending welcome email", { error: String(err) });
    await logSystemEvent(supabaseAdmin, "email_send", "failure", `Exception sending welcome email: ${String(err)}`, { email, error: String(err) });
  }

  log("info", "Checkout completed — full Stripe-first flow executed", {
    user_id: userId,
    plan,
    seats_allowed: seatsAllowed,
    stripe_subscription_id: subscriptionId,
    email,
  });
  await logSystemEvent(supabaseAdmin, "stripe_webhook", "success", "Checkout completed — full Stripe-first flow executed", { user_id: userId, plan, seats_allowed: seatsAllowed, stripe_subscription_id: subscriptionId, email });
}

// ============================================================================
// HANDLER 2: invoice.paid
// ============================================================================
async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const subscriptionId = invoice.subscription as string;
  if (!subscriptionId) {
    log("info", "Invoice not linked to subscription, skipping", { invoice_id: invoice.id });
    return;
  }

  log("info", "Processing invoice.paid", {
    invoice_id: invoice.id,
    subscription_id: subscriptionId,
  });

  const periodStart = invoice.period_start
    ? new Date(invoice.period_start * 1000).toISOString()
    : null;
  const periodEnd = invoice.period_end
    ? new Date(invoice.period_end * 1000).toISOString()
    : null;

  const updateData: Record<string, unknown> = {
    status: "active",
    updated_at: new Date().toISOString(),
  };
  if (periodStart) updateData.current_period_start = periodStart;
  if (periodEnd) updateData.current_period_end = periodEnd;

  const { error } = await supabaseAdmin
    .from("subscriptions")
    .update(updateData)
    .eq("stripe_subscription_id", subscriptionId);

  if (error) {
    log("error", "Failed to update subscription on invoice.paid", {
      error: String(error),
      subscription_id: subscriptionId,
    });
    await logSystemEvent(supabaseAdmin, "stripe_webhook", "failure", `Failed to update subscription on invoice.paid: ${String(error)}`, { subscription_id: subscriptionId });
  } else {
    log("info", "Invoice paid — subscription confirmed active", {
      subscription_id: subscriptionId,
    });
    await logSystemEvent(supabaseAdmin, "stripe_webhook", "success", "Invoice paid — subscription confirmed active", { subscription_id: subscriptionId });
  }
}

// ============================================================================
// HANDLER 3: customer.subscription.updated
// ============================================================================
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  log("info", "Processing subscription.updated", {
    subscription_id: subscription.id,
    status: subscription.status,
  });

  const priceId = subscription.items.data[0]?.price?.id;
  const plan = resolvePlan(undefined, priceId);
  const seatsAllowed = plan ? (PLAN_SEATS[plan] || 1) : undefined;

  const updateData: Record<string, unknown> = {
    status: subscription.status,
    cancel_at_period_end: subscription.cancel_at_period_end || false,
    current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
    current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (plan) updateData.plan = plan;
  if (seatsAllowed !== undefined) updateData.seats_allowed = seatsAllowed;

  const { error } = await supabaseAdmin
    .from("subscriptions")
    .update(updateData)
    .eq("stripe_subscription_id", subscription.id);

  if (error) {
    log("error", "Failed to update subscription", {
      error: String(error),
      subscription_id: subscription.id,
    });
    await logSystemEvent(supabaseAdmin, "stripe_webhook", "failure", `Failed to update subscription: ${String(error)}`, { subscription_id: subscription.id });
  } else {
    log("info", "Subscription updated", {
      subscription_id: subscription.id,
      plan: plan || "unchanged",
      status: subscription.status,
    });
    await logSystemEvent(supabaseAdmin, "stripe_webhook", "success", "Subscription updated", { subscription_id: subscription.id, plan: plan || "unchanged", status: subscription.status });
  }
}

// ============================================================================
// HANDLER 4: customer.subscription.deleted
// ============================================================================
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  log("info", "Processing subscription.deleted", {
    subscription_id: subscription.id,
  });

  const { error } = await supabaseAdmin
    .from("subscriptions")
    .update({
      status: "canceled",
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscription.id);

  if (error) {
    log("error", "Failed to mark subscription as canceled", {
      error: String(error),
      subscription_id: subscription.id,
    });
    await logSystemEvent(supabaseAdmin, "stripe_webhook", "failure", `Failed to mark subscription canceled: ${String(error)}`, { subscription_id: subscription.id });
  } else {
    log("info", "Subscription canceled (user NOT deleted)", {
      subscription_id: subscription.id,
    });
    await logSystemEvent(supabaseAdmin, "stripe_webhook", "success", "Subscription canceled", { subscription_id: subscription.id });
  }
}

// ============================================================================
// MAIN SERVE HANDLER
// ============================================================================
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "stripe-signature, content-type",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Verify webhook signature
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    log("error", "Missing stripe-signature header");
    await logSystemEvent(supabaseAdmin, "stripe_webhook", "failure", "Missing stripe-signature header");
    return new Response(JSON.stringify({ error: "Missing signature" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!STRIPE_WEBHOOK_SECRET) {
    log("error", "STRIPE_WEBHOOK_SECRET not configured");
    await logSystemEvent(supabaseAdmin, "stripe_webhook", "failure", "STRIPE_WEBHOOK_SECRET not configured");
    return new Response(JSON.stringify({ error: "Webhook secret not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await req.text();
  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    log("error", "Webhook signature verification failed", { error: String(err) });
    await logSystemEvent(supabaseAdmin, "stripe_webhook", "failure", `Webhook signature verification failed: ${String(err)}`);
    return new Response(
      JSON.stringify({ error: "Invalid signature" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  log("info", "Webhook event verified", {
    event_id: event.id,
    event_type: event.type,
  });

  // Route to handler
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaid(invoice);
        break;
      }
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(subscription);
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }
      default:
        log("info", "Unhandled event type — acknowledged", { event_type: event.type });
    }
  } catch (err) {
    log("error", "Exception processing webhook event", {
      event_id: event.id,
      event_type: event.type,
      error: String(err),
    });
    await logSystemEvent(supabaseAdmin, "stripe_webhook", "failure", `Exception processing ${event.type}: ${String(err)}`, { event_id: event.id, event_type: event.type });
    // Return 200 to prevent Stripe retry loops — error is logged
  }

  // Always return 200 to acknowledge receipt
  return new Response(
    JSON.stringify({ received: true, event_type: event.type }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
