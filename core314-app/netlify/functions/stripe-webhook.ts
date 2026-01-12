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
// KILL SWITCH CHECK
// Phase 15.2: Check if Stripe billing is enabled before processing webhooks
// =============================================================================

async function isStripeBillingEnabled(): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('system_control_flags')
      .select('enabled')
      .eq('key', 'stripe_billing_enabled')
      .single();
    
    if (error) {
      // If table doesn't exist or flag not found, default to enabled
      console.log('[KILL_SWITCH] Could not check stripe_billing_enabled flag, defaulting to enabled');
      return true;
    }
    
    return data?.enabled ?? true;
  } catch (err) {
    console.error('[KILL_SWITCH] Error checking stripe_billing_enabled:', err);
    return true; // Default to enabled on error
  }
}

// =============================================================================
// LAUNCH EVENT LOGGING
// Phase 15.3: Log conversion funnel events
// =============================================================================

async function logLaunchEvent(userId: string, eventType: string, metadata: Record<string, unknown> = {}): Promise<void> {
  try {
    await supabase.rpc('log_launch_event', {
      p_user_id: userId,
      p_event_type: eventType,
      p_metadata: metadata,
    });
    console.log(`[LAUNCH_EVENT] Logged ${eventType} for user ${userId}`);
  } catch (err) {
    // Non-fatal: log but don't fail the webhook
    console.error(`[LAUNCH_EVENT] Failed to log ${eventType}:`, err);
  }
}

// =============================================================================
// TIER-0: WEBHOOK IDEMPOTENCY & LOGGING
// Prevents duplicate processing and provides audit trail
// =============================================================================

async function isEventAlreadyProcessed(eventId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('is_webhook_event_processed', {
      p_event_id: eventId,
    });
    if (error) {
      console.log(`[IDEMPOTENCY] Could not check event ${eventId}, proceeding with processing`);
      return false;
    }
    return data === true;
  } catch (err) {
    console.error(`[IDEMPOTENCY] Error checking event ${eventId}:`, err);
    return false;
  }
}

async function logWebhookEvent(
  eventId: string,
  eventType: string,
  customerId?: string,
  subscriptionId?: string,
  userId?: string,
  status: 'pending' | 'processing' | 'success' | 'failed' | 'skipped' = 'pending',
  errorMessage?: string,
  eventData?: Record<string, unknown>
): Promise<void> {
  try {
    await supabase.rpc('log_webhook_event', {
      p_event_id: eventId,
      p_event_type: eventType,
      p_customer_id: customerId || null,
      p_subscription_id: subscriptionId || null,
      p_user_id: userId || null,
      p_status: status,
      p_error_message: errorMessage || null,
      p_event_data: eventData || null,
    });
    console.log(`[WEBHOOK_LOG] Logged event ${eventId} with status ${status}`);
  } catch (err) {
    // Non-fatal: log but don't fail the webhook
    console.error(`[WEBHOOK_LOG] Failed to log event ${eventId}:`, err);
  }
}

async function updateWebhookEventStatus(
  eventId: string,
  status: 'success' | 'failed' | 'skipped',
  errorMessage?: string,
  userId?: string
): Promise<void> {
  try {
    await supabase.rpc('update_webhook_event_status', {
      p_event_id: eventId,
      p_status: status,
      p_error_message: errorMessage || null,
      p_user_id: userId || null,
    });
  } catch (err) {
    console.error(`[WEBHOOK_LOG] Failed to update event ${eventId} status:`, err);
  }
}

// =============================================================================
// TIER-0: SYNC SUBSCRIPTION TO USER_SUBSCRIPTIONS TABLE
// Ensures both profiles and user_subscriptions are updated consistently
// =============================================================================

async function syncToUserSubscriptions(
  userId: string,
  planName: string,
  stripeSubscriptionId: string,
  stripeCustomerId: string,
  status: string,
  currentPeriodStart: Date,
  currentPeriodEnd: Date,
  trialStart?: Date | null,
  trialEnd?: Date | null
): Promise<void> {
  try {
    await supabase.rpc('sync_subscription_to_user_subscriptions', {
      p_user_id: userId,
      p_plan_name: planName,
      p_stripe_subscription_id: stripeSubscriptionId,
      p_stripe_customer_id: stripeCustomerId,
      p_status: status,
      p_current_period_start: currentPeriodStart.toISOString(),
      p_current_period_end: currentPeriodEnd.toISOString(),
      p_trial_start: trialStart?.toISOString() || null,
      p_trial_end: trialEnd?.toISOString() || null,
    });
    console.log(`[SYNC] Synced subscription ${stripeSubscriptionId} to user_subscriptions for user ${userId}`);
  } catch (err) {
    console.error(`[SYNC] Failed to sync subscription ${stripeSubscriptionId}:`, err);
  }
}

