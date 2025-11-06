
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface BehavioralEvent {
  user_id?: string;
  event_type: string;
  event_source: string;
  event_context?: Record<string, any>;
  outcome_reference?: string;
  behavior_score?: number;
}

/**
 * Validate incoming behavioral event data
 */
function validateEvent(event: any): { valid: boolean; error?: string } {
  if (!event.event_type || typeof event.event_type !== 'string') {
    return { valid: false, error: 'event_type is required and must be a string' };
  }

  if (!event.event_source || typeof event.event_source !== 'string') {
    return { valid: false, error: 'event_source is required and must be a string' };
  }

  if (event.user_id && typeof event.user_id !== 'string') {
    return { valid: false, error: 'user_id must be a string (UUID)' };
  }

  if (event.outcome_reference && typeof event.outcome_reference !== 'string') {
    return { valid: false, error: 'outcome_reference must be a string (UUID)' };
  }

  if (event.behavior_score !== undefined && typeof event.behavior_score !== 'number') {
    return { valid: false, error: 'behavior_score must be a number' };
  }

  if (event.behavior_score !== undefined && (event.behavior_score < 0 || event.behavior_score > 100)) {
    return { valid: false, error: 'behavior_score must be between 0 and 100' };
  }

  return { valid: true };
}

/**
 * Calculate initial behavior score based on event type and context
 */
function calculateInitialBehaviorScore(event: BehavioralEvent): number {
  const eventTypeScores: Record<string, number> = {
    'workflow_trigger': 50,
    'parameter_adjustment': 60,
    'alert_response': 70,
    'optimization_applied': 80,
    'manual_override': 40,
    'system_automation': 65,
    'user_feedback': 75,
  };

  let baseScore = eventTypeScores[event.event_type] || 50;

  if (event.event_context) {
    if (event.event_context.success === true) baseScore += 10;
    if (event.event_context.efficiency_improvement) baseScore += 15;
    if (event.event_context.stability_maintained === true) baseScore += 10;

    if (event.event_context.error === true) baseScore -= 20;
    if (event.event_context.rollback_required === true) baseScore -= 15;
    if (event.event_context.stability_degraded === true) baseScore -= 25;
  }

  return Math.max(0, Math.min(100, baseScore));
}

/**
 * Main handler for behavioral event listener
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ status: 'error', message: 'Method not allowed' }),
      {
        status: 405,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }

  try {
    console.log('[BAIL] Behavioral Event Listener invoked');

    const body = await req.json();
    const events: BehavioralEvent[] = Array.isArray(body) ? body : [body];

    console.log(`[BAIL] Processing ${events.length} behavioral event(s)`);

    const results = [];
    const errors = [];

    for (const event of events) {
      const validation = validateEvent(event);
      if (!validation.valid) {
        console.error(`[BAIL] Validation error: ${validation.error}`, event);
        errors.push({
          event,
          error: validation.error,
        });
        continue;
      }

      const behavior_score = event.behavior_score !== undefined
        ? event.behavior_score
        : calculateInitialBehaviorScore(event);

      const { data: insertedEvent, error: insertError } = await supabase
        .from('fusion_behavioral_metrics')
        .insert({
          user_id: event.user_id || null,
          event_type: event.event_type,
          event_source: event.event_source,
          event_context: event.event_context || {},
          outcome_reference: event.outcome_reference || null,
          behavior_score,
        })
        .select()
        .single();

      if (insertError) {
        console.error('[BAIL] Error inserting behavioral metric:', insertError);
        errors.push({
          event,
          error: insertError.message,
        });
        continue;
      }

      console.log(`[BAIL] Behavioral event captured: ${insertedEvent.id}`, {
        event_type: event.event_type,
        event_source: event.event_source,
        behavior_score,
      });

      results.push({
        id: insertedEvent.id,
        event_type: event.event_type,
        behavior_score,
      });
    }

    const response = {
      status: 'success',
      message: `Processed ${results.length} event(s)`,
      results,
      errors: errors.length > 0 ? errors : undefined,
    };

    return new Response(JSON.stringify(response), {
      status: errors.length > 0 && results.length === 0 ? 400 : 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error('[BAIL] Error:', error);
    return new Response(
      JSON.stringify({
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
});
