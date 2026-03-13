import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { withSentry, breadcrumb, handleSentryTest, jsonError } from "../_shared/sentry.ts";
import { fetchUserExecutionMode, getBaselineAdminResponse } from "../_shared/execution_mode.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') || '';

serve(withSentry(async (req) => {
  const testResponse = await handleSentryTest(req);
  if (testResponse) return testResponse;

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // ============================================================
    // BASELINE MODE GATE - MUST BE BEFORE ANY AI PROCESSING
    // ============================================================
    const executionMode = await fetchUserExecutionMode(supabase, user.id);
    if (executionMode === 'baseline') {
      return new Response(JSON.stringify(getBaselineAdminResponse()), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    // ============================================================

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Starting global insights aggregation...');

    const { data: orgs, error: orgsError } = await supabase
      .from('organizations')
      .select('id');

    if (orgsError) throw orgsError;
    
    const sampleSize = orgs?.length || 0;
    console.log(`Sample size: ${sampleSize} organizations`);

    if (sampleSize === 0) {
      return new Response(JSON.stringify({ 
        success: true,
        message: 'No organizations to aggregate',
        sample_size: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: fusionScores } = await supabase
      .from('fusion_scores')
      .select('fusion_score');

    const avgFusionScore = fusionScores?.length 
      ? fusionScores.reduce((sum, s) => sum + (s.fusion_score || 0), 0) / fusionScores.length
      : 0;

    console.log(`Average fusion score: ${avgFusionScore}`);

    const { data: weightings } = await supabase
      .from('fusion_weightings')
      .select('variance, ai_confidence, integration_id');

    const avgVariance = weightings?.length
      ? weightings.reduce((sum, w) => sum + (w.variance || 0), 0) / weightings.length
      : 0;

    const avgConfidence = weightings?.length
      ? weightings.reduce((sum, w) => sum + (w.ai_confidence || 0), 0) / weightings.length
      : 0;

    console.log(`Average variance: ${avgVariance}, Average confidence: ${avgConfidence}`);

    const { data: optimizations } = await supabase
      .from('fusion_optimizations')
      .select('improvement_score')
      .eq('applied', true);

    const avgOptimizationImprovement = optimizations?.length
      ? optimizations.reduce((sum, o) => sum + (o.improvement_score || 0), 0) / optimizations.length
      : 0;

    console.log(`Average optimization improvement: ${avgOptimizationImprovement}`);

    const integrationPerformance = new Map<string, { total: number; count: number }>();
    
    if (weightings) {
      for (const w of weightings) {
        if (!w.integration_id) continue;
        const perf = integrationPerformance.get(w.integration_id) || { total: 0, count: 0 };
        perf.total += (w.ai_confidence || 0) * (1 - (w.variance || 0));
        perf.count += 1;
        integrationPerformance.set(w.integration_id, perf);
      }
    }

    const integrationIds = Array.from(integrationPerformance.keys());
    const { data: integrations } = await supabase
      .from('integrations_master')
      .select('id, integration_name')
      .in('id', integrationIds);

    const topPerforming: Record<string, number> = {};
    const idToName = new Map(integrations?.map(i => [i.id, i.integration_name]) || []);
    
    for (const [id, perf] of integrationPerformance) {
      const name = idToName.get(id);
      if (name && perf.count > 0) {
        topPerforming[name] = perf.total / perf.count;
      }
    }

    const sortedIntegrations = Object.entries(topPerforming)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);
    
    const topPerformingIntegrations = Object.fromEntries(sortedIntegrations);

    console.log('Top performing integrations:', topPerformingIntegrations);

    const addNoise = (value: number) => {
      const noise = (Math.random() - 0.5) * 0.01;
      return value + (value * noise);
    };

    const aggregatedMetrics = {
      avg_fusion_score: addNoise(avgFusionScore),
      avg_confidence: addNoise(avgConfidence),
      avg_variance: addNoise(avgVariance),
    };

    const gptPrompt = `You are Core314's global intelligence analyst. Analyze these anonymized metrics across ${sampleSize} organizations and provide insights.

Global Metrics:
- Average Fusion Score: ${aggregatedMetrics.avg_fusion_score.toFixed(1)}
- Average Confidence: ${aggregatedMetrics.avg_confidence.toFixed(3)}
- Average Variance: ${aggregatedMetrics.avg_variance.toFixed(3)}
- Average Optimization Improvement: ${avgOptimizationImprovement.toFixed(3)}
- Top Performing Integrations: ${JSON.stringify(topPerformingIntegrations)}

Provide a 2-3 paragraph summary covering:
1. Overall performance trends and health of the platform
2. Key insights about integration performance
3. Recommendations for optimization strategies

Return JSON with:
{
  "summary": "comprehensive narrative here",
  "key_findings": ["finding 1", "finding 2", "finding 3"]
}`;

    console.log('Calling GPT-4o-mini for AI summary...');

    const gptResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
            content: 'You are Core314\'s global intelligence analyst. Provide data-driven insights and recommendations based on anonymized cross-organization metrics. Always return valid JSON.',
          },
          {
            role: 'user',
            content: gptPrompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 800,
      }),
    });

    const gptData = await gptResponse.json();
    
    if (!gptResponse.ok || !gptData.choices || gptData.choices.length === 0) {
      console.error('OpenAI API error:', gptData);
      throw new Error(`OpenAI API failed: ${gptData.error?.message || JSON.stringify(gptData)}`);
    }

    const aiSummaryData = JSON.parse(gptData.choices[0].message.content || '{}');
    const aiSummary = aiSummaryData.summary || 'No summary available.';

    console.log('AI summary generated successfully');

    const { data: savedInsight, error: insertError } = await supabase
      .from('fusion_global_insights')
      .insert({
        aggregation_date: new Date().toISOString(),
        aggregated_metrics: aggregatedMetrics,
        top_performing_integrations: topPerformingIntegrations,
        avg_optimization_improvement: avgOptimizationImprovement,
        sample_size: sampleSize,
        ai_summary: aiSummary,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    console.log('Global insight saved successfully:', savedInsight.id);

    await supabase.from('fusion_audit_log').insert({
      organization_id: null,
      user_id: user.id,
      event_type: 'global_insight_aggregated',
      event_data: { 
        insight_id: savedInsight.id,
        sample_size: sampleSize,
        avg_fusion_score: aggregatedMetrics.avg_fusion_score
      },
    });

    return new Response(JSON.stringify({ 
      success: true,
      insight: savedInsight,
      message: `Global insights aggregated from ${sampleSize} organizations`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Insights aggregation error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}, { name: "insights-aggregate" }));
