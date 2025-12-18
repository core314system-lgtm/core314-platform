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

  // Check if this is an addon purchase (vs a plan subscription)
  if (metadata.kind === 'addon') {
    await handleAddonCheckoutCompleted(session);
    return;
  }

  // Original plan subscription handling
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const priceId = subscription.items.data[0].price.id;
  
  const tierMap: Record<string, string> = {
    [process.env.VITE_STRIPE_PRICE_STARTER!]: 'starter',
    [process.env.VITE_STRIPE_PRICE_PRO!]: 'professional',
    [process.env.VITE_STRIPE_PRICE_ENTERPRISE!]: 'enterprise',
  };
  
  const tier = tierMap[priceId] || 'none';

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
  const priceId = subscription.items.data[0].price.id;
  
  const tierMap: Record<string, string> = {
    [process.env.VITE_STRIPE_PRICE_STARTER!]: 'starter',
    [process.env.VITE_STRIPE_PRICE_PRO!]: 'professional',
    [process.env.VITE_STRIPE_PRICE_ENTERPRISE!]: 'enterprise',
  };
  
  const tier = tierMap[priceId] || 'none';

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

  await supabase
    .from('profiles')
    .update({
      subscription_status: 'past_due',
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_customer_id', customerId);
}
