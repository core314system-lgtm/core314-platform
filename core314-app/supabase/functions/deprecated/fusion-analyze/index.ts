import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { withSentry, breadcrumb, handleSentryTest, jsonError } from "../_shared/sentry.ts";

interface AnalysisRequest {
  userId?: string;
  integrationId?: string;
}

interface MetricData {
  metric_name: string;
  normalized_value: number;
  recorded_at: string;
}

interface WeightData {
  metric_name: string;
  final_weight: number;
  variance: number;
  ai_confidence: number;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(withSentry(async (req) => {
  const testResponse = await handleSentryTest(req);
  if (testResponse) return testResponse;

  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const authHeader = req.headers.get('Authorization')!;
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { userId, integrationId }: AnalysisRequest = await req.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const startTime = Date.now();

    let integrations: { integration_id: string; integration_name: string }[] = [];
    
    if (integrationId) {
      const { data: intData } = await supabase
        .from('user_integrations')
        .select('integration_id, integrations_master(integration_name)')
        .eq('user_id', userId)
        .eq('integration_id', integrationId)
        .eq('status', 'active')
        .single();
      
      if (intData && intData.integrations_master) {
        const master = intData.integrations_master as { integration_name: string };
        integrations = [{ integration_id: intData.integration_id, integration_name: master.integration_name }];
      }
    } else {
      const { data: intData } = await supabase
        .from('user_integrations')
        .select('integration_id, integrations_master(integration_name)')
        .eq('user_id', userId)
        .eq('status', 'active');

      if (intData) {
        integrations = intData.map(i => ({
          integration_id: i.integration_id,
          integration_name: (i.integrations_master as { integration_name: string }).integration_name
        }));
      }
    }

    if (integrations.length === 0) {
      return new Response(JSON.stringify({ error: 'No active integrations found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let totalInsights = 0;

    for (const integration of integrations) {
      const insights = await analyzeIntegration(supabase, userId, integration.integration_id, integration.integration_name);
      totalInsights += insights;
    }

    await supabase
      .from('fusion_audit_log')
      .insert({
        user_id: userId,
        integration_id: integrationId || null,
        event_type: 'intelligence_analysis',
        metrics_count: totalInsights,
        triggered_by: 'user',
        execution_time_ms: Date.now() - startTime,
        status: 'success'
      });

    return new Response(JSON.stringify({
      success: true,
      integrationsAnalyzed: integrations.length,
      totalInsights,
      executionTimeMs: Date.now() - startTime
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}, { name: "fusion-analyze" }));

async function analyzeIntegration(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  integrationId: string,
  integrationName: string
): Promise<number> {
  let insightCount = 0;

  const { data: recentMetrics } = await supabase
    .from('fusion_metrics')
    .select('metric_name, normalized_value, recorded_at')
    .eq('user_id', userId)
    .eq('integration_id', integrationId)
    .order('recorded_at', { ascending: false })
    .limit(100);

  const { data: weights } = await supabase
    .from('fusion_weightings')
    .select('metric_name, final_weight, variance, ai_confidence')
    .eq('user_id', userId)
    .eq('integration_id', integrationId);

  const { data: scoreHistory } = await supabase
    .from('fusion_score_history')
    .select('fusion_score, recorded_at')
    .eq('user_id', userId)
    .eq('integration_id', integrationId)
    .order('recorded_at', { ascending: false })
    .limit(30);

  if (!recentMetrics || recentMetrics.length === 0 || !weights || weights.length === 0) {
    return insightCount;
  }

  const metricsByName = new Map<string, MetricData[]>();
  recentMetrics.forEach((m: MetricData) => {
    if (!metricsByName.has(m.metric_name)) {
      metricsByName.set(m.metric_name, []);
    }
    metricsByName.get(m.metric_name)!.push(m);
  });

  for (const weight of weights as WeightData[]) {
    const metricHistory = metricsByName.get(weight.metric_name);
    if (!metricHistory || metricHistory.length < 2) continue;

    const values = metricHistory.slice(0, 10).map(m => m.normalized_value);
    const trend = calculateTrend(values);
    
    if (Math.abs(trend) > 0.1) {
      await supabase.from('fusion_insights').insert({
        user_id: userId,
        integration_id: integrationId,
        integration_name: integrationName,
        insight_type: 'trend',
        message: `${weight.metric_name} showing ${trend > 0 ? 'upward' : 'downward'} trend of ${(Math.abs(trend) * 100).toFixed(1)}%`,
        confidence: 0.85 + (weight.ai_confidence * 0.15),
        metadata: { trend_value: trend, metric_name: weight.metric_name }
      });
      insightCount++;
    }

    if (weight.variance > 0.45) {
      await supabase.from('fusion_insights').insert({
        user_id: userId,
        integration_id: integrationId,
        integration_name: integrationName,
        insight_type: 'anomaly',
        message: `High variance detected in ${weight.metric_name} (${(weight.variance * 100).toFixed(1)}%)`,
        confidence: 0.90,
        metadata: { variance: weight.variance, metric_name: weight.metric_name }
      });
      insightCount++;
    }
  }

  if (scoreHistory && scoreHistory.length >= 7) {
    const scores = scoreHistory.map(h => h.fusion_score);
    const recentAvg = scores.slice(0, 7).reduce((sum, s) => sum + s, 0) / 7;
    const predictedScore = weightedMovingAverage(scores);
    
    await supabase.from('fusion_insights').insert({
      user_id: userId,
      integration_id: integrationId,
      integration_name: integrationName,
      insight_type: 'prediction',
      message: `Predicted 7-day fusion score: ${predictedScore.toFixed(1)} (current: ${recentAvg.toFixed(1)})`,
      confidence: 0.80,
      metadata: { predicted_score: predictedScore, current_avg: recentAvg }
    });
    insightCount++;
  }

  const avgVariance = weights.reduce((sum: number, w: WeightData) => sum + w.variance, 0) / weights.length;
  const avgConfidence = weights.reduce((sum: number, w: WeightData) => sum + w.ai_confidence, 0) / weights.length;
  
  let healthStatus = 'stable';
  if (avgVariance > 0.4) healthStatus = 'volatile';
  else if (avgVariance < 0.2 && avgConfidence > 0.8) healthStatus = 'excellent';
  
  await supabase.from('fusion_insights').insert({
    user_id: userId,
    integration_id: integrationId,
    integration_name: integrationName,
    insight_type: 'summary',
    message: `Integration health: ${healthStatus} (variance: ${(avgVariance * 100).toFixed(1)}%, confidence: ${(avgConfidence * 100).toFixed(1)}%)`,
    confidence: 0.95,
    metadata: { health_status: healthStatus, avg_variance: avgVariance, avg_confidence: avgConfidence }
  });
  insightCount++;

  return insightCount;
}

function calculateTrend(values: number[]): number {
  if (values.length < 2) return 0;
  
  const n = values.length;
  const xMean = (n - 1) / 2;
  const yMean = values.reduce((sum, v) => sum + v, 0) / n;
  
  let numerator = 0;
  let denominator = 0;
  
  for (let i = 0; i < n; i++) {
    numerator += (i - xMean) * (values[i] - yMean);
    denominator += Math.pow(i - xMean, 2);
  }
  
  const slope = denominator !== 0 ? numerator / denominator : 0;
  return slope;
}

function weightedMovingAverage(scores: number[]): number {
  if (scores.length === 0) return 0;
  
  const weights = [0.4, 0.3, 0.2, 0.1];
  let weightedSum = 0;
  let weightSum = 0;
  
  for (let i = 0; i < Math.min(scores.length, weights.length); i++) {
    weightedSum += scores[i] * weights[i];
    weightSum += weights[i];
  }
  
  return weightSum > 0 ? weightedSum / weightSum : scores[0];
}
