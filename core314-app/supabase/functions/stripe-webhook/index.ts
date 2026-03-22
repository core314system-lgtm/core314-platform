// ============================================================================
// STRIPE WEBHOOK HANDLER — SIGNUP-FIRST FLOW
// ============================================================================
// In the signup-first flow, the user already exists in auth.users before
// reaching Stripe Checkout. This webhook's ONLY job is:
//   1. checkout.session.completed — Link Stripe customer, upsert subscription
//   2. invoice.paid              — Confirm subscription active, update period
//   3. customer.subscription.updated — Sync plan/status/seats/cancellation
//   4. customer.subscription.deleted — Mark subscription canceled
//
// DO NOT create users here. DO NOT send onboarding emails.
// User creation happens on the signup page (Supabase Auth signUp).
// ============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

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
  "price_1TDmVlRvffecbIr9Gm8itXZw": "intelligence",
  "price_1TDmXnRvffecbIr9UUJpP5H8": "command_center",
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
// HANDLER 1: checkout.session.completed
// ============================================================================
// User already exists (created during signup). We just need to:
//   1. Find the user by client_reference_id (user_id) or email
//   2. Link Stripe customer ID to their profile
//   3. Upsert subscription record
// ============================================================================
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  log("info", "Processing checkout.session.completed", {
    session_id: session.id,
    customer_email: session.customer_details?.email || session.customer_email,
  });

  const email = session.customer_details?.email || session.customer_email;
  const stripeCustomerId = session.customer as string;
  const subscriptionId = session.subscription as string;

  // Resolve user_id: prefer client_reference_id (set at checkout), fallback to metadata, then email lookup
  let userId = session.client_reference_id || session.metadata?.userId || session.metadata?.user_id;

  if (!userId && email) {
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) {
      log("error", "Failed to list users", { error: String(listError) });
    } else {
      const found = users.find((u: { email?: string }) => u.email?.toLowerCase() === email.toLowerCase());
      if (found) {
        userId = found.id;
        log("info", "Found user by email lookup", { user_id: userId });
      }
    }
  }

  if (!userId) {
    log("error", "Cannot find user for checkout session — user must sign up first", {
      session_id: session.id,
      email,
    });
    return;
  }

  // Resolve plan from metadata or subscription price
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
    return;
  }

  const seatsAllowed = PLAN_SEATS[plan] || 1;

  // Link Stripe customer to profile (non-fatal if column doesn't exist)
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

  // Upsert subscription (idempotent on user_id unique constraint)
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
    return;
  }

  log("info", "Checkout completed — subscription created", {
    user_id: userId,
    plan,
    seats_allowed: seatsAllowed,
    stripe_subscription_id: subscriptionId,
  });
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
  } else {
    log("info", "Invoice paid — subscription confirmed active", {
      subscription_id: subscriptionId,
    });
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
  } else {
    log("info", "Subscription updated", {
      subscription_id: subscription.id,
      plan: plan || "unchanged",
      status: subscription.status,
    });
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
  } else {
    log("info", "Subscription canceled (user NOT deleted)", {
      subscription_id: subscription.id,
    });
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
    return new Response(JSON.stringify({ error: "Missing signature" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!STRIPE_WEBHOOK_SECRET) {
    log("error", "STRIPE_WEBHOOK_SECRET not configured");
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
    // Return 200 to prevent Stripe retry loops — error is logged
  }

  // Always return 200 to acknowledge receipt
  return new Response(
    JSON.stringify({ received: true, event_type: event.type }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
