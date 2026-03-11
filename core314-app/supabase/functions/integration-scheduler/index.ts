import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

/**
 * Integration Scheduler (Orchestrator)
 * 
 * Central scheduler that orchestrates all integration operations:
 * 1. Health check — validate OAuth tokens for all connected integrations
 * 2. Token refresh — refresh expiring tokens before they expire
 * 3. Polling — call each service-specific poll function to collect data
 * 
 * Designed to be invoked by pg_cron every 15 minutes.
 * Each poll function handles its own rate limiting via integration_ingestion_state.
 * 
 * Flow:
 *   pg_cron (every 15 min) → integration-scheduler → health-check + pollers
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface StepResult {
  step: string;
  success: boolean;
  message: string;
  duration_ms: number;
  details?: Record<string, unknown>;
}

/**
 * Call a Supabase Edge Function by name using the service role key.
 * Returns the parsed JSON response or an error object.
 */
async function callEdgeFunction(
  supabaseUrl: string,
  serviceRoleKey: string,
  functionName: string
): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const url = `${supabaseUrl}/functions/v1/${functionName}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ triggered_by: 'integration-scheduler' }),
    });

    const data = await response.json();
    return { ok: response.ok, data };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { ok: false, data: { error: errorMessage } };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const results: StepResult[] = [];
    const now = new Date();

    console.log(`[scheduler] Starting integration scheduler run at ${now.toISOString()}`);

    // Step 1: Run health check (validates tokens, refreshes expiring ones)
    const healthStart = Date.now();
    console.log('[scheduler] Step 1: Running health check...');
    const healthResult = await callEdgeFunction(supabaseUrl, serviceRoleKey, 'integration-health-check');
    results.push({
      step: 'health-check',
      success: healthResult.ok,
      message: healthResult.ok
        ? `Checked ${(healthResult.data.summary as Record<string, number>)?.total || 0} integrations`
        : `Health check failed: ${healthResult.data.error || 'unknown error'}`,
      duration_ms: Date.now() - healthStart,
      details: healthResult.data.summary as Record<string, unknown> || undefined,
    });

    // Step 2: Run each service-specific poller
    const pollers = [
      { name: 'slack-poll', service: 'Slack' },
      { name: 'hubspot-poll', service: 'HubSpot' },
      { name: 'quickbooks-poll', service: 'QuickBooks' },
    ];

    for (const poller of pollers) {
      const pollStart = Date.now();
      console.log(`[scheduler] Step 2: Running ${poller.service} poll...`);
      const pollResult = await callEdgeFunction(supabaseUrl, serviceRoleKey, poller.name);
      results.push({
        step: poller.name,
        success: pollResult.ok,
        message: pollResult.ok
          ? `Processed ${pollResult.data.processed || 0} of ${pollResult.data.total || 0} integrations`
          : `Poll failed: ${pollResult.data.error || pollResult.data.message || 'unknown error'}`,
        duration_ms: Date.now() - pollStart,
        details: pollResult.ok ? {
          processed: pollResult.data.processed,
          total: pollResult.data.total,
          errors: pollResult.data.errors,
        } : undefined,
      });
    }

    // Step 3: Log scheduler run to a tracking table (for UI to query)
    const totalDuration = Date.now() - startTime;
    const allSuccess = results.every(r => r.success);
    const failedSteps = results.filter(r => !r.success).map(r => r.step);

    // Update a scheduler_runs record in integration_ingestion_state (reuse as meta tracker)
    // We use a special service_name 'scheduler' to track the last run
    await supabase.from('integration_ingestion_state').upsert({
      user_id: '00000000-0000-0000-0000-000000000000', // System user
      user_integration_id: '00000000-0000-0000-0000-000000000000', // System
      service_name: 'scheduler',
      last_polled_at: now.toISOString(),
      last_event_timestamp: now.toISOString(),
      next_poll_after: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
      metadata: {
        run_timestamp: now.toISOString(),
        duration_ms: totalDuration,
        all_success: allSuccess,
        failed_steps: failedSteps,
        results,
      },
      updated_at: now.toISOString(),
    }, { onConflict: 'user_id,user_integration_id,service_name' });

    console.log(`[scheduler] Complete in ${totalDuration}ms: ${allSuccess ? 'ALL SUCCESS' : `FAILURES: ${failedSteps.join(', ')}`}`);

    return new Response(JSON.stringify({
      success: allSuccess,
      timestamp: now.toISOString(),
      duration_ms: totalDuration,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[scheduler] Fatal error:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
