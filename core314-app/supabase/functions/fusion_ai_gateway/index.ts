import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { corsHeaders } from '../_shared/cors.ts';
import { verifyAndAuthorizeWithPolicy } from '../_shared/auth.ts';
import { withSentry, breadcrumb, handleSentryTest, jsonError } from "../_shared/sentry.ts";

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
  context?: {
    integration_name?: string;
    metric_data?: Record<string, unknown>;
    user_goal?: string;
  };
  data_context?: Record<string, unknown>; // Live metrics from ai_data_context
}

interface ChatResponse {
  success: boolean;
  reply?: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  error?: string;
}

Deno.serve(withSentry(async (req) => {
  const testResponse = await handleSentryTest(req);
  if (testResponse) return testResponse;

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authResult = await verifyAndAuthorizeWithPolicy(
      req,
      supabase,
      ['platform_admin', 'operator', 'admin', 'manager'],
      'fusion_ai_gateway'
    );

    if (!authResult.ok) {
      return authResult.response;
    }

    const userId = authResult.context.userId;
    const orgId = authResult.context.orgId;

    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_tier, organization_id')
      .eq('id', userId)
      .single();

    if (!profile) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'User profile not found',
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const userTier = profile.subscription_tier;
    const userOrgId = profile.organization_id || orgId;

    const { data: hasQuota } = await supabase.rpc('check_ai_quota', {
      p_user_id: userId,
      p_tier: userTier,
    });

    if (!hasQuota) {
      const { data: quotaLimit } = await supabase.rpc('get_ai_quota_for_tier', {
        p_tier: userTier,
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: `AI request quota exceeded. Your ${userTier} plan includes ${quotaLimit} requests per month. Please upgrade to access more AI insights.`,
          quota_exceeded: true,
        }),
        {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ success: false, error: 'Method not allowed' }),
        {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const body: ChatRequest = await req.json();

    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Messages array is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    const openaiEndpoint = Deno.env.get('CORE314_AI_ENDPOINT') || 'https://api.openai.com/v1/chat/completions';
    const openaiModel = Deno.env.get('CORE314_AI_MODEL') || 'gpt-4o-mini';

    if (!openaiApiKey) {
      console.error('OPENAI_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'AI service not configured' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    let systemContent = `You are Core314 AI, an intelligent assistant for the Core314 business operations platform. You help users understand their system health, integration performance, and operational metrics.

You have access to the following LIVE system data for this user:`;

    if (body.data_context) {
      systemContent += `\n\nCurrent System Metrics:\n${JSON.stringify(body.data_context, null, 2)}`;
    }

    if (body.context) {
      systemContent += `\n\nAdditional Context:\n${JSON.stringify(body.context, null, 2)}`;
    }

    systemContent += `\n\nWhen answering questions:
- Reference specific metrics from the live data when relevant
- Provide actionable insights based on actual performance numbers
- Be concise but thorough
- If you don't have enough information, ask clarifying questions
- Always cite specific data points when making recommendations`;

    const systemMessage: ChatMessage = {
      role: 'system',
      content: systemContent,
    };

    const messages = [systemMessage, ...body.messages];

    const openaiResponse = await fetch(openaiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: openaiModel,
        messages: messages,
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('OpenAI API error:', errorText);
      return new Response(
        JSON.stringify({ success: false, error: 'AI service error' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const openaiData = await openaiResponse.json();
    const reply = openaiData.choices[0]?.message?.content || 'No response generated';

    await supabase.rpc('increment_ai_usage', {
      p_user_id: userId,
      p_org_id: userOrgId,
    });

    const response: ChatResponse = {
      success: true,
      reply: reply,
      usage: openaiData.usage,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}, { name: "fusion_ai_gateway" }));