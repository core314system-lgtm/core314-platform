import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { withSentry, breadcrumb, handleSentryTest, jsonError } from "../_shared/sentry.ts";
import { 
  deriveExecutionMode, 
  getBaselineInsightsResponse,
  type ExecutionMode 
} from '../_shared/execution_mode.ts';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') || '';

serve(withSentry(async (req) => {
  const testResponse = await handleSentryTest(req);
  if (testResponse) return testResponse;

  try {
    const { userId, integrationId } = await req.json();

    const authHeader = req.headers.get('Authorization')!;
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.id !== userId) {
      return new Response('Unauthorized', { status: 401 });
    }

    // ============================================================
    // GLOBAL EXECUTION SWITCH - SINGLE SOURCE OF TRUTH
    // MANDATORY: This gate MUST be checked at the VERY TOP before ANY AI processing
    // FAIL-CLOSED: If no computed score or no efficiency metrics, treat as baseline
    // ============================================================
    const supabaseService = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    const { data: fusionScores } = await supabaseService
      .from('fusion_scores')
      .select('fusion_score, score_origin')
      .eq('user_id', user.id)
      .order('calculated_at', { ascending: false })
      .limit(1);
    
    const { data: efficiencyMetrics } = await supabaseService
      .from('fusion_efficiency_metrics')
      .select('id')
      .eq('user_id', user.id)
      .limit(1);
    
    const hasComputedScore = fusionScores && fusionScores.length > 0 && fusionScores[0].score_origin === 'computed';
    const hasEfficiencyMetrics = efficiencyMetrics && efficiencyMetrics.length > 0;
    const execution_mode: ExecutionMode = (hasComputedScore && hasEfficiencyMetrics) ? 'computed' : 'baseline';
    
    // HARD DISABLE: If baseline mode, return IMMEDIATELY with fixed response
    if (execution_mode === 'baseline') {
      console.log('BASELINE SHORT-CIRCUIT HIT: generate-ai-insights - baseline mode (NO AI)');
      const baselineResponse = getBaselineInsightsResponse();
      return new Response(JSON.stringify(baselineResponse), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { data: metrics } = await supabase
      .from('fusion_metrics')
      .select('metric_name, raw_value, metric_type, normalized_value')
      .eq('user_id', userId)
      .eq('integration_id', integrationId)
      .order('synced_at', { ascending: false })
      .limit(10);

    if (!metrics || metrics.length === 0) {
      return new Response(JSON.stringify({ summary: 'No metrics available' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { data: integration } = await supabase
      .from('integrations_master')
      .select('integration_name')
      .eq('id', integrationId)
      .single();

    const prompt = `Analyze these metrics from ${integration?.integration_name || 'the integration'} and provide ONE actionable sentence summarizing the current status:

${metrics.map(m => `- ${m.metric_name}: ${m.raw_value} (normalized: ${m.normalized_value.toFixed(2)})`).join('\n')}

Provide a brief, actionable insight in one sentence.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a business operations analyst. Provide brief, actionable insights.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 100,
      }),
    });

    const data = await response.json();
    const summary = data.choices[0].message.content;

    return new Response(JSON.stringify({ summary }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}, { name: "generate-ai-insights" }));
