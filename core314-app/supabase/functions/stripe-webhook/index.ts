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
      return;
    }

    userId = newUser.user.id;
    log("info", "User created via Supabase Admin API", { user_id: userId, email });
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
    return;
  }

  log("info", "Subscription created", {
    user_id: userId,
    plan,
    seats_allowed: seatsAllowed,
    stripe_subscription_id: subscriptionId,
  });

  // ---- STEP 5: Send password setup email via SendGrid ----
  try {
    // Generate a secure password recovery link using Supabase Admin API
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: {
        redirectTo: "https://app.core314.com/reset-password",
      },
    });

    if (linkError || !linkData?.properties?.action_link) {
      log("error", "Failed to generate password setup link", {
        error: linkError ? String(linkError) : "No action_link returned",
        email,
      });
    } else {
      const passwordSetupLink = linkData.properties.action_link;
      log("info", "Password setup link generated", { email });

      // Send the email via SendGrid
      const sendgridApiKey = Deno.env.get("SENDGRID_API_KEY");
      const senderEmail = Deno.env.get("SENDGRID_SENDER_EMAIL") || "support@core314.com";
      const senderName = Deno.env.get("SENDGRID_SENDER_NAME") || "Core314";

      if (!sendgridApiKey) {
        log("error", "SENDGRID_API_KEY not set — cannot send password setup email", { email });
      } else {
        const emailHtml = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background-color:#f4f4f4;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f4f4f4;padding:20px;">
    <tr><td align="center">
      <table cellpadding="0" cellspacing="0" border="0" width="600" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 4px rgba(0,0,0,0.1);">
        <tr><td style="padding:40px 40px 30px 40px;">
          <h2 style="margin:0 0 20px 0;color:#0ea5e9;font-size:28px;font-weight:bold;">Set Your Core314 Password</h2>
          <p style="margin:0 0 15px 0;color:#222;font-size:16px;line-height:1.6;">Welcome to Core314!</p>
          <p style="margin:0 0 15px 0;color:#222;font-size:16px;line-height:1.6;">Your subscription is active and your account has been created. Click the button below to set your password and start using the platform.</p>
          <table cellpadding="0" cellspacing="0" border="0">
            <tr><td style="background-color:#0ea5e9;border-radius:6px;text-align:center;">
              <a href="${passwordSetupLink}" style="display:inline-block;padding:14px 32px;color:#ffffff;text-decoration:none;font-size:16px;font-weight:bold;">Set Your Password</a>
            </td></tr>
          </table>
          <p style="margin:20px 0 0 0;color:#999;font-size:12px;">If you didn't subscribe to Core314, you can safely ignore this email. This link expires in 24 hours.</p>
        </td></tr>
        <tr><td style="padding:20px 40px 40px 40px;border-top:1px solid #e0e0e0;">
          <p style="margin:0;color:#777;font-size:12px;line-height:1.4;">Core314 Operational Intelligence<br>&copy; ${new Date().getFullYear()} Core314. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

        const sgResponse = await fetch("https://api.sendgrid.com/v3/mail/send", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${sendgridApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email }] }],
            from: { email: senderEmail, name: senderName },
            subject: "Set your Core314 password",
            content: [
              { type: "text/plain", value: `Welcome to Core314! Set your password here: ${passwordSetupLink}` },
              { type: "text/html", value: emailHtml },
            ],
          }),
        });

        if (!sgResponse.ok) {
          const errBody = await sgResponse.text();
          log("error", "SendGrid API error for password setup email", {
            status: sgResponse.status,
            body: errBody,
            email,
          });
        } else {
          log("info", "Password setup email sent via SendGrid", { email });
        }
      }
    }
  } catch (err) {
    log("error", "Exception sending password setup email", { error: String(err) });
  }

  log("info", "Checkout completed — full Stripe-first flow executed", {
    user_id: userId,
    plan,
    seats_allowed: seatsAllowed,
    stripe_subscription_id: subscriptionId,
    email,
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
