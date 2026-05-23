import type { Context } from "@netlify/functions"

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

    // Use OpenAI streaming to keep the Netlify function alive.
    // We return a ReadableStream that emits whitespace while waiting
    // for OpenAI chunks, then emits the final assembled JSON response.
    // JSON.parse ignores leading whitespace, so the client can use
    // a normal res.json() call.
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
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Please wait a minute and try again." }), { status: 429, headers: corsHeaders })
    }

    if (!openaiRes.ok) {
      const err = await openaiRes.text()
      return new Response(JSON.stringify({ error: `AI analysis error: ${err}` }), { status: openaiRes.status, headers: corsHeaders })
    }

    const decoder = new TextDecoder()
    const encoder = new TextEncoder()
    const reader = openaiRes.body!.getReader()

    const stream = new ReadableStream({
      async start(controller) {
        const contentParts: string[] = []
        let finishReason: string | null = null
        let modelName = model || "gpt-4o-mini"
        let promptTokens = 0
        let completionTokens = 0
        let sseBuffer = ""

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            // Emit a space to keep the HTTP connection alive
            controller.enqueue(encoder.encode(" "))

            sseBuffer += decoder.decode(value, { stream: true })
            const lines = sseBuffer.split("\n")
            sseBuffer = lines.pop() || ""

            for (const line of lines) {
              const trimmed = line.trim()
              if (!trimmed || trimmed === "data: [DONE]") continue
              if (!trimmed.startsWith("data: ")) continue

              try {
                const chunk = JSON.parse(trimmed.slice(6))
                const delta = chunk.choices?.[0]?.delta
                if (delta?.content) contentParts.push(delta.content)
                if (chunk.choices?.[0]?.finish_reason) finishReason = chunk.choices[0].finish_reason
                if (chunk.model) modelName = chunk.model
                if (chunk.usage) {
                  promptTokens = chunk.usage.prompt_tokens || 0
                  completionTokens = chunk.usage.completion_tokens || 0
                }
              } catch {
                // skip malformed SSE chunks
              }
            }
          }
        } catch {
          // stream read error — use whatever content we collected
        }

        const fullContent = contentParts.join("")
        const response = {
          choices: [{
            index: 0,
            message: { role: "assistant", content: fullContent },
            finish_reason: finishReason || "stop",
          }],
          model: modelName,
          usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens, total_tokens: promptTokens + completionTokens },
        }

        controller.enqueue(encoder.encode(JSON.stringify(response)))
        controller.close()
      },
    })

    return new Response(stream, { headers: corsHeaders })
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : "Unknown error"
    return new Response(JSON.stringify({ error: errMsg }), { status: 500, headers: corsHeaders })
  }
}
