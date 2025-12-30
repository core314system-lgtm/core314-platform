import { Handler } from '@netlify/functions';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
});

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// =============================================================================
// PRICE CLASSIFICATION - SINGLE SOURCE OF TRUTH
// Strictly separates base plan prices from add-on prices.
// Add-on purchases must NEVER modify base plan fields (subscription_tier, subscription_status).
// =============================================================================

type PriceKind = 'base' | 'addon' | 'unknown';

// Base plan prices (used in plan checkout)
const BASE_PLAN_PRICE_IDS = [
  process.env.VITE_STRIPE_PRICE_STARTER,
  process.env.VITE_STRIPE_PRICE_PRO,
  process.env.VITE_STRIPE_PRICE_ENTERPRISE,
].filter(Boolean) as string[];

// Add-on prices (used in create-addon-checkout)
const ADDON_PRICE_IDS = [
  process.env.STRIPE_PRICE_DATA_EXPORT,
  process.env.STRIPE_PRICE_PREMIUM_ANALYTICS,
  process.env.STRIPE_PRICE_ADVANCED_FUSION_AI,
  process.env.STRIPE_PRICE_ADDITIONAL_INTEGRATION_PRO,
].filter(Boolean) as string[];

// Classify a Stripe price ID
function classifyPrice(priceId?: string | null): PriceKind {
  if (!priceId) return 'unknown';
  if (BASE_PLAN_PRICE_IDS.includes(priceId)) return 'base';
  if (ADDON_PRICE_IDS.includes(priceId)) return 'addon';
  return 'unknown';
}

// Map base plan price IDs to tier names
const BASE_PLAN_TIER_MAP: Record<string, 'starter' | 'professional' | 'enterprise'> = {
  [process.env.VITE_STRIPE_PRICE_STARTER!]: 'starter',
  [process.env.VITE_STRIPE_PRICE_PRO!]: 'professional',
  [process.env.VITE_STRIPE_PRICE_ENTERPRISE!]: 'enterprise',
};

