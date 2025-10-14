import { supabase } from '../lib/supabase';

const ALPHA = 0.3;
const BETA = 0.5;
const GAMMA = 0.2;

interface WeightCalculation {
  metric_id: string;
  variance: number;
  ai_confidence: number;
  correlation_penalty: number;
  raw_weight: number;
  final_weight: number;
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
  reason: string = 'Scheduled recalibration'
): Promise<void> {
  const { data: metrics } = await supabase
    .from('fusion_metrics')
    .select('id, metric_name, normalized_value, weight')
    .eq('user_id', userId)
    .eq('integration_id', integrationId);

  if (!metrics || metrics.length === 0) return;

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

  for (const calc of calculations) {
    await supabase
      .from('fusion_weightings')
      .upsert({
        user_id: userId,
        integration_id: integrationId,
        metric_id: calc.metric_id,
        weight: calc.final_weight,
        ai_confidence: calc.ai_confidence,
        adjustment_reason: reason,
        adaptive: true
      }, {
        onConflict: 'user_id,integration_id,metric_id'
      });
  }
}

export async function recalibrateAllWeights(userId: string): Promise<void> {
  const { data: integrations } = await supabase
    .from('user_integrations')
    .select('integration_id')
    .eq('user_id', userId)
    .eq('status', 'active');

  if (!integrations) return;

  for (const int of integrations) {
    await calculateAdaptiveWeights(userId, int.integration_id, 'Manual recalibration');
  }
}
