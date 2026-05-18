import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!
)

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

  try {
    const { question_id, answer_text, share_with_all, user_id } = await req.json()

    if (!question_id || !answer_text?.trim()) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: corsHeaders })
    }

    const status = share_with_all ? "shared" : "answered"

    const { data, error } = await supabase
      .from("subcontractor_questions")
      .update({
        answer_text: answer_text.trim(),
        answered_by: user_id || null,
        answered_at: new Date().toISOString(),
        status,
        shared_with_all: share_with_all || false,
      })
      .eq("id", question_id)
      .select("*, sow_subcontractors(*, subcontractors(*))")
      .single()

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
    }

    // Log communication
    const sub = (data as any)?.sow_subcontractors?.subcontractors
    await supabase.from("sow_communications").insert({
      sow_subcontractor_id: data.sow_subcontractor_id,
      comm_type: "response",
      direction: "outbound",
      subject: `Answer to question${share_with_all ? " (shared with all)" : ""}`,
      body: answer_text.trim(),
      created_by: user_id || null,
    })

    // If sub was in questions_pending, update to reviewing
    const sowSub = (data as any)?.sow_subcontractors
    if (sowSub && sowSub.outreach_status === "questions_pending") {
      await supabase
        .from("sow_subcontractors")
        .update({ outreach_status: "reviewing", updated_at: new Date().toISOString() })
        .eq("id", data.sow_subcontractor_id)
    }

    // Optionally send email notification to sub about the answer
    // (can be added later with SendGrid)

    return new Response(JSON.stringify({ success: true, question: data }), { headers: corsHeaders })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders })
  }
}
