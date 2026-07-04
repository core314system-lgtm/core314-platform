import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"

export default async (req: Request, _context: Context) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
    "Cache-Control": "public, max-age=300", // 5-minute cache
  }

  if (req.method === "OPTIONS") {
    return new Response("", { status: 204, headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!
    )

    const [totalRes, verifiedRes] = await Promise.all([
      supabase.from("master_subcontractors").select("*", { count: "exact", head: true }),
      supabase
        .from("master_subcontractors")
        .select("*", { count: "exact", head: true })
        .in("verification_status", ["verified", "claimed"]),
    ])

    return new Response(
      JSON.stringify({
        total: totalRes.count || 0,
        verified: verifiedRes.count || 0,
        statesCovered: 50,
        tradeCategories: 45,
      }),
      { status: 200, headers: corsHeaders }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ total: 0, verified: 0, statesCovered: 50, tradeCategories: 45 }),
      { status: 200, headers: corsHeaders }
    )
  }
}
