
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import {
  createAdminClient,
  logEvent,
} from '../_shared/integration-utils.ts';
import Stripe from 'https://esm.sh/stripe@13.11.0?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});

const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || '';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const signature = req.headers.get('stripe-signature');
    
    if (!signature) {
      return new Response(
        JSON.stringify({ error: 'Missing stripe-signature header' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const body = await req.text();

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        webhookSecret
      );
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return new Response(
        JSON.stringify({ error: `Webhook signature verification failed: ${err.message}` }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!event.type || !event.data) {
      return new Response(
        JSON.stringify({ error: 'Invalid Stripe event format' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabaseAdmin = createAdminClient();

    let userId: string | undefined;
    const customerId = event.data.object?.customer;
    
    if (customerId) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('stripe_customer_id', customerId)
        .single();
      
      if (profile) {
        userId = profile.id;
      }
    }

    const logResult = await logEvent(supabaseAdmin, {
      service_name: 'stripe',
      event_type: event.type,
      payload: {
        event_id: event.id,
        created: event.created,
        data: event.data,
        verified: true,
      },
      user_id: userId,
    });

    if (!logResult.success) {
      console.error('Failed to log Stripe event:', logResult.error);
      return new Response(
        JSON.stringify({ error: 'Failed to log event', details: logResult.error }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (userId) {
      try {
        const { data: userIntegrations } = await supabaseAdmin
          .from('user_integrations')
          .select('integration_id')
          .eq('user_id', userId)
          .eq('status', 'active');

        if (userIntegrations && userIntegrations.length > 0) {
          const supabaseUrl = Deno.env.get('SUPABASE_URL');
          
          for (const integration of userIntegrations) {
            try {
              await fetch(`${supabaseUrl}/functions/v1/fusion-recalibrate`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                },
                body: JSON.stringify({
                  userId,
                  integrationId: integration.integration_id,
                }),
              });
            } catch (err) {
              console.error('Error calling fusion-recalibrate:', err);
            }
          }
        }
      } catch (err) {
        console.error('Error triggering fusion recalculation:', err);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        event_id: event.id,
        event_type: event.type,
        user_id: userId || null,
        logged: true,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Stripe webhook error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
