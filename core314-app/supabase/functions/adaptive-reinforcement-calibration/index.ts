/**
 * Core314 Adaptive Reinforcement Calibration
 * ============================================
 * Phase 27: Baseline validation loop that compares real-time CFFE outputs
 * to the Fusion Optimization Baseline metrics from Phase 26.
 * 
 * This function:
 * - Fetches baseline metrics from analyze-fusion-baseline
 * - Computes current stability indices from recent CFFE output
 * - Calculates variance between current and baseline metrics
 * - Provides calibration recommendations for CFFE tuning
 * 
 * Read-only analytics function - does not modify CFFE private logic.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { createAdminClient } from '../_shared/integration-utils.ts';
import { logAuditEvent } from '../_shared/audit-logger.ts';

interface BaselineMetrics {
  event_type: string;
  avg_confidence: number;
  avg_feedback: number;
  reinforcement_ratio: number;
  tune_ratio: number;
  reset_ratio: number;
  stability_index: number;
  sample_count: number;
}

interface CalibrationResult {
  event_type: string;
  baseline_stability: number;
  current_stability: number;
  variance: number;
  recommendation: string;
  sample_count: number;
}

interface CalibrationResponse {
  status: string;
  calibrations: CalibrationResult[];
  timestamp: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const internalToken = req.headers.get('X-Internal-Token');
    const expectedToken = Deno.env.get('INTERNAL_WEBHOOK_TOKEN');

    if (!internalToken || internalToken !== expectedToken) {
      console.warn('[ARC] Unauthorized access attempt');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('[ARC] Starting adaptive reinforcement calibration...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const baselineUrl = `${supabaseUrl}/functions/v1/analyze-fusion-baseline`;
    
    const authHeader = req.headers.get('Authorization');
    
    console.log('[ARC] Fetching baseline metrics...');
    
    const baselineResponse = await fetch(baselineUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader || '',
        'X-Internal-Token': expectedToken!,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });

    if (!baselineResponse.ok) {
      console.error('[ARC] Failed to fetch baseline metrics:', baselineResponse.status);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to fetch baseline metrics',
          status: baselineResponse.status 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const baselineData = await baselineResponse.json();
    
    if (baselineData.status !== 'success' || !baselineData.summary || baselineData.summary.length === 0) {
      console.warn('[ARC] No baseline data available');
      return new Response(
        JSON.stringify({
          status: 'success',
          calibrations: [],
          timestamp: new Date().toISOString(),
          message: 'No baseline data available for calibration'
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const baselineMetrics: BaselineMetrics[] = baselineData.summary;
    console.log(`[ARC] Baseline metrics retrieved: ${baselineMetrics.length} event types`);

    const supabaseAdmin = createAdminClient();
    
    const { data: recentData, error: queryError } = await supabaseAdmin
      .from('adaptive_workflow_metrics')
      .select('workflow_id, event_type, confidence_score, feedback_score, adjustment_type, created_at')
      .order('created_at', { ascending: false })
      .limit(100);

    if (queryError) {
      console.error('[ARC] Query error:', queryError.message);
      return new Response(
        JSON.stringify({ error: 'Failed to query recent data', details: queryError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (!recentData || recentData.length === 0) {
      console.warn('[ARC] No recent data found');
      return new Response(
        JSON.stringify({
          status: 'success',
          calibrations: [],
          timestamp: new Date().toISOString(),
          message: 'No recent data available for calibration'
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`[ARC] Recent data retrieved: ${recentData.length} records`);

    const eventTypeGroups = new Map<string, any[]>();
    
    for (const record of recentData) {
      if (!eventTypeGroups.has(record.event_type)) {
        eventTypeGroups.set(record.event_type, []);
      }
      eventTypeGroups.get(record.event_type)!.push(record);
    }

    const calibrations: CalibrationResult[] = [];

    for (const baseline of baselineMetrics) {
      const currentRecords = eventTypeGroups.get(baseline.event_type);
      
      if (!currentRecords || currentRecords.length === 0) {
        console.log(`[ARC] No current data for event type: ${baseline.event_type}`);
        continue;
      }

      const validRecords = currentRecords.filter(r => 
        r.confidence_score !== null && 
        r.feedback_score !== null
      );

      if (validRecords.length === 0) {
        continue;
      }

      const currentAvgConfidence = validRecords.reduce((sum, r) => sum + r.confidence_score, 0) / validRecords.length;
      const currentAvgFeedback = validRecords.reduce((sum, r) => sum + r.feedback_score, 0) / validRecords.length;

      const currentStability = (currentAvgConfidence * 0.6) + (currentAvgFeedback * 0.4);

      const variance = currentStability - baseline.stability_index;

      let recommendation: string;
      if (variance >= 0.05) {
        recommendation = 'reinforce';
      } else if (variance <= -0.05) {
        recommendation = 'reset';
      } else {
        recommendation = 'tune';
      }

      calibrations.push({
        event_type: baseline.event_type,
        baseline_stability: parseFloat(baseline.stability_index.toFixed(3)),
        current_stability: parseFloat(currentStability.toFixed(3)),
        variance: parseFloat(variance.toFixed(3)),
        recommendation,
        sample_count: validRecords.length
      });

      console.log(
        `[ARC] ${baseline.event_type}: ` +
        `Baseline stability: ${baseline.stability_index.toFixed(3)} | ` +
        `Current stability: ${currentStability.toFixed(3)} ` +
        `(Δ ${variance.toFixed(3)}) → Recommendation: ${recommendation}`
      );
    }

    calibrations.sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance));

    const response: CalibrationResponse = {
      status: 'success',
      calibrations,
      timestamp: new Date().toISOString()
    };

    console.log(`[ARC] Calibration complete. Event types analyzed: ${calibrations.length}`);

    const avgVariance = calibrations.length > 0 
      ? calibrations.reduce((sum, c) => sum + Math.abs(c.variance), 0) / calibrations.length 
      : 0;
    const avgStability = calibrations.length > 0
      ? calibrations.reduce((sum, c) => sum + c.current_stability, 0) / calibrations.length
      : 0;

    await logAuditEvent({
      event_type: 'reinforcement_calibration',
      event_source: 'adaptive-reinforcement-calibration',
      event_payload: {
        calibrations_count: calibrations.length,
        avg_variance: parseFloat(avgVariance.toFixed(4)),
        recommendations: calibrations.map(c => ({
          event_type: c.event_type,
          variance: c.variance,
          recommendation: c.recommendation
        }))
      },
      stability_score: avgStability * 100,
      reinforcement_delta: avgVariance,
    });

    return new Response(
      JSON.stringify(response, null, 2),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('[ARC] Unexpected error:', error.message);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
