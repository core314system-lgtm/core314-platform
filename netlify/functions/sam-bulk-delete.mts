import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"

/**
 * Delete master_subcontractors records.
 * Uses service role key to bypass RLS.
 *
 * POST body: { ids?: string[], deleteAll?: boolean }
 * - ids: array of record IDs to delete individually
 * - deleteAll: if true, deletes ALL records in the table
 */

const SUPABASE_URL = process.env.TASKORDER_SUPABASE_URL || process.env.SUPABASE_URL || ""
const SUPABASE_SERVICE_KEY = process.env.TASKORDER_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ""

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

export default async function handler(req: Request, _context: Context) {
  if (req.method === "OPTIONS") {
    return new Response("", { status: 204, headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { "Content-Type": "application/json", ...corsHeaders },
    })
  }

  const authHeader = req.headers.get("Authorization")
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json", ...corsHeaders },
    })
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // Verify caller is admin
    const token = authHeader.replace("Bearer ", "")
    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { "Content-Type": "application/json", ...corsHeaders },
      })
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!profile || profile.role !== "admin") {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403, headers: { "Content-Type": "application/json", ...corsHeaders },
      })
    }

    const body = await req.json()
    const { ids, deleteAll } = body

    let deleted = 0

    if (deleteAll === true) {
      // Delete all records in batches (Supabase limits to 1000 rows per request)
      let totalDeleted = 0
      while (true) {
        const { data, error } = await supabase
          .from("master_subcontractors")
          .delete()
          .neq("id", "00000000-0000-0000-0000-000000000000")
          .select("id")
          .limit(1000)

        if (error) {
          return new Response(JSON.stringify({ error: error.message, deleted: totalDeleted }), {
            status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
          })
        }
        const batchCount = data?.length || 0
        totalDeleted += batchCount
        if (batchCount === 0) break
      }
      deleted = totalDeleted
    } else if (ids && Array.isArray(ids) && ids.length > 0) {
      // Delete specific records
      const { data, error } = await supabase
        .from("master_subcontractors")
        .delete()
        .in("id", ids)
        .select("id")

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
        })
      }
      deleted = data?.length || 0
    } else {
      return new Response(JSON.stringify({ error: "Provide ids[] or deleteAll: true" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
      })
    }

    return new Response(JSON.stringify({ deleted }), {
      status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || String(err) }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
    })
  }
}
