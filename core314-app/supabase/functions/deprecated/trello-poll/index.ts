import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface TrelloMetrics {
  boardCount: number;
  cardCount: number;
  openCards: number;
  closedCards: number;
  lastActivityTimestamp: string | null;
}

async function fetchTrelloMetrics(apiKey: string, apiToken: string): Promise<TrelloMetrics> {
  const metrics: TrelloMetrics = {
    boardCount: 0,
    cardCount: 0,
    openCards: 0,
    closedCards: 0,
    lastActivityTimestamp: null,
  };

  try {
    const boardsResponse = await fetch(`https://api.trello.com/1/members/me/boards?key=${apiKey}&token=${apiToken}&fields=name,dateLastActivity`);

    if (boardsResponse.ok) {
      const boards = await boardsResponse.json();
      metrics.boardCount = boards.length;
      
      if (boards.length > 0 && boards[0].dateLastActivity) {
        metrics.lastActivityTimestamp = boards[0].dateLastActivity;
      }

      for (const board of boards.slice(0, 5)) {
        try {
          const cardsResponse = await fetch(`https://api.trello.com/1/boards/${board.id}/cards?key=${apiKey}&token=${apiToken}&fields=closed`);
          
          if (cardsResponse.ok) {
            const cards = await cardsResponse.json();
            metrics.cardCount += cards.length;
            
            for (const card of cards) {
              if (card.closed) {
                metrics.closedCards++;
              } else {
                metrics.openCards++;
              }
            }
          }
        } catch (e) {
          console.log('[trello-poll] Error fetching cards for board:', board.id, e);
        }
      }
    } else {
      console.log('[trello-poll] Failed to fetch boards:', boardsResponse.status, await boardsResponse.text());
    }
  } catch (error) {
    console.error('[trello-poll] Error fetching Trello metrics:', error);
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

    const { data: trelloIntegrations, error: intError } = await supabase
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
      .eq('integration_registry.service_name', 'trello')
      .eq('status', 'active');

    if (intError) {
      console.error('[trello-poll] Error fetching integrations:', intError);
      return new Response(JSON.stringify({ error: 'Failed to fetch integrations' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!trelloIntegrations || trelloIntegrations.length === 0) {
      return new Response(JSON.stringify({ message: 'No Trello integrations found', processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let processedCount = 0;
    const errors: string[] = [];

    for (const integration of trelloIntegrations) {
      try {
        const { data: state } = await supabase
          .from('integration_ingestion_state')
          .select('*')
          .eq('user_id', integration.user_id)
          .eq('user_integration_id', integration.id)
          .eq('service_name', 'trello')
          .single();

        const now = new Date();
        if (state?.next_poll_after && new Date(state.next_poll_after) > now) {
          console.log('[trello-poll] Skipping user (rate limited):', integration.user_id);
          continue;
        }

        const config = integration.config as { api_key?: string; api_token?: string } | null;
        if (!config?.api_key || !config?.api_token) {
          console.error('[trello-poll] Missing credentials for user:', integration.user_id);
          errors.push(`Missing credentials for user ${integration.user_id}`);
          continue;
        }

        const metrics = await fetchTrelloMetrics(config.api_key, config.api_token);
        const eventTime = metrics.lastActivityTimestamp || now.toISOString();

        if (metrics.boardCount > 0 || metrics.cardCount > 0) {
          await supabase.from('integration_events').insert({
            user_id: integration.user_id,
            user_integration_id: integration.id,
            integration_registry_id: integration.provider_id,
            service_name: 'trello',
            event_type: 'trello.board_activity',
            occurred_at: eventTime,
            source: 'trello_api_poll',
            metadata: {
              board_count: metrics.boardCount,
              card_count: metrics.cardCount,
              open_cards: metrics.openCards,
              closed_cards: metrics.closedCards,
              poll_timestamp: now.toISOString(),
            },
          });
        }

        await supabase.from('integration_ingestion_state').upsert({
          user_id: integration.user_id,
          user_integration_id: integration.id,
          service_name: 'trello',
          last_polled_at: now.toISOString(),
          last_event_timestamp: eventTime,
          next_poll_after: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
          metadata: { last_metrics: metrics },
          updated_at: now.toISOString(),
        }, { onConflict: 'user_id,user_integration_id,service_name' });

        processedCount++;
        console.log('[trello-poll] Processed user:', integration.user_id, metrics);
      } catch (userError: unknown) {
        const errorMessage = userError instanceof Error ? userError.message : String(userError);
        console.error('[trello-poll] Error processing user:', integration.user_id, userError);
        errors.push(`Error for user ${integration.user_id}: ${errorMessage}`);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      processed: processedCount,
      total: trelloIntegrations.length,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[trello-poll] Error:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
