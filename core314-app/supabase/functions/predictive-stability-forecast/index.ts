import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { createAdminClient } from '../_shared/integration-utils.ts';

interface MetricRecord {
  event_type: string;
  confidence_score: number;
  feedback_score: number | null;
  adjustment_type: string | null;
  created_at: string;
}

interface ForecastResult {
  event_type: string;
  current_variance: number;
  predicted_variance: number;
  predicted_stability_index: number;
  instability_probability: number;
  risk_category: string;
  sample_count: number;
}

interface ForecastResponse {
  status: string;
  forecasts: ForecastResult[];
  timestamp: string;
}

function calculateVariance(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
  return squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
}

function calculateRollingVariance(values: number[], windowSize: number = 20): number {
  if (values.length < windowSize) {
    return calculateVariance(values);
  }
  const recentValues = values.slice(-windowSize);
  return calculateVariance(recentValues);
}

function calculateStabilityIndex(confidenceScores: number[], feedbackScores: number[]): number {
  if (confidenceScores.length === 0) return 0;
  
  const avgConfidence = confidenceScores.reduce((sum, val) => sum + val, 0) / confidenceScores.length;
  
  let avgFeedback = 0;
  if (feedbackScores.length > 0) {
    avgFeedback = feedbackScores.reduce((sum, val) => sum + val, 0) / feedbackScores.length;
  }
  
  return (0.6 * avgConfidence) + (0.4 * avgFeedback);
}

function exponentialSmoothing(currentValue: number, previousValue: number, alpha: number = 0.6): number {
  return (alpha * currentValue) + ((1 - alpha) * previousValue);
}

function predictVariance(currentVariance: number, historicalVariances: number[], alpha: number = 0.6): number {
  if (historicalVariances.length === 0) {
    return currentVariance;
  }
  
  const previousVariance = historicalVariances[historicalVariances.length - 1];
  return exponentialSmoothing(currentVariance, previousVariance, alpha);
}

function predictStabilityIndex(currentStability: number, historicalStabilities: number[], alpha: number = 0.6): number {
  if (historicalStabilities.length === 0) {
    return currentStability;
  }
  
  const previousStability = historicalStabilities[historicalStabilities.length - 1];
  return exponentialSmoothing(currentStability, previousStability, alpha);
}

function calculateInstabilityProbability(predictedStabilityIndex: number): number {
  return Math.max(0, Math.min(1, 1 - predictedStabilityIndex));
}

function categorizeRisk(instabilityProbability: number): string {
  if (instabilityProbability >= 0.8) {
    return 'High Risk';
  } else if (instabilityProbability >= 0.6) {
    return 'Moderate Risk';
  } else {
    return 'Stable';
  }
}

function groupByEventType(records: MetricRecord[]): Map<string, MetricRecord[]> {
  const grouped = new Map<string, MetricRecord[]>();
  
  for (const record of records) {
    if (!grouped.has(record.event_type)) {
      grouped.set(record.event_type, []);
    }
    grouped.get(record.event_type)!.push(record);
  }
  
  return grouped;
}

function computeForecastForEventType(records: MetricRecord[]): ForecastResult {
  const eventType = records[0].event_type;
  const confidenceScores = records.map(r => r.confidence_score);
  const feedbackScores = records.filter(r => r.feedback_score !== null).map(r => r.feedback_score!);
  
  const currentVariance = calculateRollingVariance(confidenceScores, 20);
  
  const historicalVariances: number[] = [];
  for (let i = 20; i < confidenceScores.length; i += 20) {
    const windowValues = confidenceScores.slice(Math.max(0, i - 20), i);
    historicalVariances.push(calculateVariance(windowValues));
  }
  
  const predictedVariance = predictVariance(currentVariance, historicalVariances, 0.6);
  
  const currentStability = calculateStabilityIndex(confidenceScores, feedbackScores);
  
  const historicalStabilities: number[] = [];
  for (let i = 20; i < records.length; i += 20) {
    const windowRecords = records.slice(Math.max(0, i - 20), i);
    const windowConfidence = windowRecords.map(r => r.confidence_score);
    const windowFeedback = windowRecords.filter(r => r.feedback_score !== null).map(r => r.feedback_score!);
    historicalStabilities.push(calculateStabilityIndex(windowConfidence, windowFeedback));
  }
  
  const predictedStabilityIndex = predictStabilityIndex(currentStability, historicalStabilities, 0.6);
  
  const instabilityProbability = calculateInstabilityProbability(predictedStabilityIndex);
  
  const riskCategory = categorizeRisk(instabilityProbability);
  
  return {
    event_type: eventType,
    current_variance: currentVariance,
    predicted_variance: predictedVariance,
    predicted_stability_index: predictedStabilityIndex,
    instability_probability: instabilityProbability,
    risk_category: riskCategory,
    sample_count: records.length
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const internalToken = req.headers.get('X-Internal-Token');
    const expectedToken = Deno.env.get('INTERNAL_WEBHOOK_TOKEN');

    if (!internalToken || internalToken !== expectedToken) {
      console.warn('[PSF] Unauthorized access attempt');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('[PSF] Starting Predictive Stability Forecast...');

    const supabaseAdmin = createAdminClient();
    
    const { data: metrics, error: queryError } = await supabaseAdmin
      .from('adaptive_workflow_metrics')
      .select('event_type, confidence_score, feedback_score, adjustment_type, created_at')
      .order('created_at', { ascending: false })
      .limit(500);

    if (queryError) {
      console.error('[PSF] Database query error:', queryError);
      return new Response(
        JSON.stringify({
          error: 'Database error',
          details: queryError.message
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (!metrics || metrics.length === 0) {
      console.log('[PSF] No metrics found in database');
      return new Response(
        JSON.stringify({
          status: 'success',
          forecasts: [],
          timestamp: new Date().toISOString(),
          message: 'No historical data available for forecasting'
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const groupedMetrics = groupByEventType(metrics as MetricRecord[]);
    
    console.log(`[PSF] Retrieved ${metrics.length} records across ${groupedMetrics.size} event types`);

    const forecasts: ForecastResult[] = [];

    for (const [eventType, records] of groupedMetrics.entries()) {
      if (records.length < 10) {
        console.log(`[PSF] Skipping ${eventType}: insufficient data (${records.length} records)`);
        continue;
      }

      const forecast = computeForecastForEventType(records);
      forecasts.push(forecast);

      console.log(
        `[PSF] ${eventType}: predicted_variance=${forecast.predicted_variance.toFixed(3)} | ` +
        `instability=${forecast.instability_probability.toFixed(3)} (${forecast.risk_category})`
      );
    }

    console.log(`[PSF] Forecast complete. Results ready for Fusion Risk Engine.`);

    const response: ForecastResponse = {
      status: 'success',
      forecasts: forecasts,
      timestamp: new Date().toISOString()
    };

    return new Response(
      JSON.stringify(response, null, 2),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('[PSF] Unexpected error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
