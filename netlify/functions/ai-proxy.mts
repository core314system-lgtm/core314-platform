import type { Context } from "@netlify/functions"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

export default async (req: Request, _context: Context) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { ...corsHeaders, "Content-Type": "application/json" } })
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const apiKey = process.env.OPENAI_API_KEY || process.env.TASKORDER_OPENAI_API_KEY
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "OpenAI API key not configured on the server." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  try {
    const body = await req.json()
    const { messages, model, temperature, max_tokens, response_format } = body

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Missing 'messages' array" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
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
        stream: true,
        stream_options: { include_usage: true },
      }),
    })

    if (openaiRes.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Please wait a minute and try again." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    if (!openaiRes.ok) {
      const err = await openaiRes.text()
      return new Response(JSON.stringify({ error: `AI analysis error: ${err}` }), {
        status: openaiRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Stream the OpenAI SSE events to keep the connection alive.
    // We forward each SSE line to the client as-is, wrapped in our own
    // SSE format. The client reads the text/event-stream and reconstructs
    // the final response.
    // 
    // Actually — simpler: pipe the raw OpenAI SSE stream directly to the client.
    // The client-side code will be updated to handle SSE and reconstruct the JSON.
    //
    // For backward compatibility, we use a passthrough approach:
    // Forward the OpenAI stream as text/event-stream to the client.
    return new Response(openaiRes.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    })
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : "Unknown error"
    return new Response(JSON.stringify({ error: errMsg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
}
