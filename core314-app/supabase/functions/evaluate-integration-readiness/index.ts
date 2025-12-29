/**
 * evaluate-integration-readiness
 * 
 * PURPOSE:
 * This function only evaluates readiness. Promotion is a separate step.
 * 
 * This is a READ-ONLY evaluation function that determines whether an integration
 * is READY to move from `connected` to `observing` state, but does NOT perform the move.
 * 
 * BEHAVIOR:
 * - Reads from: integration_events, telemetry_metrics (if present), integration_maturity
 * - Evaluates readiness per integration_key using:
 *   - event_count >= threshold (configurable constant)
 *   - time_span >= threshold (e.g. 7 days)
 *   - data_type coverage (messages OR meetings OR activity)
 * - Writes results to integration_readiness table
 * - Does NOT update integration_maturity
 * - Does NOT trigger any automation
 * 
 * SAFETY:
 * - Service-role only
 * - No RLS exposure to users
 * - Idempotent execution
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Configurable thresholds for readiness evaluation
const THRESHOLDS = {
  MIN_EVENT_COUNT: 10,           // Minimum number of events required
  MIN_TIME_SPAN_DAYS: 7,         // Minimum days of data required
  MIN_DATA_TYPES: 1,             // Minimum number of data types (messages, meetings, activity)
};

interface ReadinessResult {
  integration_key: string;
  eligible_for_observing: boolean;
  reason: string;
  evaluated_at: string;
}

interface EvaluationMetrics {
  event_count: number;
  first_event_at: string | null;
  last_event_at: string | null;
  time_span_days: number;
  data_types: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('[evaluate-readiness] Starting evaluation...');

    // Get all integrations currently in 'connected' state
    const { data: connectedIntegrations, error: maturityError } = await supabase
      .from('integration_maturity')
      .select('integration_key')
      .eq('maturity_state', 'connected');

    if (maturityError) {
      console.error('[evaluate-readiness] Error fetching maturity data:', maturityError);
      // If table is empty or doesn't exist yet, evaluate all known integrations
    }

    // Get unique integration keys from integration_events
    const { data: eventIntegrations, error: eventError } = await supabase
      .from('integration_events')
      .select('service_name')
      .limit(1000);

    if (eventError) {
      console.error('[evaluate-readiness] Error fetching event integrations:', eventError);
      return new Response(JSON.stringify({ error: 'Failed to fetch integration events' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get unique integration keys to evaluate
    const integrationKeys = new Set<string>();
    
    // Add integrations from maturity table
    if (connectedIntegrations) {
      connectedIntegrations.forEach((i: any) => integrationKeys.add(i.integration_key));
    }
    
    // Add integrations from events (in case they're not in maturity table yet)
    if (eventIntegrations) {
      eventIntegrations.forEach((e: any) => {
        if (e.service_name) {
          integrationKeys.add(e.service_name);
        }
      });
    }

    if (integrationKeys.size === 0) {
      console.log('[evaluate-readiness] No integrations to evaluate');
      return new Response(JSON.stringify({ 
        message: 'No integrations to evaluate', 
        evaluated: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results: ReadinessResult[] = [];
    const now = new Date();

    for (const integrationKey of integrationKeys) {
      try {
        const metrics = await evaluateIntegrationMetrics(supabase, integrationKey);
        const readiness = determineReadiness(integrationKey, metrics);
        
        results.push(readiness);

        // Write result to integration_readiness table (idempotent - insert new row each time)
        const { error: insertError } = await supabase
          .from('integration_readiness')
          .insert({
            integration_key: readiness.integration_key,
            eligible: readiness.eligible_for_observing,
            reason: readiness.reason,
            evaluated_at: readiness.evaluated_at,
          });

        if (insertError) {
          console.error('[evaluate-readiness] Error inserting readiness result:', insertError);
        } else {
          console.log('[evaluate-readiness] Recorded readiness for:', integrationKey, readiness.eligible_for_observing);
        }
      } catch (evalError: any) {
        console.error('[evaluate-readiness] Error evaluating integration:', integrationKey, evalError);
        results.push({
          integration_key: integrationKey,
          eligible_for_observing: false,
          reason: `Evaluation error: ${evalError.message}`,
          evaluated_at: now.toISOString(),
        });
      }
    }

    console.log('[evaluate-readiness] Evaluation complete. Results:', results.length);

    return new Response(JSON.stringify({
      success: true,
      evaluated: results.length,
      results: results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[evaluate-readiness] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function evaluateIntegrationMetrics(
  supabase: any, 
  integrationKey: string
): Promise<EvaluationMetrics> {
  // Get event statistics for this integration
  const { data: events, error: eventsError } = await supabase
    .from('integration_events')
    .select('event_type, created_at')
    .eq('service_name', integrationKey)
    .order('created_at', { ascending: true });

  if (eventsError) {
    console.error('[evaluate-readiness] Error fetching events for:', integrationKey, eventsError);
    throw eventsError;
  }

  const eventCount = events?.length || 0;
  const firstEventAt = events?.[0]?.created_at || null;
  const lastEventAt = events?.[events.length - 1]?.created_at || null;

  // Calculate time span in days
  let timeSpanDays = 0;
  if (firstEventAt && lastEventAt) {
    const firstDate = new Date(firstEventAt);
    const lastDate = new Date(lastEventAt);
    timeSpanDays = Math.floor((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
  }

  // Determine data types present
  const dataTypes = new Set<string>();
  if (events) {
    for (const event of events) {
      const eventType = event.event_type?.toLowerCase() || '';
      if (eventType.includes('message') || eventType.includes('chat')) {
        dataTypes.add('messages');
      }
      if (eventType.includes('meeting') || eventType.includes('call')) {
        dataTypes.add('meetings');
      }
      if (eventType.includes('activity') || eventType.includes('reaction') || eventType.includes('channel')) {
        dataTypes.add('activity');
      }
    }
  }

  // Also check telemetry_metrics if available
  try {
    const { data: telemetry } = await supabase
      .from('telemetry_metrics')
      .select('metric_name')
      .ilike('source_app', `%${integrationKey}%`)
      .limit(100);

    if (telemetry && telemetry.length > 0) {
      dataTypes.add('telemetry');
    }
  } catch (telemetryError) {
    // Telemetry table may not exist or have data - this is optional
    console.log('[evaluate-readiness] Telemetry check skipped for:', integrationKey);
  }

  return {
    event_count: eventCount,
    first_event_at: firstEventAt,
    last_event_at: lastEventAt,
    time_span_days: timeSpanDays,
    data_types: Array.from(dataTypes),
  };
}

function determineReadiness(
  integrationKey: string, 
  metrics: EvaluationMetrics
): ReadinessResult {
  const now = new Date().toISOString();
  const reasons: string[] = [];
  let eligible = true;

  // Check event count threshold
  if (metrics.event_count < THRESHOLDS.MIN_EVENT_COUNT) {
    eligible = false;
    reasons.push(`Event count (${metrics.event_count}) below threshold (${THRESHOLDS.MIN_EVENT_COUNT})`);
  }

  // Check time span threshold
  if (metrics.time_span_days < THRESHOLDS.MIN_TIME_SPAN_DAYS) {
    eligible = false;
    reasons.push(`Time span (${metrics.time_span_days} days) below threshold (${THRESHOLDS.MIN_TIME_SPAN_DAYS} days)`);
  }

  // Check data type coverage
  if (metrics.data_types.length < THRESHOLDS.MIN_DATA_TYPES) {
    eligible = false;
    reasons.push(`Data types (${metrics.data_types.length}) below threshold (${THRESHOLDS.MIN_DATA_TYPES})`);
  }

  // Build reason string
  let reason: string;
  if (eligible) {
    reason = `Eligible: ${metrics.event_count} events over ${metrics.time_span_days} days with data types: ${metrics.data_types.join(', ')}`;
  } else {
    reason = reasons.join('; ');
  }

  return {
    integration_key: integrationKey,
    eligible_for_observing: eligible,
    reason: reason,
    evaluated_at: now,
  };
}
