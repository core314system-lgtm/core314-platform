import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface RateLimitConfig {
  ai_calls_per_hour: number
  emails_per_hour: number
}

const PLAN_LIMITS: Record<string, RateLimitConfig> = {
  growth_monthly: { ai_calls_per_hour: 30, emails_per_hour: 50 },
  growth_annual: { ai_calls_per_hour: 30, emails_per_hour: 50 },
  enterprise_monthly: { ai_calls_per_hour: 999, emails_per_hour: 200 },
  enterprise_annual: { ai_calls_per_hour: 999, emails_per_hour: 200 },
  trialing: { ai_calls_per_hour: 30, emails_per_hour: 50 },
  no_subscription: { ai_calls_per_hour: 5, emails_per_hour: 10 },
}

export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  try {
    const { org_id, action_type } = await req.json()

    if (!org_id || !action_type) {
      return new Response(JSON.stringify({ error: 'org_id and action_type required' }), { status: 400 })
    }

    // Get org subscription plan and check if user is global admin
    const { data: org } = await supabase
      .from('organizations')
      .select('subscription_plan, subscription_status')
      .eq('id', org_id)
      .single()

    // Check if the org has any global admin members (platform owner orgs get enterprise limits)
    const { data: adminMembers } = await supabase
      .from('user_profiles')
      .select('is_global_admin')
      .eq('org_id', org_id)
      .eq('is_global_admin', true)
      .limit(1)

    const hasGlobalAdmin = (adminMembers?.length ?? 0) > 0
    const planKey = hasGlobalAdmin
      ? 'enterprise_monthly'
      : org?.subscription_status === 'trialing' ? 'trialing' : (org?.subscription_plan || 'no_subscription')
    const limits = PLAN_LIMITS[planKey] || PLAN_LIMITS.no_subscription

    // Check usage in last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

    const { count } = await supabase
      .from('account_usage')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', org_id)
      .eq('action_type', action_type)
      .gte('created_at', oneHourAgo)

    const currentCount = count || 0
    const limit = action_type === 'ai_call' ? limits.ai_calls_per_hour : limits.emails_per_hour

    if (currentCount >= limit) {
      return new Response(JSON.stringify({
        allowed: false,
        current: currentCount,
        limit,
        retry_after_seconds: 3600,
        message: `Rate limit exceeded. ${action_type === 'ai_call' ? 'AI analysis' : 'Email'} limit: ${limit}/hour. Current usage: ${currentCount}. ${planKey === 'no_subscription' ? 'Subscribe to increase limits.' : 'Upgrade to Enterprise for higher limits.'}`,
      }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': '3600',
        }
      })
    }

    // Record usage
    await supabase
      .from('account_usage')
      .insert({
        org_id,
        action_type,
        created_at: new Date().toISOString(),
      })

    return new Response(JSON.stringify({
      allowed: true,
      current: currentCount + 1,
      limit,
      remaining: limit - currentCount - 1,
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (err: unknown) {
    // If rate limiting table doesn't exist, allow by default
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message.includes('42P01') || message.includes('relation')) {
      return new Response(JSON.stringify({ allowed: true, current: 0, limit: 999, remaining: 999 }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }
    return new Response(JSON.stringify({ error: message }), { status: 500 })
  }
}
