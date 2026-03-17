import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { sendIntegrationFailureEmail } from '../_shared/integration-notifications.ts';

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
 *   pg_cron (every 15 min) → integration-scheduler → health-check + pollers → signal-detector → signal-correlator
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

    // Step 2: Run each service-specific poller (all 10 integrations)
    const pollers = [
      { name: 'slack-poll', service: 'Slack' },
      { name: 'hubspot-poll', service: 'HubSpot' },
      { name: 'quickbooks-poll', service: 'QuickBooks' },
      { name: 'google-calendar-poll', service: 'Google Calendar' },
      { name: 'gmail-poll', service: 'Gmail' },
      { name: 'jira-poll', service: 'Jira' },
      { name: 'trello-poll', service: 'Trello' },
      { name: 'teams-poll', service: 'Microsoft Teams' },
      { name: 'sheets-poll', service: 'Google Sheets' },
      { name: 'asana-poll', service: 'Asana' },
    ];

    // Track consecutive failures per poller for alerting
    const { data: failureState } = await supabase
      .from('integration_ingestion_state')
      .select('metadata')
      .eq('user_id', '00000000-0000-0000-0000-000000000000')
      .eq('user_integration_id', '00000000-0000-0000-0000-000000000000')
      .eq('service_name', 'scheduler_failures')
      .single();

    const failureCounts: Record<string, number> = (failureState?.metadata as Record<string, number>) || {};

    for (const poller of pollers) {
      const pollStart = Date.now();
      console.log(`[scheduler] Step 2: Running ${poller.service} poll...`);

      // Retry once on failure with exponential backoff
      let pollResult = await callEdgeFunction(supabaseUrl, serviceRoleKey, poller.name);
      if (!pollResult.ok) {
        console.log(`[scheduler] ${poller.service} failed, retrying after 2s...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        pollResult = await callEdgeFunction(supabaseUrl, serviceRoleKey, poller.name);
      }

      if (pollResult.ok) {
        failureCounts[poller.name] = 0; // Reset on success
      } else {
        failureCounts[poller.name] = (failureCounts[poller.name] || 0) + 1;
        const consecutiveFailures = failureCounts[poller.name];
        console.error(`[scheduler] ${poller.service} consecutive failure #${consecutiveFailures}`);

        // Send email alert on 3rd consecutive failure (and every 3rd after)
        if (consecutiveFailures >= 3 && consecutiveFailures % 3 === 0) {
          // Find users with this integration connected to alert them
          const serviceName = poller.name.replace('-poll', '').replace(/-/g, '_');
          const { data: affectedTokens } = await supabase
            .from('oauth_tokens')
            .select('user_id, integration_registry!inner(service_name)')
            .eq('integration_registry.service_name', serviceName)
            .limit(10);

          if (affectedTokens && affectedTokens.length > 0) {
            for (const token of affectedTokens) {
              const { data: { user: affectedUser } } = await supabase.auth.admin.getUserById(token.user_id);
              if (affectedUser?.email) {
                sendIntegrationFailureEmail(
                  serviceName,
                  consecutiveFailures,
                  String(pollResult.data.error || pollResult.data.message || 'Polling failed'),
                  { recipientEmail: affectedUser.email, recipientName: affectedUser.user_metadata?.full_name as string }
                ).catch(err => console.error(`[scheduler] Failure email error:`, err));
              }
            }
          }
        }
      }

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
        } : { consecutive_failures: failureCounts[poller.name] },
      });
    }

    // Persist failure counts for next run
    await supabase.from('integration_ingestion_state').upsert({
      user_id: '00000000-0000-0000-0000-000000000000',
      user_integration_id: '00000000-0000-0000-0000-000000000000',
      service_name: 'scheduler_failures',
      last_polled_at: now.toISOString(),
      next_poll_after: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
      metadata: failureCounts,
      updated_at: now.toISOString(),
    }, { onConflict: 'user_id,user_integration_id,service_name' });

    // Step 3: Run signal detector (analyzes integration_events → creates operational_signals)
    const signalStart = Date.now();
    console.log('[scheduler] Step 3: Running signal detector...');
    const signalResult = await callEdgeFunction(supabaseUrl, serviceRoleKey, 'signal-detector');
    results.push({
      step: 'signal-detector',
      success: signalResult.ok,
      message: signalResult.ok
        ? `Created ${signalResult.data.signals_created || 0} signals, deactivated ${signalResult.data.signals_deactivated || 0}`
        : `Signal detection failed: ${signalResult.data.error || 'unknown error'}`,
      duration_ms: Date.now() - signalStart,
      details: signalResult.ok ? {
        users_processed: signalResult.data.users_processed,
        signals_created: signalResult.data.signals_created,
        signals_deactivated: signalResult.data.signals_deactivated,
      } : undefined,
    });

    // Step 4: Run signal correlator (groups signals from multiple integrations into correlated events)
    const correlatorStart = Date.now();
    console.log('[scheduler] Step 4: Running signal correlator...');
    const correlatorResult = await callEdgeFunction(supabaseUrl, serviceRoleKey, 'signal-correlator');
    results.push({
      step: 'signal-correlator',
      success: correlatorResult.ok,
      message: correlatorResult.ok
        ? `Analyzed ${correlatorResult.data.signals_analyzed || 0} signals, found ${correlatorResult.data.correlated_events || 0} correlated events`
        : `Signal correlation failed: ${correlatorResult.data.error || 'unknown error'}`,
      duration_ms: Date.now() - correlatorStart,
      details: correlatorResult.ok ? {
        signals_analyzed: correlatorResult.data.signals_analyzed,
        correlated_events: correlatorResult.data.correlated_events,
      } : undefined,
    });

    // Step 5: Log scheduler run to a tracking table (for UI to query)
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
