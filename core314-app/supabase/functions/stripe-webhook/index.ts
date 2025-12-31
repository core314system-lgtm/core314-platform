
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { withSentry, breadcrumb, handleSentryTest, jsonError } from "../_shared/sentry.ts";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || 
                          Deno.env.get("CORE314_STRIPE_SECRET_KEY") || "";
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") || 
                              Deno.env.get("CORE314_STRIPE_WEBHOOK_SECRET") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || Deno.env.get("CORE314_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("CORE314_SERVICE_KEY") || "";

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);


async function verifyWebhookSignature(
  request: Request
): Promise<Stripe.Event | null> {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    console.error("❌ No stripe-signature header found");
    return null;
  }

  try {
    const body = await request.text();
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      STRIPE_WEBHOOK_SECRET
    );
    return event;
  } catch (err) {
    console.error("❌ Webhook signature verification failed:", err.message);
    return null;
  }
}


async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  console.log("📝 Processing subscription.created:", subscription.id);

  const customerId = subscription.customer as string;
  const planName = subscription.items.data[0]?.price?.product 
    ? (await stripe.products.retrieve(subscription.items.data[0].price.product as string)).metadata?.plan_name || "Starter"
    : "Starter";

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .single();

  if (profileError || !profile) {
    console.error("❌ User not found for customer:", customerId);
    return { success: false, error: "User not found" };
  }

  const { error: insertError } = await supabase
    .from("user_subscriptions")
    .insert({
      user_id: profile.id,
      plan_name: planName,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: customerId,
      status: subscription.status,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      metadata: {
        items: subscription.items.data.map(item => ({
          price_id: item.price.id,
          quantity: item.quantity,
        })),
      },
    });

  if (insertError) {
    console.error("❌ Failed to create subscription record:", insertError);
    return { success: false, error: insertError.message };
  }

  const { data: limitsResult, error: limitsError } = await supabase
    .rpc("apply_plan_limits", {
      p_user_id: profile.id,
      p_plan_name: planName,
    });

  if (limitsError) {
    console.error("⚠️ Failed to apply plan limits:", limitsError);
  } else {
    console.log("✅ Plan limits applied:", limitsResult);
  }

  console.log("✅ Subscription created successfully");
  return { success: true, subscription_id: subscription.id };
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  console.log("📝 Processing subscription.updated:", subscription.id);

  const customerId = subscription.customer as string;
  const planName = subscription.items.data[0]?.price?.product 
    ? (await stripe.products.retrieve(subscription.items.data[0].price.product as string)).metadata?.plan_name || "Starter"
    : "Starter";

  const { data: existingSub, error: findError } = await supabase
    .from("user_subscriptions")
    .select("user_id, plan_name")
    .eq("stripe_subscription_id", subscription.id)
    .single();

  if (findError || !existingSub) {
    console.error("❌ Subscription not found:", subscription.id);
    return { success: false, error: "Subscription not found" };
  }

  const oldPlanName = existingSub.plan_name;
  const planChanged = oldPlanName !== planName;

  const { error: updateError } = await supabase
    .from("user_subscriptions")
    .update({
      plan_name: planName,
      status: subscription.status,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
      metadata: {
        items: subscription.items.data.map(item => ({
          price_id: item.price.id,
          quantity: item.quantity,
        })),
      },
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscription.id);

  if (updateError) {
    console.error("❌ Failed to update subscription:", updateError);
    return { success: false, error: updateError.message };
  }

  if (planChanged) {
    console.log(`📊 Plan changed from ${oldPlanName} to ${planName}`);
    const { data: limitsResult, error: limitsError } = await supabase
      .rpc("apply_plan_limits", {
        p_user_id: existingSub.user_id,
        p_plan_name: planName,
      });

    if (limitsError) {
      console.error("⚠️ Failed to apply plan limits:", limitsError);
    } else {
      console.log("✅ Plan limits applied:", limitsResult);
    }
  }

  console.log("✅ Subscription updated successfully");
  return { success: true, subscription_id: subscription.id, plan_changed: planChanged };
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log("📝 Processing subscription.deleted:", subscription.id);

  const { error: updateError } = await supabase
    .from("user_subscriptions")
    .update({
      status: "canceled",
      ended_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscription.id);

  if (updateError) {
    console.error("❌ Failed to mark subscription as canceled:", updateError);
    return { success: false, error: updateError.message };
  }

  const { data: sub, error: findError } = await supabase
    .from("user_subscriptions")
    .select("user_id")
    .eq("stripe_subscription_id", subscription.id)
    .single();

  if (findError || !sub) {
    console.error("❌ Subscription not found:", subscription.id);
    return { success: false, error: "Subscription not found" };
  }

  const { data: limitsResult, error: limitsError } = await supabase
    .rpc("apply_plan_limits", {
      p_user_id: sub.user_id,
      p_plan_name: "Free",
    });

  if (limitsError) {
    console.error("⚠️ Failed to apply Free plan limits:", limitsError);
  } else {
    console.log("✅ Downgraded to Free plan:", limitsResult);
  }

  console.log("✅ Subscription deleted successfully");
  return { success: true, subscription_id: subscription.id };
}


async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  console.log("📝 Processing invoice.payment_succeeded:", invoice.id);

  const subscriptionId = invoice.subscription as string;
  if (!subscriptionId) {
    console.log("ℹ️ Invoice not associated with subscription, skipping");
    return { success: true, skipped: true };
  }

  const { error: updateError } = await supabase
    .from("user_subscriptions")
    .update({
      status: "active",
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscriptionId)
    .in("status", ["incomplete", "past_due"]);

  if (updateError) {
    console.error("❌ Failed to update subscription status:", updateError);
    return { success: false, error: updateError.message };
  }

  console.log("✅ Invoice payment processed successfully");
  return { success: true, invoice_id: invoice.id };
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  console.log("📝 Processing invoice.payment_failed:", invoice.id);

  const subscriptionId = invoice.subscription as string;
  if (!subscriptionId) {
    console.log("ℹ️ Invoice not associated with subscription, skipping");
    return { success: true, skipped: true };
  }

  const { error: updateError } = await supabase
    .from("user_subscriptions")
    .update({
      status: "past_due",
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscriptionId);

  if (updateError) {
    console.error("❌ Failed to update subscription status:", updateError);
    return { success: false, error: updateError.message };
  }

  console.log("✅ Invoice payment failure processed");
  return { success: true, invoice_id: invoice.id };
}


async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  console.log("📝 Processing checkout.session.completed:", session.id);

  const metadata = session.metadata || {};
  const addonType = metadata.addon_type || metadata.type;
  const userId = metadata.user_id;

  if (!addonType || !userId || addonType !== 'addon') {
    console.log("ℹ️ Not an add-on purchase, skipping");
    return { success: true, skipped: true };
  }

  const addonName = metadata.addon_name;
  const addonCategory = metadata.addon_category;

  if (!addonName || !addonCategory) {
    console.error("❌ Missing addon_name or addon_category in metadata");
    return { success: false, error: "Missing required metadata" };
  }

  const { error: insertError } = await supabase
    .from("user_addons")
    .insert({
      user_id: userId,
      addon_name: addonName,
      addon_category: addonCategory,
      stripe_price_id: metadata.price_id,
      stripe_subscription_id: session.subscription as string,
      status: "active",
      activated_at: new Date().toISOString(),
      metadata: {
        session_id: session.id,
        customer_id: session.customer,
        amount_total: session.amount_total,
        currency: session.currency,
      },
    });

  if (insertError) {
    console.error("❌ Failed to create add-on record:", insertError);
    return { success: false, error: insertError.message };
  }

  console.log("✅ Add-on purchase recorded successfully");
  return { success: true, addon_type: addonName };
}


serve(withSentry(async (req) => {
  const testResponse = await handleSentryTest(req);
  if (testResponse) return testResponse;

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

  try {
    const event = await verifyWebhookSignature(req);
    if (!event) {
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`🔔 Webhook received: ${event.type}`);

    let result;

    switch (event.type) {
      case "customer.subscription.created":
        result = await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.updated":
        result = await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.deleted":
        result = await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case "invoice.payment_succeeded":
        result = await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case "invoice.payment_failed":
        result = await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case "checkout.session.completed":
        result = await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      default:
        console.log(`ℹ️ Unhandled event type: ${event.type}`);
        result = { success: true, skipped: true, reason: "Event type not handled" };
    }

    return new Response(
      JSON.stringify({
        received: true,
        event_type: event.type,
        result,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("❌ Webhook processing error:", error);
    return new Response(
      JSON.stringify({
        error: "Webhook processing failed",
        message: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}, { name: "stripe-webhook" }));
