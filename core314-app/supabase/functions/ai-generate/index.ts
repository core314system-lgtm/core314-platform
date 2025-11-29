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
    await logError(null, 500, "missing_openai_key", "OPENAI_API_KEY not configured", req.url);
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
    await logError(null, 401, "unauthorized", "Unauthorized", req.url);
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userId = user.id;

  const rateLimitResult = await checkRateLimit(supabase, userId);
  if (!rateLimitResult.allowed) {
    await logError(userId, 429, "rate_limit_exceeded", `Rate limit exceeded: ${rateLimitResult.count}/20 requests in current minute`, req.url);
    return new Response(
      JSON.stringify({ 
        error: "Rate limit exceeded",
        limit: 20,
        window: "1 minute",
        current: rateLimitResult.count,
        retry_after: rateLimitResult.retryAfter
      }),
      { 
        status: 429, 
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json",
          "Retry-After": rateLimitResult.retryAfter.toString()
        }
      }
    );
  }

  let body: AIRequest;
  try {
    body = await req.json();
  } catch {
    await logError(userId, 400, "invalid_json", "Invalid JSON", req.url);
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const prompt = (body.prompt ?? "").trim();
  if (!prompt) {
    await logError(userId, 400, "missing_prompt", "Missing prompt", req.url);
    return new Response(JSON.stringify({ error: "Missing prompt" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (prompt.length > 8000) {
    await logError(userId, 400, "prompt_too_long", `Prompt length ${prompt.length} exceeds maximum 8000`, req.url);
    return new Response(JSON.stringify({ error: "Prompt too long" }), {
      status: 400,
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
        await logError(userId, 500, "openai_api_error", `OpenAI API error: ${json.error?.message || 'Unknown error'}`, req.url);
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
        await logError(userId, 400, "invalid_model", `Model ${model} not allowed`, req.url);
        return new Response(JSON.stringify({ error: "Model not allowed" }), {
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
        await logError(userId, 500, "openai_api_error", `OpenAI API error: ${json.error?.message || 'Unknown error'}`, req.url);
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
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    await logError(userId, 500, "internal_error", errorMessage, req.url);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

interface RateLimitResult {
  allowed: boolean;
  count: number;
  retryAfter: number;
}

async function checkRateLimit(supabase: any, userId: string): Promise<RateLimitResult> {
  try {
    const now = new Date();
    const windowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 
                                  now.getHours(), now.getMinutes(), 0, 0);
    
    const { data, error } = await supabase
      .from('rate_limits')
      .upsert({
        user_id: userId,
        window_start: windowStart.toISOString(),
        count: 1
      }, {
        onConflict: 'user_id,window_start',
        returning: 'representation'
      })
      .select('count')
      .single();

    if (error) {
      const { data: existingData, error: selectError } = await supabase
        .from('rate_limits')
        .select('count')
        .eq('user_id', userId)
        .eq('window_start', windowStart.toISOString())
        .single();

      if (selectError || !existingData) {
        console.error('Rate limit check failed:', error, selectError);
        return { allowed: true, count: 1, retryAfter: 60 };
      }

      const newCount = existingData.count + 1;
      await supabase
        .from('rate_limits')
        .update({ count: newCount })
        .eq('user_id', userId)
        .eq('window_start', windowStart.toISOString());

      const secondsUntilReset = 60 - now.getSeconds();
      return {
        allowed: newCount <= 20,
        count: newCount,
        retryAfter: secondsUntilReset
      };
    }

    const count = data?.count || 1;
    const secondsUntilReset = 60 - now.getSeconds();

    return {
      allowed: count <= 20,
      count,
      retryAfter: secondsUntilReset
    };
  } catch (error) {
    console.error('Rate limit check error:', error);
    return { allowed: true, count: 1, retryAfter: 60 };
  }
}

async function logError(
  userId: string | null,
  statusCode: number,
  errorType: string,
  errorMessage: string,
  requestPath: string
): Promise<void> {
  try {
    if (statusCode < 400) return;

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Cannot log error: missing Supabase credentials');
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    await supabase
      .from('function_error_events')
      .insert({
        function_name: 'ai-generate',
        user_id: userId,
        status_code: statusCode,
        error_type: errorType,
        error_message: errorMessage,
        request_path: requestPath,
        metadata: {
          timestamp: new Date().toISOString()
        }
      });
  } catch (error) {
    console.error('Failed to log error event:', error);
  }
}
