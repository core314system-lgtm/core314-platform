import { Handler } from '@netlify/functions';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
});

// Map plan display names to Stripe price IDs from environment
// Used when Billing page sends planName instead of priceId
const PLAN_NAME_TO_PRICE_ID: Record<string, string | undefined> = {
  'Monitor': process.env.VITE_STRIPE_PRICE_MONITOR,
  'Intelligence': process.env.VITE_STRIPE_PRICE_INTELLIGENCE,
  'Command Center': process.env.VITE_STRIPE_PRICE_COMMAND_CENTER,
  'Enterprise': process.env.VITE_STRIPE_PRICE_ENTERPRISE,
};

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { priceId: directPriceId, planName, email, userId, metadata = {} } = JSON.parse(event.body || '{}');

    // Resolve price ID: prefer direct priceId, fall back to planName lookup
    const priceId = directPriceId || PLAN_NAME_TO_PRICE_ID[planName];

    if (!priceId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid plan or missing price ID' }),
      };
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      customer_email: email,
      client_reference_id: userId,
      metadata: {
        ...metadata,
        plan: planName || '',
        source: 'core314_app',
      },
      success_url: `${process.env.URL}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.URL}/pricing`,
      allow_promotion_codes: true,
      billing_address_collection: 'required',
      subscription_data: {
        trial_period_days: 14,
        metadata: {
          ...metadata,
          plan: planName || '',
        },
      },
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ url: session.url }),
    };
  } catch (err) {
    console.error('Checkout session creation error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to create checkout session' }),
    };
  }
};
