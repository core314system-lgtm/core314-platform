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
    const { naics_code, agency, keyword } = await req.json()
    if (!naics_code && !keyword) {
      return new Response(
        JSON.stringify({ error: "Provide at least a NAICS code or keyword" }),
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

    // Try to fetch real data from FPDS first
    let fpdsContext = ""
    try {
      const fpdsParams = new URLSearchParams()
      if (naics_code) fpdsParams.set("NAICS", naics_code)
      if (agency) fpdsParams.set("AGENCY_NAME", agency)
      if (keyword) fpdsParams.set("PRODUCT_OR_SERVICE_DESCRIPTION", keyword)
      fpdsParams.set("LAST_MOD_DATE", "[2024/01/01,]")

      const fpdsUrl = `https://www.fpds.gov/ezsearch/LATEST?q=${fpdsParams.toString()}&feed=atom&start=0&rows=20`
      const fpdsRes = await fetch(fpdsUrl, { signal: AbortSignal.timeout(8000) })
      if (fpdsRes.ok) {
        const fpdsText = await fpdsRes.text()
        fpdsContext = `\n\nReal FPDS data (Atom feed, first 20 results):\n${fpdsText.substring(0, 8000)}`
      }
    } catch {
      fpdsContext = "\n\n(FPDS data unavailable — generate analysis based on your knowledge of federal contracting patterns for the given NAICS/agency/keyword)"
    }

    const systemPrompt = `You are a federal contracting competitive intelligence analyst. Analyze federal procurement data and provide structured competitive landscape analysis.

Always respond with valid JSON matching this schema:
{
  "awards": [
    {
      "vendor_name": "string",
      "contract_number": "string",
      "agency": "string",
      "description": "string",
      "naics_code": "string",
      "award_date": "string (YYYY-MM-DD)",
      "dollars_obligated": number,
      "contract_type": "string (FFP, T&M, CPFF, etc.)",
      "set_aside": "string",
      "place_of_performance": "string"
    }
  ],
  "competitors": [
    {
      "name": "string",
      "total_awards": number,
      "total_dollars": number,
      "primary_agencies": ["string"],
      "primary_naics": ["string"],
      "avg_award_size": number,
      "win_rate_estimate": "string",
      "strengths": ["string"],
      "weaknesses": ["string"]
    }
  ],
  "market_summary": {
    "total_awards": number,
    "total_dollars": number,
    "avg_award_size": number,
    "top_agencies": ["string"],
    "trend": "string (market trend description)"
  },
  "recommendations": ["string"]
}

If FPDS data is provided, use it to populate real award records. If not, generate realistic but clearly marked illustrative data based on the market sector. Always provide actionable strategic recommendations.`

    const userPrompt = `Analyze the competitive landscape for:
- NAICS Code: ${naics_code || 'Not specified'}
- Agency: ${agency || 'All agencies'}
- Keywords: ${keyword || 'Not specified'}
${fpdsContext}`

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
        temperature: 0.3,
        max_tokens: 4000,
        response_format: { type: "json_object" },
      }),
    })

    if (!openaiRes.ok) {
      const errText = await openaiRes.text()
      console.error("OpenAI error:", errText)
      return new Response(
        JSON.stringify({ error: "AI analysis failed" }),
        { status: 500, headers: corsHeaders }
      )
    }

    const openaiData = await openaiRes.json()
    const content = openaiData.choices?.[0]?.message?.content
    if (!content) {
      return new Response(
        JSON.stringify({ error: "No results returned" }),
        { status: 500, headers: corsHeaders }
      )
    }

    const parsed = JSON.parse(content)
    return new Response(JSON.stringify(parsed), { status: 200, headers: corsHeaders })
  } catch (err) {
    console.error("Competitive intel error:", err)
    return new Response(
      JSON.stringify({ error: "Analysis failed" }),
      { status: 500, headers: corsHeaders }
    )
  }
}
