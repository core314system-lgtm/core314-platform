import { Handler } from '@netlify/functions';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
});

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { priceId, email, metadata = {} } = JSON.parse(event.body || '{}');

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
      metadata: {
        ...metadata,
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
