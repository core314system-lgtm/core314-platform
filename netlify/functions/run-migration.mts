import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"

/**
 * Migration runner for Q&A Management tables.
 * Uses Supabase service role to verify table creation.
 * Tables must be created via the Supabase Dashboard SQL Editor.
 *
 * POST /api/run-migration
 * Headers: Authorization: Bearer <service_role_key>
 *
 * Returns status of each required table (exists or missing).
 * If tables are missing, provides the SQL to run in the Dashboard.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
}

export default async (req: Request, _context: Context) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders })
  }

  const authHeader = req.headers.get("Authorization")
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.TASKORDER_SUPABASE_SERVICE_ROLE_KEY
  if (!authHeader || !serviceKey || authHeader !== `Bearer ${serviceKey}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders })
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!
  const supabase = createClient(supabaseUrl, serviceKey)

  const results: Array<{ table: string; status: string; error?: string }> = []

  // Check each required table
  const tables = ["opportunity_questions", "question_submissions", "question_answer_history"]
  for (const table of tables) {
    const { error } = await supabase.from(table).select("id").limit(1)
    if (error) {
      results.push({ table, status: "missing", error: error.message })
    } else {
      results.push({ table, status: "exists" })
    }
  }

  // Check question_deadline column on task_orders
  const { data: to, error: toErr } = await supabase
    .from("task_orders")
    .select("question_deadline")
    .limit(1)
  results.push({
    table: "task_orders.question_deadline",
    status: toErr ? "missing" : "exists",
    error: toErr?.message,
  })

  const missing = results.filter(r => r.status === "missing")
  const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || ""

  return new Response(
    JSON.stringify({
      success: missing.length === 0,
      results,
      missing: missing.length,
      instructions: missing.length > 0
        ? `Run the migration SQL in the Supabase Dashboard SQL Editor: https://supabase.com/dashboard/project/${projectRef}/sql/new`
        : "All tables exist. Migration complete.",
      migration_file: "supabase/migration-qa-management.sql",
    }),
    { headers: corsHeaders }
  )
}
