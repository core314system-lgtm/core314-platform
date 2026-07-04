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
    const { project, citations } = await req.json()
    if (!project || !citations || !Array.isArray(citations)) {
      return new Response(
        JSON.stringify({ error: "Missing project or citations" }),
        { status: 400, headers: corsHeaders }
      )
    }

    if (citations.length === 0) {
      return new Response(
        JSON.stringify({ recommendations: [] }),
        { status: 200, headers: corsHeaders }
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

    const systemPrompt = `You are a federal government contracting past performance analyst. You are given a project's details and a library of past performance citations. Your job is to rank each citation by relevance to the project and explain WHY each citation is relevant.

Scoring criteria (0-100):
- NAICS code match: +25 points if same NAICS, +15 if same 4-digit prefix, +5 if same 2-digit sector
- Agency match: +20 points if same agency or department
- Service scope similarity: +20 points based on relevance tags and service categories matching the project title/scope
- Contract value similarity: +10 points if within same order of magnitude
- Set-aside match: +10 points if same set-aside type
- Recency: +10 points if completed within last 3 years, +5 if within 5 years
- CPARS rating: +5 bonus for Exceptional/Very Good ratings

Respond with valid JSON:
{
  "recommendations": [
    {
      "citation_id": "string (the citation's id field)",
      "score": number (0-100 relevance score),
      "reasons": ["string array — 2-4 short reasons explaining the match (e.g. 'Same NAICS 561210', 'Same agency: USAF', 'Similar scope: facility maintenance')"]
    }
  ]
}

Rules:
- Rank ALL citations, highest score first
- Only include citations with score >= 20 (minimum threshold for any relevance)
- Be specific in reasons — mention actual NAICS codes, agency names, service types
- Maximum 15 recommendations`

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
            content: `PROJECT:\n${JSON.stringify(project, null, 2)}\n\nCITATIONS LIBRARY (${citations.length} total):\n${JSON.stringify(citations, null, 2)}`,
          },
        ],
        temperature: 0.1,
        max_tokens: 3000,
        response_format: { type: "json_object" },
      }),
    })

    if (!openaiRes.ok) {
      const errText = await openaiRes.text()
      console.error("OpenAI error:", errText)
      return new Response(
        JSON.stringify({ error: "AI matching failed" }),
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
    console.error("ai-past-performance-match error:", err)
    return new Response(
      JSON.stringify({ error: "Failed to match citations" }),
      { status: 500, headers: corsHeaders }
    )
  }
}
