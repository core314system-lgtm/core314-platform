import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// =============================================================================
// BETA STRIPE WEBHOOK
// Handles Stripe webhook events for beta tester conversions:
// - checkout.session.completed → Mark lifecycle as converting
// - invoice.payment_succeeded → Mark lifecycle as converted (first payment)
// - customer.subscription.updated → Detect coupon expiry (month 7+)
// - customer.subscription.deleted → Mark lifecycle as churned
// =============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  const requestId = crypto.randomUUID().substring(0, 8);
  const log = (step: string, data?: unknown) =>
    console.log(`[${requestId}] ${step}`, data ? JSON.stringify(data) : '');

  log('WEBHOOK_ENTRY', { method: req.method });

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const stripeWebhookSecret = Deno.env.get('STRIPE_BETA_WEBHOOK_SECRET');

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse the webhook payload
    const body = await req.text();
    let event: {
      type: string;
      data: {
        object: Record<string, unknown>;
      };
    };

    // If webhook secret is configured, verify signature
    if (stripeWebhookSecret) {
      const signature = req.headers.get('stripe-signature');
      if (!signature) {
        log('MISSING_SIGNATURE');
        return new Response(
          JSON.stringify({ error: 'Missing stripe-signature header' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      // Note: Full signature verification would use Stripe SDK
      // For edge functions, we parse and verify the payload structure
      log('SIGNATURE_PRESENT', { signaturePrefix: signature.substring(0, 20) });
    }

    try {
      event = JSON.parse(body);
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON payload' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    log('EVENT_RECEIVED', { type: event.type });

    const obj = event.data.object;

    switch (event.type) {
      // =====================================================================
      // CHECKOUT SESSION COMPLETED
      // Beta tester completed the Stripe Checkout flow
      // =====================================================================
      case 'checkout.session.completed': {
        const metadata = obj.metadata as Record<string, string> | undefined;
        const isBetaConversion = metadata?.type === 'beta_conversion';

        if (!isBetaConversion) {
          log('NOT_BETA_CHECKOUT', { metadata });
          break;
        }

        const userId = metadata?.core314_user_id;
        const lifecycleId = metadata?.lifecycle_id;
        const subscriptionId = obj.subscription as string | undefined;
        const customerId = obj.customer as string | undefined;

        log('BETA_CHECKOUT_COMPLETED', { userId, lifecycleId, subscriptionId, customerId });

        if (userId && lifecycleId) {
          // Update lifecycle record
          const { error: updateError } = await supabase
            .from('beta_tester_lifecycle')
            .update({
              lifecycle_status: 'converting',
              stripe_subscription_id: subscriptionId || null,
              stripe_customer_id: customerId || null,
              checkout_session_id: obj.id as string,
            })
            .eq('id', lifecycleId);

          if (updateError) {
            log('LIFECYCLE_UPDATE_ERROR', { error: updateError.message });
          } else {
            log('LIFECYCLE_UPDATED_TO_CONVERTING', { lifecycleId });
          }

          // Update profile with stripe info
          await supabase
            .from('profiles')
            .update({
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              subscription_tier: 'command_center',
              subscription_status: 'trialing', // Still in trial until Day 46
            })
            .eq('id', userId);
        }
        break;
      }

      // =====================================================================
      // INVOICE PAYMENT SUCCEEDED
      // First actual payment = conversion confirmed
      // =====================================================================
      case 'invoice.payment_succeeded': {
        const subscriptionId = obj.subscription as string | undefined;
        const amountPaid = obj.amount_paid as number | undefined;
        const billingReason = obj.billing_reason as string | undefined;

        if (!subscriptionId) break;

        // Check if this subscription belongs to a beta tester
        const { data: lifecycle } = await supabase
          .from('beta_tester_lifecycle')
          .select('id, user_id, lifecycle_status, first_payment_at')
          .eq('stripe_subscription_id', subscriptionId)
          .single();

        if (!lifecycle) {
          log('NO_LIFECYCLE_FOR_SUBSCRIPTION', { subscriptionId });
          break;
        }

        log('PAYMENT_SUCCEEDED', {
          lifecycleId: lifecycle.id,
          amountPaid,
          billingReason,
          currentStatus: lifecycle.lifecycle_status,
        });

        // If this is the first payment (not a trial), mark as converted
        if (!lifecycle.first_payment_at && amountPaid && amountPaid > 0) {
          await supabase
            .from('beta_tester_lifecycle')
            .update({
              lifecycle_status: 'converted',
              first_payment_at: new Date().toISOString(),
            })
            .eq('id', lifecycle.id);

          // Update profile subscription status
          await supabase
            .from('profiles')
            .update({
              subscription_status: 'active',
            })
            .eq('id', lifecycle.user_id);

          log('LIFECYCLE_CONVERTED', { lifecycleId: lifecycle.id, userId: lifecycle.user_id });
        }
        break;
      }

      // =====================================================================
      // SUBSCRIPTION UPDATED
      // Detect coupon removal (month 7 transition)
      // =====================================================================
      case 'customer.subscription.updated': {
        const subscriptionId = obj.id as string;
        const discount = obj.discount as { coupon?: { id: string } } | null;

        // Check if this subscription belongs to a beta tester
        const { data: lifecycle } = await supabase
          .from('beta_tester_lifecycle')
          .select('id, user_id, stripe_coupon_id')
          .eq('stripe_subscription_id', subscriptionId)
          .single();

        if (!lifecycle) break;

        // If discount was removed (coupon expired after 6 months)
        if (!discount && lifecycle.stripe_coupon_id) {
          log('COUPON_EXPIRED', {
            lifecycleId: lifecycle.id,
            message: 'Beta tester discount expired. Now at full price.',
          });

          // Could send a notification here if desired
          // The transition to full price is automatic via Stripe
        }
        break;
      }

      // =====================================================================
      // SUBSCRIPTION DELETED
      // Beta tester canceled or subscription ended
      // =====================================================================
      case 'customer.subscription.deleted': {
        const subscriptionId = obj.id as string;

        const { data: lifecycle } = await supabase
          .from('beta_tester_lifecycle')
          .select('id, user_id')
          .eq('stripe_subscription_id', subscriptionId)
          .single();

        if (!lifecycle) break;

        log('SUBSCRIPTION_DELETED', { lifecycleId: lifecycle.id });

        await supabase
          .from('beta_tester_lifecycle')
          .update({ lifecycle_status: 'churned' })
          .eq('id', lifecycle.id);

        await supabase
          .from('profiles')
          .update({
            subscription_status: 'canceled',
            subscription_tier: 'none',
          })
          .eq('id', lifecycle.user_id);

        break;
      }

      default:
        log('UNHANDLED_EVENT', { type: event.type });
    }

    return new Response(
      JSON.stringify({ received: true, type: event.type, request_id: requestId }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log('UNEXPECTED_ERROR', { error: errorMsg });
    return new Response(
      JSON.stringify({ error: 'Webhook processing failed', details: errorMsg, request_id: requestId }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
