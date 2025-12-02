import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { withSentry, breadcrumb, handleSentryTest } from "../_shared/sentry.ts";

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
    const { organization_id, mode = 'analysis' } = await req.json();
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

    const { data: member } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', organization_id)
      .eq('user_id', user.id)
      .single();

    if (!member) {
      return new Response(JSON.stringify({ error: 'Not a member of this organization' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: orgMembers } = await supabase
      .from('organization_members')
      .select('user_id')
      .eq('organization_id', organization_id);

    if (!orgMembers || orgMembers.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        optimization_needed: false,
        message: 'No users found in organization'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userIds = orgMembers.map(m => m.user_id);

    const { data: fusionScores } = await supabase
      .from('fusion_scores')
      .select('fusion_score, calculated_at')
      .in('user_id', userIds)
      .gte('calculated_at', thirtyDaysAgo)
      .order('calculated_at', { ascending: false });

    const { data: weightings } = await supabase
      .from('fusion_weightings')
      .select('integration_id, weight, variance, ai_confidence')
      .in('user_id', userIds);

    const { data: insights } = await supabase
      .from('fusion_insights')
      .select('confidence, created_at')
      .in('user_id', userIds)
      .gte('created_at', sevenDaysAgo)
      .order('created_at', { ascending: false });

    const avgFusionScore = fusionScores?.length 
      ? fusionScores.reduce((sum, s) => sum + (s.fusion_score || 0), 0) / fusionScores.length
      : 70;

    const avgVariance = weightings?.length
      ? weightings.reduce((sum, w) => sum + (w.variance || 0), 0) / weightings.length
      : 0.5;

    const avgConfidence = weightings?.length
      ? weightings.reduce((sum, w) => sum + (w.ai_confidence || 0), 0) / weightings.length
      : 0.75;

    const detectionResults = {
      varianceSpike: false,
      confidenceDrop: false,
      scoreTrend: false,
    };

    const recentVariance = weightings?.slice(0, Math.ceil(weightings.length / 2));
    const oldVariance = weightings?.slice(Math.ceil(weightings.length / 2));
    if (recentVariance && oldVariance && recentVariance.length > 0 && oldVariance.length > 0) {
      const recentAvg = recentVariance.reduce((sum, w) => sum + (w.variance || 0), 0) / recentVariance.length;
      const oldAvg = oldVariance.reduce((sum, w) => sum + (w.variance || 0), 0) / oldVariance.length;
      if (recentAvg - oldAvg > 0.15) {
        detectionResults.varianceSpike = true;
      }
    }

    const recentInsights = insights?.filter(i => new Date(i.created_at) >= new Date(threeDaysAgo));
    if (recentInsights && recentInsights.length > 0) {
      const recentConfAvg = recentInsights.reduce((sum, i) => sum + (i.confidence || 0), 0) / recentInsights.length;
      if (avgConfidence - recentConfAvg > 0.1) {
        detectionResults.confidenceDrop = true;
      }
    }

    if (fusionScores && fusionScores.length >= 3) {
      const last3 = fusionScores.slice(0, 3);
      if (last3[0].fusion_score < last3[1].fusion_score && 
          last3[1].fusion_score < last3[2].fusion_score) {
        detectionResults.scoreTrend = true;
      }
    }

    if (!detectionResults.varianceSpike && !detectionResults.confidenceDrop && !detectionResults.scoreTrend) {
      return new Response(JSON.stringify({ 
        success: true, 
        optimization_needed: false,
        message: 'System performing optimally - no optimization needed'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const baselineWeights: Record<string, number> = {};
    if (weightings) {
      const integrationIds = weightings.map(w => w.integration_id);
      const { data: integrations } = await supabase
        .from('integrations_master')
        .select('id, integration_name')
        .in('id', integrationIds);

      const idToName = new Map(integrations?.map(i => [i.id, i.integration_name]) || []);
      weightings.forEach(w => {
        const name = idToName.get(w.integration_id);
        if (name) baselineWeights[name] = w.weight || 0;
      });
    }

    const gptPrompt = `You are Core314's Autonomous Optimization Engine. Analyze the following Fusion data and determine optimal weight or configuration adjustments to improve FusionScore and AI Confidence while minimizing Variance.

Baseline Metrics:
- Average Fusion Score: ${avgFusionScore.toFixed(1)}
- Average Variance: ${avgVariance.toFixed(3)}
- Average Confidence: ${avgConfidence.toFixed(3)}
- Current Weights: ${JSON.stringify(baselineWeights)}

Detection Results:
- Variance Spike Detected: ${detectionResults.varianceSpike}
- Confidence Drop Detected: ${detectionResults.confidenceDrop}
- Downward Score Trend: ${detectionResults.scoreTrend}

Based on these metrics, generate optimized configuration that will:
1. Reduce variance if spike detected
2. Improve confidence if drop detected
3. Reverse downward score trend if detected

Return JSON with:
{
  "optimized_data": {
    "weights": {"Integration1": weight1, "Integration2": weight2, ...},
    "confidence": predicted_confidence,
    "fusion_score": predicted_fusion_score,
    "variance": predicted_variance
  },
  "improvement_score": magnitude_of_improvement_0_to_1,
  "summary": "2-3 paragraph explanation of: what issues were detected, how the optimized weights will address them, expected impact on performance, and risks/recommendations"
}`;

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
            content: 'You are Core314\'s Autonomous Optimization Engine. You specialize in analyzing Fusion metrics and recommending optimal configurations. Always return valid JSON.',
          },
          {
            role: 'user',
            content: gptPrompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    const gptData = await gptResponse.json();
    
    if (!gptResponse.ok || !gptData.choices || gptData.choices.length === 0) {
      console.error('OpenAI API error:', gptData);
      throw new Error(`OpenAI API failed: ${gptData.error?.message || JSON.stringify(gptData)}`);
    }

    const optimization = JSON.parse(gptData.choices[0].message.content || '{}');

    const { data: savedOptimization, error: insertError } = await supabase
      .from('fusion_optimizations')
      .insert({
        organization_id,
        user_id: user.id,
        optimization_type: mode === 'auto' ? 'auto_adjustment' : 'recommendation',
        baseline_data: {
          weights: baselineWeights,
          confidence: avgConfidence,
          fusion_score: avgFusionScore,
          variance: avgVariance,
        },
        optimized_data: optimization.optimized_data,
        improvement_score: optimization.improvement_score || 0.5,
        summary: optimization.summary || 'No summary available.',
        applied: false,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    await supabase.from('fusion_audit_log').insert({
      organization_id,
      user_id: user.id,
      event_type: 'optimization_analyzed',
      event_data: { 
        optimization_id: savedOptimization.id,
        improvement_score: optimization.improvement_score,
        detection_results: detectionResults 
      },
    });

    return new Response(JSON.stringify({ 
      success: true, 
      optimization_needed: true,
      optimization: savedOptimization 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Optimization analysis error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}), { name: "optimize-analyze" }));