import type { Context } from "@netlify/functions"
import Stripe from "stripe"
import { createClient } from "@supabase/supabase-js"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-12-18.acacia' })
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const VERIFICATION_PLANS = {
  annual: {
    name: 'Procuvex Verified — Annual',
    price: 199_00, // $199/year
    interval: 'year' as const,
  },
  annual_intro: {
    name: 'Procuvex Verified — Introductory',
    price: 99_00, // $99/year (first year)
    interval: 'year' as const,
  },
}

export default async (req: Request, _context: Context) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-user-id",
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { headers })
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers })
  }

  try {
    const { sub_id, user_id, user_email, plan } = await req.json()

    if (!sub_id || !user_id || !user_email) {
      return new Response(JSON.stringify({ error: "sub_id, user_id, and user_email required" }), { status: 400, headers })
    }

    // Verify this user owns this sub profile
    const { data: subData, error: subErr } = await supabase
      .from("master_subcontractors")
      .select("id, company_name, claimed_by_user_id, verification_status")
      .eq("id", sub_id)
      .single()

    if (subErr || !subData) {
      return new Response(JSON.stringify({ error: "Subcontractor not found" }), { status: 404, headers })
    }

    if (subData.claimed_by_user_id !== user_id) {
      return new Response(JSON.stringify({ error: "You don't own this profile" }), { status: 403, headers })
    }

    if (subData.verification_status === "verified") {
      return new Response(JSON.stringify({ error: "Already verified" }), { status: 400, headers })
    }

    // Check if this is a first-time customer (for intro pricing)
    const customers = await stripe.customers.list({ email: user_email, limit: 1 })
    let customer: Stripe.Customer

    if (customers.data.length > 0) {
      customer = customers.data[0]
    } else {
      customer = await stripe.customers.create({
        email: user_email,
        metadata: { sub_id, user_id, type: "subcontractor_verification" },
      })
    }

    // Determine plan — use intro pricing for new customers
    const selectedPlan = plan === "annual_intro" ? VERIFICATION_PLANS.annual_intro : VERIFICATION_PLANS.annual

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: {
            name: selectedPlan.name,
            description: `Verified badge, priority placement, auto-matching with primes, cert expiration alerts for ${subData.company_name}`,
          },
          unit_amount: selectedPlan.price,
          recurring: { interval: selectedPlan.interval },
        },
        quantity: 1,
      }],
      subscription_data: {
        metadata: { sub_id, user_id, type: "sub_verification" },
      },
      metadata: { sub_id, user_id, type: "sub_verification" },
      success_url: `https://procuvex.com/my-sub-profile?verified=success`,
      cancel_url: `https://procuvex.com/my-sub-profile?verified=cancelled`,
      allow_promotion_codes: true,
    })

    // Mark as pending verification
    await supabase
      .from("master_subcontractors")
      .update({
        verification_status: "pending_verification",
        stripe_checkout_session_id: session.id,
      })
      .eq("id", sub_id)

    return new Response(JSON.stringify({ checkout_url: session.url, session_id: session.id }), { headers })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return new Response(JSON.stringify({ error: message }), { status: 500, headers })
  }
}
