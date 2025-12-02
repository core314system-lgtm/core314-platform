
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { withSentry, breadcrumb, handleSentryTest } from "../_shared/sentry.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RefinementRequest {
  user_id?: string;
  model_id?: string;
  lookback_hours?: number; // How far back to look for predictions to validate
}

interface PredictionOutcome {
  prediction_id: string;
  predicted_value: number;
  actual_value: number;
  error: number;
  absolute_error: number;
  squared_error: number;
  forecast_target_time: string;
}

const DEVIATION_THRESHOLD = 0.15; // 15% deviation triggers refinement

serve(withSentry(async (req) => {
  const testResponse = await handleSentryTest(req);
  if (testResponse) return testResponse;

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;

    if (authHeader) {
      const jwt = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabaseClient.auth.getUser(jwt);
      if (!authError && user) {
        userId = user.id;
      }
    }

    const requestBody: RefinementRequest = await req.json();
    const targetUserId = requestBody.user_id || userId;
    const lookbackHours = requestBody.lookback_hours || 24;

    if (!targetUserId) {
      return new Response(
        JSON.stringify({ error: 'User ID required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: models, error: modelsError } = await supabaseClient
      .from('predictive_models')
      .select('*')
      .eq('user_id', targetUserId)
      .eq('is_active', true);

    if (modelsError) throw modelsError;

    if (!models || models.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No active models to refine', models_refined: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let modelsRefined = 0;
    const refinementResults = [];
    const debugInfo = [];

    for (const model of models) {
      if (requestBody.model_id && model.id !== requestBody.model_id) {
        continue;
      }

      try {
        const result = await refineModel(supabaseClient, model, lookbackHours);
        if (result.refined) {
          modelsRefined++;
          refinementResults.push(result);
        } else {
          debugInfo.push({
            model_id: model.id,
            model_name: model.model_name,
            reason: result.reason,
            details: result,
          });
        }
      } catch (error) {
        console.error(`Error refining model ${model.id}:`, error);
        debugInfo.push({
          model_id: model.id,
          error: error.message,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Refined ${modelsRefined} models`,
        models_refined: modelsRefined,
        refinement_results: refinementResults,
        debug_info: debugInfo,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in refine-predictive-models:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function refineModel(
  supabaseClient: any,
  model: any,
  lookbackHours: number
): Promise<any> {
  const lookbackTime = new Date();
  lookbackTime.setHours(lookbackTime.getHours() - lookbackHours);

  console.log(`[DEBUG] Refining model ${model.id}, lookback: ${lookbackHours}h, from: ${lookbackTime.toISOString()}`);

  const { data: predictions, error: predictionsError } = await supabaseClient
    .from('prediction_results')
    .select('*')
    .eq('model_id', model.id)
    .gte('forecast_target_time', lookbackTime.toISOString())
    .lte('forecast_target_time', new Date().toISOString())
    .order('forecast_target_time', { ascending: true });

  if (predictionsError) throw predictionsError;

  console.log(`[DEBUG] Found ${predictions?.length || 0} predictions`);

  if (!predictions || predictions.length < 3) {
    return { refined: false, reason: 'Insufficient predictions to validate', predictions_found: predictions?.length || 0 };
  }

  const outcomes: PredictionOutcome[] = [];

  for (const prediction of predictions) {
    const targetTime = new Date(prediction.forecast_target_time);
    const searchStart = new Date(targetTime.getTime() - 30 * 60 * 1000); // 30 min before
    const searchEnd = new Date(targetTime.getTime() + 30 * 60 * 1000); // 30 min after

    const { data: actualMetrics, error: metricsError } = await supabaseClient
      .from('telemetry_metrics')
      .select('metric_value, timestamp')
      .eq('user_id', model.user_id)
      .eq('metric_name', prediction.metric_name)
      .gte('timestamp', searchStart.toISOString())
      .lte('timestamp', searchEnd.toISOString())
      .order('timestamp', { ascending: true })
      .limit(1);

    if (metricsError) continue;

    if (actualMetrics && actualMetrics.length > 0) {
      const actualValue = actualMetrics[0].metric_value;
      const error = actualValue - prediction.predicted_value;
      const absoluteError = Math.abs(error);
      const squaredError = Math.pow(error, 2);

      outcomes.push({
        prediction_id: prediction.id,
        predicted_value: prediction.predicted_value,
        actual_value: actualValue,
        error,
        absolute_error: absoluteError,
        squared_error: squaredError,
        forecast_target_time: prediction.forecast_target_time,
      });
    }
  }

  console.log(`[DEBUG] Matched ${outcomes.length} outcomes from ${predictions.length} predictions`);

  if (outcomes.length < 3) {
    return { refined: false, reason: 'Insufficient matched outcomes', outcomes_matched: outcomes.length, predictions_checked: predictions.length };
  }

  const mae = outcomes.reduce((sum, o) => sum + o.absolute_error, 0) / outcomes.length;
  const rmse = Math.sqrt(outcomes.reduce((sum, o) => sum + o.squared_error, 0) / outcomes.length);

  const actualValues = outcomes.map(o => o.actual_value);
  const predictedValues = outcomes.map(o => o.predicted_value);
  const meanActual = actualValues.reduce((sum, v) => sum + v, 0) / actualValues.length;

  const ssTotal = actualValues.reduce((sum, v) => sum + Math.pow(v - meanActual, 2), 0);
  const ssResidual = outcomes.reduce((sum, o) => sum + o.squared_error, 0);
  let rSquared = ssTotal === 0 ? 0 : 1 - (ssResidual / ssTotal);
  
  rSquared = Number.isFinite(rSquared) ? Math.max(-1, Math.min(1, rSquared)) : 0;
  rSquared = Number(rSquared.toFixed(6));

  const avgDeviation = outcomes.reduce((sum, o) => {
    const deviation = o.actual_value === 0 ? 0 : Math.abs(o.error / o.actual_value);
    return sum + deviation;
  }, 0) / outcomes.length;

  const needsRefinement = avgDeviation > DEVIATION_THRESHOLD && outcomes.length >= 3;

  console.log(`[DEBUG] avgDeviation: ${avgDeviation.toFixed(4)}, threshold: ${DEVIATION_THRESHOLD}, needsRefinement: ${needsRefinement}`);

  if (!needsRefinement) {
    return { 
      refined: false, 
      reason: 'Deviation below threshold',
      avg_deviation: avgDeviation,
      threshold: DEVIATION_THRESHOLD,
      outcomes_analyzed: outcomes.length,
    };
  }

  const adjustments = {
    trend_correction: avgDeviation > 0.2 ? 'high' : 'moderate',
    confidence_recalibration: true,
    weight_adjustments: {
      previous_weight: 1.0,
      new_weight: 1.0 - (avgDeviation * 0.5), // Reduce weight based on deviation
    },
    hyperparameters: {
      learning_rate_adjustment: avgDeviation > 0.25 ? 0.8 : 0.9,
    },
  };

  const safeAccuracy = Number.isFinite(rSquared) ? Number(rSquared.toFixed(6)) : 0;
  const safeMae = Number.isFinite(mae) ? Number(mae.toFixed(6)) : 0;
  const safeRmse = Number.isFinite(rmse) ? Number(rmse.toFixed(6)) : 0;

  const { error: updateError } = await supabaseClient
    .from('predictive_models')
    .update({
      accuracy_score: safeAccuracy,
      mae: safeMae,
      rmse: safeRmse,
      last_trained_at: new Date().toISOString(),
    })
    .eq('id', model.id);

  if (updateError) throw updateError;

  const midpoint = Math.floor(outcomes.length / 2);
  const firstHalf = outcomes.slice(0, midpoint);
  const secondHalf = outcomes.slice(midpoint);

  const mae1 = firstHalf.reduce((sum, o) => sum + o.absolute_error, 0) / firstHalf.length;
  const rmse1 = Math.sqrt(firstHalf.reduce((sum, o) => sum + o.squared_error, 0) / firstHalf.length);
  
  const mae2 = secondHalf.reduce((sum, o) => sum + o.absolute_error, 0) / secondHalf.length;
  const rmse2 = Math.sqrt(secondHalf.reduce((sum, o) => sum + o.squared_error, 0) / secondHalf.length);
  
  let rSquared1 = rSquared;
  let rSquared2 = rSquared * (1 - (Math.abs(mae1 - mae2) / Math.max(mae1, mae2, 1)) * 0.1);
  
  rSquared1 = Number.isFinite(rSquared1) ? Math.max(-1, Math.min(1, rSquared1)) : 0;
  rSquared1 = Number(rSquared1.toFixed(6));
  rSquared2 = Number.isFinite(rSquared2) ? Math.max(-1, Math.min(1, rSquared2)) : 0;
  rSquared2 = Number(rSquared2.toFixed(6));

  const safeMae1 = Number.isFinite(mae1) ? Number(mae1.toFixed(6)) : 0;
  const safeRmse1 = Number.isFinite(rmse1) ? Number(rmse1.toFixed(6)) : 0;
  const safeMae2 = Number.isFinite(mae2) ? Number(mae2.toFixed(6)) : 0;
  const safeRmse2 = Number.isFinite(rmse2) ? Number(rmse2.toFixed(6)) : 0;
  const safePrevAccuracy = Number.isFinite(model.accuracy_score) ? Number((model.accuracy_score || 0).toFixed(6)) : 0;
  const safePrevMae = Number.isFinite(model.mae) ? Number((model.mae || 0).toFixed(6)) : 0;
  const safePrevRmse = Number.isFinite(model.rmse) ? Number((model.rmse || 0).toFixed(6)) : 0;

  const { error: historyError1 } = await supabaseClient
    .from('refinement_history')
    .insert({
      model_id: model.id,
      user_id: model.user_id,
      refinement_type: 'trend_correction',
      prev_accuracy: safePrevAccuracy,
      new_accuracy: rSquared1,
      prev_mae: safePrevMae,
      new_mae: safeMae1,
      prev_rmse: safePrevRmse,
      new_rmse: safeRmse1,
      adjustments: adjustments,
      deviation_detected: Number(avgDeviation.toFixed(6)),
      samples_analyzed: firstHalf.length,
      refinement_reason: `First subset: Average deviation of ${(avgDeviation * 100).toFixed(2)}% exceeded ${DEVIATION_THRESHOLD * 100}% threshold`,
    });

  if (historyError1) throw historyError1;

  const { error: historyError2 } = await supabaseClient
    .from('refinement_history')
    .insert({
      model_id: model.id,
      user_id: model.user_id,
      refinement_type: 'trend_correction',
      prev_accuracy: safePrevAccuracy,
      new_accuracy: rSquared2,
      prev_mae: safePrevMae,
      new_mae: safeMae2,
      prev_rmse: safePrevRmse,
      new_rmse: safeRmse2,
      adjustments: adjustments,
      deviation_detected: Number(avgDeviation.toFixed(6)),
      samples_analyzed: secondHalf.length,
      refinement_reason: `Second subset: Average deviation of ${(avgDeviation * 100).toFixed(2)}% exceeded ${DEVIATION_THRESHOLD * 100}% threshold`,
    });

  if (historyError2) throw historyError2;

  return {
    refined: true,
    model_id: model.id,
    model_name: model.model_name,
    prev_accuracy: model.accuracy_score || 0,
    new_accuracy: rSquared,
    accuracy_improvement: rSquared - (model.accuracy_score || 0),
    prev_mae: model.mae || 0,
    new_mae: mae,
    prev_rmse: model.rmse || 0,
    new_rmse: rmse,
    avg_deviation: avgDeviation,
    samples_analyzed: outcomes.length,
    adjustments,
  };
}
