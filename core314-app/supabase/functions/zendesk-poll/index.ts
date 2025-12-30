import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ZendeskMetrics {
  ticketCount: number;
  openTickets: number;
  pendingTickets: number;
  solvedTickets: number;
  lastActivityTimestamp: string | null;
}

async function fetchZendeskMetrics(apiKey: string, subdomain: string, email: string): Promise<ZendeskMetrics> {
  const metrics: ZendeskMetrics = {
    ticketCount: 0,
    openTickets: 0,
    pendingTickets: 0,
    solvedTickets: 0,
    lastActivityTimestamp: null,
  };

  try {
    const auth = btoa(`${email}/token:${apiKey}`);
    const ticketsUrl = `https://${subdomain}.zendesk.com/api/v2/tickets.json?per_page=100`;
    
    const ticketsResponse = await fetch(ticketsUrl, {
      headers: { 'Authorization': `Basic ${auth}` },
    });

    if (ticketsResponse.ok) {
      const ticketsData = await ticketsResponse.json();
      const tickets = ticketsData.tickets || [];
      
      metrics.ticketCount = tickets.length;
      
      for (const ticket of tickets) {
        if (ticket.status === 'open' || ticket.status === 'new') {
          metrics.openTickets++;
        } else if (ticket.status === 'pending') {
          metrics.pendingTickets++;
        } else if (ticket.status === 'solved' || ticket.status === 'closed') {
          metrics.solvedTickets++;
        }
      }
      
      if (tickets.length > 0 && tickets[0].updated_at) {
        metrics.lastActivityTimestamp = tickets[0].updated_at;
      }
    } else {
      console.log('[zendesk-poll] Failed to fetch tickets:', ticketsResponse.status, await ticketsResponse.text());
    }
  } catch (error) {
    console.error('[zendesk-poll] Error fetching Zendesk metrics:', error);
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

    const { data: zendeskIntegrations, error: intError } = await supabase
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
      .eq('integration_registry.service_name', 'zendesk')
      .eq('status', 'active');

    if (intError) {
      console.error('[zendesk-poll] Error fetching integrations:', intError);
      return new Response(JSON.stringify({ error: 'Failed to fetch integrations' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!zendeskIntegrations || zendeskIntegrations.length === 0) {
      return new Response(JSON.stringify({ message: 'No Zendesk integrations found', processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let processedCount = 0;
    const errors: string[] = [];

    for (const integration of zendeskIntegrations) {
      try {
        const { data: state } = await supabase
          .from('integration_ingestion_state')
          .select('*')
          .eq('user_id', integration.user_id)
          .eq('user_integration_id', integration.id)
          .eq('service_name', 'zendesk')
          .single();

        const now = new Date();
        if (state?.next_poll_after && new Date(state.next_poll_after) > now) {
          console.log('[zendesk-poll] Skipping user (rate limited):', integration.user_id);
          continue;
        }

        const config = integration.config as { api_key?: string; subdomain?: string; email?: string } | null;
        if (!config?.api_key || !config?.subdomain || !config?.email) {
          console.error('[zendesk-poll] Missing credentials for user:', integration.user_id);
          errors.push(`Missing credentials for user ${integration.user_id}`);
          continue;
        }

        const metrics = await fetchZendeskMetrics(config.api_key, config.subdomain, config.email);
        const eventTime = metrics.lastActivityTimestamp || now.toISOString();

        if (metrics.ticketCount > 0) {
          await supabase.from('integration_events').insert({
            user_id: integration.user_id,
            user_integration_id: integration.id,
            integration_registry_id: integration.provider_id,
            service_name: 'zendesk',
            event_type: 'zendesk.ticket_activity',
            occurred_at: eventTime,
            source: 'zendesk_api_poll',
            metadata: {
              ticket_count: metrics.ticketCount,
              open_tickets: metrics.openTickets,
              pending_tickets: metrics.pendingTickets,
              solved_tickets: metrics.solvedTickets,
              poll_timestamp: now.toISOString(),
            },
          });
        }

        await supabase.from('integration_ingestion_state').upsert({
          user_id: integration.user_id,
          user_integration_id: integration.id,
          service_name: 'zendesk',
          last_polled_at: now.toISOString(),
          last_event_timestamp: eventTime,
          next_poll_after: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
          metadata: { last_metrics: metrics },
          updated_at: now.toISOString(),
        }, { onConflict: 'user_id,user_integration_id,service_name' });

        processedCount++;
        console.log('[zendesk-poll] Processed user:', integration.user_id, metrics);
      } catch (userError: unknown) {
        const errorMessage = userError instanceof Error ? userError.message : String(userError);
        console.error('[zendesk-poll] Error processing user:', integration.user_id, userError);
        errors.push(`Error for user ${integration.user_id}: ${errorMessage}`);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      processed: processedCount,
      total: zendeskIntegrations.length,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[zendesk-poll] Error:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