// Map tier names to plan names for user_subscriptions table
const TIER_TO_PLAN_NAME: Record<string, string> = {
  starter: 'Starter',
  professional: 'Pro',
  enterprise: 'Enterprise',
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

  let stripeEvent: Stripe.Event | null = null;

  try {
    // Phase 15.2: Check kill switch before processing
    const billingEnabled = await isStripeBillingEnabled();
    if (!billingEnabled) {
      console.log('[KILL_SWITCH] Stripe billing is disabled, acknowledging webhook but not processing');
      return { 
        statusCode: 200, 
        body: JSON.stringify({ received: true, skipped: true, reason: 'billing_disabled' }) 
      };
    }

    stripeEvent = stripe.webhooks.constructEvent(
      event.body!,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );

    // ==========================================================================
    // TIER-0: IDEMPOTENCY CHECK
    // Prevent duplicate processing of the same event
    // ==========================================================================
    const alreadyProcessed = await isEventAlreadyProcessed(stripeEvent.id);
    if (alreadyProcessed) {
      console.log(`[IDEMPOTENCY] Event ${stripeEvent.id} already processed, skipping`);
      return { 
        statusCode: 200, 
        body: JSON.stringify({ received: true, skipped: true, reason: 'already_processed' }) 
      };
    }

    // Log the event as processing
    await logWebhookEvent(
      stripeEvent.id,
      stripeEvent.type,
      undefined,
      undefined,
      undefined,
      'processing'
    );

    switch (stripeEvent.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(stripeEvent.data.object as Stripe.Checkout.Session, stripeEvent.id);
        break;
      case 'customer.subscription.created':
        await handleSubscriptionCreated(stripeEvent.data.object as Stripe.Subscription, stripeEvent.id);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(stripeEvent.data.object as Stripe.Subscription, stripeEvent.id);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(stripeEvent.data.object as Stripe.Subscription, stripeEvent.id);
        break;
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(stripeEvent.data.object as Stripe.Invoice, stripeEvent.id);
        break;
      case 'invoice.payment_failed':
        await handlePaymentFailed(stripeEvent.data.object as Stripe.Invoice, stripeEvent.id);
        break;
      default:
        console.log(`[WEBHOOK] Unhandled event type: ${stripeEvent.type}`);
        await updateWebhookEventStatus(stripeEvent.id, 'skipped', `Unhandled event type: ${stripeEvent.type}`);
    }

    return { statusCode: 200, body: JSON.stringify({ received: true }) };
  } catch (err) {
    console.error('Webhook error:', err);
    // Log the failure if we have an event ID
    if (stripeEvent?.id) {
      await updateWebhookEventStatus(
        stripeEvent.id, 
        'failed', 
        err instanceof Error ? err.message : 'Unknown error'
      );
    }
    return {
      statusCode: 400,
      body: `Webhook Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
    };
  }
};

async function handleCheckoutCompleted(session: Stripe.Checkout.Session, eventId: string) {
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;
  const customerEmail = session.customer_email;
  const metadata = session.metadata || {};

  // ==========================================================================
  // TIER-0: USER LINKAGE - Prefer client_reference_id over email
  // client_reference_id is set in create-checkout-session.ts and is more reliable
  // ==========================================================================
  const userId = session.client_reference_id || metadata.userId || metadata.user_id;

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
    await updateWebhookEventStatus(eventId, 'success', undefined, userId || undefined);
    return;
  }

  // ==========================================================================
  // GUARD: Unknown price - do NOT modify base plan fields
  // ==========================================================================
  if (priceKind === 'unknown') {
    console.log(`[CHECKOUT] Unknown price ${priceId} - not modifying base plan fields`);
    await updateWebhookEventStatus(eventId, 'skipped', `Unknown price: ${priceId}`);
    return;
  }

  // ==========================================================================
  // BASE PLAN HANDLING: Only base plan prices reach this point
  // ==========================================================================
  const tier = BASE_PLAN_TIER_MAP[priceId!];
  console.log(`[CHECKOUT] Base plan checkout completed: tier=${tier}, priceId=${priceId}, userId=${userId}`);

  // Find user by client_reference_id first, then fall back to email
  let existingProfile: { id: string } | null = null;
  
  if (userId) {
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();
    existingProfile = data;
  }
  
  // Fall back to email lookup if no userId or not found
  if (!existingProfile && customerEmail) {
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', customerEmail)
      .single();
    existingProfile = data;
  }

  if (!existingProfile) {
    console.error(`[CHECKOUT] No profile found for userId=${userId} or email=${customerEmail}`);
    await updateWebhookEventStatus(eventId, 'failed', 'No profile found for user');
    return;
  }

  // ==========================================================================
  // TIER-0: Extract trial timestamps from Stripe subscription
  // ==========================================================================
  const trialStart = subscription.trial_start 
    ? new Date(subscription.trial_start * 1000) 
    : null;
  const trialEnd = subscription.trial_end 
    ? new Date(subscription.trial_end * 1000) 
    : null;
  const currentPeriodStart = new Date(subscription.current_period_start * 1000);
  const currentPeriodEnd = new Date(subscription.current_period_end * 1000);

  // Update profile with subscription data including trial timestamps
  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      subscription_tier: tier,
      subscription_status: subscription.status,
      trial_start: trialStart?.toISOString() || null,
      trial_end: trialEnd?.toISOString() || null,
      current_period_start: currentPeriodStart.toISOString(),
      current_period_end: currentPeriodEnd.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', existingProfile.id);

  if (updateError) {
    console.error(`[CHECKOUT] Failed to update profile:`, updateError);
    await updateWebhookEventStatus(eventId, 'failed', `Profile update failed: ${updateError.message}`, existingProfile.id);
    return;
  }

  // ==========================================================================
  // TIER-0: Sync to user_subscriptions table for consistency
  // ==========================================================================
  await syncToUserSubscriptions(
    existingProfile.id,
    TIER_TO_PLAN_NAME[tier] || 'Starter',
    subscriptionId,
    customerId,
    subscription.status,
    currentPeriodStart,
    currentPeriodEnd,
    trialStart,
    trialEnd
  );

  // Sync to entitlements
  await supabase.rpc('sync_stripe_to_entitlements', {
    p_user_id: existingProfile.id,
    p_subscription_tier: tier,
    p_subscription_status: subscription.status,
  });

  await supabase.from('subscription_history').insert({
    user_id: existingProfile.id,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
    event_type: 'checkout_completed',
    new_tier: tier,
    new_status: subscription.status,
  });

  // Phase 15.3: Log upgrade_completed launch event
  await logLaunchEvent(existingProfile.id, 'upgrade_completed', {
    tier,
    price_id: priceId,
    subscription_id: subscriptionId,
  });

  // Mark event as successfully processed
  await updateWebhookEventStatus(eventId, 'success', undefined, existingProfile.id);
  console.log(`[CHECKOUT] Successfully processed checkout for user ${existingProfile.id}`);
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

// =============================================================================
// TIER-0: HANDLE SUBSCRIPTION CREATED
// Handles customer.subscription.created events
// =============================================================================
async function handleSubscriptionCreated(subscription: Stripe.Subscription, eventId: string) {
  const customerId = subscription.customer as string;
  const priceId = subscription.items.data[0]?.price?.id;
  const priceKind = classifyPrice(priceId);

  console.log(`[SUB_CREATED] Processing subscription.created: ${subscription.id}, priceKind=${priceKind}`);

  // Skip addon subscriptions - they're handled via checkout.session.completed
  if (priceKind === 'addon') {
    console.log(`[SUB_CREATED] Add-on subscription ${subscription.id} - skipping (handled via checkout)`);
    await updateWebhookEventStatus(eventId, 'skipped', 'Add-on subscription handled via checkout');
    return;
  }

  if (priceKind === 'unknown') {
    console.log(`[SUB_CREATED] Unknown price ${priceId} - skipping`);
    await updateWebhookEventStatus(eventId, 'skipped', `Unknown price: ${priceId}`);
    return;
  }

  // Find profile by stripe_customer_id
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!profile) {
    console.log(`[SUB_CREATED] No profile found for customer ${customerId} - may be handled via checkout`);
    await updateWebhookEventStatus(eventId, 'skipped', 'No profile found - handled via checkout');
    return;
  }

  const tier = BASE_PLAN_TIER_MAP[priceId!];
  const trialStart = subscription.trial_start ? new Date(subscription.trial_start * 1000) : null;
  const trialEnd = subscription.trial_end ? new Date(subscription.trial_end * 1000) : null;
  const currentPeriodStart = new Date(subscription.current_period_start * 1000);
  const currentPeriodEnd = new Date(subscription.current_period_end * 1000);

  // Update profile with subscription data
  await supabase
    .from('profiles')
    .update({
      stripe_subscription_id: subscription.id,
      subscription_tier: tier,
      subscription_status: subscription.status,
      trial_start: trialStart?.toISOString() || null,
      trial_end: trialEnd?.toISOString() || null,
      current_period_start: currentPeriodStart.toISOString(),
      current_period_end: currentPeriodEnd.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', profile.id);

  // Sync to user_subscriptions
  await syncToUserSubscriptions(
    profile.id,
    TIER_TO_PLAN_NAME[tier] || 'Starter',
    subscription.id,
    customerId,
    subscription.status,
    currentPeriodStart,
    currentPeriodEnd,
    trialStart,
    trialEnd
  );

  await updateWebhookEventStatus(eventId, 'success', undefined, profile.id);
  console.log(`[SUB_CREATED] Successfully processed subscription.created for user ${profile.id}`);
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription, eventId: string) {
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
    await updateWebhookEventStatus(eventId, 'success');
    return;
  }

  // ==========================================================================
  // GUARD: Unknown price - do NOT modify base plan fields
  // ==========================================================================
  if (priceKind === 'unknown') {
    console.log(`[SUB_UPDATED] Unknown price ${priceId} on subscription ${subscription.id} - not modifying base plan fields`);
    await updateWebhookEventStatus(eventId, 'skipped', `Unknown price: ${priceId}`);
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

  if (!profile) {
    console.error(`[SUB_UPDATED] No profile found for customer ${customerId}`);
    await updateWebhookEventStatus(eventId, 'failed', 'No profile found');
    return;
  }

  const oldTier = profile.subscription_tier || 'none';
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
    const periodEnd = subscription.current_period_end 
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null;
    
    await supabase.rpc('handle_subscription_downgrade', {
      p_user_id: profile.id,
      p_old_tier: oldTier,
      p_new_tier: newTier,
      p_period_end_at: periodEnd,
    });
  } else {
    console.log(`[SUB_UPDATED] Base plan subscription updated (same tier): tier=${newTier}, status=${subscription.status}`);
  }

  // TIER-0: Extract trial and period timestamps
  const trialStart = subscription.trial_start ? new Date(subscription.trial_start * 1000) : null;
  const trialEnd = subscription.trial_end ? new Date(subscription.trial_end * 1000) : null;
  const currentPeriodStart = new Date(subscription.current_period_start * 1000);
  const currentPeriodEnd = new Date(subscription.current_period_end * 1000);

  // Update profile with new tier, status, and timestamps
  await supabase
    .from('profiles')
    .update({
      subscription_tier: newTier,
      subscription_status: subscription.status,
      stripe_price_id: priceId,
      trial_start: trialStart?.toISOString() || null,
      trial_end: trialEnd?.toISOString() || null,
      current_period_start: currentPeriodStart.toISOString(),
      current_period_end: currentPeriodEnd.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_customer_id', customerId);

  // TIER-0: Sync to user_subscriptions
  await syncToUserSubscriptions(
    profile.id,
    TIER_TO_PLAN_NAME[newTier] || 'Starter',
    subscription.id,
    customerId,
    subscription.status,
    currentPeriodStart,
    currentPeriodEnd,
    trialStart,
    trialEnd
  );

  // Sync to entitlements (Phase 13.1)
  await supabase.rpc('sync_stripe_to_entitlements', {
    p_user_id: profile.id,
    p_subscription_tier: newTier,
    p_subscription_status: subscription.status,
  });

  // Log subscription history with lifecycle event
  await supabase.from('subscription_history').insert({
    user_id: profile.id,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    event_type: 'subscription_updated',
    lifecycle_event: lifecycleEvent,
    previous_tier: oldTier,
    new_tier: newTier,
    new_status: subscription.status,
  });

  // Phase 15.3: Log upgrade/downgrade launch events
  if (lifecycleEvent) {
    if (lifecycleEvent === 'upgrade') {
      await logLaunchEvent(profile.id, 'upgrade_completed', {
        previous_tier: oldTier,
        new_tier: newTier,
        subscription_id: subscription.id,
      });
    } else if (lifecycleEvent === 'downgrade') {
      await logLaunchEvent(profile.id, 'downgrade_completed', {
        previous_tier: oldTier,
        new_tier: newTier,
        subscription_id: subscription.id,
      });
    }
  }

  await updateWebhookEventStatus(eventId, 'success', undefined, profile.id);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription, eventId: string) {
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
    await updateWebhookEventStatus(eventId, 'success');
    return;
  }

  // ==========================================================================
  // GUARD: Unknown price - do NOT modify base plan fields
  // ==========================================================================
  if (priceKind === 'unknown') {
    console.log(`[SUB_DELETED] Unknown price ${priceId} on subscription ${subscription.id} - not modifying base plan fields`);
    await updateWebhookEventStatus(eventId, 'skipped', `Unknown price: ${priceId}`);
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

    // Update current_period_end in profiles for enforcement
    await supabase
      .from('profiles')
      .update({
        current_period_end: periodEnd,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile.id);
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

  // Phase 15.3: Log cancellation launch event
  if (profile?.id) {
    await logLaunchEvent(profile.id, 'cancellation', {
      previous_tier: profile.subscription_tier,
      subscription_id: subscription.id,
      period_end: subscription.current_period_end 
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : null,
    });
  }

  await updateWebhookEventStatus(eventId, 'success', undefined, profile?.id);
}

// =============================================================================
// TIER-0: HANDLE PAYMENT SUCCEEDED
// Handles invoice.payment_succeeded events - recovers from past_due status
// =============================================================================
async function handlePaymentSucceeded(invoice: Stripe.Invoice, eventId: string) {
  const customerId = invoice.customer as string;
  const subscriptionId = invoice.subscription as string | null;

  if (!subscriptionId) {
    console.log(`[PAYMENT_SUCCEEDED] Invoice ${invoice.id} not associated with subscription, skipping`);
    await updateWebhookEventStatus(eventId, 'skipped', 'No subscription associated');
    return;
  }

  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const priceId = subscription.items.data[0]?.price?.id;
    const priceKind = classifyPrice(priceId);

    if (priceKind === 'addon') {
      console.log(`[PAYMENT_SUCCEEDED] Add-on subscription ${subscriptionId} payment succeeded`);
      await updateWebhookEventStatus(eventId, 'success');
      return;
    }

    if (priceKind === 'unknown') {
      console.log(`[PAYMENT_SUCCEEDED] Unknown price ${priceId} - skipping`);
      await updateWebhookEventStatus(eventId, 'skipped', `Unknown price: ${priceId}`);
      return;
    }

    // Get profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, subscription_status')
      .eq('stripe_customer_id', customerId)
      .single();

    if (!profile) {
      console.log(`[PAYMENT_SUCCEEDED] No profile found for customer ${customerId}`);
      await updateWebhookEventStatus(eventId, 'skipped', 'No profile found');
      return;
    }

    // Only update if currently past_due or incomplete
    if (profile.subscription_status === 'past_due' || profile.subscription_status === 'incomplete') {
      console.log(`[PAYMENT_SUCCEEDED] Recovering from ${profile.subscription_status} to active`);
      
      const currentPeriodStart = new Date(subscription.current_period_start * 1000);
      const currentPeriodEnd = new Date(subscription.current_period_end * 1000);

      await supabase
        .from('profiles')
        .update({
          subscription_status: 'active',
          current_period_start: currentPeriodStart.toISOString(),
          current_period_end: currentPeriodEnd.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id);

      // Also update user_subscriptions
      await supabase
        .from('user_subscriptions')
        .update({
          status: 'active',
          current_period_start: currentPeriodStart.toISOString(),
          current_period_end: currentPeriodEnd.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_subscription_id', subscriptionId);

      await logLaunchEvent(profile.id, 'payment_recovered', {
        previous_status: profile.subscription_status,
        subscription_id: subscriptionId,
      });
    }

    await updateWebhookEventStatus(eventId, 'success', undefined, profile.id);
    console.log(`[PAYMENT_SUCCEEDED] Successfully processed for user ${profile.id}`);
  } catch (err) {
    console.error(`[PAYMENT_SUCCEEDED] Error processing:`, err);
    await updateWebhookEventStatus(eventId, 'failed', err instanceof Error ? err.message : 'Unknown error');
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice, eventId: string) {
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
        await updateWebhookEventStatus(eventId, 'success');
        return;
      }

      if (priceKind === 'unknown') {
        console.log(`[PAYMENT_FAILED] Unknown price ${priceId} on subscription ${subscriptionId} - not modifying base plan status`);
        await updateWebhookEventStatus(eventId, 'skipped', `Unknown price: ${priceId}`);
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

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  await supabase
    .from('profiles')
    .update({
      subscription_status: 'past_due',
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_customer_id', customerId);

  // Also update user_subscriptions
  if (subscriptionId) {
    await supabase
      .from('user_subscriptions')
      .update({
        status: 'past_due',
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_subscription_id', subscriptionId);
  }

  if (profile?.id) {
    await logLaunchEvent(profile.id, 'payment_failed', {
      subscription_id: subscriptionId,
    });
  }

  await updateWebhookEventStatus(eventId, 'success', undefined, profile?.id);
}
