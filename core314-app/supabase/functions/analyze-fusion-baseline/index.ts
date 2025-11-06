/**
 * Core314 Fusion Optimization Model Training Baseline
 * ====================================================
 * Phase 26: Analyze telemetry data to establish baseline metrics
 * for the Core Fusion Feedback Engine (CFFE).
 * 
 * This function aggregates adaptive workflow metrics to calculate:
 * - Average confidence scores
 * - Average feedback scores
 * - Adjustment type distributions
 * - Stability indices
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

interface BaselineResponse {
  status: string;
  total_records: number;
  summary: BaselineMetrics[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const internalToken = req.headers.get('X-Internal-Token');
    const expectedToken = Deno.env.get('INTERNAL_WEBHOOK_TOKEN');

    if (!internalToken || internalToken !== expectedToken) {
      console.warn('[Fusion Baseline Analyzer] Unauthorized access attempt');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('[Fusion Baseline Analyzer] Starting baseline analysis...');

    const supabaseAdmin = createAdminClient();

    const { data: telemetryData, error: queryError } = await supabaseAdmin
      .from('adaptive_workflow_metrics')
      .select('workflow_id, event_type, confidence_score, feedback_score, adjustment_type, created_at')
      .order('created_at', { ascending: false })
      .limit(500);

    if (queryError) {
      console.error('[Fusion Baseline Analyzer] Query error:', queryError.message);
      return new Response(
        JSON.stringify({ error: 'Failed to query telemetry data', details: queryError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (!telemetryData || telemetryData.length === 0) {
      console.warn('[Fusion Baseline Analyzer] No telemetry data found');
      return new Response(
        JSON.stringify({
          status: 'success',
          total_records: 0,
          summary: [],
          message: 'No telemetry data available for analysis'
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`[Fusion Baseline Analyzer] Total records: ${telemetryData.length}`);

    const eventTypeGroups = new Map<string, any[]>();
    
    for (const record of telemetryData) {
      if (!eventTypeGroups.has(record.event_type)) {
        eventTypeGroups.set(record.event_type, []);
      }
      eventTypeGroups.get(record.event_type)!.push(record);
    }

    const summary: BaselineMetrics[] = [];

    for (const [eventType, records] of eventTypeGroups.entries()) {
      const validRecords = records.filter(r => 
        r.confidence_score !== null && 
        r.feedback_score !== null && 
        r.adjustment_type !== null
      );

      if (validRecords.length === 0) {
        continue;
      }

      const avgConfidence = validRecords.reduce((sum, r) => sum + r.confidence_score, 0) / validRecords.length;

      const avgFeedback = validRecords.reduce((sum, r) => sum + r.feedback_score, 0) / validRecords.length;

      const reinforceCount = validRecords.filter(r => r.adjustment_type === 'reinforce').length;
      const tuneCount = validRecords.filter(r => r.adjustment_type === 'tune').length;
      const resetCount = validRecords.filter(r => r.adjustment_type === 'reset').length;

      const reinforcementRatio = reinforceCount / validRecords.length;
      const tuneRatio = tuneCount / validRecords.length;
      const resetRatio = resetCount / validRecords.length;

      const stabilityIndex = (avgConfidence * 0.6) + (avgFeedback * 0.4);

      summary.push({
        event_type: eventType,
        avg_confidence: parseFloat(avgConfidence.toFixed(3)),
        avg_feedback: parseFloat(avgFeedback.toFixed(3)),
        reinforcement_ratio: parseFloat(reinforcementRatio.toFixed(3)),
        tune_ratio: parseFloat(tuneRatio.toFixed(3)),
        reset_ratio: parseFloat(resetRatio.toFixed(3)),
        stability_index: parseFloat(stabilityIndex.toFixed(3)),
        sample_count: validRecords.length
      });

      console.log(
        `[Fusion Baseline Analyzer] ${eventType}: ` +
        `Avg Confidence: ${avgConfidence.toFixed(3)} | ` +
        `Avg Feedback: ${avgFeedback.toFixed(3)} | ` +
        `Stability: ${stabilityIndex.toFixed(3)}`
      );
    }

    summary.sort((a, b) => b.stability_index - a.stability_index);

    const response: BaselineResponse = {
      status: 'success',
      total_records: telemetryData.length,
      summary
    };

    console.log(`[Fusion Baseline Analyzer] Analysis complete. Event types analyzed: ${summary.length}`);

    await logAuditEvent({
      event_type: 'baseline_analysis',
      event_source: 'analyze-fusion-baseline',
      event_payload: {
        total_records: telemetryData.length,
        event_types_analyzed: summary.length,
        summary: summary.map(s => ({
          event_type: s.event_type,
          stability_index: s.stability_index,
          sample_count: s.sample_count
        }))
      },
      stability_score: summary.length > 0 ? summary[0].stability_index * 100 : null,
    });

    return new Response(
      JSON.stringify(response, null, 2),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('[Fusion Baseline Analyzer] Unexpected error:', error.message);
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
