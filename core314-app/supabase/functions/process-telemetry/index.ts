
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { withSentry, breadcrumb, handleSentryTest, jsonError } from "../_shared/sentry.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MetricPayload {
  metric_name: string;
  metric_value: number;
  metric_unit?: string;
  source_app?: string;
  metadata?: Record<string, any>;
  timestamp?: string;
}

interface BatchMetricPayload {
  metrics: MetricPayload[];
}

serve(withSentry(async (req) => {
  const testResponse = await handleSentryTest(req);
  if (testResponse) return testResponse;

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Invalid authentication token');
    }

    const body = await req.json();
    const startTime = Date.now();

    let metrics: MetricPayload[] = [];
    if (Array.isArray(body.metrics)) {
      metrics = body.metrics;
    } else if (body.metric_name && body.metric_value !== undefined) {
      metrics = [body as MetricPayload];
    } else {
      throw new Error('Invalid payload format. Expected either a single metric or { metrics: [...] }');
    }

    const normalizedMetrics = metrics.map((metric) => {
      if (!metric.metric_name || typeof metric.metric_name !== 'string') {
        throw new Error('metric_name is required and must be a string');
      }
      if (metric.metric_value === undefined || metric.metric_value === null) {
        throw new Error('metric_value is required');
      }
      if (typeof metric.metric_value !== 'number' && isNaN(Number(metric.metric_value))) {
        throw new Error('metric_value must be a number');
      }

      return {
        user_id: user.id,
        metric_name: metric.metric_name.toLowerCase().trim(),
        metric_value: Number(metric.metric_value),
        metric_unit: metric.metric_unit?.trim() || null,
        source_app: metric.source_app?.trim() || 'unknown',
        metadata: metric.metadata || {},
        timestamp: metric.timestamp ? new Date(metric.timestamp).toISOString() : new Date().toISOString(),
      };
    });

    const { data: insertedMetrics, error: insertError } = await supabaseClient
      .from('telemetry_metrics')
      .insert(normalizedMetrics)
      .select('id, metric_name, metric_value, timestamp');

    if (insertError) {
      console.error('Error inserting metrics:', insertError);
      throw new Error(`Failed to insert metrics: ${insertError.message}`);
    }

    const processingTime = Date.now() - startTime;

    const thresholdChecks = await Promise.all(
      normalizedMetrics.map(async (metric) => {
        try {
          const userScopedClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            {
              global: {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              },
            }
          );
          
          const { data: thresholds, error: thresholdError } = await userScopedClient
            .rpc('get_active_thresholds', {
              p_metric_name: metric.metric_name,
            });

          if (thresholdError || !thresholds || thresholds.length === 0) {
            return { metric_name: metric.metric_name, triggered: false };
          }

          const triggeredThresholds = [];
          for (const threshold of thresholds) {
            const { data: shouldTrigger, error: checkError } = await supabaseClient
              .rpc('should_trigger_threshold', {
                p_threshold_id: threshold.id,
                p_metric_value: metric.metric_value,
              });

            if (!checkError && shouldTrigger) {
              triggeredThresholds.push(threshold);
            }
          }

          return {
            metric_name: metric.metric_name,
            triggered: triggeredThresholds.length > 0,
            thresholds: triggeredThresholds,
          };
        } catch (error) {
          console.error(`Error checking thresholds for ${metric.metric_name}:`, error);
          return { metric_name: metric.metric_name, triggered: false, error: error.message };
        }
      })
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully processed ${normalizedMetrics.length} metric(s)`,
        metrics_ingested: insertedMetrics?.length || 0,
        processing_time_ms: processingTime,
        threshold_checks: thresholdChecks,
        metrics: insertedMetrics,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in process-telemetry:', error);
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
}), { name: "process-telemetry" }));
