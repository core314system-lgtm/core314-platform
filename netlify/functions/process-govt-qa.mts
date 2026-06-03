import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"
import { sanitizeAndLimit } from "./_shared/sanitize.ts"

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!
)

const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

interface QAPair {
  question_number: string | null
  question_text: string
  answer_text: string
  section_reference: string | null
}

interface SubQuestion {
  id: string
  question_text: string
  subcontractor_id: string
  company_name: string
  contact_email: string | null
  sow_name: string | null
  status: string
}

interface MatchResult {
  govt_qa: QAPair
  matched_sub_question: SubQuestion | null
  confidence: number
  match_reason: string
}

export default async (req: Request, _context: Context) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders })
  }

  try {
    const { task_order_id, qa_pairs, action } = await req.json()

    if (!task_order_id) {
      return new Response(JSON.stringify({ error: "task_order_id required" }), { status: 400, headers: corsHeaders })
    }

    // Action: parse — AI extracts Q&A pairs from document text
    if (action === "parse") {
      const { document_text } = await req.json().catch(() => ({ document_text: null }))
      // For now, the frontend handles parsing. This endpoint receives pre-parsed Q&A pairs.
      return new Response(JSON.stringify({ error: "Use 'match' action with pre-parsed qa_pairs" }), { status: 400, headers: corsHeaders })
    }

    // Action: match — match government Q&A pairs against subcontractor questions
    if (action === "match" && qa_pairs) {
      // Get all pending subcontractor questions for this task order
      const { data: subQuestions } = await supabase
        .from("opportunity_questions")
        .select("id, question_text, subcontractor_id, related_section, status, sow_subcontractor_id")
        .eq("task_order_id", task_order_id)
        .eq("is_from_portal", true)
        .in("status", ["pending_submission", "submitted", "pending_review"])

      // Get subcontractor info
      const subIds = [...new Set((subQuestions || []).map(q => q.subcontractor_id).filter(Boolean))]
      let subMap: Record<string, { company_name: string; contact_email: string | null }> = {}
      if (subIds.length > 0) {
        const { data: subs } = await supabase
          .from("subcontractors")
          .select("id, company_name, contact_email")
          .in("id", subIds)
        if (subs) {
          for (const s of subs) subMap[s.id] = { company_name: s.company_name, contact_email: s.contact_email }
        }
      }

      // Use OpenAI to match Q&A pairs to subcontractor questions
      const openaiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY
      const matches: MatchResult[] = []

      if (openaiKey && subQuestions && subQuestions.length > 0) {
        const subQList = subQuestions.map(q => ({
          id: q.id,
          text: q.question_text,
          sub_id: q.subcontractor_id,
        }))

        const prompt = `You are matching government Q&A responses to subcontractor questions.

Government Q&A pairs:
${(qa_pairs as QAPair[]).map((qa, i) => `[G${i}] Q: ${qa.question_text}\nA: ${qa.answer_text}`).join("\n\n")}

Subcontractor questions awaiting answers:
${subQList.map((q, i) => `[S${i}] ${q.text}`).join("\n")}

For each government Q&A pair, determine if it answers any of the subcontractor questions. Return a JSON array where each element has:
- govt_index: number (index of govt Q&A)
- sub_index: number or null (index of matching sub question, null if no match)
- confidence: number 0-100
- match_reason: string explaining why they match or don't

Only match if the government answer genuinely addresses the subcontractor's question. Be conservative — a partial match should have lower confidence.

Return ONLY valid JSON array, no other text.`

        try {
          const aiResp = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              messages: [{ role: "user", content: prompt }],
              temperature: 0.1,
              response_format: { type: "json_object" },
            }),
          })

          if (aiResp.ok) {
            const aiData = await aiResp.json()
            const content = aiData.choices?.[0]?.message?.content
            if (content) {
              const parsed = JSON.parse(content)
              const matchArray = parsed.matches || parsed

              for (const m of (Array.isArray(matchArray) ? matchArray : [])) {
                const govtQa = (qa_pairs as QAPair[])[m.govt_index]
                if (!govtQa) continue

                let matchedSub: SubQuestion | null = null
                if (m.sub_index !== null && m.sub_index !== undefined && subQList[m.sub_index]) {
                  const sq = subQuestions![m.sub_index]
                  const subInfo = subMap[sq.subcontractor_id] || { company_name: "Unknown", contact_email: null }
                  matchedSub = {
                    id: sq.id,
                    question_text: sq.question_text,
                    subcontractor_id: sq.subcontractor_id,
                    company_name: subInfo.company_name,
                    contact_email: subInfo.contact_email,
                    sow_name: null,
                    status: sq.status,
                  }
                }

                matches.push({
                  govt_qa: govtQa,
                  matched_sub_question: matchedSub,
                  confidence: m.confidence || 0,
                  match_reason: m.match_reason || "",
                })
              }
            }
          }
        } catch (aiErr) {
          console.error("AI matching failed:", aiErr)
        }
      }

      // For any govt Q&A not matched by AI, add as unmatched
      const matchedGovtIndices = new Set(matches.map(m => (qa_pairs as QAPair[]).indexOf(m.govt_qa)))
      for (let i = 0; i < (qa_pairs as QAPair[]).length; i++) {
        if (!matchedGovtIndices.has(i)) {
          matches.push({
            govt_qa: (qa_pairs as QAPair[])[i],
            matched_sub_question: null,
            confidence: 0,
            match_reason: "No matching subcontractor question found — stored as project intelligence",
          })
        }
      }

      return new Response(JSON.stringify({ success: true, matches, total_govt_qa: (qa_pairs as QAPair[]).length, total_sub_questions: subQuestions?.length || 0 }), { headers: corsHeaders })
    }

    // Action: distribute — send matched answers to subcontractors
    if (action === "distribute") {
      const { approved_matches } = await req.json().catch(() => ({ approved_matches: null }))
      if (!approved_matches) {
        // Re-read from body since we already consumed it
        return new Response(JSON.stringify({ error: "approved_matches required" }), { status: 400, headers: corsHeaders })
      }
      // This is handled by the frontend calling notify-qa-response
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders })
    }

    return new Response(JSON.stringify({ error: "Invalid action. Use 'match' or 'distribute'" }), { status: 400, headers: corsHeaders })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders })
  }
}