// =============================================================================
// WEBHOOK HANDLER
// =============================================================================

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const sig = event.headers['stripe-signature'];
  if (!sig) {
    return { statusCode: 400, body: 'No signature' };
  }

  try {
    const stripeEvent = stripe.webhooks.constructEvent(
      event.body!,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );

    switch (stripeEvent.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(stripeEvent.data.object as Stripe.Checkout.Session);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(stripeEvent.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(stripeEvent.data.object as Stripe.Subscription);
        break;
      case 'invoice.payment_failed':
        await handlePaymentFailed(stripeEvent.data.object as Stripe.Invoice);
        break;
    }

    return { statusCode: 200, body: JSON.stringify({ received: true }) };
  } catch (err) {
    console.error('Webhook error:', err);
    return {
      statusCode: 400,
      body: `Webhook Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
    };
  }
};

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;
  const customerEmail = session.customer_email;
  const metadata = session.metadata || {};

  // Retrieve subscription to get price ID for classification
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const priceId = subscription.items.data[0]?.price?.id;
  const priceKind = classifyPrice(priceId);

  // ==========================================================================
  // GUARD: Route add-on purchases to dedicated handler
  // Check BOTH price classification AND metadata for maximum safety
  // ==========================================================================
  if (priceKind === 'addon' || metadata.kind === 'addon') {
    console.log(`[CHECKOUT] Add-on detected (priceKind=${priceKind}, metadata.kind=${metadata.kind}), routing to addon handler`);
    await handleAddonCheckoutCompleted(session);
    return;
  }

  // ==========================================================================
  // GUARD: Unknown price - do NOT modify base plan fields
  // ==========================================================================
  if (priceKind === 'unknown') {
    console.log(`[CHECKOUT] Unknown price ${priceId} - not modifying base plan fields`);
    return;
  }

  // ==========================================================================
  // BASE PLAN HANDLING: Only base plan prices reach this point
  // ==========================================================================
  const tier = BASE_PLAN_TIER_MAP[priceId!];
  console.log(`[CHECKOUT] Base plan checkout completed: tier=${tier}, priceId=${priceId}`);

  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', customerEmail)
    .single();

  if (existingProfile) {
    await supabase
      .from('profiles')
      .update({
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        subscription_tier: tier,
        subscription_status: subscription.status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingProfile.id);
  }

  await supabase.from('subscription_history').insert({
    user_id: existingProfile?.id,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
    event_type: 'checkout_completed',
    new_tier: tier,
    new_status: subscription.status,
  });
}

// Handle addon purchase checkout completion
async function handleAddonCheckoutCompleted(session: Stripe.Checkout.Session) {
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;
  const metadata = session.metadata || {};

  const addonName = metadata.addon_name;
  const addonCategory = metadata.addon_category;
  const userId = metadata.user_id;

  if (!addonName || !userId) {
    console.error('Missing addon metadata:', { addonName, userId });
    return;
  }

  // Retrieve the subscription to get the price ID
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const priceId = subscription.items.data[0].price.id;

  // Check if this addon already exists for this user (idempotency)
  const { data: existingAddon } = await supabase
    .from('user_addons')
    .select('id')
    .eq('user_id', userId)
    .eq('addon_name', addonName)
    .eq('status', 'active')
    .maybeSingle();

  if (existingAddon) {
    // Addon already active, update the subscription ID if different
    await supabase
      .from('user_addons')
      .update({
        stripe_subscription_id: subscriptionId,
        stripe_price_id: priceId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingAddon.id);
    
    console.log(`Addon ${addonName} already active for user ${userId}, updated subscription ID`);
    return;
  }

  // Check if there's a canceled/expired addon to reactivate
  const { data: inactiveAddon } = await supabase
    .from('user_addons')
    .select('id')
    .eq('user_id', userId)
    .eq('addon_name', addonName)
    .in('status', ['canceled', 'expired'])
    .maybeSingle();

  if (inactiveAddon) {
    // Reactivate the existing addon
    await supabase
      .from('user_addons')
      .update({
        status: 'active',
        stripe_subscription_id: subscriptionId,
        stripe_price_id: priceId,
        activated_at: new Date().toISOString(),
        expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', inactiveAddon.id);
    
    console.log(`Reactivated addon ${addonName} for user ${userId}`);
    return;
  }

  // Create new addon entitlement
  const { error: insertError } = await supabase
    .from('user_addons')
    .insert({
      user_id: userId,
      addon_name: addonName,
      addon_category: addonCategory || 'custom',
      stripe_price_id: priceId,
      stripe_subscription_id: subscriptionId,
      status: 'active',
      activated_at: new Date().toISOString(),
      metadata: {
        stripe_customer_id: customerId,
        org_id: metadata.org_id || null,
      },
    });

  if (insertError) {
    console.error('Error inserting addon entitlement:', insertError);
    throw insertError;
  }

  console.log(`Created addon entitlement: ${addonName} for user ${userId}`);
}

// Tier ranking for upgrade/downgrade detection
const TIER_RANK: Record<string, number> = {
  none: 0,
  starter: 1,
  professional: 2,
  enterprise: 3,
};

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  const priceId = subscription.items.data[0]?.price?.id;
  const priceKind = classifyPrice(priceId);

  // ==========================================================================
  // GUARD: Add-on subscriptions must NOT modify base plan fields
  // ==========================================================================
  if (priceKind === 'addon') {
    console.log(`[SUB_UPDATED] Add-on subscription ${subscription.id} updated (priceId=${priceId}) - NOT modifying base plan`);
    // Update user_addons status if subscription status changed (e.g., to canceled)
    if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
      await supabase
        .from('user_addons')
        .update({
          status: 'canceled',
          expires_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_subscription_id', subscription.id);
      console.log(`[SUB_UPDATED] Marked addon subscription ${subscription.id} as canceled in user_addons`);
    }
    return;
  }

  // ==========================================================================
  // GUARD: Unknown price - do NOT modify base plan fields
  // ==========================================================================
  if (priceKind === 'unknown') {
    console.log(`[SUB_UPDATED] Unknown price ${priceId} on subscription ${subscription.id} - not modifying base plan fields`);
    return;
  }

  // ==========================================================================
  // BASE PLAN HANDLING: Only base plan prices reach this point
  // Phase 13.2: Detect upgrade/downgrade and handle gracefully
  // ==========================================================================
  const newTier = BASE_PLAN_TIER_MAP[priceId!];
  
  // Get current profile to detect upgrade/downgrade
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, subscription_tier, subscription_status')
    .eq('stripe_customer_id', customerId)
    .single();

  const oldTier = profile?.subscription_tier || 'none';
  const oldRank = TIER_RANK[oldTier] || 0;
  const newRank = TIER_RANK[newTier] || 0;

  // Determine lifecycle event type
  let lifecycleEvent: string | null = null;
  if (newRank > oldRank) {
    lifecycleEvent = 'upgrade';
    console.log(`[SUB_UPDATED] UPGRADE detected: ${oldTier} -> ${newTier}`);
  } else if (newRank < oldRank) {
    lifecycleEvent = 'downgrade';
    console.log(`[SUB_UPDATED] DOWNGRADE detected: ${oldTier} -> ${newTier}`);
    
    // Phase 13.2: Use graceful downgrade handler
    // No data loss, no intelligence corruption, no Fusion Score reset
    if (profile?.id) {
      const periodEnd = subscription.current_period_end 
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : null;
      
      await supabase.rpc('handle_subscription_downgrade', {
        p_user_id: profile.id,
        p_old_tier: oldTier,
        p_new_tier: newTier,
        p_period_end_at: periodEnd,
      });
    }
  } else {
    console.log(`[SUB_UPDATED] Base plan subscription updated (same tier): tier=${newTier}, status=${subscription.status}`);
  }

  // Update profile with new tier and status
  await supabase
    .from('profiles')
    .update({
      subscription_tier: newTier,
      subscription_status: subscription.status,
      stripe_price_id: priceId,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_customer_id', customerId);

  // Sync to entitlements (Phase 13.1)
  if (profile?.id) {
    await supabase.rpc('sync_stripe_to_entitlements', {
      p_user_id: profile.id,
      p_subscription_tier: newTier,
      p_subscription_status: subscription.status,
    });
  }

  // Log subscription history with lifecycle event
  await supabase.from('subscription_history').insert({
    user_id: profile?.id,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    event_type: 'subscription_updated',
    lifecycle_event: lifecycleEvent,
    previous_tier: oldTier,
    new_tier: newTier,
    new_status: subscription.status,
  });
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  const priceId = subscription.items.data[0]?.price?.id;
  const priceKind = classifyPrice(priceId);

  // ==========================================================================
  // GUARD: Add-on subscription cancellation must NOT modify base plan
  // ==========================================================================
  if (priceKind === 'addon') {
    console.log(`[SUB_DELETED] Add-on subscription ${subscription.id} deleted (priceId=${priceId}) - NOT modifying base plan`);
    // Mark the add-on entitlement as canceled in user_addons
    await supabase
      .from('user_addons')
      .update({
        status: 'canceled',
        expires_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_subscription_id', subscription.id);
    console.log(`[SUB_DELETED] Marked addon subscription ${subscription.id} as canceled in user_addons`);
    return;
  }

  // ==========================================================================
  // GUARD: Unknown price - do NOT modify base plan fields
  // ==========================================================================
  if (priceKind === 'unknown') {
    console.log(`[SUB_DELETED] Unknown price ${priceId} on subscription ${subscription.id} - not modifying base plan fields`);
    return;
  }

  // ==========================================================================
  // BASE PLAN HANDLING: Only base plan prices reach this point
  // Phase 13.2: Use graceful cancellation handler
  // Freeze entitlements at current state until period end
  // ==========================================================================
  const currentTier = BASE_PLAN_TIER_MAP[priceId!] || 'starter';
  console.log(`[SUB_DELETED] Base plan subscription deleted: tier=${currentTier}, priceId=${priceId}`);

  // Get profile for cancellation handling
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, subscription_tier')
    .eq('stripe_customer_id', customerId)
    .single();

  if (profile?.id) {
    // Calculate period end (subscription already deleted, use current time + grace period)
    const periodEnd = subscription.current_period_end 
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : new Date().toISOString();

    // Phase 13.2: Use graceful cancellation handler
    // This freezes entitlements at current state until period end
    await supabase.rpc('handle_subscription_cancellation', {
      p_user_id: profile.id,
      p_current_tier: profile.subscription_tier || currentTier,
      p_period_end_at: periodEnd,
    });
  } else {
    // Fallback: just update status if profile not found
    await supabase
      .from('profiles')
      .update({
        subscription_status: 'canceled',
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_customer_id', customerId);
  }

  // Log subscription history with lifecycle event
  await supabase.from('subscription_history').insert({
    user_id: profile?.id,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    event_type: 'subscription_deleted',
    lifecycle_event: 'cancel',
    previous_tier: profile?.subscription_tier,
    new_status: 'canceled',
    period_end_at: subscription.current_period_end 
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null,
  });
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;
  const subscriptionId = invoice.subscription as string | null;

  // ==========================================================================
  // GUARD: Check if this is an add-on subscription payment failure
  // Add-on payment failures must NOT mark the base plan as past_due
  // ==========================================================================
  if (subscriptionId) {
    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const priceId = subscription.items.data[0]?.price?.id;
      const priceKind = classifyPrice(priceId);

      if (priceKind === 'addon') {
        console.log(`[PAYMENT_FAILED] Add-on subscription ${subscriptionId} payment failed - NOT marking base plan as past_due`);
        // Optionally update user_addons status here in the future
        return;
      }

      if (priceKind === 'unknown') {
        console.log(`[PAYMENT_FAILED] Unknown price ${priceId} on subscription ${subscriptionId} - not modifying base plan status`);
        return;
      }
    } catch (err) {
      console.error(`[PAYMENT_FAILED] Error retrieving subscription ${subscriptionId}:`, err);
      // Fall through to default behavior if we can't determine the subscription type
    }
  }

  // ==========================================================================
  // BASE PLAN HANDLING: Only base plan payment failures reach this point
  // ==========================================================================
  console.log(`[PAYMENT_FAILED] Base plan payment failed for customer ${customerId}`);

  await supabase
    .from('profiles')
    .update({
      subscription_status: 'past_due',
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_customer_id', customerId);
}
