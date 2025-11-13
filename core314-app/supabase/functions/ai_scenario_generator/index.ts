import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { corsHeaders } from '../_shared/cors.ts';
import { verifyAndAuthorizeWithPolicy } from '../_shared/auth.ts';

interface ScenarioRequest {
  goal?: string;
  metrics_snapshot?: Record<string, unknown>;
  horizon?: string;
  constraints?: string[];
}

interface ScenarioCard {
  id: string;
  title: string;
  description: string;
  expected_impact: string;
  confidence: number;
  recommended_action: string;
  horizon: string;
  tags: string[];
}

interface ScenarioResponse {
  success: boolean;
  scenarios?: ScenarioCard[];
  error?: string;
}

Deno.serve(async (req) => {
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
      'ai_scenario_generator'
    );

    if (!authResult.ok) {
      return authResult.response;
    }

    const userId = authResult.context.userId;

    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', userId)
      .single();

    if (!profile || !['professional', 'enterprise'].includes(profile.subscription_tier)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Predictive Optimization Engine requires Professional or Enterprise tier',
        }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: hasAccess } = await supabase.rpc('user_has_feature_access', {
      p_user_id: userId,
      p_feature_key: 'predictive_scenarios',
    });

    if (!hasAccess) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Predictive scenarios feature is not enabled for your account',
        }),
        {
          status: 403,
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

    const body: ScenarioRequest = await req.json().catch(() => ({}));
    const horizon = body.horizon || '7d';
    const goal = body.goal || 'Optimize system performance and efficiency';

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    const openaiEndpoint = Deno.env.get('CORE314_AI_ENDPOINT') || 'https://api.openai.com/v1/chat/completions';
    const openaiModel = Deno.env.get('CORE314_AI_MODEL') || 'gpt-4o-mini';
    const scenarioContext = Deno.env.get('AI_SCENARIO_CONTEXT') || 'fusion_optimization';

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

    const { data: recentMetrics } = await supabase
      .from('fusion_metrics')
      .select('metric_name, raw_value, normalized_value, integration_id')
      .eq('user_id', userId)
      .order('synced_at', { ascending: false })
      .limit(20);

    const { data: integrations } = await supabase
      .from('user_integrations')
      .select('integration_id, integrations_master(integration_name)')
      .eq('user_id', userId)
      .eq('status', 'active');

    const metricsContext = recentMetrics?.map(m => 
      `${m.metric_name}: ${m.raw_value} (normalized: ${m.normalized_value.toFixed(2)})`
    ).join(', ') || 'No recent metrics';

    const integrationsContext = integrations?.map(i => 
      i.integrations_master?.integration_name
    ).filter(Boolean).join(', ') || 'No active integrations';

    const prompt = `You are an AI optimization expert for Core314, a business operations platform. Generate 3-5 predictive optimization scenarios based on the following context:

Goal: ${goal}
Time Horizon: ${horizon}
Context: ${scenarioContext}
Active Integrations: ${integrationsContext}
Recent Metrics: ${metricsContext}
Constraints: ${body.constraints?.join(', ') || 'None specified'}
Additional Data: ${body.metrics_snapshot ? JSON.stringify(body.metrics_snapshot) : 'None'}

Generate scenarios as a JSON array with this structure:
[
  {
    "title": "Brief scenario title (5-8 words)",
    "description": "Detailed description of the scenario and what it predicts (2-3 sentences)",
    "expected_impact": "Quantified impact (e.g., '+15% efficiency', '-20% response time')",
    "confidence": 0.85,
    "recommended_action": "Specific action to achieve this outcome (1-2 sentences)",
    "horizon": "${horizon}",
    "tags": ["optimization", "performance", "automation"]
  }
]

Focus on actionable, data-driven scenarios that align with the user's goal. Include a mix of quick wins and strategic improvements.`;

    const openaiResponse = await fetch(openaiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: openaiModel,
        messages: [
          {
            role: 'system',
            content: 'You are an AI optimization expert. Generate predictive scenarios in valid JSON format only. Always return a JSON array.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.8,
        max_tokens: 1500,
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
    const content = openaiData.choices[0]?.message?.content || '{}';
    
    let parsedScenarios;
    try {
      const parsed = JSON.parse(content);
      parsedScenarios = Array.isArray(parsed) ? parsed : (parsed.scenarios || []);
    } catch (e) {
      console.error('Failed to parse OpenAI response:', e);
      parsedScenarios = [];
    }

    const scenarios: ScenarioCard[] = parsedScenarios.map((s: Partial<ScenarioCard>, index: number) => ({
      id: `scenario-${Date.now()}-${index}`,
      title: s.title || 'Optimization Scenario',
      description: s.description || 'No description available',
      expected_impact: s.expected_impact || 'Impact to be determined',
      confidence: s.confidence || 0.7,
      recommended_action: s.recommended_action || 'Review and analyze',
      horizon: s.horizon || horizon,
      tags: s.tags || ['optimization'],
    }));

    const response: ScenarioResponse = {
      success: true,
      scenarios: scenarios,
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
});
