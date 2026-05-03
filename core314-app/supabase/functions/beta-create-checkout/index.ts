import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// =============================================================================
// BETA CREATE CHECKOUT
// Creates a Stripe Checkout Session for a beta tester with:
// - 50% off coupon for 6 months
// - trial_end set to Day 46 (so no charge until beta period ends)
// - Command Center plan ($799/mo → $399.50/mo)
//
// Can be called:
// 1. By admin from Beta Operations UI (POST with user_id)
// 2. Via direct link from email (GET with user_id query param)
// =============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

const COUPON_ID = 'beta-tester-50-off-6mo';
const APP_URL = 'https://app.core314.com';

// =============================================================================
// STRIPE HELPERS
// =============================================================================

async function stripeRequest(
  endpoint: string,
  method: string,
  body?: URLSearchParams,
): Promise<{ ok: boolean; data?: Record<string, unknown>; error?: string }> {
  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');

  if (!stripeSecretKey) {
    return { ok: false, error: 'STRIPE_SECRET_KEY not configured' };
  }

  try {
    const response = await fetch(`https://api.stripe.com/v1${endpoint}`, {
      method,
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body?.toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      return { ok: false, error: data.error?.message || `Stripe error ${response.status}` };
    }

    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function ensureCouponExists(): Promise<{ ok: boolean; error?: string }> {
  // Check if coupon already exists
  const existing = await stripeRequest(`/coupons/${COUPON_ID}`, 'GET');

  if (existing.ok) {
    console.log('[CHECKOUT] Coupon already exists:', COUPON_ID);
    return { ok: true };
  }

  // Create the coupon
  console.log('[CHECKOUT] Creating coupon:', COUPON_ID);
  const params = new URLSearchParams();
  params.append('id', COUPON_ID);
  params.append('percent_off', '50');
  params.append('duration', 'repeating');
  params.append('duration_in_months', '6');
  params.append('name', 'Beta Tester 50% Off 6 Months');

  const result = await stripeRequest('/coupons', 'POST', params);

  if (!result.ok) {
    console.error('[CHECKOUT] Failed to create coupon:', result.error);
    return { ok: false, error: result.error };
  }

  console.log('[CHECKOUT] Coupon created successfully');
  return { ok: true };
}

async function getOrCreateStripeCustomer(
  email: string,
  name: string,
  userId: string,
): Promise<{ ok: boolean; customerId?: string; error?: string }> {
  // Search for existing customer by email
  const searchParams = new URLSearchParams();
  searchParams.append('query', `email:"${email}"`);
  searchParams.append('limit', '1');

  const searchResult = await stripeRequest('/customers/search', 'GET');

  // If search fails or no results, create a new customer
  const listParams = new URLSearchParams();
  listParams.append('email', email);
  listParams.append('limit', '1');

  const listResult = await stripeRequest(`/customers?${listParams.toString()}`, 'GET');

  if (listResult.ok && listResult.data) {
    const customers = listResult.data as { data?: Array<{ id: string }> };
    if (customers.data && customers.data.length > 0) {
      console.log('[CHECKOUT] Found existing customer:', customers.data[0].id);
      return { ok: true, customerId: customers.data[0].id };
    }
  }

  // Create new customer
  const createParams = new URLSearchParams();
  createParams.append('email', email);
  createParams.append('name', name);
  createParams.append('metadata[core314_user_id]', userId);
  createParams.append('metadata[source]', 'beta_tester_conversion');

  const createResult = await stripeRequest('/customers', 'POST', createParams);

  if (!createResult.ok) {
    return { ok: false, error: createResult.error };
  }

  const customerId = (createResult.data as { id: string }).id;
  console.log('[CHECKOUT] Created new customer:', customerId);
  return { ok: true, customerId };
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

serve(async (req) => {
  const requestId = crypto.randomUUID().substring(0, 8);
  const log = (step: string, data?: unknown) =>
    console.log(`[${requestId}] ${step}`, data ? JSON.stringify(data) : '');

  log('FUNCTION_ENTRY', { method: req.method });

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const stripePriceId = Deno.env.get('STRIPE_COMMAND_CENTER_PRICE_ID');

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!stripePriceId) {
      return new Response(
        JSON.stringify({ error: 'STRIPE_COMMAND_CENTER_PRICE_ID not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user_id from query params (GET) or body (POST)
    let userId: string | null = null;

    if (req.method === 'GET') {
      const url = new URL(req.url);
      userId = url.searchParams.get('user_id');
    } else if (req.method === 'POST') {
      const body = await req.json();
      userId = body.user_id;
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'user_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    log('USER_ID', { userId });

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      log('PROFILE_NOT_FOUND', { error: profileError?.message });
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get lifecycle record
    const { data: lifecycle, error: lifecycleError } = await supabase
      .from('beta_tester_lifecycle')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (lifecycleError || !lifecycle) {
      log('LIFECYCLE_NOT_FOUND', { error: lifecycleError?.message });
      return new Response(
        JSON.stringify({ error: 'Beta lifecycle record not found. User must be an approved beta tester.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If already has a subscription, redirect to billing
    if (lifecycle.stripe_subscription_id) {
      log('ALREADY_CONVERTED', { subscription: lifecycle.stripe_subscription_id });

      if (req.method === 'GET') {
        return new Response(null, {
          status: 302,
          headers: { ...corsHeaders, 'Location': `${APP_URL}/billing?already_subscribed=true` },
        });
      }

      return new Response(
        JSON.stringify({ error: 'User already has an active subscription', redirect: `${APP_URL}/billing` }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Ensure coupon exists in Stripe
    const couponResult = await ensureCouponExists();
    if (!couponResult.ok) {
      log('COUPON_ERROR', { error: couponResult.error });
      return new Response(
        JSON.stringify({ error: 'Failed to set up discount coupon', details: couponResult.error }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get or create Stripe customer
    const customerResult = await getOrCreateStripeCustomer(
      profile.email,
      profile.full_name || profile.email,
      userId,
    );

    if (!customerResult.ok || !customerResult.customerId) {
      log('CUSTOMER_ERROR', { error: customerResult.error });
      return new Response(
        JSON.stringify({ error: 'Failed to set up payment account', details: customerResult.error }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate trial_end (Day 46 from first login, or 8 days from now if Day 38)
    let trialEndTimestamp: number;

    if (lifecycle.first_login_at) {
      const firstLogin = new Date(lifecycle.first_login_at);
      const totalDays = 45 + (lifecycle.extension_days || 0);
      const day46 = new Date(firstLogin.getTime() + (totalDays + 1) * 24 * 60 * 60 * 1000);

      // Ensure trial_end is at least 48 hours in the future (Stripe requirement)
      const minTrialEnd = new Date(Date.now() + 48 * 60 * 60 * 1000);
      trialEndTimestamp = Math.max(
        Math.floor(day46.getTime() / 1000),
        Math.floor(minTrialEnd.getTime() / 1000),
      );
    } else {
      // No first login yet — set trial to 46 days from now
      trialEndTimestamp = Math.floor(Date.now() / 1000) + 46 * 24 * 60 * 60;
    }

    log('TRIAL_END', { trialEndTimestamp, date: new Date(trialEndTimestamp * 1000).toISOString() });

    // Create Stripe Checkout Session
    const checkoutParams = new URLSearchParams();
    checkoutParams.append('mode', 'subscription');
    checkoutParams.append('customer', customerResult.customerId);
    checkoutParams.append('line_items[0][price]', stripePriceId);
    checkoutParams.append('line_items[0][quantity]', '1');
    checkoutParams.append('discounts[0][coupon]', COUPON_ID);
    checkoutParams.append('subscription_data[trial_end]', trialEndTimestamp.toString());
    checkoutParams.append('subscription_data[metadata][beta_tester]', 'true');
    checkoutParams.append('subscription_data[metadata][core314_user_id]', userId);
    checkoutParams.append('subscription_data[metadata][lifecycle_id]', lifecycle.id);
    checkoutParams.append('success_url', `${APP_URL}/billing?beta_converted=true`);
    checkoutParams.append('cancel_url', `${APP_URL}/billing?beta_conversion=canceled`);
    checkoutParams.append('metadata[core314_user_id]', userId);
    checkoutParams.append('metadata[lifecycle_id]', lifecycle.id);
    checkoutParams.append('metadata[type]', 'beta_conversion');

    const checkoutResult = await stripeRequest('/checkout/sessions', 'POST', checkoutParams);

    if (!checkoutResult.ok || !checkoutResult.data) {
      log('CHECKOUT_ERROR', { error: checkoutResult.error });
      return new Response(
        JSON.stringify({ error: 'Failed to create checkout session', details: checkoutResult.error }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const sessionData = checkoutResult.data as { id: string; url: string };
    const checkoutUrl = sessionData.url;

    log('CHECKOUT_CREATED', { sessionId: sessionData.id, url: checkoutUrl });

    // Update lifecycle record with checkout info
    await supabase
      .from('beta_tester_lifecycle')
      .update({
        stripe_customer_id: customerResult.customerId,
        checkout_session_id: sessionData.id,
        checkout_url: checkoutUrl,
        lifecycle_status: lifecycle.lifecycle_status === 'completed' ? 'converting' : lifecycle.lifecycle_status,
      })
      .eq('id', lifecycle.id);

    // If GET request (from email link), redirect to Stripe Checkout
    if (req.method === 'GET') {
      return new Response(null, {
        status: 302,
        headers: { ...corsHeaders, 'Location': checkoutUrl },
      });
    }

    // POST request (from admin UI), return the URL
    return new Response(
      JSON.stringify({
        success: true,
        checkout_url: checkoutUrl,
        checkout_session_id: sessionData.id,
        customer_id: customerResult.customerId,
        trial_end: new Date(trialEndTimestamp * 1000).toISOString(),
        request_id: requestId,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log('UNEXPECTED_ERROR', { error: errorMsg });
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred', details: errorMsg, request_id: requestId }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
