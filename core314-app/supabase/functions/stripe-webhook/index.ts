import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'

serve(async (req) => {
  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', { apiVersion: '2023-10-16' })
  const signature = req.headers.get('Stripe-Signature')
  const body = await req.text()
  let event
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature!, Deno.env.get('STRIPE_WEBHOOK_SECRET') || '')
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Webhook signature verification failed' }), { status: 400 })
  }
  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object
      const userId = session.metadata?.user_id
      if (userId) {
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
        await supabase.from('profiles').update({ stripe_subscription_id: subscription.id, subscription_tier: session.metadata?.tier || 'starter', subscription_status: subscription.status, subscription_period_end: new Date(subscription.current_period_end * 1000).toISOString() }).eq('id', userId)
      }
      break
    }
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const subscription = event.data.object
      await supabase.from('profiles').update({ subscription_status: subscription.status, subscription_period_end: new Date(subscription.current_period_end * 1000).toISOString() }).eq('stripe_subscription_id', subscription.id)
      break
    }
    case 'invoice.payment_failed': {
      const invoice = event.data.object
      await supabase.from('profiles').update({ subscription_status: 'past_due' }).eq('stripe_customer_id', invoice.customer)
      break
    }
  }
  return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } })
})
