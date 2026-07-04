import type { Context } from "@netlify/functions"

export default async (req: Request, _context: Context) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json",
  }

  if (req.method === "OPTIONS") {
    return new Response("", { status: 204, headers: corsHeaders })
  }

  try {
    const { section_text } = await req.json()
    if (!section_text || section_text.trim().length < 50) {
      return new Response(
        JSON.stringify({ error: "Section text too short. Paste the full Section L/M content." }),
        { status: 400, headers: corsHeaders }
      )
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY
    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "OpenAI API key not configured" }),
        { status: 500, headers: corsHeaders }
      )
    }

    const systemPrompt = `You are a GovCon proposal expert specializing in federal RFP analysis. You analyze Section L (Instructions to Offerors) and Section M (Evaluation Criteria) documents to extract structured data for proposal teams.

Always respond with valid JSON matching this schema:
{
  "evaluation_factors": [
    {
      "id": "string (unique)",
      "factor_name": "string",
      "weight": "string (e.g. 'Most Important', 'Important', '30%')",
      "subfactors": ["string"],
      "section_reference": "string (e.g. 'M.1.a')",
      "proposal_section": "string (which proposal section addresses this)",
      "requirements": ["string (specific requirements for this factor)"],
      "status": "not_started"
    }
  ],
  "proposal_outline": [
    {
      "volume": "string (e.g. 'Volume I')",
      "section": "string",
      "description": "string",
      "page_limit": "string or null",
      "eval_factor_refs": ["string (which eval factors this section addresses)"]
    }
  ],
  "key_instructions": ["string"],
  "page_limits": {"volume_name": "page_limit"},
  "submission_requirements": ["string"],
  "warnings": ["string (compliance traps, unusual requirements, potential pitfalls)"]
}`

    const userPrompt = `Analyze this Section L/M text and extract all evaluation criteria, proposal structure, and submission requirements:\n\n${section_text.substring(0, 15000)}`

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 4000,
        response_format: { type: "json_object" },
      }),
    })

    if (!openaiRes.ok) {
      const errText = await openaiRes.text()
      console.error("OpenAI error:", errText)
      return new Response(
        JSON.stringify({ error: "AI analysis failed. Please try again." }),
        { status: 500, headers: corsHeaders }
      )
    }

    const openaiData = await openaiRes.json()
    const content = openaiData.choices?.[0]?.message?.content

    if (!content) {
      return new Response(
        JSON.stringify({ error: "No analysis results returned" }),
        { status: 500, headers: corsHeaders }
      )
    }

    const parsed = JSON.parse(content)
    return new Response(JSON.stringify(parsed), { status: 200, headers: corsHeaders })
  } catch (err) {
    console.error("Section L/M analysis error:", err)
    return new Response(
      JSON.stringify({ error: "Analysis failed. Check input format and try again." }),
      { status: 500, headers: corsHeaders }
    )
  }
}
