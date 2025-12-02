import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { withSentry, breadcrumb, handleSentryTest, jsonError } from "../_shared/sentry.ts";

const ALPHA = 0.3;
const BETA = 0.5;
const GAMMA = 0.2;

interface RecalibrateRequest {
  userId?: string;
  integrationId?: string;
}

interface RecalibrateResult {
  integrationId: string;
  success: boolean;
  metricsCount: number;
  avgConfidence: number;
  variance?: number;
  error?: string;
}

serve(withSentry(async (req) => {
  const testResponse = await handleSentryTest(req);
  if (testResponse) return testResponse;

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const authHeader = req.headers.get('Authorization')!;
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { userId, integrationId }: RecalibrateRequest = await req.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const startTime = Date.now();
    const results: RecalibrateResult[] = [];

    if (integrationId) {
      const result = await recalibrateIntegration(supabase, userId, integrationId, startTime);
      results.push(result);
    } else {
      const { data: integrations } = await supabase
        .from('user_integrations')
        .select('integration_id')
        .eq('user_id', userId)
        .eq('status', 'active');

      if (!integrations || integrations.length === 0) {
        return new Response(JSON.stringify({ error: 'No active integrations found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      for (const int of integrations) {
        const result = await recalibrateIntegration(supabase, userId, int.integration_id, startTime);
        results.push(result);
      }
    }

    const totalMetrics = results.reduce((sum, r) => sum + r.metricsCount, 0);
    const avgConfidence = results.length > 0
      ? results.reduce((sum, r) => sum + r.avgConfidence, 0) / results.length
      : 0;

    return new Response(JSON.stringify({
      success: true,
      totalIntegrations: results.length,
      totalMetrics,
      avgConfidence,
      executionTimeMs: Date.now() - startTime,
      results
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

async function recalibrateIntegration(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  integrationId: string,
  startTime: number
): Promise<RecalibrateResult> {
  try {
    const { data: metrics } = await supabase
      .from('fusion_metrics')
      .select('id, metric_name, normalized_value, weight')
      .eq('user_id', userId)
      .eq('integration_id', integrationId);

    if (!metrics || metrics.length === 0) {
      await logAuditEvent(supabase, userId, integrationId, 'manual_recalibration', {
        metricsCount: 0,
        status: 'failed',
        errorMessage: 'No metrics found',
        executionTimeMs: Date.now() - startTime
      });
      return { integrationId, success: false, metricsCount: 0, avgConfidence: 0 };
    }

    const { data: history } = await supabase
      .from('fusion_score_history')
      .select('fusion_score')
      .eq('user_id', userId)
      .eq('integration_id', integrationId)
      .order('recorded_at', { ascending: false })
      .limit(30);

    let variance = 0.5;
    if (history && history.length >= 2) {
      const values = history.map((h: { fusion_score: number }) => h.fusion_score);
      const mean = values.reduce((sum: number, v: number) => sum + v, 0) / values.length;
      const varianceRaw = values.reduce((sum: number, v: number) => sum + Math.pow(v - mean, 2), 0) / values.length;
      const stdDev = Math.sqrt(varianceRaw);
      const cv = mean > 0 ? stdDev / mean : 0;
      variance = Math.min(cv, 1.0);
    }

    const ai_confidence = Math.max(0, Math.min(1, 1 - variance));

    const calculations = metrics.map((metric: { id: string; metric_name: string; weight?: number }) => {
      const base_weight = metric.weight || 1.0;
      const correlation_penalty = 0;
      
      const raw_weight = base_weight * (
        1 + ALPHA * variance + BETA * ai_confidence - GAMMA * correlation_penalty
      );
      
      return {
        metric_id: metric.id,
        metric_name: metric.metric_name,
        raw_weight,
        variance,
        ai_confidence,
        correlation_penalty
      };
    });

    const totalWeight = calculations.reduce((sum: number, c: { raw_weight: number }) => sum + c.raw_weight, 0);
    
    const weightChanges: Record<string, { old: number; new: number }> = {};
    
    for (const calc of calculations) {
      const final_weight = totalWeight > 0 ? calc.raw_weight / totalWeight : 1.0 / metrics.length;
      
      const { data: existing } = await supabase
        .from('fusion_weightings')
        .select('final_weight')
        .eq('user_id', userId)
        .eq('integration_id', integrationId)
        .eq('metric_id', calc.metric_id)
        .single();

      if (existing) {
        weightChanges[calc.metric_name] = {
          old: existing.final_weight,
          new: final_weight
        };
      }
      
      await supabase
        .from('fusion_weightings')
        .upsert({
          user_id: userId,
          integration_id: integrationId,
          metric_id: calc.metric_id,
          metric_name: calc.metric_name,
          final_weight,
          variance: calc.variance,
          ai_confidence: calc.ai_confidence,
          correlation_penalty: calc.correlation_penalty,
          adjustment_reason: 'Manual recalibration via API',
          adaptive: true
        });
    }

    await logAuditEvent(supabase, userId, integrationId, 'manual_recalibration', {
      metricsCount: metrics.length,
      totalVariance: variance,
      avgAiConfidence: ai_confidence,
      weightChanges,
      status: 'success',
      executionTimeMs: Date.now() - startTime
    });

    return {
      integrationId,
      success: true,
      metricsCount: metrics.length,
      avgConfidence: ai_confidence,
      variance
    };
  } catch (error) {
    await logAuditEvent(supabase, userId, integrationId, 'manual_recalibration', {
      metricsCount: 0,
      status: 'failed',
      errorMessage: error.message,
      executionTimeMs: Date.now() - startTime
    });
    return {
      integrationId,
      success: false,
      metricsCount: 0,
      avgConfidence: 0,
      error: error.message
    };
  }
}

async function logAuditEvent(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  integrationId: string,
  eventType: string,
  params: {
    metricsCount: number;
    totalVariance?: number;
    avgAiConfidence?: number;
    weightChanges?: Record<string, { old: number; new: number }>;
    status: string;
    errorMessage?: string;
    executionTimeMs: number;
  }
) {
  await supabase
    .from('fusion_audit_log')
    .insert({
      user_id: userId,
      integration_id: integrationId,
      event_type: eventType,
      metrics_count: params.metricsCount,
      total_variance: params.totalVariance,
      avg_ai_confidence: params.avgAiConfidence,
      weight_changes: params.weightChanges,
      triggered_by: eventType === 'manual_recalibration' ? 'user' : 'system',
      execution_time_ms: params.executionTimeMs,
      status: params.status,
      error_message: params.errorMessage
    });
}
