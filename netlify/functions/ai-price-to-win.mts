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
    const body = await req.json()
    const { contract_type, estimated_value, naics_code, agency, scope, period_months, set_aside, incumbent_info } = body

    if (!scope) {
      return new Response(
        JSON.stringify({ error: "Scope of work is required" }),
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

    const systemPrompt = `You are a federal contracting pricing strategist with deep expertise in government contract pricing, FAR 15.101-1 best value tradeoff analysis, and competitive pricing intelligence.

Analyze the opportunity and provide a comprehensive price-to-win analysis. Always respond with valid JSON matching this schema:
{
  "recommended_price_range": {
    "low": number (dollars),
    "target": number (dollars - optimal price point),
    "high": number (dollars),
    "currency": "USD"
  },
  "confidence_level": "string (High/Medium/Low with brief justification)",
  "analysis": {
    "market_rate_analysis": "string (2-3 sentences)",
    "competitive_position": "string (2-3 sentences)",
    "historical_pricing": "string (2-3 sentences)",
    "risk_factors": ["string"]
  },
  "labor_rate_benchmarks": [
    {
      "category": "string (labor category name)",
      "market_low": number ($/hr),
      "market_avg": number ($/hr),
      "market_high": number ($/hr),
      "recommended": number ($/hr)
    }
  ],
  "pricing_strategies": [
    {
      "strategy_name": "string",
      "description": "string",
      "price_point": number (total dollars),
      "win_probability": "string (e.g. '60-70%')",
      "risk_level": "string (Low/Medium/High)",
      "tradeoffs": ["string"]
    }
  ],
  "cost_drivers": [
    {
      "driver": "string",
      "impact": "string (dollar or percentage impact)",
      "mitigation": "string"
    }
  ],
  "recommendations": ["string (actionable pricing recommendations)"]
}

Base your analysis on realistic federal contracting market rates, GSA pricing, and DOL wage determinations. Provide at least 3 pricing strategies (aggressive, target, conservative).`

    const userPrompt = `Opportunity details:
- Contract Type: ${contract_type || 'FFP'}
- Estimated Value: ${estimated_value ? `$${estimated_value.toLocaleString()}` : 'Not specified'}
- NAICS: ${naics_code || 'Not specified'}
- Agency: ${agency || 'Not specified'}
- Period: ${period_months ? `${period_months} months` : 'Not specified'}
- Set-Aside: ${set_aside || 'Full & Open'}
- Incumbent: ${incumbent_info || 'Unknown'}

Scope of Work:
${scope}`

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
    console.error("PTW analysis error:", err)
    return new Response(
      JSON.stringify({ error: "Analysis failed" }),
      { status: 500, headers: corsHeaders }
    )
  }
}
