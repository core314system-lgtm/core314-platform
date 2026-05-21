import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"

/**
 * Netlify Function: External API for Project Management
 * 
 * POST /api/projects — Create a new project programmatically
 * GET  /api/projects — List projects for the authenticated user
 * 
 * Authentication: Bearer token (Supabase access token) or X-API-Key (org API key)
 */

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ""
const supabaseServiceKey = process.env.TASKORDER_SUPABASE_SERVICE_ROLE_KEY || ""

export default async (req: Request, _context: Context) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
  }

  if (req.method === "OPTIONS") {
    return new Response("", { status: 204, headers })
  }

  // Authenticate
  const authHeader = req.headers.get("authorization")
  const apiKey = req.headers.get("x-api-key")

  if (!authHeader && !apiKey) {
    return new Response(
      JSON.stringify({ error: "Missing authentication. Provide Authorization: Bearer <token> or X-API-Key header." }),
      { status: 401, headers }
    )
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  let userId: string | null = null
  let orgId: string | null = null

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7)
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers })
    }
    userId = user.id

    // Get user's current org
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("current_org_id")
      .eq("id", userId)
      .single()
    orgId = profile?.current_org_id || null
  } else if (apiKey) {
    // Look up API key in org settings
    const { data: orgs } = await supabase
      .from("organizations")
      .select("id, settings")

    const matchedOrg = (orgs || []).find(
      (o: { id: string; settings: Record<string, unknown> }) =>
        o.settings && (o.settings as Record<string, string>).api_key === apiKey
    )

    if (!matchedOrg) {
      return new Response(JSON.stringify({ error: "Invalid API key" }), { status: 401, headers })
    }
    orgId = matchedOrg.id

    // Get the org owner as the acting user
    const { data: owner } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("org_id", orgId)
      .eq("role", "owner")
      .limit(1)
      .single()
    userId = owner?.user_id || null
  }

  if (!userId) {
    return new Response(JSON.stringify({ error: "Could not resolve user" }), { status: 401, headers })
  }

  try {
    if (req.method === "GET") {
      // List projects
      let query = supabase.from("task_orders").select("*").order("created_at", { ascending: false })
      if (orgId) {
        query = query.eq("org_id", orgId)
      } else {
        query = query.eq("created_by", userId)
      }

      const { data, error } = await query
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers })
      }

      return new Response(JSON.stringify({ projects: data || [] }), { status: 200, headers })
    }

    if (req.method === "POST") {
      const body = await req.json()
      const {
        title,
        solicitation_number,
        task_order_number,
        site_name,
        location_city,
        location_state,
        due_date,
        notes,
        project_type = "government_task_order",
        status = "draft",
        source,
        source_id,
      } = body

      if (!title) {
        return new Response(JSON.stringify({ error: "title is required" }), { status: 400, headers })
      }

      const insertData: Record<string, unknown> = {
        title,
        solicitation_number: solicitation_number || null,
        task_order_number: task_order_number || null,
        site_name: site_name || null,
        location_city: location_city || null,
        location_state: location_state || null,
        due_date: due_date || null,
        notes: notes || null,
        project_type,
        status,
        created_by: userId,
        source: source || null,
        source_id: source_id || null,
      }

      if (orgId) {
        insertData.org_id = orgId
      }

      const { data, error } = await supabase.from("task_orders").insert(insertData).select().single()

      if (error) {
        // Retry without source columns if they don't exist
        if (error.message?.includes("source")) {
          delete insertData.source
          delete insertData.source_id
          const { data: fallback, error: fallbackErr } = await supabase
            .from("task_orders")
            .insert(insertData)
            .select()
            .single()

          if (fallbackErr) {
            return new Response(JSON.stringify({ error: fallbackErr.message }), { status: 500, headers })
          }
          return new Response(JSON.stringify({ project: fallback }), { status: 201, headers })
        }
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers })
      }

      // Record in workflow history
      try {
        await supabase.from("workflow_history").insert({
          task_order_id: data.id,
          from_stage: null,
          to_stage: status,
          changed_by: userId,
          changed_by_name: null,
          note: source ? `Imported from ${source}` : "Created via API",
        })
      } catch {
        // workflow_history may not exist
      }

      return new Response(JSON.stringify({ project: data }), { status: 201, headers })
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return new Response(JSON.stringify({ error: message }), { status: 500, headers })
  }
}

export const config = {
  path: "/api/projects",
}
