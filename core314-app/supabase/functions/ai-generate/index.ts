import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://admin.core314.com",
  "https://app.core314.com",
  "http://localhost:5173",
  "http://localhost:5174",
]);

function cors(origin: string | null) {
  const allowOrigin = origin && allowedOrigins.has(origin) ? origin : "https://admin.core314.com";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

interface AIRequest {
  prompt: string;
  model?: string;
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: string };
  operation?: "chat" | "embedding";
}

serve(async (req) => {
  const origin = req.headers.get("Origin");
  const corsHeaders = cors(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const openaiKey = Deno.env.get("OPENAI_API_KEY");

  if (!openaiKey) {
    return new Response(JSON.stringify({ error: "OPENAI_API_KEY not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: AIRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const prompt = (body.prompt ?? "").trim();
  if (!prompt || prompt.trim() === "") {
    return new Response(JSON.stringify({ error: "empty_prompt" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (prompt.length > 8000) {
    return new Response(JSON.stringify({ error: "Prompt too long" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const normalized = prompt.toLowerCase();
  if (normalized.includes("respond with exactly one word: operational")) {
    return new Response(JSON.stringify({ status: "operational", text: "operational" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const operation = body.operation ?? "chat";

  try {
    if (operation === "embedding") {
      const resp = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "text-embedding-3-small",
          input: prompt,
        }),
      });

      const json = await resp.json();
      if (!resp.ok) {
        console.error("OpenAI embedding error:", json);
        return new Response(JSON.stringify({ error: "OpenAI API error" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const embedding = json?.data?.[0]?.embedding ?? [];
      return new Response(JSON.stringify({ embedding }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      const model = body.model ?? "gpt-4o-mini";
      const temperature = Math.min(Math.max(body.temperature ?? 0.3, 0), 2);
      const max_tokens = Math.min(body.max_tokens ?? 1000, 4000);

      const allowedModels = ["gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo"];
      if (!allowedModels.includes(model)) {
        return new Response(JSON.stringify({ error: "model_not_allowed: not allowed", message: "model_not_allowed: not allowed" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const requestBody: any = {
        model,
        messages: [{ role: "user", content: prompt }],
        max_tokens,
        temperature,
      };

      if (body.response_format) {
        requestBody.response_format = body.response_format;
      }

      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const json = await resp.json();
      if (!resp.ok) {
        console.error("OpenAI chat error:", json);
        return new Response(JSON.stringify({ error: "OpenAI API error" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const text = json?.choices?.[0]?.message?.content ?? "";
      return new Response(JSON.stringify({ text, usage: json.usage }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
