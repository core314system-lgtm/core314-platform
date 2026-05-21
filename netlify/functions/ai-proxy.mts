import type { Context } from "@netlify/functions"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
}

const MAX_RETRIES = 3
const RETRY_BASE_DELAY = 5000

export default async (req: Request, _context: Context) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders })
  }

  const apiKey = process.env.OPENAI_API_KEY || process.env.TASKORDER_OPENAI_API_KEY
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "OpenAI API key not configured on the server." }), { status: 500, headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { messages, model, temperature, max_tokens, response_format } = body

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Missing 'messages' array" }), { status: 400, headers: corsHeaders })
    }

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model || "gpt-4o-mini",
          messages,
          temperature: temperature ?? 0.1,
          max_tokens: max_tokens || 16384,
          ...(response_format ? { response_format } : {}),
        }),
      })

      if (res.status === 429) {
        if (attempt < MAX_RETRIES) {
          const delay = RETRY_BASE_DELAY * Math.pow(2, attempt)
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please wait a minute and try again." }), { status: 429, headers: corsHeaders })
      }

      if (!res.ok) {
        const err = await res.text()
        return new Response(JSON.stringify({ error: `AI analysis error: ${err}` }), { status: res.status, headers: corsHeaders })
      }

      const data = await res.json()
      return new Response(JSON.stringify(data), { headers: corsHeaders })
    }

    return new Response(JSON.stringify({ error: "Failed after maximum retries" }), { status: 500, headers: corsHeaders })
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : "Unknown error"
    return new Response(JSON.stringify({ error: errMsg }), { status: 500, headers: corsHeaders })
  }
}
