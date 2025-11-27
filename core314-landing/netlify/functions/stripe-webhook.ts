import { Handler } from '@netlify/functions';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-06-20',
});

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  const sig = event.headers['stripe-signature'];

  if (!sig) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'No signature' }),
    };
  }

  let stripeEvent: Stripe.Event;

  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body || '',
      sig,
      webhookSecret
    );
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return {
      statusCode: 400,
      body: JSON.stringify({ error: `Webhook Error: ${err.message}` }),
    };
  }

  try {
    switch (stripeEvent.type) {
      case 'checkout.session.completed': {
        const session = stripeEvent.data.object as Stripe.Checkout.Session;
        
        const subscription = await stripe.subscriptions.retrieve(
          session.subscription as string
        );

        const userId = session.client_reference_id || session.metadata?.userId;

        if (userId) {
          await supabase
            .from('profiles')
            .update({
              stripe_customer_id: session.customer as string,
              stripe_subscription_id: subscription.id,
              subscription_status: subscription.status,
              subscription_plan: session.metadata?.plan || 'unknown',
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
              trial_end: subscription.trial_end 
                ? new Date(subscription.trial_end * 1000).toISOString() 
                : null,
            })
            .eq('id', userId);

          const { data: profile } = await supabase
            .from('profiles')
            .select('email, full_name, company')
            .eq('id', userId)
            .single();

          if (profile) {
            try {
              await fetch(`${process.env.URL || 'https://core314.com'}/api/send-welcome-email`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  email: profile.email,
                  fullName: profile.full_name,
                  companyName: profile.company,
                  plan: session.metadata?.plan || 'unknown',
                }),
              });
            } catch (emailError) {
              console.error('Failed to send welcome email:', emailError);
            }
          }
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = stripeEvent.data.object as Stripe.Subscription;
        
        await supabase
          .from('profiles')
          .update({
            subscription_status: subscription.status,
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            trial_end: subscription.trial_end 
              ? new Date(subscription.trial_end * 1000).toISOString() 
              : null,
          })
          .eq('stripe_customer_id', subscription.customer as string);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = stripeEvent.data.object as Stripe.Subscription;
        
        await supabase
          .from('profiles')
          .update({
            subscription_status: 'canceled',
            stripe_subscription_id: null,
          })
          .eq('stripe_customer_id', subscription.customer as string);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = stripeEvent.data.object as Stripe.Invoice;
        
        await supabase
          .from('profiles')
          .update({
            subscription_status: 'active',
            last_payment_date: new Date().toISOString(),
          })
          .eq('stripe_customer_id', invoice.customer as string);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = stripeEvent.data.object as Stripe.Invoice;
        
        await supabase
          .from('profiles')
          .update({
            subscription_status: 'past_due',
          })
          .eq('stripe_customer_id', invoice.customer as string);
        break;
      }

      default:
        console.log(`Unhandled event type: ${stripeEvent.type}`);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ received: true }),
    };
  } catch (error: any) {
    console.error('Webhook handler error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
