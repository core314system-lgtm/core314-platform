import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"

/**
 * Bulk insert/upsert records into master_subcontractors.
 * Uses service role key to bypass RLS.
 * Called by the client-side file upload parser after streaming the SAM.gov extract.
 *
 * POST body: { records: object[] }
 * Returns: { imported: number, skipped: number, errors: string[] }
 */

const SUPABASE_URL = process.env.TASKORDER_SUPABASE_URL || process.env.SUPABASE_URL || ""
const SUPABASE_SERVICE_KEY = process.env.TASKORDER_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ""

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-user-id",
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

  // Auth check — require a logged-in user
  const authHeader = req.headers.get("Authorization")
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json", ...corsHeaders },
    })
  }

  try {
    const body = await req.json()
    const { records } = body

    if (!records || !Array.isArray(records) || records.length === 0) {
      return new Response(JSON.stringify({ error: "No records provided" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
      })
    }

    // Limit batch size to 500 per request
    const batch = records.slice(0, 500)

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // Verify caller is admin
    const token = authHeader.replace("Bearer ", "")
    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { "Content-Type": "application/json", ...corsHeaders },
      })
    }

    // Check admin status
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

    let imported = 0
    let skipped = 0
    const errors: string[] = []

    // Try batch upsert first
    const { data, error } = await supabase
      .from("master_subcontractors")
      .upsert(batch, { onConflict: "sam_uei", ignoreDuplicates: true })
      .select("id")

    if (error) {
      console.error("BATCH UPSERT ERROR:", error.code, error.message, error.details)
      console.error("FIRST RECORD SAMPLE:", JSON.stringify(batch[0]).slice(0, 500))
      
      // Batch failed — try first record individually to get exact error
      const { error: firstErr } = await supabase
        .from("master_subcontractors")
        .upsert(batch[0], { onConflict: "sam_uei", ignoreDuplicates: true })
      
      if (firstErr) {
        console.error("SINGLE RECORD ERROR:", firstErr.code, firstErr.message, firstErr.details)
        errors.push(`DB Error: ${firstErr.code} — ${firstErr.message}${firstErr.details ? ' — ' + firstErr.details : ''}`)
      }

      // Try remaining records one by one
      for (const record of batch) {
        const { error: singleErr } = await supabase
          .from("master_subcontractors")
          .upsert(record, { onConflict: "sam_uei", ignoreDuplicates: true })
        if (!singleErr) {
          imported++
        } else {
          skipped++
        }
      }
    } else {
      imported = data?.length || batch.length
    }

    return new Response(JSON.stringify({ imported, skipped, errors }), {
      status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || String(err) }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
    })
  }
}
