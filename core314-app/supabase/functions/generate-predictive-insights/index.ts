import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PredictionRequest {
  model_id?: string;
  model_name?: string;
  forecast_hours?: number;
  user_id?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const startTime = Date.now();

    const body = await req.json().catch(() => ({})) as PredictionRequest;
    const {
      model_id,
      model_name,
      forecast_hours = 24,
    } = body;

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

    if (!model_id && !model_name) {
      throw new Error('Either model_id or model_name is required');
    }

    let modelQuery = supabaseClient
      .from('predictive_models')
      .select('*')
      .eq('user_id', actingUserId)
      .eq('is_active', true);

    if (model_id) {
      modelQuery = modelQuery.eq('id', model_id);
    } else if (model_name) {
      modelQuery = modelQuery.eq('model_name', model_name);
    }

    const { data: model, error: modelError } = await modelQuery.single();

    if (modelError || !model) {
      throw new Error(`Model not found or inactive: ${model_id || model_name}`);
    }

    const lookbackDays = 30;
    const lookbackDate = new Date();
    lookbackDate.setDate(lookbackDate.getDate() - lookbackDays);

    const { data: historicalData, error: dataError } = await supabaseClient
      .from('telemetry_metrics')
      .select('metric_name, metric_value, recorded_at')
      .eq('user_id', actingUserId)
      .eq('metric_name', model.target_metric)
      .gte('recorded_at', lookbackDate.toISOString())
      .order('recorded_at', { ascending: true });

    if (dataError || !historicalData || historicalData.length < 5) {
      throw new Error(`Insufficient historical data for ${model.target_metric}. Need at least 5 samples.`);
    }

    const { data: thresholds } = await supabaseClient
      .from('metric_thresholds')
      .select('*')
      .eq('user_id', actingUserId)
      .eq('metric_name', model.target_metric)
      .eq('is_active', true);

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const recentValues = historicalData.slice(-20).map((d: any) => parseFloat(d.metric_value));
    const mean = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    const variance = recentValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / recentValues.length;
    const stdDev = Math.sqrt(variance);

    const trend = recentValues.length >= 2 
      ? (recentValues[recentValues.length - 1] - recentValues[0]) / recentValues.length
      : 0;

    const forecastTargetTime = new Date();
    forecastTargetTime.setHours(forecastTargetTime.getHours() + forecast_hours);

    const predictedValue = mean + (trend * forecast_hours);
    const confidenceScore = Math.max(0.5, Math.min(0.95, model.accuracy_score || 0.85));
    const lowerBound = predictedValue - (1.96 * stdDev);
    const upperBound = predictedValue + (1.96 * stdDev);

    const prompt = `You are an expert data analyst generating predictive insights for business operations.

Metric: ${model.target_metric}
Current Value: ${recentValues[recentValues.length - 1].toFixed(2)}
Predicted Value (${forecast_hours}h): ${predictedValue.toFixed(2)}
Confidence: ${(confidenceScore * 100).toFixed(1)}%
Trend: ${trend > 0 ? 'Increasing' : trend < 0 ? 'Decreasing' : 'Stable'}

Historical Context:
- Mean (30d): ${mean.toFixed(2)}
- Std Dev: ${stdDev.toFixed(2)}
- Recent trend: ${trend.toFixed(2)} per hour

${thresholds && thresholds.length > 0 ? `Active Thresholds:
${thresholds.map((t: any) => `- ${t.alert_level}: ${t.threshold_value} (${t.comparison_operator})`).join('\n')}` : 'No thresholds configured'}

Task: Generate a human-readable forecast insight that:
1. Explains what is expected to happen in the next ${forecast_hours} hours
2. Identifies if any thresholds will be breached and when
3. Provides actionable recommendations if issues are predicted
4. Uses clear, non-technical language

Respond in JSON format:
{
  "explanation": "Clear explanation of the forecast",
  "risk_level": "low|medium|high",
  "threshold_breaches": [{"threshold_level": "warning", "breach_time_hours": 4, "message": "..."}],
  "recommendations": ["action1", "action2"],
  "confidence_explanation": "Why this confidence level"
}`;

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'You are an expert business analyst specializing in predictive insights and operational forecasting.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.4,
        response_format: { type: 'json_object' },
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      throw new Error(`OpenAI API error: ${openaiResponse.status} - ${errorText}`);
    }

    const openaiData = await openaiResponse.json();
    const insightResult = JSON.parse(openaiData.choices[0].message.content);

    const { data: predictionResult, error: predictionError } = await supabaseClient
      .from('prediction_results')
      .insert({
        model_id: model.id,
        user_id: actingUserId,
        metric_name: model.target_metric,
        prediction_type: 'forecast',
        predicted_value: predictedValue,
        forecast_horizon_hours: forecast_hours,
        forecast_target_time: forecastTargetTime.toISOString(),
        confidence_score: confidenceScore,
        lower_bound: lowerBound,
        upper_bound: upperBound,
        features_used: {
          mean,
          stdDev,
          trend,
          samples: historicalData.length,
        },
        explanation: insightResult.explanation,
      })
      .select()
      .single();

    if (predictionError) {
      throw new Error(`Failed to store prediction: ${predictionError.message}`);
    }

    const alertsCreated = [];

    if (insightResult.threshold_breaches && insightResult.threshold_breaches.length > 0 && thresholds) {
      for (const breach of insightResult.threshold_breaches) {
        const matchingThreshold = thresholds.find((t: any) => 
          t.alert_level === breach.threshold_level
        );

        if (matchingThreshold) {
          const breachTime = new Date();
          breachTime.setHours(breachTime.getHours() + (breach.breach_time_hours || forecast_hours));

          const { data: alert, error: alertError } = await supabaseClient
            .from('predictive_alerts')
            .insert({
              prediction_id: predictionResult.id,
              user_id: actingUserId,
              model_id: model.id,
              threshold_id: matchingThreshold.id,
              metric_name: model.target_metric,
              predicted_value: predictedValue,
              threshold_value: matchingThreshold.threshold_value,
              alert_level: breach.threshold_level,
              alert_type: 'forecast_breach',
              forecast_breach_time: breachTime.toISOString(),
              time_to_breach_hours: breach.breach_time_hours || forecast_hours,
              alert_message: breach.message || `${model.target_metric} predicted to breach ${breach.threshold_level} threshold in ${breach.breach_time_hours || forecast_hours} hours`,
              recommendation: insightResult.recommendations?.join('; '),
              confidence_score: confidenceScore,
            })
            .select()
            .single();

          if (!alertError && alert) {
            alertsCreated.push(alert);

            await supabaseClient
              .from('alert_history')
              .insert({
                user_id: actingUserId,
                predictive_alert_id: alert.id,
                metric_name: model.target_metric,
                alert_level: breach.threshold_level,
                alert_message: breach.message,
                alert_source: 'predictive',
              });
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        prediction_id: predictionResult.id,
        model_name: model.model_name,
        metric_name: model.target_metric,
        forecast: {
          predicted_value: predictedValue,
          confidence_score: confidenceScore,
          lower_bound: lowerBound,
          upper_bound: upperBound,
          forecast_target_time: forecastTargetTime.toISOString(),
          forecast_hours,
        },
        insight: {
          explanation: insightResult.explanation,
          risk_level: insightResult.risk_level,
          recommendations: insightResult.recommendations,
          confidence_explanation: insightResult.confidence_explanation,
        },
        alerts_created: alertsCreated.length,
        threshold_breaches: insightResult.threshold_breaches || [],
        processing_time_ms: Date.now() - startTime,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in generate-predictive-insights:', error);
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
});
