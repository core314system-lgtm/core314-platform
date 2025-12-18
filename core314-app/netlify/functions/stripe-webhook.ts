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
// PRICE CLASSIFICATION
// Explicitly classify Stripe prices into BASE PLANS vs ADD-ONS
// This ensures add-on purchases NEVER modify base subscription plan fields
// =============================================================================

// Base plan prices (from VITE_ env vars used in checkout)
const BASE_PLAN_PRICE_MAP: Record<string, 'starter' | 'professional' | 'enterprise'> = {
  [process.env.VITE_STRIPE_PRICE_STARTER!]: 'starter',
  [process.env.VITE_STRIPE_PRICE_PRO!]: 'professional',
  [process.env.VITE_STRIPE_PRICE_ENTERPRISE!]: 'enterprise',
};

// Add-on prices (from non-VITE env vars used in create-addon-checkout)
const ADDON_PRICE_IDS = new Set<string>(
  [
    process.env.STRIPE_PRICE_ADDITIONAL_INTEGRATION_PRO,
    process.env.STRIPE_PRICE_PREMIUM_ANALYTICS,
    process.env.STRIPE_PRICE_ADVANCED_FUSION_AI,
    process.env.STRIPE_PRICE_DATA_EXPORT,
  ].filter((id): id is string => Boolean(id))
);

// Price type classification
type PriceType = 'base' | 'addon' | 'unknown';

function classifyPrice(priceId: string | null | undefined): PriceType {
  if (!priceId) return 'unknown';
  if (ADDON_PRICE_IDS.has(priceId)) return 'addon';
  if (BASE_PLAN_PRICE_MAP[priceId]) return 'base';
  return 'unknown';
}

// =============================================================================
// AUTOMATIC REPAIR SAFEGUARD
// If an add-on webhook fires and subscription_tier is NULL/none,
// but the Stripe customer has an active base plan, restore it immediately
// =============================================================================

