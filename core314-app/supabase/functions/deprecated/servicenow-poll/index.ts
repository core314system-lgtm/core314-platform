import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ServiceNowMetrics {
  incidentCount: number;
  newIncidents: number;
  inProgressIncidents: number;
  resolvedIncidents: number;
  closedIncidents: number;
  lastActivityTimestamp: string | null;
}

async function fetchServiceNowMetrics(instance: string, username: string, password: string): Promise<ServiceNowMetrics> {
  const metrics: ServiceNowMetrics = {
    incidentCount: 0,
    newIncidents: 0,
    inProgressIncidents: 0,
    resolvedIncidents: 0,
    closedIncidents: 0,
    lastActivityTimestamp: null,
  };

  try {
    const auth = btoa(`${username}:${password}`);
    const incidentsUrl = `https://${instance}.service-now.com/api/now/table/incident?sysparm_limit=100&sysparm_fields=sys_id,state,sys_updated_on`;

    const response = await fetch(incidentsUrl, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      const incidents = data.result || [];
      
      metrics.incidentCount = incidents.length;
      
      for (const incident of incidents) {
        // ServiceNow states: 1=New, 2=In Progress, 3=On Hold, 6=Resolved, 7=Closed
        const state = parseInt(incident.state, 10);
        if (state === 1) {
          metrics.newIncidents++;
        } else if (state === 2 || state === 3) {
          metrics.inProgressIncidents++;
        } else if (state === 6) {
          metrics.resolvedIncidents++;
        } else if (state === 7) {
          metrics.closedIncidents++;
        }
      }
      
      if (incidents.length > 0 && incidents[0].sys_updated_on) {
        metrics.lastActivityTimestamp = incidents[0].sys_updated_on;
      }
    } else {
      console.log('[servicenow-poll] Failed to fetch incidents:', response.status, await response.text());
    }
  } catch (error) {
    console.error('[servicenow-poll] Error fetching ServiceNow metrics:', error);
  }

  return metrics;
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

    const { data: integrations, error: intError } = await supabase
      .from('user_integrations')
      .select(`
        id,
        user_id,
        config,
        provider_id,
        integration_registry!inner (
          service_name
        )
      `)
      .eq('integration_registry.service_name', 'servicenow')
      .eq('status', 'active');

    if (intError) {
      console.error('[servicenow-poll] Error fetching integrations:', intError);
      return new Response(JSON.stringify({ error: 'Failed to fetch integrations' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!integrations || integrations.length === 0) {
      return new Response(JSON.stringify({ message: 'No ServiceNow integrations found', processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let processedCount = 0;
    const errors: string[] = [];

    for (const integration of integrations) {
      try {
        const { data: state } = await supabase
          .from('integration_ingestion_state')
          .select('*')
          .eq('user_id', integration.user_id)
          .eq('user_integration_id', integration.id)
          .eq('service_name', 'servicenow')
          .single();

        const now = new Date();
        if (state?.next_poll_after && new Date(state.next_poll_after) > now) {
          console.log('[servicenow-poll] Skipping user (rate limited):', integration.user_id);
          continue;
        }

        const config = integration.config as { instance?: string; username?: string; password?: string } | null;
        if (!config?.instance || !config?.username || !config?.password) {
          console.error('[servicenow-poll] Missing credentials for user:', integration.user_id);
          errors.push(`Missing credentials for user ${integration.user_id}`);
          continue;
        }

        const metrics = await fetchServiceNowMetrics(config.instance, config.username, config.password);
        const eventTime = metrics.lastActivityTimestamp || now.toISOString();

        if (metrics.incidentCount > 0) {
          await supabase.from('integration_events').insert({
            user_id: integration.user_id,
            user_integration_id: integration.id,
            integration_registry_id: integration.provider_id,
            service_name: 'servicenow',
            event_type: 'servicenow.incident_activity',
            occurred_at: eventTime,
            source: 'servicenow_api_poll',
            metadata: {
              incident_count: metrics.incidentCount,
              new_incidents: metrics.newIncidents,
              in_progress_incidents: metrics.inProgressIncidents,
              resolved_incidents: metrics.resolvedIncidents,
              closed_incidents: metrics.closedIncidents,
              poll_timestamp: now.toISOString(),
            },
          });
        }

        await supabase.from('integration_ingestion_state').upsert({
          user_id: integration.user_id,
          user_integration_id: integration.id,
          service_name: 'servicenow',
          last_polled_at: now.toISOString(),
          last_event_timestamp: eventTime,
          next_poll_after: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
          metadata: { last_metrics: metrics },
          updated_at: now.toISOString(),
        }, { onConflict: 'user_id,user_integration_id,service_name' });

        processedCount++;
        console.log('[servicenow-poll] Processed user:', integration.user_id, metrics);
      } catch (userError: unknown) {
        const errorMessage = userError instanceof Error ? userError.message : String(userError);
        console.error('[servicenow-poll] Error processing user:', integration.user_id, userError);
        errors.push(`Error for user ${integration.user_id}: ${errorMessage}`);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      processed: processedCount,
      total: integrations.length,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[servicenow-poll] Error:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
