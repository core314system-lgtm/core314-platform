import type { Context } from "@netlify/functions"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
}

export default async (req: Request, _context: Context) => {
  if (req.method === "OPTIONS") {
    return new Response("", { status: 204, headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: corsHeaders }
    )
  }

  try {
    const { document_text, file_name } = await req.json()
    if (!document_text || typeof document_text !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing or invalid document_text" }),
        { status: 400, headers: corsHeaders }
      )
    }

    const OPENAI_API_KEY =
      process.env.OPENAI_API_KEY || process.env.TASKORDER_OPENAI_API_KEY
    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "OpenAI API key not configured" }),
        { status: 500, headers: corsHeaders }
      )
    }

    const truncatedText = document_text.substring(0, 30000)

    const systemPrompt = `You are a federal government contracting past performance analyst. You are given the text content of a past performance document (CPARS report, contract close-out summary, past performance volume from a proposal, SF-330, or similar).

Extract ALL past performance citations found in the document. For each citation, extract:

Respond with valid JSON matching this exact schema:
{
  "citations": [
    {
      "contract_title": "string (required — the contract or project name)",
      "contract_number": "string or null (contract/task order number, e.g. FA8732-21-D-0005)",
      "agency": "string or null (government agency, e.g. Department of the Air Force)",
      "client_name": "string or null (specific office or organization within the agency)",
      "contract_type": "string or null (one of: FFP, T&M, CPFF, CPAF, CPIF, IDIQ, BPA, Other)",
      "naics_code": "string or null (6-digit NAICS code if mentioned)",
      "set_aside": "string or null (e.g. Small Business, 8(a), SDVOSB, HUBZone, WOSB, Full & Open)",
      "contract_value": "number or null (total contract value in dollars — convert from millions if needed)",
      "period_of_performance_start": "string or null (YYYY-MM-DD format)",
      "period_of_performance_end": "string or null (YYYY-MM-DD format)",
      "relevance_tags": ["string array — short tags describing the work (e.g. facility maintenance, IT support, logistics)"],
      "service_categories": ["string array — broader service categories (e.g. Janitorial, HVAC, Cybersecurity, Software Development)"],
      "description": "string or null (brief description of the contract scope and work performed)",
      "our_role": "string or null (one of: prime, subcontractor, jv_partner, mentor, protege)",
      "key_personnel": ["string array — names and roles of key personnel mentioned (e.g. John Smith - PM)"],
      "cpars_rating": "string or null (one of: exceptional, very_good, satisfactory, marginal, unsatisfactory — map from any rating format used in the document)",
      "past_performance_narrative": "string or null (reusable narrative text describing performance, accomplishments, and outcomes — write it suitable for direct inclusion in a proposal)",
      "lessons_learned": "string or null (any lessons learned or improvement areas mentioned)"
    }
  ],
  "analysis_notes": "string — brief summary of what was found in the document and any caveats (e.g. 'Extracted 3 citations from a CPARS report. Contract values were estimated from partial data.')"
}

Guidelines:
- Extract EVERY distinct contract/citation found in the document. A single document may contain multiple citations.
- If the document only describes one contract, return an array with one citation.
- Be precise with dates — use YYYY-MM-DD format. If only year is given, use YYYY-01-01.
- For CPARS ratings, map any rating scale to the standard 5-level scale (exceptional, very_good, satisfactory, marginal, unsatisfactory).
- For contract values, always convert to raw dollars (e.g. "$5.2M" → 5200000).
- Write the past_performance_narrative in a professional, proposal-ready tone that can be directly reused.
- If certain fields cannot be determined from the document, set them to null.
- For our_role, try to determine if the company was the prime contractor, subcontractor, JV partner, etc.`

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Analyze this past performance document and extract all citations:\n\nFile: ${file_name || "document"}\n\n${truncatedText}`,
          },
        ],
        temperature: 0.1,
        max_tokens: 4000,
        response_format: { type: "json_object" },
      }),
    })

    if (!openaiRes.ok) {
      const errText = await openaiRes.text()
      console.error("OpenAI error:", errText)
      return new Response(
        JSON.stringify({ error: "AI analysis failed. Please try again." }),
        { status: 502, headers: corsHeaders }
      )
    }

    const aiData = await openaiRes.json()
    const content = aiData.choices?.[0]?.message?.content
    if (!content) {
      return new Response(
        JSON.stringify({ error: "No response from AI" }),
        { status: 502, headers: corsHeaders }
      )
    }

    const parsed = JSON.parse(content)
    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: corsHeaders,
    })
  } catch (err) {
    console.error("ai-past-performance error:", err)
    return new Response(
      JSON.stringify({
        error: "Failed to analyze document. Please try again.",
      }),
      { status: 500, headers: corsHeaders }
    )
  }
}
