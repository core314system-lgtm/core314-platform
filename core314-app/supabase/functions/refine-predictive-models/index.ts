
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

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

serve(async (req) => {
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

    for (const model of models) {
      if (requestBody.model_id && model.id !== requestBody.model_id) {
        continue;
      }

      try {
        const result = await refineModel(supabaseClient, model, lookbackHours);
        if (result.refined) {
          modelsRefined++;
          refinementResults.push(result);
        }
      } catch (error) {
        console.error(`Error refining model ${model.id}:`, error);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Refined ${modelsRefined} models`,
        models_refined: modelsRefined,
        refinement_results: refinementResults,
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

  const { data: predictions, error: predictionsError } = await supabaseClient
    .from('prediction_results')
    .select('*')
    .eq('model_id', model.id)
    .lte('forecast_target_time', new Date().toISOString())
    .gte('created_at', lookbackTime.toISOString())
    .order('forecast_target_time', { ascending: true });

  if (predictionsError) throw predictionsError;

  if (!predictions || predictions.length < 3) {
    return { refined: false, reason: 'Insufficient predictions to validate' };
  }

  const outcomes: PredictionOutcome[] = [];

  for (const prediction of predictions) {
    const targetTime = new Date(prediction.forecast_target_time);
    const searchStart = new Date(targetTime.getTime() - 5 * 60 * 1000); // 5 min before
    const searchEnd = new Date(targetTime.getTime() + 5 * 60 * 1000); // 5 min after

    const { data: actualMetrics, error: metricsError } = await supabaseClient
      .from('telemetry_metrics')
      .select('value, timestamp')
      .eq('user_id', model.user_id)
      .eq('metric_name', prediction.metric_name)
      .gte('timestamp', searchStart.toISOString())
      .lte('timestamp', searchEnd.toISOString())
      .order('timestamp', { ascending: true })
      .limit(1);

    if (metricsError) continue;

    if (actualMetrics && actualMetrics.length > 0) {
      const actualValue = actualMetrics[0].value;
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

  if (outcomes.length < 3) {
    return { refined: false, reason: 'Insufficient matched outcomes' };
  }

  const mae = outcomes.reduce((sum, o) => sum + o.absolute_error, 0) / outcomes.length;
  const rmse = Math.sqrt(outcomes.reduce((sum, o) => sum + o.squared_error, 0) / outcomes.length);

  const actualValues = outcomes.map(o => o.actual_value);
  const predictedValues = outcomes.map(o => o.predicted_value);
  const meanActual = actualValues.reduce((sum, v) => sum + v, 0) / actualValues.length;

  const ssTotal = actualValues.reduce((sum, v) => sum + Math.pow(v - meanActual, 2), 0);
  const ssResidual = outcomes.reduce((sum, o) => sum + o.squared_error, 0);
  const rSquared = ssTotal === 0 ? 0 : 1 - (ssResidual / ssTotal);

  const avgDeviation = outcomes.reduce((sum, o) => {
    const deviation = o.actual_value === 0 ? 0 : Math.abs(o.error / o.actual_value);
    return sum + deviation;
  }, 0) / outcomes.length;

  const needsRefinement = avgDeviation > DEVIATION_THRESHOLD && outcomes.length >= 3;

  if (!needsRefinement) {
    return { 
      refined: false, 
      reason: 'Deviation below threshold',
      avg_deviation: avgDeviation,
      threshold: DEVIATION_THRESHOLD,
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

  const { error: updateError } = await supabaseClient
    .from('predictive_models')
    .update({
      accuracy_score: rSquared,
      mae: mae,
      rmse: rmse,
      last_trained_at: new Date().toISOString(),
    })
    .eq('id', model.id);

  if (updateError) throw updateError;

  const { error: historyError } = await supabaseClient
    .from('refinement_history')
    .insert({
      model_id: model.id,
      user_id: model.user_id,
      refinement_type: 'trend_correction',
      prev_accuracy: model.accuracy_score || 0,
      new_accuracy: rSquared,
      prev_mae: model.mae || 0,
      new_mae: mae,
      prev_rmse: model.rmse || 0,
      new_rmse: rmse,
      adjustments: adjustments,
      deviation_detected: avgDeviation,
      samples_analyzed: outcomes.length,
      refinement_reason: `Average deviation of ${(avgDeviation * 100).toFixed(2)}% exceeded ${DEVIATION_THRESHOLD * 100}% threshold`,
    });

  if (historyError) throw historyError;

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
