import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { withSentry, breadcrumb, handleSentryTest, jsonError } from "../_shared/sentry.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const DECAY_LAMBDA = 0.1;
const MIN_WEIGHT = 0.1;
const MAX_WEIGHT = 10.0;
const DEFAULT_LEARNING_RATE = 0.05;

serve(withSentry(async (req) => {
  const testResponse = await handleSentryTest(req);
  if (testResponse) return testResponse;

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, integration_id, test_mode = false } = await req.json();
    
    console.log('🧠 Running fusion learning update...');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    
    let query = supabase
      .from('fusion_feedback')
      .select('*')
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: false });
    
    if (user_id) query = query.eq('user_id', user_id);
    if (integration_id) query = query.eq('integration_id', integration_id);
    
    const { data: feedbackData, error: fetchError } = await query;
    
    if (fetchError) throw fetchError;
    
    if (!feedbackData || feedbackData.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No feedback data to process',
        updates: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${feedbackData.length} feedback entries`);

    const groupedFeedback = new Map<string, any[]>();
    for (const feedback of feedbackData) {
      const key = `${feedback.user_id}:${feedback.integration_id}`;
      if (!groupedFeedback.has(key)) {
        groupedFeedback.set(key, []);
      }
      groupedFeedback.get(key)!.push(feedback);
    }

    let updatesCount = 0;

    for (const [key, feedbacks] of groupedFeedback) {
      const [userId, integrationId] = key.split(':');
      
      try {
        const result = await updateWeights(supabase, userId, integrationId, feedbacks, test_mode);
        if (result.success) {
          updatesCount++;
          console.log(`✅ Updated weights for user ${userId}, integration ${integrationId}`);
        }
      } catch (error) {
        console.error(`Error updating weights for ${key}:`, error);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      feedback_processed: feedbackData.length,
      weight_updates: updatesCount,
      test_mode
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Fusion learning update error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function updateWeights(
  supabase: any,
  userId: string,
  integrationId: string,
  feedbacks: any[],
  testMode: boolean
): Promise<{ success: boolean; message: string }> {
  const { data: scoreData } = await supabase
    .from('fusion_scores')
    .select('learning_rate')
    .eq('user_id', userId)
    .eq('integration_id', integrationId)
    .single();
  
  const learningRate = scoreData?.learning_rate || DEFAULT_LEARNING_RATE;

  const now = Date.now();
  let weightedSuccessSum = 0;
  let totalDecayWeight = 0;

  for (const feedback of feedbacks) {
    const ageInDays = (now - new Date(feedback.created_at).getTime()) / (1000 * 60 * 60 * 24);
    const decayWeight = Math.exp(-DECAY_LAMBDA * ageInDays);
    
    const successValue = feedback.feedback_type === 'success' ? 1.0 : 
                        feedback.feedback_type === 'fail' ? 0.0 : 0.5;
    
    weightedSuccessSum += successValue * decayWeight;
    totalDecayWeight += decayWeight;
  }

  const weightedSuccessRate = totalDecayWeight > 0 ? weightedSuccessSum / totalDecayWeight : 0.5;
  const avgScoreDelta = feedbacks.reduce((sum, f) => {
    const delta = (f.score_after || 0) - (f.score_before || 0);
    return sum + delta;
  }, 0) / feedbacks.length;

  console.log(`Success rate: ${weightedSuccessRate.toFixed(3)}, Avg score delta: ${avgScoreDelta.toFixed(2)}`);

  const { data: metrics } = await supabase
    .from('fusion_metrics')
    .select('id, metric_name, weight')
    .eq('user_id', userId)
    .eq('integration_id', integrationId);

  if (!metrics || metrics.length === 0) {
    return { success: false, message: 'No metrics found' };
  }

  const performanceFactor = (weightedSuccessRate - 0.5) * 2;
  const scoreDeltaFactor = Math.min(Math.max(avgScoreDelta / 10, -0.5), 0.5);
  
  const adjustmentMultiplier = 1 + (performanceFactor * learningRate) + (scoreDeltaFactor * learningRate);

  if (testMode) {
    console.log(`[Test Mode] Would apply adjustment: ${adjustmentMultiplier.toFixed(3)}x`);
    return { success: true, message: 'Test mode - no actual updates' };
  }

  for (const metric of metrics) {
    const { data: existingWeight } = await supabase
      .from('fusion_weightings')
      .select('weight, final_weight')
      .eq('user_id', userId)
      .eq('integration_id', integrationId)
      .eq('metric_id', metric.id)
      .single();

    const currentWeight = existingWeight?.weight || metric.weight || 1.0;
    const newWeight = Math.min(Math.max(currentWeight * adjustmentMultiplier, MIN_WEIGHT), MAX_WEIGHT);

    await supabase
      .from('fusion_weightings')
      .upsert({
        user_id: userId,
        integration_id: integrationId,
        metric_id: metric.id,
        metric_name: metric.metric_name,
        weight: newWeight,
        final_weight: newWeight,
        adjustment_reason: `Adaptive learning: success_rate=${weightedSuccessRate.toFixed(2)}, delta=${avgScoreDelta.toFixed(1)}`,
        adaptive: true
      });
  }

  await supabase.from('fusion_audit_log').insert({
    user_id: userId,
    integration_id: integrationId,
    event_type: 'adaptive_learning_update',
    event_data: {
      feedback_count: feedbacks.length,
      success_rate: weightedSuccessRate,
      avg_score_delta: avgScoreDelta,
      adjustment_multiplier: adjustmentMultiplier,
      metrics_updated: metrics.length
    }
  });

  return { success: true, message: `Updated ${metrics.length} weights` };
}
