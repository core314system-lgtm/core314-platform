import type { Context } from "@netlify/functions"
import Stripe from "stripe"
import { createClient } from "@supabase/supabase-js"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-12-18.acacia' })

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  try {
    const { action, org_id, user_email } = await req.json()

    if (action === 'portal') {
      // Create a Stripe Customer Portal session for managing subscription
      const customers = await stripe.customers.list({ email: user_email, limit: 1 })
      
      if (customers.data.length === 0) {
        return new Response(JSON.stringify({ error: 'No subscription found' }), { status: 404 })
      }

      const session = await stripe.billingPortal.sessions.create({
        customer: customers.data[0].id,
        return_url: 'https://procuvex.com/settings',
      })

      return new Response(JSON.stringify({ portal_url: session.url }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (action === 'status') {
      // Get current subscription status from DB
      const { data: org } = await supabase
        .from('organizations')
        .select('subscription_status, subscription_plan, trial_ends_at, subscription_ends_at, stripe_subscription_id')
        .eq('id', org_id)
        .single()

      if (!org) {
        return new Response(JSON.stringify({ status: 'no_subscription', plan: null }), {
          headers: { 'Content-Type': 'application/json' }
        })
      }

      return new Response(JSON.stringify({
        status: org.subscription_status || 'no_subscription',
        plan: org.subscription_plan || null,
        trial_ends_at: org.trial_ends_at,
        subscription_ends_at: org.subscription_ends_at,
      }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (action === 'cancel') {
      const { data: org } = await supabase
        .from('organizations')
        .select('stripe_subscription_id')
        .eq('id', org_id)
        .single()

      if (!org?.stripe_subscription_id) {
        return new Response(JSON.stringify({ error: 'No active subscription' }), { status: 404 })
      }

      // Cancel at period end (don't immediately cut off)
      await stripe.subscriptions.update(org.stripe_subscription_id, {
        cancel_at_period_end: true,
      })

      return new Response(JSON.stringify({ status: 'cancelling' }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), { status: 500 })
  }
}
