
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { withSentry, breadcrumb, handleSentryTest, jsonError } from "../_shared/sentry.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-token',
};

const THRESHOLDS = {
  STABILITY_VARIANCE: 0.25,
  REINFORCEMENT_RATE_PER_HOUR: 120,
  INSTABILITY_PROBABILITY: 0.40,
};

interface AuditLogEntry {
  id: string;
  event_type: string;
  event_source: string;
  event_payload: Record<string, any>;
  stability_score: number | null;
  reinforcement_delta: number | null;
  created_at: string;
}

serve(withSentry(async (req) => {
  const testResponse = await handleSentryTest(req);
  if (testResponse) return testResponse;

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('[Fusion Anomaly Detector] Starting anomaly detection scan');

    const internalToken = req.headers.get('x-internal-token');
    const expectedToken = Deno.env.get('INTERNAL_WEBHOOK_TOKEN');
    
    if (internalToken !== expectedToken) {
      console.error('[Fusion Anomaly Detector] Invalid internal token');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recentLogs, error: fetchError } = await supabase
      .from('fusion_audit_log')
      .select('*')
      .gte('created_at', oneHourAgo)
      .eq('anomaly_flag', false)
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('[Fusion Anomaly Detector] Fetch error:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch audit logs', details: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!recentLogs || recentLogs.length === 0) {
      console.log('[Fusion Anomaly Detector] No new logs to analyze');
      return new Response(
        JSON.stringify({ success: true, message: 'No new logs to analyze', anomalies_detected: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Fusion Anomaly Detector] Analyzing ${recentLogs.length} audit logs`);

    const anomaliesDetected: Array<{ id: string; reason: string }> = [];

    const stabilityScores = recentLogs
      .filter((log) => log.stability_score !== null)
      .map((log) => log.stability_score as number);

    if (stabilityScores.length > 1) {
      const mean = stabilityScores.reduce((sum, score) => sum + score, 0) / stabilityScores.length;
      const variance = stabilityScores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / stabilityScores.length;
      const stdDev = Math.sqrt(variance);

      console.log(`[Fusion Anomaly Detector] Stability variance: ${variance.toFixed(4)}, StdDev: ${stdDev.toFixed(4)}`);

      if (variance > THRESHOLDS.STABILITY_VARIANCE) {
        console.log(`[Fusion Anomaly Detector] High stability variance detected: ${variance.toFixed(4)}`);
        
        for (const log of recentLogs) {
          if (log.stability_score !== null) {
            const deviation = Math.abs(log.stability_score - mean);
            if (deviation > stdDev * 2) {
              anomaliesDetected.push({
                id: log.id,
                reason: `High stability variance (${variance.toFixed(4)}, deviation: ${deviation.toFixed(2)})`,
              });
            }
          }
        }
      }
    }

    const reinforcementEvents = recentLogs.filter((log) => 
      log.event_type === 'reinforcement_calibration' || 
      log.event_type === 'cffe_sync' ||
      (log.reinforcement_delta !== null && log.reinforcement_delta !== 0)
    );

    if (reinforcementEvents.length > THRESHOLDS.REINFORCEMENT_RATE_PER_HOUR) {
      console.log(`[Fusion Anomaly Detector] Reinforcement spike detected: ${reinforcementEvents.length} events/hour`);
      
      for (const log of reinforcementEvents) {
        anomaliesDetected.push({
          id: log.id,
          reason: `Reinforcement spike (${reinforcementEvents.length} events/hour, threshold: ${THRESHOLDS.REINFORCEMENT_RATE_PER_HOUR})`,
        });
      }
    }

    for (const log of recentLogs) {
      if (log.event_payload && typeof log.event_payload === 'object') {
        const payload = log.event_payload as Record<string, any>;
        
        if (payload.instability_probability !== undefined && 
            payload.instability_probability > THRESHOLDS.INSTABILITY_PROBABILITY) {
          console.log(`[Fusion Anomaly Detector] Critical instability detected: ${payload.instability_probability}`);
          anomaliesDetected.push({
            id: log.id,
            reason: `Critical instability (probability: ${payload.instability_probability.toFixed(4)}, threshold: ${THRESHOLDS.INSTABILITY_PROBABILITY})`,
          });
        }

        if (payload.predicted_variance !== undefined && 
            payload.predicted_variance > THRESHOLDS.STABILITY_VARIANCE) {
          console.log(`[Fusion Anomaly Detector] High predicted variance: ${payload.predicted_variance}`);
          anomaliesDetected.push({
            id: log.id,
            reason: `High predicted variance (${payload.predicted_variance.toFixed(4)}, threshold: ${THRESHOLDS.STABILITY_VARIANCE})`,
          });
        }
      }
    }

    let updatedCount = 0;
    for (const anomaly of anomaliesDetected) {
      const { error: updateError } = await supabase
        .from('fusion_audit_log')
        .update({
          anomaly_flag: true,
          anomaly_reason: anomaly.reason,
        })
        .eq('id', anomaly.id);

      if (updateError) {
        console.error(`[Fusion Anomaly Detector] Failed to update log ${anomaly.id}:`, updateError);
      } else {
        updatedCount++;
      }
    }

    console.log(`[Fusion Anomaly Detector] Scan complete: ${updatedCount} anomalies flagged`);

    let alertsGenerated = 0;
    if (updatedCount > 0) {
      try {
        console.log('[Fusion Anomaly Detector] Triggering alert engine');
        const alertEngineUrl = `${supabaseUrl}/functions/v1/fusion-alert-engine`;
        const alertResponse = await fetch(alertEngineUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
        });

        if (alertResponse.ok) {
          const alertResult = await alertResponse.json();
          alertsGenerated = alertResult.alerts_generated || 0;
          console.log(`[Fusion Anomaly Detector] Alert engine generated ${alertsGenerated} alerts`);
        } else {
          console.error('[Fusion Anomaly Detector] Alert engine failed:', await alertResponse.text());
        }
      } catch (alertError) {
        console.error('[Fusion Anomaly Detector] Failed to trigger alert engine:', alertError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        logs_analyzed: recentLogs.length,
        anomalies_detected: updatedCount,
        alerts_generated: alertsGenerated,
        thresholds: THRESHOLDS,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Fusion Anomaly Detector] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}), { name: "fusion-anomaly-detector" }));