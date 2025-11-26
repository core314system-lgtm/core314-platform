import { Handler } from '@netlify/functions';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-06-20',
});

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

    const prices = await stripe.prices.list({
      lookup_keys: [lookupKey],
      limit: 1,
    });

    if (!prices.data || prices.data.length === 0) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Price not found for plan' }),
      };
    }

    const priceId = prices.data[0].id;

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

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: lineItems,
      success_url: `${process.env.URL || 'https://core314.com'}/signup/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.URL || 'https://core314.com'}/pricing`,
      customer_email: email,
      client_reference_id: userId,
      subscription_data: {
        trial_period_days: 14,
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
