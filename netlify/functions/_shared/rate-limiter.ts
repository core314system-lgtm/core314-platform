import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.TASKORDER_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!
)

interface RateLimitConfig {
  ai_calls_per_hour: number
  emails_per_hour: number
  api_calls_per_minute: number
}

const PLAN_LIMITS: Record<string, RateLimitConfig> = {
  growth_monthly:     { ai_calls_per_hour: 30,  emails_per_hour: 50,  api_calls_per_minute: 60 },
  growth_annual:      { ai_calls_per_hour: 30,  emails_per_hour: 50,  api_calls_per_minute: 60 },
  enterprise_monthly: { ai_calls_per_hour: 999, emails_per_hour: 200, api_calls_per_minute: 120 },
  enterprise_annual:  { ai_calls_per_hour: 999, emails_per_hour: 200, api_calls_per_minute: 120 },
  trialing:           { ai_calls_per_hour: 30,  emails_per_hour: 50,  api_calls_per_minute: 60 },
  no_subscription:    { ai_calls_per_hour: 5,   emails_per_hour: 10,  api_calls_per_minute: 20 },
}

type ActionType = "ai_call" | "email" | "api_call"

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

    const planKey = org?.subscription_status === "trialing"
      ? "trialing"
      : (org?.subscription_plan || "no_subscription")
    const limits = PLAN_LIMITS[planKey] || PLAN_LIMITS.no_subscription

    const isMinuteWindow = actionType === "api_call"
    const windowMs = isMinuteWindow ? 60 * 1000 : 60 * 60 * 1000
    const windowStart = new Date(Date.now() - windowMs).toISOString()

    const { count } = await supabase
      .from("account_usage")
      .select("*", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("action_type", actionType)
      .gte("created_at", windowStart)

    const currentCount = count || 0
    let limit: number
    if (actionType === "ai_call") limit = limits.ai_calls_per_hour
    else if (actionType === "email") limit = limits.emails_per_hour
    else limit = limits.api_calls_per_minute

    if (currentCount >= limit) {
      return {
        allowed: false,
        current: currentCount,
        limit,
        remaining: 0,
        retryAfterSeconds: isMinuteWindow ? 60 : 3600,
      }
    }

    await supabase.from("account_usage").insert({
      org_id: orgId,
      action_type: actionType,
      created_at: new Date().toISOString(),
    })

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
