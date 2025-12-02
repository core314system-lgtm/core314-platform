import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { withSentry, breadcrumb, handleSentryTest, jsonError } from "../_shared/sentry.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RetrainingRequest {
  force_retrain?: boolean;
  model_id?: string;
  user_id?: string;
}

serve(withSentry(async (req) => {
  const testResponse = await handleSentryTest(req);
  if (testResponse) return testResponse;

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const startTime = Date.now();

    const body = await req.json().catch(() => ({})) as RetrainingRequest;
    const { force_retrain = false, model_id } = body;

    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseClient = createClient(supabaseUrl, serviceKey);

    let actingUserId: string | null = null;

    if (token && token === serviceKey) {
      if (!body?.user_id) {
        throw new Error('user_id required in request body when using service role key');
      }
      actingUserId = body.user_id;
    } else {
      if (!token) {
        throw new Error('Missing authorization header');
      }
      const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
      if (authError || !user) {
        throw new Error('Invalid authentication token');
      }
      actingUserId = user.id;
    }

    let modelsToRetrain = [];

    if (model_id) {
      const { data: specificModel, error: modelError } = await supabaseClient
        .from('predictive_models')
        .select('*')
        .eq('id', model_id)
        .eq('user_id', actingUserId)
        .eq('is_active', true)
        .single();

      if (modelError || !specificModel) {
        throw new Error(`Model not found: ${model_id}`);
      }
      modelsToRetrain = [specificModel];
    } else {
      const { data: dueModels, error: dueError } = await supabaseClient
        .rpc('get_models_due_for_retraining');

      if (dueError) {
        throw new Error(`Failed to fetch models due for retraining: ${dueError.message}`);
      }

      modelsToRetrain = (dueModels || []).filter((m: any) => m.user_id === actingUserId);
    }

    if (!force_retrain && modelsToRetrain.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No models due for retraining',
          models_checked: 0,
          models_retrained: 0,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const retrainingResults = [];

    for (const model of modelsToRetrain) {
      try {
        const lookbackDays = 30;
        const lookbackDate = new Date();
        lookbackDate.setDate(lookbackDate.getDate() - lookbackDays);

        const { data: recentData, error: dataError } = await supabaseClient
          .from('telemetry_metrics')
          .select('metric_value, recorded_at')
          .eq('user_id', actingUserId)
          .eq('metric_name', model.target_metric)
          .gte('recorded_at', lookbackDate.toISOString())
          .order('recorded_at', { ascending: true });

        if (dataError || !recentData || recentData.length < 10) {
          retrainingResults.push({
            model_id: model.id,
            model_name: model.model_name,
            status: 'skipped',
            reason: 'Insufficient data',
          });
          continue;
        }

        const { data: recentPredictions } = await supabaseClient
          .from('prediction_results')
          .select('predicted_value, actual_value, prediction_error')
          .eq('model_id', model.id)
          .not('actual_value', 'is', null)
          .order('predicted_at', { ascending: false })
          .limit(20);

        let shouldRetrain = force_retrain;
        let driftReason = '';

        if (!shouldRetrain && recentPredictions && recentPredictions.length >= 5) {
          const avgError = recentPredictions.reduce((sum: number, p: any) => 
            sum + (p.prediction_error || 0), 0) / recentPredictions.length;
          
          const expectedError = model.mae || 5.0;
          const driftPercentage = Math.abs((avgError - expectedError) / expectedError);

          if (driftPercentage > (model.drift_threshold || 0.10)) {
            shouldRetrain = true;
            driftReason = `Drift detected: ${(driftPercentage * 100).toFixed(1)}% (threshold: ${((model.drift_threshold || 0.10) * 100).toFixed(0)}%)`;
          }
        }

        const scheduledRetrain = model.next_retrain_at && new Date(model.next_retrain_at) <= new Date();
        if (!shouldRetrain && scheduledRetrain) {
          shouldRetrain = true;
          driftReason = 'Scheduled retraining due';
        }

        if (!shouldRetrain) {
          retrainingResults.push({
            model_id: model.id,
            model_name: model.model_name,
            status: 'skipped',
            reason: 'No drift detected, not due for retraining',
          });
          continue;
        }

        const trainResponse = await fetch(`${supabaseUrl}/functions/v1/train-predictive-model`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: actingUserId,
            model_name: model.model_name,
            model_type: model.model_type,
            target_metric: model.target_metric,
            features: model.features,
            hyperparameters: model.hyperparameters,
            training_window_days: 30,
          }),
        });

        if (!trainResponse.ok) {
          const errorText = await trainResponse.text();
          retrainingResults.push({
            model_id: model.id,
            model_name: model.model_name,
            status: 'failed',
            reason: `Training failed: ${errorText}`,
          });
          continue;
        }

        const trainResult = await trainResponse.json();

        retrainingResults.push({
          model_id: model.id,
          model_name: model.model_name,
          status: 'completed',
          reason: driftReason || 'Scheduled retraining',
          performance: trainResult.performance,
          training_duration_ms: trainResult.training_duration_ms,
        });

      } catch (error) {
        retrainingResults.push({
          model_id: model.id,
          model_name: model.model_name,
          status: 'error',
          reason: error.message,
        });
      }
    }

    const successCount = retrainingResults.filter(r => r.status === 'completed').length;
    const failedCount = retrainingResults.filter(r => r.status === 'failed' || r.status === 'error').length;
    const skippedCount = retrainingResults.filter(r => r.status === 'skipped').length;

    return new Response(
      JSON.stringify({
        success: true,
        message: `Retraining completed: ${successCount} succeeded, ${failedCount} failed, ${skippedCount} skipped`,
        models_checked: modelsToRetrain.length,
        models_retrained: successCount,
        models_failed: failedCount,
        models_skipped: skippedCount,
        results: retrainingResults,
        processing_time_ms: Date.now() - startTime,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in adaptive-retraining-scheduler:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error',
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}), { name: "adaptive-retraining-scheduler" }));