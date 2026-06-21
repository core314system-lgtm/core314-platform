import type { Context } from "@netlify/functions"
import Stripe from "stripe"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-12-18.acacia' })

const PLANS = {
  growth_monthly: {
    name: 'Growth',
    price: 2500_00, // $2,500
    interval: 'month' as const,
    trial_days: 7,
  },
  growth_annual: {
    name: 'Growth (Annual)',
    price: 24000_00, // $24,000/yr ($2,000/mo effective - 20% discount)
    interval: 'year' as const,
    trial_days: 7,
  },
  enterprise_monthly: {
    name: 'Enterprise',
    price: 5000_00, // $5,000
    interval: 'month' as const,
    trial_days: 7,
  },
  enterprise_annual: {
    name: 'Enterprise (Annual)',
    price: 48000_00, // $48,000/yr ($4,000/mo effective - 20% discount)
    interval: 'year' as const,
    trial_days: 7,
  },
}

export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  try {
    const { plan_id, org_id, user_email, success_url, cancel_url, referral_code } = await req.json()

    const plan = PLANS[plan_id as keyof typeof PLANS]
    if (!plan) {
      return new Response(JSON.stringify({ error: 'Invalid plan' }), { status: 400 })
    }

    // Create or retrieve Stripe customer
    const customers = await stripe.customers.list({ email: user_email, limit: 1 })
    let customer: Stripe.Customer

    if (customers.data.length > 0) {
      customer = customers.data[0]
    } else {
      customer = await stripe.customers.create({
        email: user_email,
        metadata: { org_id },
      })
    }

    // Create checkout session with 7-day trial
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      mode: 'subscription',
      payment_method_types: ['card', 'us_bank_account'],
      payment_method_options: {
        us_bank_account: {
          financial_connections: { permissions: ['payment_method'] },
        },
      },
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Procuvex ${plan.name}`,
            description: `AI-Powered Procurement Intelligence Platform — ${plan.name} Plan`,
          },
          unit_amount: plan.price,
          recurring: { interval: plan.interval },
        },
        quantity: 1,
      }],
      subscription_data: {
        trial_period_days: plan.trial_days,
        metadata: { org_id, plan_id, ...(referral_code ? { referral_code } : {}) },
      },
      metadata: { org_id, plan_id, ...(referral_code ? { referral_code } : {}) },
      success_url: success_url || 'https://procuvex.com/settings?subscription=success',
      cancel_url: cancel_url || 'https://procuvex.com/settings?subscription=cancelled',
      allow_promotion_codes: true,
    })

    return new Response(JSON.stringify({ 
      checkout_url: session.url,
      session_id: session.id 
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), { status: 500 })
  }
}
