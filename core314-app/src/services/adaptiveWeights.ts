import { supabase } from '../lib/supabase';

const ALPHA = 0.3;
const BETA = 0.5;
const GAMMA = 0.2;

interface WeightCalculation {
  metric_id: string;
  metric_name: string;
  variance: number;
  ai_confidence: number;
  correlation_penalty: number;
  raw_weight: number;
  final_weight: number;
}

interface AuditLogParams {
  metricsCount: number;
  totalVariance?: number;
  avgAiConfidence?: number;
  weightChanges?: Record<string, { old: number; new: number }>;
  status: 'success' | 'failed' | 'partial';
  errorMessage?: string;
  executionTimeMs: number;
}

async function logAuditEvent(
  userId: string,
  integrationId: string,
  eventType: 'manual_recalibration' | 'scheduled_recalibration' | 'adaptive_trigger',
  params: AuditLogParams
): Promise<void> {
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

async function calculateMetricVariance(
  userId: string,
  integrationId: string
): Promise<number> {
  const { data: history } = await supabase
    .from('fusion_score_history')
    .select('fusion_score')
    .eq('user_id', userId)
    .eq('integration_id', integrationId)
    .order('recorded_at', { ascending: false })
    .limit(30);

  if (!history || history.length < 2) return 0.5;

  const values = history.map(h => h.fusion_score);
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  
  const cv = mean > 0 ? stdDev / mean : 0;
  return Math.min(cv, 1.0);
}

function calculateAIConfidence(variance: number): number {
  return Math.max(0, Math.min(1, 1 - variance));
}

export async function calculateAdaptiveWeights(
  userId: string,
  integrationId: string,
  reason: string = 'Scheduled recalibration',
  eventType: 'manual_recalibration' | 'scheduled_recalibration' | 'adaptive_trigger' = 'scheduled_recalibration'
): Promise<{ success: boolean; metricsCount: number; avgConfidence: number }> {
  const startTime = Date.now();
  
  try {
    const { data: metrics } = await supabase
      .from('fusion_metrics')
      .select('id, metric_name, normalized_value, weight')
      .eq('user_id', userId)
      .eq('integration_id', integrationId);

    if (!metrics || metrics.length === 0) {
      await logAuditEvent(userId, integrationId, eventType, {
        metricsCount: 0,
        status: 'failed',
        errorMessage: 'No metrics found',
        executionTimeMs: Date.now() - startTime
      });
      return { success: false, metricsCount: 0, avgConfidence: 0 };
    }

    const variance = await calculateMetricVariance(userId, integrationId);
    
    const calculations: WeightCalculation[] = metrics.map(metric => {
      const base_weight = metric.weight || 1.0;
      const ai_confidence = calculateAIConfidence(variance);
      const correlation_penalty = 0;
      
      const raw_weight = base_weight * (
        1 + ALPHA * variance + BETA * ai_confidence - GAMMA * correlation_penalty
      );
      
      return {
        metric_id: metric.id,
        metric_name: metric.metric_name,
        variance,
        ai_confidence,
        correlation_penalty,
        raw_weight,
        final_weight: 0
      };
    });

    const totalWeight = calculations.reduce((sum, c) => sum + c.raw_weight, 0);
    
    calculations.forEach(c => {
      c.final_weight = totalWeight > 0 ? c.raw_weight / totalWeight : 1.0 / metrics.length;
    });

    const weightChanges: Record<string, { old: number; new: number }> = {};
    
    for (const calc of calculations) {
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
          new: calc.final_weight
        };
      }
      
      await supabase
        .from('fusion_weightings')
        .upsert({
          user_id: userId,
          integration_id: integrationId,
          metric_id: calc.metric_id,
          metric_name: calc.metric_name,
          final_weight: calc.final_weight,
          variance: calc.variance,
          ai_confidence: calc.ai_confidence,
          correlation_penalty: calc.correlation_penalty,
          adjustment_reason: reason,
          adaptive: true
        }, {
          onConflict: 'user_id,integration_id,metric_id'
        });
    }

    const avgConfidence = calculations.reduce((sum, c) => sum + c.ai_confidence, 0) / calculations.length;
    
    await logAuditEvent(userId, integrationId, eventType, {
      metricsCount: metrics.length,
      totalVariance: variance,
      avgAiConfidence: avgConfidence,
      weightChanges,
      status: 'success',
      executionTimeMs: Date.now() - startTime
    });

    return { success: true, metricsCount: metrics.length, avgConfidence };
  } catch (error) {
    await logAuditEvent(userId, integrationId, eventType, {
      metricsCount: 0,
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      executionTimeMs: Date.now() - startTime
    });
    throw error;
  }
}

export async function recalibrateAllWeights(
  userId: string
): Promise<{ success: boolean; totalMetrics: number; avgConfidence: number }> {
  const { data: integrations } = await supabase
    .from('user_integrations')
    .select('integration_id')
    .eq('user_id', userId)
    .eq('status', 'active');

  if (!integrations) return { success: false, totalMetrics: 0, avgConfidence: 0 };

  let totalMetrics = 0;
  let totalConfidence = 0;
  let integrationCount = 0;

  for (const int of integrations) {
    const result = await calculateAdaptiveWeights(
      userId, 
      int.integration_id, 
      'Manual recalibration',
      'manual_recalibration'
    );
    if (result.success) {
      totalMetrics += result.metricsCount;
      totalConfidence += result.avgConfidence;
      integrationCount++;
    }
  }

  return {
    success: integrationCount > 0,
    totalMetrics,
    avgConfidence: integrationCount > 0 ? totalConfidence / integrationCount : 0
  };
}
