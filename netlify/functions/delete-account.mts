import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"
import Stripe from "stripe"

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-12-18.acacia' })

export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  try {
    const { user_id, org_id } = await req.json()

    if (!user_id) {
      return new Response(JSON.stringify({ error: 'user_id required' }), { status: 400 })
    }

    // 1. Cancel Stripe subscription if exists
    if (org_id) {
      const { data: orgData } = await supabase
        .from('organizations')
        .select('stripe_subscription_id, stripe_customer_id')
        .eq('id', org_id)
        .single()

      if (orgData?.stripe_subscription_id) {
        try {
          await stripe.subscriptions.cancel(orgData.stripe_subscription_id)
        } catch {
          // Subscription may already be cancelled
        }
      }
    }

    // 2. Delete user data from org-related tables
    if (org_id) {
      // Delete account_usage records
      await supabase.from('account_usage').delete().eq('org_id', org_id)

      // Delete support tickets
      await supabase.from('support_tickets').delete().eq('org_id', org_id)

      // Delete org invitations
      await supabase.from('org_invitations').delete().eq('org_id', org_id)

      // Delete organization members
      await supabase.from('organization_members').delete().eq('org_id', org_id)

      // Update organization status
      await supabase
        .from('organizations')
        .update({
          subscription_status: 'deleted',
          subscription_ends_at: new Date().toISOString(),
        })
        .eq('id', org_id)
    }

    // 3. Delete the user's auth account
    const { error: deleteError } = await supabase.auth.admin.deleteUser(user_id)
    if (deleteError) {
      return new Response(JSON.stringify({ error: deleteError.message }), { status: 500 })
    }

    return new Response(JSON.stringify({ success: true, message: 'Account deleted successfully' }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), { status: 500 })
  }
}
