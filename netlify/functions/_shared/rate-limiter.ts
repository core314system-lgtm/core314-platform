import { createClient } from "@supabase/supabase-js"

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.TASKORDER_SUPABASE_SERVICE_ROLE_KEY
const hasServiceRole = Boolean(serviceRoleKey)

if (!hasServiceRole) {
  // Without the service-role key the client falls back to the anon key, which
  // RLS blocks from reading/writing account_usage — so the limiter silently
  // never counts anything and every request is allowed. Make that loud.
  console.error(
    "[rate-limiter] SUPABASE_SERVICE_ROLE_KEY is not set — rate limiting is DISABLED " +
    "(usage cannot be recorded under RLS with the anon key). Set it in the Netlify environment."
  )
}

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!,
  serviceRoleKey || process.env.VITE_SUPABASE_ANON_KEY!
)

export interface RateLimitConfig {
  ai_calls_per_hour: number
  emails_per_hour: number
  api_calls_per_minute: number
}

export const PLAN_LIMITS: Record<string, RateLimitConfig> = {
  growth_monthly:     { ai_calls_per_hour: 30,  emails_per_hour: 50,  api_calls_per_minute: 60 },
  growth_annual:      { ai_calls_per_hour: 30,  emails_per_hour: 50,  api_calls_per_minute: 60 },
  enterprise_monthly: { ai_calls_per_hour: 999, emails_per_hour: 200, api_calls_per_minute: 120 },
  enterprise_annual:  { ai_calls_per_hour: 999, emails_per_hour: 200, api_calls_per_minute: 120 },
  trialing:           { ai_calls_per_hour: 30,  emails_per_hour: 50,  api_calls_per_minute: 60 },
  no_subscription:    { ai_calls_per_hour: 5,   emails_per_hour: 10,  api_calls_per_minute: 20 },
}

export type ActionType = "ai_call" | "email" | "api_call"

/** Resolve which PLAN_LIMITS key applies given org state. Pure + testable. */
export function resolvePlanKey(params: {
  hasGlobalAdmin: boolean
  subscriptionStatus?: string | null
  subscriptionPlan?: string | null
}): string {
  const { hasGlobalAdmin, subscriptionStatus, subscriptionPlan } = params
  if (hasGlobalAdmin) return "enterprise_monthly"
  if (subscriptionStatus === "trialing") return "trialing"
  return subscriptionPlan || "no_subscription"
}

/** The numeric limit for a given plan key + action. Falls back to no_subscription. */
export function limitFor(planKey: string, actionType: ActionType): number {
  const limits = PLAN_LIMITS[planKey] || PLAN_LIMITS.no_subscription
  if (actionType === "ai_call") return limits.ai_calls_per_hour
  if (actionType === "email") return limits.emails_per_hour
  return limits.api_calls_per_minute
}

interface RateLimitResult {
  allowed: boolean
  current: number
  limit: number
  remaining: number
  retryAfterSeconds?: number
}

export async function checkRateLimit(orgId: string, actionType: ActionType): Promise<RateLimitResult> {
  try {
    const { data: org } = await supabase
      .from("organizations")
      .select("subscription_plan, subscription_status")
      .eq("id", orgId)
      .single()

    // Check if org has global admin members (platform owner orgs get enterprise limits)
    const { data: adminMembers } = await supabase
      .from("user_profiles")
      .select("is_global_admin")
      .eq("current_org_id", orgId)
      .eq("is_global_admin", true)
      .limit(1)

    const hasGlobalAdmin = (adminMembers?.length ?? 0) > 0
    const planKey = resolvePlanKey({
      hasGlobalAdmin,
      subscriptionStatus: org?.subscription_status,
      subscriptionPlan: org?.subscription_plan,
    })

    const isMinuteWindow = actionType === "api_call"
    const windowMs = isMinuteWindow ? 60 * 1000 : 60 * 60 * 1000
    const windowStart = new Date(Date.now() - windowMs).toISOString()

    const { count, error: countError } = await supabase
      .from("account_usage")
      .select("*", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("action_type", actionType)
      .gte("created_at", windowStart)

    if (countError) {
      console.error(`[rate-limiter] usage count query failed for org ${orgId}: ${countError.message}`)
    }

    const currentCount = count || 0
    const limit = limitFor(planKey, actionType)

    if (currentCount >= limit) {
      return {
        allowed: false,
        current: currentCount,
        limit,
        remaining: 0,
        retryAfterSeconds: isMinuteWindow ? 60 : 3600,
      }
    }

    const { error: insertError } = await supabase.from("account_usage").insert({
      org_id: orgId,
      action_type: actionType,
      created_at: new Date().toISOString(),
    })

    if (insertError) {
      // If usage cannot be recorded the limiter can never enforce — surface it.
      console.error(`[rate-limiter] failed to record usage for org ${orgId} (${actionType}): ${insertError.message}`)
    }

    return {
      allowed: true,
      current: currentCount + 1,
      limit,
      remaining: limit - currentCount - 1,
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown"
    if (message.includes("42P01") || message.includes("relation")) {
      return { allowed: true, current: 0, limit: 999, remaining: 999 }
    }
    return { allowed: true, current: 0, limit: 999, remaining: 999 }
  }
}

export function rateLimitResponse(result: RateLimitResult, actionLabel: string): Response {
  return new Response(JSON.stringify({
    error: `Rate limit exceeded for ${actionLabel}. Limit: ${result.limit}. Current: ${result.current}. Please try again later.`,
    retry_after_seconds: result.retryAfterSeconds,
  }), {
    status: 429,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Retry-After": String(result.retryAfterSeconds || 3600),
    },
  })
}
