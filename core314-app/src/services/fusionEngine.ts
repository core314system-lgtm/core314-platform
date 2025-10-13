import { supabase } from '../lib/supabase';

interface MetricWeights {
  count: number;
  sum: number;
  average: number;
  percentage: number;
  trend: number;
}

const DEFAULT_WEIGHTS: MetricWeights = {
  count: 0.2,
  sum: 0.3,
  average: 0.25,
  percentage: 0.15,
  trend: 0.1,
};

export async function normalizeMetric(
  _metricType: string,
  rawValue: number,
  historicalData?: number[]
): Promise<number> {
  if (!historicalData || historicalData.length === 0) {
    return Math.min(rawValue / 100, 1);
  }

  const min = Math.min(...historicalData);
  const max = Math.max(...historicalData);
  
  if (max === min) return 0.5;
  
  return (rawValue - min) / (max - min);
}

export async function calculateFusionScore(
  userId: string,
  integrationId: string
): Promise<{ score: number; breakdown: Record<string, number>; trend: 'up' | 'down' | 'stable' }> {
  const { data: metrics, error } = await supabase
    .from('fusion_metrics')
    .select('*')
    .eq('user_id', userId)
    .eq('integration_id', integrationId);

  if (error || !metrics || metrics.length === 0) {
    return { score: 0, breakdown: {}, trend: 'stable' };
  }

  let weightedSum = 0;
  let totalWeight = 0;
  const breakdown: Record<string, number> = {};

  metrics.forEach((metric) => {
    const weight = metric.weight || DEFAULT_WEIGHTS[metric.metric_type as keyof MetricWeights] || 0.2;
    const contribution = metric.normalized_value * weight;
    weightedSum += contribution;
    totalWeight += weight;
    breakdown[metric.metric_name] = contribution;
  });

  const fusionScore = totalWeight > 0 ? (weightedSum / totalWeight) * 100 : 0;

  const { data: previousScore } = await supabase
    .from('fusion_scores')
    .select('fusion_score')
    .eq('user_id', userId)
    .eq('integration_id', integrationId)
    .order('calculated_at', { ascending: false })
    .limit(1)
    .single();

  let trend: 'up' | 'down' | 'stable' = 'stable';
  if (previousScore) {
    const diff = fusionScore - previousScore.fusion_score;
    if (diff > 5) trend = 'up';
    else if (diff < -5) trend = 'down';
  }

  return { score: fusionScore, breakdown, trend };
}

export async function updateFusionScore(
  userId: string,
  integrationId: string,
  includeAI: boolean = false
): Promise<void> {
  const { score, breakdown, trend } = await calculateFusionScore(userId, integrationId);

  let aiSummary: string | undefined;
  if (includeAI) {
    const { data: existingScore } = await supabase
      .from('fusion_scores')
      .select('ai_summary, ai_cached_at')
      .eq('user_id', userId)
      .eq('integration_id', integrationId)
      .single();

    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
    const needsNewSummary = !existingScore?.ai_cached_at || 
      new Date(existingScore.ai_cached_at) < fourHoursAgo;

    if (needsNewSummary) {
      aiSummary = await generateAISummary(userId, integrationId);
    } else {
      aiSummary = existingScore.ai_summary || undefined;
    }
  }

  const { error } = await supabase
    .from('fusion_scores')
    .upsert({
      user_id: userId,
      integration_id: integrationId,
      fusion_score: score,
      score_breakdown: breakdown,
      trend_direction: trend,
      ai_summary: aiSummary,
      ai_cached_at: aiSummary ? new Date().toISOString() : null,
      calculated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,integration_id'
    });

  if (error) {
    console.error('Error updating fusion score:', error);
  }
}

async function generateAISummary(userId: string, integrationId: string): Promise<string> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return 'Unable to generate AI summary';

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-ai-insights`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ userId, integrationId }),
    });

    const data = await response.json();
    return data.summary || 'Unable to generate AI summary';
  } catch (error) {
    console.error('AI summary generation error:', error);
    return 'AI insights temporarily unavailable';
  }
}
