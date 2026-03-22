import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// ============================================================================
// STRIPE WEBHOOK HANDLER
// ============================================================================
// Processes Stripe webhook events to complete the checkout-to-access loop:
//   1. checkout.session.completed  — Create user, link customer, upsert subscription, send email
//   2. invoice.paid                — Confirm subscription is active, update billing period
//   3. customer.subscription.updated — Sync plan/status/seat changes
//   4. customer.subscription.deleted — Mark subscription canceled (do NOT delete user)
//
// Full flow: Landing -> Stripe Checkout -> Webhook -> User Created -> Email -> Login
//
// All writes use service_role (bypasses RLS).
// Idempotent: safe to process the same event multiple times.
// ============================================================================

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ||
  Deno.env.get("CORE314_STRIPE_SECRET_KEY") || "";
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") ||
  Deno.env.get("CORE314_STRIPE_WEBHOOK_SECRET") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY") || "";
const APP_URL = Deno.env.get("APP_URL") || "https://app.core314.com";

// ============================================================================
// PLAN MAPPING
// ============================================================================
// Reverse map: Stripe price ID -> plan name
const PRICE_TO_PLAN: Record<string, string> = {
  "price_1TDmVlRvffecbIr9Gm8itXZw": "intelligence",
  "price_1TDmXnRvffecbIr9UUJpP5H8": "command_center",
};

// Plan -> seat allocation (also enforced by DB trigger, but set explicitly for clarity)
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
  // 1. Metadata takes precedence (set at checkout time)
  if (metadataPlan && (metadataPlan === "intelligence" || metadataPlan === "command_center")) {
    return metadataPlan;
  }
  // 2. Fall back to price ID reverse lookup
  if (priceId && PRICE_TO_PLAN[priceId]) {
    return PRICE_TO_PLAN[priceId];
  }
  return null;
}