async function maybeRepairBasePlan(customerId: string): Promise<void> {
  // Look up the profile by stripe_customer_id
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, subscription_tier, subscription_status')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!profile) {
    console.log(`[REPAIR] No profile found for customer ${customerId}`);
    return;
  }

  // If subscription_tier is already set to a valid base plan, no repair needed
  const validTiers = ['starter', 'professional', 'enterprise'];
  if (profile.subscription_tier && validTiers.includes(profile.subscription_tier)) {
    return;
  }

  // subscription_tier is null/none - check Stripe for active base plan subscriptions
  console.log(`[REPAIR] Profile ${profile.id} has subscription_tier=${profile.subscription_tier}, checking Stripe for active base plan`);

  try {
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
    });

    for (const sub of subscriptions.data) {
      const priceId = sub.items.data[0]?.price?.id;
      const priceType = classifyPrice(priceId);

      if (priceType === 'base') {
        const tier = BASE_PLAN_PRICE_MAP[priceId!];
        console.log(`[REPAIR] Found active base plan subscription ${sub.id} with tier ${tier}, repairing profile`);

        // Restore the base plan
        await supabase
          .from('profiles')
          .update({
            subscription_tier: tier,
            subscription_status: sub.status,
            stripe_subscription_id: sub.id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', profile.id);

        // Log the repair in subscription_history
        await supabase.from('subscription_history').insert({
          user_id: profile.id,
          stripe_customer_id: customerId,
          stripe_subscription_id: sub.id,
          event_type: 'subscription_repaired_from_addon',
          new_tier: tier,
          new_status: sub.status,
        });

        console.log(`[REPAIR] Successfully restored subscription_tier=${tier} for profile ${profile.id}`);
        return;
      }
    }

    console.log(`[REPAIR] No active base plan found in Stripe for customer ${customerId}`);
  } catch (err) {
    console.error(`[REPAIR] Error checking Stripe subscriptions:`, err);
  }
}

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
  const priceType = classifyPrice(priceId);

  // ==========================================================================
  // GUARD CLAUSE: Route add-on purchases to dedicated handler
  // Check BOTH metadata AND price classification for maximum safety
  // ==========================================================================
  if (metadata.kind === 'addon' || priceType === 'addon') {
    console.log(`[CHECKOUT] Add-on detected (metadata.kind=${metadata.kind}, priceType=${priceType}), routing to addon handler`);
    await handleAddonCheckoutCompleted(session);
    // Run automatic repair in case base plan was previously corrupted
    await maybeRepairBasePlan(customerId);
    return;
  }

  // ==========================================================================
  // GUARD CLAUSE: Unknown price - do not modify plan fields
  // ==========================================================================
  if (priceType === 'unknown') {
    console.error(`[CHECKOUT] Unknown price ID ${priceId} - not modifying plan fields`);
    return;
  }

  // ==========================================================================
  // BASE PLAN HANDLING: Only base plan prices reach this point
  // ==========================================================================
  const tier = BASE_PLAN_PRICE_MAP[priceId!];
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

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  const priceId = subscription.items.data[0]?.price?.id;
  const priceType = classifyPrice(priceId);

  // ==========================================================================
  // GUARD CLAUSE: Add-on subscriptions must NOT modify base plan fields
  // ==========================================================================
  if (priceType === 'addon') {
    console.log(`[SUB_UPDATED] Add-on subscription ${subscription.id} updated (priceId=${priceId}) - NOT modifying base plan`);
    // Optionally update user_addons status if needed (future enhancement)
    // For now, just run automatic repair in case base plan was corrupted
    await maybeRepairBasePlan(customerId);
    return;
  }

  // ==========================================================================
  // GUARD CLAUSE: Unknown price - do not modify plan fields
  // ==========================================================================
  if (priceType === 'unknown') {
    console.error(`[SUB_UPDATED] Unknown price ID ${priceId} on subscription ${subscription.id} - not modifying plan fields`);
    return;
  }

  // ==========================================================================
  // BASE PLAN HANDLING: Only base plan prices reach this point
  // ==========================================================================
  const tier = BASE_PLAN_PRICE_MAP[priceId!];
  console.log(`[SUB_UPDATED] Base plan subscription updated: tier=${tier}, status=${subscription.status}`);

  await supabase
    .from('profiles')
    .update({
      subscription_tier: tier,
      subscription_status: subscription.status,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_customer_id', customerId);

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  await supabase.from('subscription_history').insert({
    user_id: profile?.id,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    event_type: 'subscription_updated',
    new_tier: tier,
    new_status: subscription.status,
  });
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  const priceId = subscription.items.data[0]?.price?.id;
  const priceType = classifyPrice(priceId);

  // ==========================================================================
  // GUARD CLAUSE: Add-on subscription cancellation must NOT modify base plan
  // ==========================================================================
  if (priceType === 'addon') {
    console.log(`[SUB_DELETED] Add-on subscription ${subscription.id} deleted (priceId=${priceId}) - NOT modifying base plan`);
    
    // Mark the add-on entitlement as canceled in user_addons
    // Use subscription metadata to find the right row
    const metadata = subscription.metadata || {};
    if (metadata.addon_name && metadata.user_id) {
      await supabase
        .from('user_addons')
        .update({
          status: 'canceled',
          expires_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', metadata.user_id)
        .eq('addon_name', metadata.addon_name)
        .eq('stripe_subscription_id', subscription.id);
      
      console.log(`[SUB_DELETED] Marked addon ${metadata.addon_name} as canceled for user ${metadata.user_id}`);
    }
    
    // Run automatic repair in case base plan was corrupted
    await maybeRepairBasePlan(customerId);
    return;
  }

  // ==========================================================================
  // GUARD CLAUSE: Unknown price - do not modify plan fields
  // ==========================================================================
  if (priceType === 'unknown') {
    console.error(`[SUB_DELETED] Unknown price ID ${priceId} on subscription ${subscription.id} - not modifying plan fields`);
    return;
  }

  // ==========================================================================
  // BASE PLAN HANDLING: Only base plan prices reach this point
  // ==========================================================================
  console.log(`[SUB_DELETED] Base plan subscription deleted: priceId=${priceId}`);

  await supabase
    .from('profiles')
    .update({
      subscription_status: 'canceled',
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_customer_id', customerId);

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  await supabase.from('subscription_history').insert({
    user_id: profile?.id,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    event_type: 'subscription_deleted',
    new_status: 'canceled',
  });
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;
  const subscriptionId = invoice.subscription as string | null;

  // ==========================================================================
  // GUARD CLAUSE: Check if this is an add-on subscription payment failure
  // Add-on payment failures should NOT mark the base plan as past_due
  // ==========================================================================
  if (subscriptionId) {
    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const priceId = subscription.items.data[0]?.price?.id;
      const priceType = classifyPrice(priceId);

      if (priceType === 'addon') {
        console.log(`[PAYMENT_FAILED] Add-on subscription ${subscriptionId} payment failed - NOT marking base plan as past_due`);
        // Optionally update user_addons status here in the future
        return;
      }

      if (priceType === 'unknown') {
        console.error(`[PAYMENT_FAILED] Unknown price ID ${priceId} on subscription ${subscriptionId} - not modifying plan status`);
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
