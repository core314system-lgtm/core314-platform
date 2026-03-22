
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

// ============================================================================
// STRIPE CREATE CHECKOUT SESSION
// ============================================================================
// Creates a Stripe Checkout session for subscription purchases.
// Supports TWO modes:
//   1. Authenticated (app) — JWT in Authorization header → customer get-or-create
//   2. Unauthenticated (landing page) — no auth → Stripe collects email at checkout
// - Maps plan → price ID
// - Returns checkout URL
// ============================================================================

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ||
  Deno.env.get("CORE314_STRIPE_SECRET_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || Deno.env.get("CORE314_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
  Deno.env.get("CORE314_SERVICE_KEY") || "";

const APP_URL = Deno.env.get("APP_URL") || "https://app.core314.com";

// ============================================================================
// PLAN → PRICE ID MAPPING (Stripe prices)
// ============================================================================
const PLAN_PRICE_MAP: Record<string, string> = {
  intelligence: "price_1TDmVlRvffecbIr9Gm8itXZw",
  command_center: "price_1TDmXnRvffecbIr9UUJpP5H8",
};

const VALID_PLANS = Object.keys(PLAN_PRICE_MAP);

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ============================================================================
// HELPERS
// ============================================================================

function jsonError(message: string, status: number, detail?: string): Response {
  return new Response(
    JSON.stringify({ error: message, detail: detail || null }),
    {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

function jsonSuccess(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ============================================================================
// GET OR CREATE STRIPE CUSTOMER
// ============================================================================

async function getOrCreateStripeCustomer(
  userId: string,
  email: string
): Promise<string> {
  // 1. Check subscriptions table for existing customer
  const { data: existingSub } = await supabaseAdmin
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existingSub?.stripe_customer_id) {
    console.log(`✅ Found existing Stripe customer: ${existingSub.stripe_customer_id}`);
    return existingSub.stripe_customer_id;
  }

  // 2. Also check profiles table (legacy path)
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", userId)
    .maybeSingle();

  if (profile?.stripe_customer_id) {
    console.log(`✅ Found Stripe customer in profiles: ${profile.stripe_customer_id}`);
    return profile.stripe_customer_id;
  }

  // 3. Search Stripe by email to avoid duplicates
  const existingCustomers = await stripe.customers.list({
    email,
    limit: 1,
  });

  if (existingCustomers.data.length > 0) {
    const customerId = existingCustomers.data[0].id;
    console.log(`✅ Found existing Stripe customer by email: ${customerId}`);

    // Store in profiles for future lookups
    await supabaseAdmin
      .from("profiles")
      .update({ stripe_customer_id: customerId })
      .eq("id", userId);

    return customerId;
  }

  // 4. Create new Stripe customer
  const customer = await stripe.customers.create({
    email,
    metadata: {
      supabase_user_id: userId,
    },
  });

  console.log(`✅ Created new Stripe customer: ${customer.id}`);

  // Store in profiles for future lookups
  await supabaseAdmin
    .from("profiles")
    .update({ stripe_customer_id: customer.id })
    .eq("id", userId);

  return customer.id;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonError("Method not allowed", 405);
  }

  try {
    // ---- PARSE + VALIDATE REQUEST ----
    const body = await req.json();
    const { plan } = body;

    if (!plan || !VALID_PLANS.includes(plan)) {
      return jsonError(
        "Invalid plan",
        400,
        `Plan must be one of: ${VALID_PLANS.join(", ")}`
      );
    }

    const priceId = PLAN_PRICE_MAP[plan];
    if (!priceId) {
      return jsonError("Price not configured for this plan", 500);
    }

    // ---- AUTH: Optional — check for authenticated user ----
    const authHeader = req.headers.get("authorization");
    let userId: string | null = null;
    let userEmail: string | null = null;
    let customerId: string | undefined = undefined;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");

      // Create a user-scoped client to verify the token
      const supabaseUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") || "", {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });

      const {
        data: { user },
        error: authError,
      } = await supabaseUser.auth.getUser(token);

      if (!authError && user) {
        userId = user.id;
        userEmail = user.email || null;

        // Authenticated path: get or create Stripe customer
        customerId = await getOrCreateStripeCustomer(user.id, user.email || "");
      }
      // If auth fails, fall through to unauthenticated path (no error)
    }

    // ---- BUILD CHECKOUT SESSION PARAMS ----
    const LANDING_URL = Deno.env.get("LANDING_URL") || "https://core314.com";

    // deno-lint-ignore no-explicit-any
    const sessionParams: Record<string, any> = {
      mode: "subscription",
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      allow_promotion_codes: true,
      metadata: {
        plan: plan,
        source: userId ? "core314_app" : "core314_landing",
      },
      subscription_data: {
        metadata: {
          plan: plan,
        },
      },
    };

    if (customerId) {
      // Authenticated: attach existing customer, redirect back to app
      sessionParams.customer = customerId;
      sessionParams.success_url = `${APP_URL}/billing?session_id={CHECKOUT_SESSION_ID}&status=success`;
      sessionParams.cancel_url = `${APP_URL}/billing?status=canceled`;
      sessionParams.metadata.user_id = userId;
      sessionParams.subscription_data.metadata.user_id = userId;
    } else {
      // Unauthenticated (landing page): let Stripe collect email
      sessionParams.success_url = `${APP_URL}/billing?session_id={CHECKOUT_SESSION_ID}&status=success`;
      sessionParams.cancel_url = `${LANDING_URL}/pricing?status=canceled`;
    }

    // ---- CREATE CHECKOUT SESSION ----
    const session = await stripe.checkout.sessions.create(sessionParams);

    console.log(
      `✅ Checkout session created: ${session.id} plan=${plan} authenticated=${!!userId}`
    );

    // ---- RETURN SESSION URL ----
    return jsonSuccess({
      url: session.url,
      session_id: session.id,
    });
  } catch (error) {
    console.error("❌ Checkout session error:", error);

    if (error instanceof Stripe.errors.StripeError) {
      return jsonError(
        "Stripe error",
        error.statusCode || 500,
        error.message
      );
    }

    return jsonError(
      "Failed to create checkout session",
      500,
      error instanceof Error ? error.message : "Unknown error"
    );
  }
});
