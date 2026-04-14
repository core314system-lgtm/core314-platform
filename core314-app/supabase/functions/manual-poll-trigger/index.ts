import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

/**
 * Manual Poll Trigger
 *
 * Triggers an on-demand poll for a specific integration service.
 * Used for:
 *   1. Manual admin-triggered polls (via API)
 *   2. Immediate poll-on-connect after OAuth callback
 *
 * Accepts:
 *   - service_name: 'jira' | 'slack' | 'hubspot' | 'quickbooks' (required)
 *   - triggered_by: string describing the trigger source (optional)
 *
 * Returns structured response with:
 *   - status: HTTP status of the poll call
 *   - records_processed: number of integrations processed
 *   - duration_ms: execution time
 *   - poll_response: raw response from the poller
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Map service names to their edge function poll endpoints
const SERVICE_POLL_MAP: Record<string, string> = {
  jira: 'jira-poll',
  slack: 'slack-poll',
  hubspot: 'hubspot-poll',
  quickbooks: 'quickbooks-poll',
  google_calendar: 'google-calendar-poll',
  gmail: 'gmail-poll',
  trello: 'trello-poll',
  microsoft_teams: 'teams-poll',
  google_sheets: 'sheets-poll',
  asana: 'asana-poll',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    let serviceName = '';
    let triggeredBy = 'manual';

    try {
      const body = await req.json();
      serviceName = (body.service_name || '').toLowerCase().trim();
      triggeredBy = body.triggered_by || 'manual';
    } catch {
      // No body or invalid JSON
    }

    if (!serviceName) {
      return new Response(JSON.stringify({
        error: 'Missing required parameter: service_name',
        valid_services: Object.keys(SERVICE_POLL_MAP),
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const pollFunction = SERVICE_POLL_MAP[serviceName];
    if (!pollFunction) {
      return new Response(JSON.stringify({
        error: `Unknown service: ${serviceName}`,
        valid_services: Object.keys(SERVICE_POLL_MAP),
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[manual-poll-trigger] Triggering ${serviceName} poll (triggered_by: ${triggeredBy})`);

    // Call the service-specific poller
    const pollUrl = `${supabaseUrl}/functions/v1/${pollFunction}`;
    const pollResponse = await fetch(pollUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ triggered_by: `manual-poll-trigger:${triggeredBy}` }),
    });

    const pollData = await pollResponse.json();
    const duration = Date.now() - startTime;

    // Structured logging: poll result
    console.log(`[manual-poll-trigger] ${serviceName} poll complete`, {
      service: serviceName,
      triggered_by: triggeredBy,
      http_status: pollResponse.status,
      ok: pollResponse.ok,
      processed: pollData.processed ?? 0,
      total: pollData.total ?? 0,
      errors: pollData.errors?.length ?? 0,
      duration_ms: duration,
    });

    // Log to integration_ingestion_state for audit trail
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    await supabase.from('integration_ingestion_state').upsert({
      user_id: '00000000-0000-0000-0000-000000000000',
      user_integration_id: '00000000-0000-0000-0000-000000000000',
      service_name: `manual_poll_${serviceName}`,
      last_polled_at: new Date().toISOString(),
      metadata: {
        triggered_by: triggeredBy,
        http_status: pollResponse.status,
        ok: pollResponse.ok,
        processed: pollData.processed ?? 0,
        total: pollData.total ?? 0,
        errors: pollData.errors ?? [],
        duration_ms: duration,
        timestamp: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,user_integration_id,service_name' });

    return new Response(JSON.stringify({
      success: pollResponse.ok,
      service: serviceName,
      triggered_by: triggeredBy,
      http_status: pollResponse.status,
      records_processed: pollData.processed ?? 0,
      records_total: pollData.total ?? 0,
      duration_ms: duration,
      poll_response: pollData,
    }), {
      status: pollResponse.ok ? 200 : 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const duration = Date.now() - startTime;
    console.error('[manual-poll-trigger] Fatal error:', error);
    return new Response(JSON.stringify({
      error: errorMessage,
      duration_ms: duration,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
