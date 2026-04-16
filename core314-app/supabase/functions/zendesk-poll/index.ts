import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: integrations } = await supabase
      .from('oauth_tokens')
      .select(`
        id, user_id, user_integration_id, integration_registry_id,
        access_token_secret_id, refresh_token_secret_id, expires_at,
        integration_registry!inner ( service_name )
      `)
      .eq('integration_registry.service_name', 'zendesk');

    if (!integrations || integrations.length === 0) {
      return new Response(JSON.stringify({ message: 'No Zendesk integrations found', processed: 0 }), {
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
          .eq('user_integration_id', integration.user_integration_id)
          .eq('service_name', 'zendesk')
          .single();

        const now = new Date();
        if (state?.next_poll_after && new Date(state.next_poll_after) > now) continue;

        const { data: tokenJson } = await supabase
          .rpc('get_decrypted_secret', { secret_id: integration.access_token_secret_id });

        if (!tokenJson) { errors.push(`No credentials for user ${integration.user_id}`); continue; }

        let accessToken: string;
        try {
          const parsed = JSON.parse(tokenJson);
          accessToken = parsed.access_token || parsed.api_token || tokenJson;
        } catch {
          accessToken = tokenJson;
        }

        // Get subdomain from user_integrations config
        const { data: userInt } = await supabase
          .from('user_integrations')
          .select('config')
          .eq('user_id', integration.user_id)
          .eq('provider_id', integration.integration_registry_id)
          .single();

        const config = (userInt?.config as Record<string, string>) || {};
        const subdomain = config.subdomain || config.zendesk_subdomain || '';

        if (!subdomain) {
          errors.push(`No Zendesk subdomain for user ${integration.user_id}`);
          continue;
        }

        const baseUrl = `https://${subdomain}.zendesk.com/api/v2`;
        const headers = {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        };

        // Fetch open tickets
        let totalTickets = 0;
        let openTickets = 0;
        let pendingTickets = 0;
        let solvedTickets = 0;
        let urgentTickets = 0;
        let highPriorityTickets = 0;
        const ticketSummary: { subject: string; status: string; priority: string | null }[] = [];

        try {
          const ticketResponse = await fetch(
            `${baseUrl}/tickets.json?sort_by=updated_at&sort_order=desc&per_page=100`,
            { headers }
          );

          if (ticketResponse.ok) {
            const ticketData = await ticketResponse.json();
            const tickets = ticketData.tickets || [];
            totalTickets = tickets.length;

            for (const ticket of tickets) {
              const status = (ticket.status as string) || '';
              const priority = (ticket.priority as string) || null;

              if (status === 'open' || status === 'new') openTickets++;
              else if (status === 'pending') pendingTickets++;
              else if (status === 'solved' || status === 'closed') solvedTickets++;

              if (priority === 'urgent') urgentTickets++;
              else if (priority === 'high') highPriorityTickets++;

              ticketSummary.push({
                subject: ticket.subject as string,
                status,
                priority,
              });
            }
          } else {
            const errText = await ticketResponse.text();
            console.warn(`[zendesk-poll] Ticket fetch failed (${ticketResponse.status}): ${errText.slice(0, 200)}`);
          }
        } catch (apiErr) {
          console.warn('[zendesk-poll] Ticket fetch error:', apiErr);
        }

        // Fetch satisfaction ratings
        let satisfactionScore = 0;
        let totalRatings = 0;
        try {
          const satResponse = await fetch(
            `${baseUrl}/satisfaction_ratings.json?sort_by=created_at&sort_order=desc&per_page=50`,
            { headers }
          );

          if (satResponse.ok) {
            const satData = await satResponse.json();
            const ratings = satData.satisfaction_ratings || [];
            totalRatings = ratings.length;
            const goodRatings = ratings.filter((r: Record<string, string>) => r.score === 'good').length;
            satisfactionScore = totalRatings > 0 ? Math.round(goodRatings / totalRatings * 100) : 0;
          }
        } catch (apiErr) {
          console.warn('[zendesk-poll] Satisfaction fetch error:', apiErr);
        }

        const resolutionRate = totalTickets > 0 ? Math.round(solvedTickets / totalTickets * 100) : 0;

        await supabase.from('integration_events').insert({
          user_id: integration.user_id,
          user_integration_id: integration.user_integration_id,
          integration_registry_id: integration.integration_registry_id,
          service_name: 'zendesk',
          event_type: 'zendesk.support_activity',
          occurred_at: now.toISOString(),
          source: 'zendesk_api_poll',
          metadata: {
            total_tickets: totalTickets,
            open_tickets: openTickets,
            pending_tickets: pendingTickets,
            solved_tickets: solvedTickets,
            urgent_tickets: urgentTickets,
            high_priority_tickets: highPriorityTickets,
            resolution_rate: resolutionRate,
            satisfaction_score: satisfactionScore,
            total_ratings: totalRatings,
            ticket_summary: ticketSummary.slice(0, 10),
            poll_timestamp: now.toISOString(),
          },
        });

        await supabase.from('integration_ingestion_state').upsert({
          user_id: integration.user_id,
          user_integration_id: integration.user_integration_id,
          service_name: 'zendesk',
          last_polled_at: now.toISOString(),
          next_poll_after: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
          metadata: { tickets: totalTickets, open: openTickets, urgent: urgentTickets, satisfaction: satisfactionScore },
          updated_at: now.toISOString(),
        }, { onConflict: 'user_id,user_integration_id,service_name' });

        processedCount++;
      } catch (userError) {
        errors.push(`Error for user ${integration.user_id}: ${(userError as Error).message}`);
      }
    }

    return new Response(JSON.stringify({ success: true, processed: processedCount, total: integrations.length, errors: errors.length > 0 ? errors : undefined }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[zendesk-poll] Error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
