import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { createAdminClient } from '../_shared/integration-utils.ts';
import { logAuditEvent } from '../_shared/audit-logger.ts';
import { withSentry, breadcrumb, handleSentryTest } from "../_shared/sentry.ts";

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

interface RiskEvent {
  event_type: string;
  predicted_variance: number;
  predicted_stability: number;
  risk_category: string;
  action_taken: string;
}

interface FREResponse {
  status: string;
  events_processed: number;
  timestamp: string;
}

function determineAction(riskCategory: string): string {
  switch (riskCategory) {
    case 'High Risk':
      return 'reset';
    case 'Moderate Risk':
      return 'reinforce';
    case 'Stable':
      return 'maintain';
    default:
      return 'maintain';
  }
}

async function applyRiskAction(
  eventType: string,
  action: string,
  supabaseUrl: string,
  internalToken: string,
  authHeader: string
): Promise<boolean> {
  if (action === 'maintain') {
    console.log(`[FRE] ${eventType}: risk=Stable → Action: maintain (no sync needed)`);
    return true;
  }

  try {
    const syncUrl = `${supabaseUrl}/functions/v1/cffe-reinforcement-sync`;
    
    const payload = {
      event_type: eventType,
      recommendation: action
    };

    const response = await fetch(syncUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'X-Internal-Token': internalToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[FRE] Failed to apply action for ${eventType}:`, errorText);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`[FRE] Error applying action for ${eventType}:`, error);
    return false;
  }
}

serve(withSentry(async (req) => {
  const testResponse = await handleSentryTest(req);
  if (testResponse) return testResponse;

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const internalToken = req.headers.get('X-Internal-Token');
    const expectedToken = Deno.env.get('INTERNAL_WEBHOOK_TOKEN');

    if (!internalToken || internalToken !== expectedToken) {
      console.warn('[FRE] Unauthorized access attempt');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('[FRE] Starting Fusion Risk Engine...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const forecastUrl = `${supabaseUrl}/functions/v1/predictive-stability-forecast`;
    
    const authHeader = req.headers.get('Authorization') || '';

    console.log('[FRE] Fetching predictive stability forecasts...');

    const forecastResponse = await fetch(forecastUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'X-Internal-Token': expectedToken!,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });

    if (!forecastResponse.ok) {
      const errorText = await forecastResponse.text();
      console.error('[FRE] Failed to fetch forecasts:', errorText);
      return new Response(
        JSON.stringify({
          error: 'Failed to fetch forecasts',
          details: errorText
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const forecastData: ForecastResponse = await forecastResponse.json();

    if (!forecastData.forecasts || forecastData.forecasts.length === 0) {
      console.log('[FRE] No forecasts available. Exiting gracefully.');
      return new Response(
        JSON.stringify({
          status: 'success',
          events_processed: 0,
          timestamp: new Date().toISOString(),
          message: 'No forecasts available for processing'
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`[FRE] Retrieved ${forecastData.forecasts.length} forecast(s)`);

    const supabaseAdmin = createAdminClient();
    const riskEvents: RiskEvent[] = [];
    let eventsProcessed = 0;

    for (const forecast of forecastData.forecasts) {
      const { event_type, predicted_variance, predicted_stability_index, instability_probability, risk_category } = forecast;
      
      const action = determineAction(risk_category);

      console.log(
        `[FRE] ${event_type}: risk=${risk_category} (instability=${instability_probability.toFixed(3)}) → Action: ${action}`
      );

      const actionSuccess = await applyRiskAction(
        event_type,
        action,
        supabaseUrl!,
        expectedToken!,
        authHeader
      );

      if (actionSuccess) {
        riskEvents.push({
          event_type,
          predicted_variance,
          predicted_stability: predicted_stability_index,
          risk_category,
          action_taken: action
        });
        eventsProcessed++;
      }
    }

    if (riskEvents.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from('fusion_risk_events')
        .insert(riskEvents);

      if (insertError) {
        console.error('[FRE] Failed to log risk events:', insertError);
      } else {
        console.log(`[FRE] Logged ${riskEvents.length} risk event(s) to database`);
      }
    }

    console.log(`[FRE] Fusion Risk Engine completed successfully. ${eventsProcessed} event(s) processed.`);

    const response: FREResponse = {
      status: 'success',
      events_processed: eventsProcessed,
      timestamp: new Date().toISOString()
    };

    const avgInstability = riskEvents.length > 0
      ? riskEvents.reduce((sum, e) => sum + (1 - e.predicted_stability), 0) / riskEvents.length
      : 0;
    const avgStability = riskEvents.length > 0
      ? riskEvents.reduce((sum, e) => sum + e.predicted_stability, 0) / riskEvents.length
      : 0;

    await logAuditEvent({
      event_type: 'risk_response',
      event_source: 'fusion-risk-engine',
      event_payload: {
        events_processed: eventsProcessed,
        actions_distribution: {
          maintain: riskEvents.filter(e => e.action_taken === 'maintain').length,
          reinforce: riskEvents.filter(e => e.action_taken === 'reinforce').length,
          reset: riskEvents.filter(e => e.action_taken === 'reset').length,
        },
        risk_distribution: {
          stable: riskEvents.filter(e => e.risk_category === 'Stable').length,
          moderate: riskEvents.filter(e => e.risk_category === 'Moderate Risk').length,
          high: riskEvents.filter(e => e.risk_category === 'High Risk').length,
        }
      },
      stability_score: avgStability * 100,
    });

    return new Response(
      JSON.stringify(response, null, 2),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('[FRE] Unexpected error:', error);
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
}), { name: "fusion-risk-engine" }));