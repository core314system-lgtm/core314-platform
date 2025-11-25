
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MemoryTrainingRequest {
  user_id?: string;
  metric_name?: string;
  data_windows?: string[]; // e.g., ['7 days', '30 days', '90 days']
}

interface MetricDataPoint {
  timestamp: string;
  value: number;
}

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

    const requestBody: MemoryTrainingRequest = await req.json();
    const targetUserId = requestBody.user_id || userId;

    if (!targetUserId) {
      return new Response(
        JSON.stringify({ error: 'User ID required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const dataWindows = requestBody.data_windows || ['7 days', '30 days', '90 days'];
    const targetMetric = requestBody.metric_name;

    const { data: metrics, error: metricsError } = await supabaseClient
      .from('telemetry_metrics')
      .select('metric_name')
      .eq('user_id', targetUserId);

    if (metricsError) throw metricsError;

    const uniqueMetrics = targetMetric 
      ? [targetMetric]
      : [...new Set(metrics?.map(m => m.metric_name) || [])];

    let snapshotsCreated = 0;

    for (const metricName of uniqueMetrics) {
      for (const window of dataWindows) {
        try {
          const snapshot = await createMemorySnapshot(
            supabaseClient,
            targetUserId,
            metricName,
            window
          );

          if (snapshot) {
            snapshotsCreated++;
          }
        } catch (error) {
          console.error(`Error creating snapshot for ${metricName} (${window}):`, error);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Created ${snapshotsCreated} memory snapshots`,
        snapshots_created: snapshotsCreated,
        metrics_processed: uniqueMetrics.length,
        windows_per_metric: dataWindows.length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in train-memory-model:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function createMemorySnapshot(
  supabaseClient: any,
  userId: string,
  metricName: string,
  dataWindow: string
): Promise<boolean> {
  const windowEnd = new Date();
  const windowStart = new Date();

  const windowMatch = dataWindow.match(/(\d+)\s+(day|days|hour|hours|week|weeks)/);
  if (!windowMatch) {
    throw new Error(`Invalid data window format: ${dataWindow}`);
  }

  const amount = parseInt(windowMatch[1]);
  const unit = windowMatch[2];

  if (unit.startsWith('day')) {
    windowStart.setDate(windowStart.getDate() - amount);
  } else if (unit.startsWith('hour')) {
    windowStart.setHours(windowStart.getHours() - amount);
  } else if (unit.startsWith('week')) {
    windowStart.setDate(windowStart.getDate() - (amount * 7));
  }

  const { data: metricData, error: fetchError } = await supabaseClient
    .from('telemetry_metrics')
    .select('timestamp, value')
    .eq('user_id', userId)
    .eq('metric_name', metricName)
    .gte('timestamp', windowStart.toISOString())
    .lte('timestamp', windowEnd.toISOString())
    .order('timestamp', { ascending: true });

  if (fetchError) throw fetchError;

  if (!metricData || metricData.length < 3) {
    console.log(`Insufficient data for ${metricName} (${dataWindow}): ${metricData?.length || 0} samples`);
    return false;
  }

  const values = metricData.map((d: MetricDataPoint) => d.value);
  const avgValue = values.reduce((sum: number, v: number) => sum + v, 0) / values.length;
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);

  const squaredDiffs = values.map((v: number) => Math.pow(v - avgValue, 2));
  const variance = squaredDiffs.reduce((sum: number, v: number) => sum + v, 0) / values.length;
  const stdDev = Math.sqrt(variance);

  const trendSlope = calculateTrendSlope(metricData);

  const { detected: seasonalityDetected, period: seasonalityPeriod } = detectSeasonality(metricData);

  const { error: insertError } = await supabaseClient
    .from('memory_snapshots')
    .insert({
      user_id: userId,
      metric_name: metricName,
      data_window: dataWindow,
      window_start: windowStart.toISOString(),
      window_end: windowEnd.toISOString(),
      avg_value: avgValue,
      trend_slope: trendSlope,
      variance: variance,
      std_dev: stdDev,
      min_value: minValue,
      max_value: maxValue,
      sample_count: metricData.length,
      seasonality_detected: seasonalityDetected,
      seasonality_period: seasonalityPeriod,
    });

  if (insertError) throw insertError;

  return true;
}

function calculateTrendSlope(data: MetricDataPoint[]): number {
  const n = data.length;
  if (n < 2) return 0;

  const points = data.map((d, i) => ({
    x: new Date(d.timestamp).getTime(),
    y: d.value,
  }));

  const meanX = points.reduce((sum, p) => sum + p.x, 0) / n;
  const meanY = points.reduce((sum, p) => sum + p.y, 0) / n;

  let numerator = 0;
  let denominator = 0;

  for (const point of points) {
    numerator += (point.x - meanX) * (point.y - meanY);
    denominator += Math.pow(point.x - meanX, 2);
  }

  return denominator === 0 ? 0 : numerator / denominator;
}

function detectSeasonality(data: MetricDataPoint[]): { detected: boolean; period: string | null } {
  
  if (data.length < 14) {
    return { detected: false, period: null };
  }

  const values = data.map(d => d.value);
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;

  const lag7Correlation = calculateAutocorrelation(values, mean, 7);

  if (lag7Correlation > 0.6) {
    return { detected: true, period: '7 days' };
  }

  return { detected: false, period: null };
}

function calculateAutocorrelation(values: number[], mean: number, lag: number): number {
  if (values.length <= lag) return 0;

  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i < values.length - lag; i++) {
    numerator += (values[i] - mean) * (values[i + lag] - mean);
  }

  for (let i = 0; i < values.length; i++) {
    denominator += Math.pow(values[i] - mean, 2);
  }

  return denominator === 0 ? 0 : numerator / denominator;
}
