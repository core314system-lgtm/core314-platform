import type { Context } from "@netlify/functions"
import { checkRateLimit } from "./_shared/rate-limiter.ts"

// Single source of truth: this endpoint delegates to the shared limiter so the
// plan resolution, usage recording, and error surfacing stay consistent with
// the inline checks used by ai-proxy / send-rfq / etc.
export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  try {
    const { org_id, action_type } = await req.json()

    if (!org_id || !action_type) {
      return new Response(JSON.stringify({ error: 'org_id and action_type required' }), { status: 400 })
    }
    if (!['ai_call', 'email', 'api_call'].includes(action_type)) {
      return new Response(JSON.stringify({ error: 'invalid action_type' }), { status: 400 })
    }

    const result = await checkRateLimit(org_id, action_type)

    if (!result.allowed) {
      return new Response(JSON.stringify({
        allowed: false,
        current: result.current,
        limit: result.limit,
        retry_after_seconds: result.retryAfterSeconds ?? 3600,
        message: `Rate limit exceeded. Limit: ${result.limit}. Current usage: ${result.current}.`,
      }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': String(result.retryAfterSeconds ?? 3600) },
      })
    }

    return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), { status: 500 })
  }
}
