import { Handler } from '@netlify/functions';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-06-20',
});

// Expected price amounts in cents (source of truth: shared/pricing.ts)
// Starter (Observe) = $199/month = 19900 cents
// Pro (Analyze) = $999/month = 99900 cents
const EXPECTED_PRICE_AMOUNTS: Record<string, number> = {
  starter: 19900, // $199/month
  pro: 99900,     // $999/month
};

// Plans eligible for 14-day free trial
// Both Starter and Pro get trials; Enterprise is custom/contact-sales
const TRIAL_ELIGIBLE_PLANS = ['starter', 'pro'];

export const handler: Handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const { plan, addons = [], email, userId } = JSON.parse(event.body || '{}');

    if (!plan) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Plan is required' }),
      };
    }

    const planLookupKeys: Record<string, string> = {
      starter: 'starter_monthly',
      pro: 'pro_monthly',
    };

    const lookupKey = planLookupKeys[plan.toLowerCase()];
    if (!lookupKey) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid plan' }),
      };
    }

    // Fetch multiple prices to handle potential duplicates with same lookup_key
    const prices = await stripe.prices.list({
      lookup_keys: [lookupKey],
      limit: 10,
      active: true,
    });

    if (!prices.data || prices.data.length === 0) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Price not found for plan' }),
      };
    }

    // Get expected amount for this plan
    const expectedAmount = EXPECTED_PRICE_AMOUNTS[plan.toLowerCase()];
    
    // Find the correct price by matching:
    // 1. Active status
    // 2. USD currency
    // 3. Monthly recurring interval
    // 4. Expected unit_amount (if defined)
    let selectedPrice = prices.data.find(p => 
      p.active &&
      p.currency === 'usd' &&
      p.recurring?.interval === 'month' &&
      (expectedAmount ? p.unit_amount === expectedAmount : true)
    );

    // If no exact match found, provide diagnostic info
    if (!selectedPrice) {
      const diagnosticInfo = prices.data.map(p => ({
        id: p.id,
        unit_amount: p.unit_amount,
        currency: p.currency,
        interval: p.recurring?.interval,
        active: p.active,
        livemode: p.livemode,
      }));
      
      console.error('Price mismatch for plan:', plan, 'Expected amount:', expectedAmount, 'Found prices:', diagnosticInfo);
      
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: `No matching price found for ${plan} plan. Expected $${(expectedAmount || 0) / 100}/month.`,
          diagnostic: {
            plan,
            expectedAmountCents: expectedAmount,
            foundPrices: diagnosticInfo,
          }
        }),
      };
    }

    const priceId = selectedPrice.id;

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        price: priceId,
        quantity: 1,
      },
    ];

    if (addons && addons.length > 0) {
      for (const addon of addons) {
        const addonPrices = await stripe.prices.list({
          lookup_keys: [addon.lookupKey],
          limit: 1,
        });

        if (addonPrices.data && addonPrices.data.length > 0) {
          lineItems.push({
            price: addonPrices.data[0].id,
            quantity: addon.quantity || 1,
          });
        }
      }
    }

    // Determine if this plan is eligible for a 14-day free trial
    const planLower = plan.toLowerCase();
    const isTrialEligible = TRIAL_ELIGIBLE_PLANS.includes(planLower);

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: lineItems,
      success_url: `${process.env.URL || 'https://core314.com'}/signup/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.URL || 'https://core314.com'}/pricing`,
      customer_email: email,
      client_reference_id: userId,
      subscription_data: {
        // 14-day free trial for Starter and Pro plans
        // Stripe Checkout will show "14 days free" and "$0 due today"
        ...(isTrialEligible && { trial_period_days: 14 }),
        metadata: {
          plan,
          userId: userId || '',
        },
      },
      metadata: {
        plan,
        userId: userId || '',
      },
      allow_promotion_codes: true,
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ sessionId: session.id, url: session.url }),
    };
  } catch (error: any) {
    console.error('Stripe checkout error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || 'Failed to create checkout session' }),
    };
  }
};
