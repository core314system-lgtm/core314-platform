
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import Stripe from 'https://esm.sh/stripe@14.5.0?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  try {
    const signature = req.headers.get('stripe-signature');
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

    if (!signature || !webhookSecret) {
      return new Response('Missing signature or webhook secret', { status: 400 });
    }

    const body = await req.text();
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return new Response('Webhook signature verification failed', { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        
        if (session.metadata?.type === 'addon') {
          const userId = session.metadata.user_id;
          const addonName = session.metadata.addon_name;
          const addonCategory = session.metadata.addon_category;
          const priceId = session.metadata.price_id;

          if (!userId || !addonName || !addonCategory) {
            console.error('Missing required metadata in checkout session');
            break;
          }

          const { error: insertError } = await supabase
            .from('user_addons')
            .insert({
              user_id: userId,
              addon_name: addonName,
              addon_category: addonCategory,
              stripe_price_id: priceId,
              stripe_subscription_id: session.subscription as string,
              status: 'active',
              activated_at: new Date().toISOString(),
              metadata: {
                session_id: session.id,
                customer_id: session.customer,
                amount_total: session.amount_total,
                currency: session.currency,
              },
            });

          if (insertError) {
            console.error('Error inserting add-on:', insertError);
          } else {
            console.log(`Add-on activated: ${addonName} for user ${userId}`);
          }
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        
        if (invoice.subscription) {
          const { data: addons } = await supabase
            .from('user_addons')
            .select('*')
            .eq('stripe_subscription_id', invoice.subscription)
            .eq('status', 'active');

          if (addons && addons.length > 0) {
            for (const addon of addons) {
              await supabase
                .from('user_addons')
                .update({
                  metadata: {
                    ...addon.metadata,
                    last_payment_date: new Date().toISOString(),
                    last_invoice_id: invoice.id,
                  },
                })
                .eq('id', addon.id);
            }
            console.log(`Updated ${addons.length} add-on(s) for subscription ${invoice.subscription}`);
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        
        const { error: updateError } = await supabase
          .from('user_addons')
          .update({
            status: 'canceled',
            expires_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', subscription.id);

        if (updateError) {
          console.error('Error canceling add-on:', updateError);
        } else {
          console.log(`Add-on canceled for subscription ${subscription.id}`);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        
        let newStatus = 'active';
        if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
          newStatus = 'canceled';
        } else if (subscription.status === 'past_due') {
          newStatus = 'pending';
        }

        const { error: updateError } = await supabase
          .from('user_addons')
          .update({
            status: newStatus,
            metadata: {
              subscription_status: subscription.status,
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            },
          })
          .eq('stripe_subscription_id', subscription.id);

        if (updateError) {
          console.error('Error updating add-on:', updateError);
        } else {
          console.log(`Add-on updated for subscription ${subscription.id}, status: ${newStatus}`);
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