// ============================================================================
// SEND PASSWORD SETUP EMAIL VIA SENDGRID
// ============================================================================
async function sendPasswordSetupEmail(email: string, resetLink: string): Promise<boolean> {
  if (!SENDGRID_API_KEY) {
    log("warn", "SENDGRID_API_KEY not set — skipping password setup email", { email });
    return false;
  }

  try {
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email }] }],
        from: { email: "support@core314.com", name: "Core314" },
        subject: "Set your Core314 password",
        content: [
          {
            type: "text/html",
            value: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="text-align: center; margin-bottom: 30px;">
                  <h1 style="color: #1a1a2e; font-size: 24px;">Welcome to Core314</h1>
                </div>
                <p style="color: #333; font-size: 16px; line-height: 1.6;">
                  Your subscription is active! To access your operational intelligence dashboard, please set your password:
                </p>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${resetLink}"
                     style="background-color: #0f172a; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600; display: inline-block;">
                    Set Your Password
                  </a>
                </div>
                <p style="color: #666; font-size: 14px; line-height: 1.6;">
                  After setting your password, log in at <a href="${APP_URL}" style="color: #2563eb;">${APP_URL}</a> to access your dashboard.
                </p>
                <p style="color: #666; font-size: 14px; line-height: 1.6;">
                  This link expires in 24 hours. If you didn't subscribe to Core314, you can safely ignore this email.
                </p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
                <p style="color: #999; font-size: 12px; text-align: center;">
                  Core314 Technologies LLC | Operational Intelligence Platform
                </p>
              </div>
            `,
          },
        ],
      }),
    });

    if (response.ok || response.status === 202) {
      log("info", "Password setup email sent successfully", { email });
      return true;
    } else {
      const errorText = await response.text();
      log("error", "SendGrid email failed", { email, status: response.status, error: errorText });
      return false;
    }
  } catch (err) {
    log("error", "SendGrid email exception", { email, error: String(err) });
    return false;
  }
}

// ============================================================================
// HANDLER: checkout.session.completed (PRIMARY)
// ============================================================================
// This is the main handler that closes the loop:
// 1. Resolves the plan from metadata/subscription
// 2. Finds or creates a Supabase user (by email)
// 3. Links Stripe customer -> Supabase user
// 4. Upserts subscription record
// 5. Sends password setup email for new users
// ============================================================================
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const stripeCustomerId = session.customer as string;
  const email = session.customer_details?.email || session.customer_email || "";
  const subscriptionId = session.subscription as string;

  log("info", "Processing checkout.session.completed", {
    session_id: session.id,
    customer: stripeCustomerId,
    email,
    subscription_id: subscriptionId,
    metadata: session.metadata as Record<string, unknown>,
  });

  if (!email) {
    log("error", "No email found in checkout session — cannot create user", { session_id: session.id });
    return;
  }

  // ---- RESOLVE PLAN ----
  let plan = resolvePlan(session.metadata?.plan, undefined);

  // If no plan in session metadata, fetch from subscription
  if (!plan && subscriptionId) {
    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const priceId = subscription.items.data[0]?.price?.id;
      plan = resolvePlan(subscription.metadata?.plan, priceId);
    } catch (err) {
      log("error", "Failed to fetch subscription for plan resolution", {
        subscription_id: subscriptionId,
        error: String(err),
      });
    }
  }

  if (!plan) {
    log("error", "Could not resolve plan — aborting checkout processing", {
      session_id: session.id,
      metadata: session.metadata as Record<string, unknown>,
    });
    return;
  }

  log("info", "Plan resolved", { plan, session_id: session.id });

  // ---- STEP 1: FIND OR CREATE USER ----
  let userId: string | null = null;
  let isNewUser = false;

  // Check metadata first (set by authenticated checkout from the app)
  if (session.metadata?.user_id) {
    userId = session.metadata.user_id;
    log("info", "Using user_id from checkout metadata (authenticated path)", { user_id: userId });
  }

  // If no user_id in metadata, look up by email in auth.users
  if (!userId) {
    const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (listError) {
      log("error", "Failed to list users for email lookup", { error: String(listError) });
    } else {
      const existingUser = existingUsers.users.find(
        (u) => u.email?.toLowerCase() === email.toLowerCase()
      );
      if (existingUser) {
        userId = existingUser.id;
        log("info", "Found existing user by email", { user_id: userId, email });
      }
    }
  }

  // If still no user, CREATE one
  if (!userId) {
    log("info", "No existing user found — creating new account", { email });

    // Generate a secure temporary password (user will set their own via email link)
    const tempPassword = crypto.randomUUID() + "!Aa1";

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true, // Mark confirmed since they just paid with this email
      user_metadata: {
        source: "stripe_checkout",
        plan,
        stripe_customer_id: stripeCustomerId,
      },
    });

    if (createError) {
      log("error", "Failed to create user", { email, error: String(createError) });
      return;
    }

    userId = newUser.user.id;
    isNewUser = true;
    log("info", "New user created successfully", { user_id: userId, email });
  }

  // ---- STEP 2: LINK STRIPE CUSTOMER -> USER PROFILE ----
  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .update({ stripe_customer_id: stripeCustomerId })
    .eq("id", userId);

  if (profileError) {
    // Non-fatal: column may not exist yet, or profile may not exist yet
    log("warn", "Failed to update profiles.stripe_customer_id", {
      user_id: userId,
      error: String(profileError),
    });
  } else {
    log("info", "Stripe customer linked to profile", {
      user_id: userId,
      stripe_customer_id: stripeCustomerId,
    });
  }

  // ---- STEP 3: FETCH SUBSCRIPTION DETAILS FROM STRIPE ----
  let periodStart: string | null = null;
  let periodEnd: string | null = null;
  let subscriptionStatus = "active";

  if (subscriptionId) {
    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      periodStart = new Date(subscription.current_period_start * 1000).toISOString();
      periodEnd = new Date(subscription.current_period_end * 1000).toISOString();
      subscriptionStatus = subscription.status;
    } catch (err) {
      log("warn", "Failed to fetch subscription details for period info", {
        subscription_id: subscriptionId,
        error: String(err),
      });
    }
  }

  // ---- STEP 4: UPSERT SUBSCRIPTION RECORD ----
  // seats_allowed is also auto-set by DB trigger (enforce_seats_on_subscription)
  const { error: upsertError } = await supabaseAdmin
    .from("subscriptions")
    .upsert(
      {
        user_id: userId,
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: subscriptionId,
        plan,
        status: subscriptionStatus,
        seats_allowed: PLAN_SEATS[plan] || 5,
        current_period_start: periodStart,
        current_period_end: periodEnd,
        cancel_at_period_end: false,
      },
      { onConflict: "user_id" }
    );

  if (upsertError) {
    log("error", "Failed to upsert subscription", {
      user_id: userId,
      plan,
      error: String(upsertError),
    });
    return;
  }

  log("info", "Subscription upserted successfully", {
    user_id: userId,
    plan,
    status: subscriptionStatus,
    seats_allowed: PLAN_SEATS[plan] || 5,
    stripe_customer_id: stripeCustomerId,
    stripe_subscription_id: subscriptionId,
    period_start: periodStart,
    period_end: periodEnd,
  });

  // ---- STEP 5: SEND PASSWORD SETUP EMAIL FOR NEW USERS ----
  if (isNewUser) {
    log("info", "Generating password setup link for new user", { email });

    const { data: resetData, error: resetError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: {
          redirectTo: `${APP_URL}/auth/reset-password`,
        },
      });

    if (resetError) {
      log("error", "Failed to generate password reset link", {
        email,
        error: String(resetError),
      });
    } else {
      const resetLink = resetData?.properties?.action_link || "";
      if (resetLink) {
        const emailSent = await sendPasswordSetupEmail(email, resetLink);
        log("info", "Password setup email result", { email, sent: emailSent });
      } else {
        log("error", "No action_link returned from generateLink", { email });
      }
    }
  }

  log("info", "checkout.session.completed processing complete", {
    user_id: userId,
    is_new_user: isNewUser,
    plan,
    email,
    stripe_customer_id: stripeCustomerId,
  });
}

// ============================================================================
// HANDLER: invoice.paid
// ============================================================================
// Confirms subscription is active after successful payment.
// Updates billing period dates.
// ============================================================================
async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const subscriptionId = invoice.subscription as string;

  log("info", "Processing invoice.paid", {
    invoice_id: invoice.id,
    customer: invoice.customer as string,
    subscription_id: subscriptionId,
  });

  if (!subscriptionId) {
    log("info", "Invoice not associated with subscription — skipping", { invoice_id: invoice.id });
    return;
  }

  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    const { error } = await supabaseAdmin
      .from("subscriptions")
      .update({
        status: subscription.status,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      })
      .eq("stripe_subscription_id", subscriptionId);

    if (error) {
      log("error", "Failed to update subscription on invoice.paid", {
        subscription_id: subscriptionId,
        error: String(error),
      });
    } else {
      log("info", "Subscription updated after invoice payment", {
        subscription_id: subscriptionId,
        status: subscription.status,
      });
    }
  } catch (err) {
    log("error", "Exception processing invoice.paid", {
      invoice_id: invoice.id,
      error: String(err),
    });
  }
}

// ============================================================================
// HANDLER: customer.subscription.updated
// ============================================================================
// Syncs plan changes, status changes, and cancellation flags.
// ============================================================================
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  log("info", "Processing customer.subscription.updated", {
    subscription_id: subscription.id,
    status: subscription.status,
    cancel_at_period_end: subscription.cancel_at_period_end,
  });

  const priceId = subscription.items.data[0]?.price?.id;
  const plan = resolvePlan(subscription.metadata?.plan, priceId);

  if (!plan) {
    log("warn", "Could not resolve plan for subscription update — skipping", {
      subscription_id: subscription.id,
      metadata: subscription.metadata as Record<string, unknown>,
      price_id: priceId,
    });
    return;
  }

  const { error } = await supabaseAdmin
    .from("subscriptions")
    .update({
      plan,
      status: subscription.status,
      seats_allowed: PLAN_SEATS[plan] || 5,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
    })
    .eq("stripe_subscription_id", subscription.id);

  if (error) {
    log("error", "Failed to update subscription", {
      subscription_id: subscription.id,
      error: String(error),
    });
  } else {
    log("info", "Subscription updated successfully", {
      subscription_id: subscription.id,
      plan,
      status: subscription.status,
      seats_allowed: PLAN_SEATS[plan] || 5,
      cancel_at_period_end: subscription.cancel_at_period_end,
    });
  }
}

// ============================================================================
// HANDLER: customer.subscription.deleted
// ============================================================================
// Marks subscription as canceled. Does NOT delete the user or row.
// ============================================================================
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  log("info", "Processing customer.subscription.deleted", {
    subscription_id: subscription.id,
  });

  const { error } = await supabaseAdmin
    .from("subscriptions")
    .update({
      status: "canceled",
      cancel_at_period_end: false,
    })
    .eq("stripe_subscription_id", subscription.id);

  if (error) {
    log("error", "Failed to cancel subscription record", {
      subscription_id: subscription.id,
      error: String(error),
    });
  } else {
    log("info", "Subscription marked as canceled", {
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

  // Only accept POST
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ---- VERIFY WEBHOOK SIGNATURE ----
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    log("error", "Missing stripe-signature header");
    return new Response(JSON.stringify({ error: "Missing signature" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!STRIPE_WEBHOOK_SECRET) {
    log("error", "STRIPE_WEBHOOK_SECRET not configured in environment");
    return new Response(JSON.stringify({ error: "Webhook secret not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Read raw body for signature verification
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

  log("info", "Webhook event received and verified", {
    event_id: event.id,
    event_type: event.type,
  });

  // ---- ROUTE TO HANDLER ----
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
        log("info", "Unhandled event type — acknowledging", { event_type: event.type });
    }
  } catch (err) {
    log("error", "Unhandled exception processing webhook event", {
      event_id: event.id,
      event_type: event.type,
      error: String(err),
    });
    // Return 200 to prevent Stripe from retrying and causing duplicate processing
    // The error is logged for investigation
  }

  // Always return 200 to acknowledge receipt
  return new Response(
    JSON.stringify({ received: true, event_type: event.type }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
