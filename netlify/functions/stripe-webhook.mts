import type { Context } from "@netlify/functions"
import Stripe from "stripe"
import { createClient } from "@supabase/supabase-js"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-12-18.acacia' })
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function updateOrgSubscription(orgId: string, status: string, planId: string, stripeSubId: string, trialEnd: number | null, currentPeriodEnd: number | null) {
  const { error } = await supabase
    .from('organizations')
    .update({
      subscription_status: status,
      subscription_plan: planId,
      stripe_subscription_id: stripeSubId,
      trial_ends_at: trialEnd ? new Date(trialEnd * 1000).toISOString() : null,
      subscription_ends_at: currentPeriodEnd ? new Date(currentPeriodEnd * 1000).toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orgId)

  if (error) {
    console.error('Failed to update org subscription:', error)
  }
}

export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig) {
    return new Response('No signature', { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, sig, endpointSecret)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Webhook signature verification failed:', message)
    return new Response(`Webhook Error: ${message}`, { status: 400 })
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const orgId = session.metadata?.org_id
      const planId = session.metadata?.plan_id || 'growth_monthly'

      if (orgId && session.subscription) {
        const sub = await stripe.subscriptions.retrieve(session.subscription as string)
        await updateOrgSubscription(
          orgId,
          sub.status === 'trialing' ? 'trialing' : 'active',
          planId,
          sub.id,
          sub.trial_end,
          sub.current_period_end
        )
      }
      break
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      const orgId = sub.metadata?.org_id

      if (orgId) {
        await updateOrgSubscription(
          orgId,
          sub.status === 'trialing' ? 'trialing' : sub.status,
          sub.metadata?.plan_id || 'growth_monthly',
          sub.id,
          sub.trial_end,
          sub.current_period_end
        )
      }
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      const orgId = sub.metadata?.org_id

      if (orgId) {
        await updateOrgSubscription(orgId, 'cancelled', '', sub.id, null, null)
      }
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      const subId = invoice.subscription as string | null

      if (subId) {
        const sub = await stripe.subscriptions.retrieve(subId)
        const orgId = sub.metadata?.org_id
        if (orgId) {
          await updateOrgSubscription(orgId, 'past_due', sub.metadata?.plan_id || '', sub.id, sub.trial_end, sub.current_period_end)
        }
      }
      break
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
}
