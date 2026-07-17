import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.TASKORDER_SUPABASE_ANON_KEY!

export interface Caller {
  userId: string
  orgId: string
}

/**
 * Resolve the caller from their Supabase JWT. We never trust a user_id/org_id
 * sent in the request body or a custom header — otherwise anyone could dodge
 * rate limits or spend/act on another org's behalf by supplying an arbitrary
 * UUID. Returns null when the token is missing/invalid. `orgId` falls back to
 * the user id so users without an org are still scoped (per-user) rather than
 * treated as anonymous.
 */
export async function resolveCaller(authHeader: string | null): Promise<Caller | null> {
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim()
  if (!token) return null
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data: { user }, error } = await sb.auth.getUser()
  if (error || !user) return null
  const { data: profile } = await sb
    .from("user_profiles")
    .select("current_org_id")
    .eq("id", user.id)
    .single()
  return { userId: user.id, orgId: profile?.current_org_id ?? user.id }
}
