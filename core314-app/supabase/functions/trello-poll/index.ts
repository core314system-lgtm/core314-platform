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
        access_token_secret_id, expires_at,
        integration_registry!inner ( service_name )
      `)
      .eq('integration_registry.service_name', 'trello');

    if (!integrations || integrations.length === 0) {
      return new Response(JSON.stringify({ message: 'No Trello integrations found', processed: 0 }), {
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
          .eq('service_name', 'trello')
          .single();

        const now = new Date();
        if (state?.next_poll_after && new Date(state.next_poll_after) > now) continue;

        const { data: credentialJson } = await supabase
          .rpc('get_decrypted_secret', { secret_id: integration.access_token_secret_id });

        if (!credentialJson) { errors.push(`No credentials for user ${integration.user_id}`); continue; }

        let credentials: { api_key: string; api_token: string };
        try {
          credentials = JSON.parse(credentialJson);
        } catch {
          errors.push(`Invalid credentials for user ${integration.user_id}`);
          continue;
        }

        const authParams = `key=${credentials.api_key}&token=${credentials.api_token}`;

        // Fetch boards
        const boardsResponse = await fetch(
          `https://api.trello.com/1/members/me/boards?${authParams}&fields=name,dateLastActivity,closed`,
          { headers: { 'Accept': 'application/json' } }
        );

        if (!boardsResponse.ok) {
          errors.push(`Trello API error for user ${integration.user_id}: ${boardsResponse.status}`);
          continue;
        }

        const boards = await boardsResponse.json();
        const activeBoards = boards.filter((b: Record<string, unknown>) => !b.closed);

        let totalCards = 0;
        let doneCards = 0;
        let overdueCards = 0;
        let totalLists = 0;
        const boardActivity: { name: string; cards: number }[] = [];

        // Sample up to 5 boards for card metrics
        for (const board of activeBoards.slice(0, 5)) {
          await new Promise(resolve => setTimeout(resolve, 200));

          const listsResponse = await fetch(
            `https://api.trello.com/1/boards/${board.id}/lists?${authParams}&cards=open&card_fields=due,dateLastActivity,closed`,
            { headers: { 'Accept': 'application/json' } }
          );

          if (!listsResponse.ok) continue;

          const lists = await listsResponse.json();
          totalLists += lists.length;

          let boardCardCount = 0;
          for (const list of lists) {
            const cards = list.cards || [];
            boardCardCount += cards.length;
            totalCards += cards.length;

            const listNameLower = (list.name as string).toLowerCase();
            if (listNameLower.includes('done') || listNameLower.includes('complete') || listNameLower.includes('finished')) {
              doneCards += cards.length;
            }

            for (const card of cards) {
              if (card.due && new Date(card.due as string) < now && !card.closed) {
                overdueCards++;
              }
            }
          }

          boardActivity.push({ name: board.name as string, cards: boardCardCount });
        }

        await supabase.from('integration_events').insert({
          user_id: integration.user_id,
          user_integration_id: integration.user_integration_id,
          integration_registry_id: integration.integration_registry_id,
          service_name: 'trello',
          event_type: 'trello.board_summary',
          occurred_at: now.toISOString(),
          source: 'trello_api_poll',
          metadata: {
            total_boards: activeBoards.length,
            total_cards: totalCards,
            total_lists: totalLists,
            done_cards: doneCards,
            overdue_cards: overdueCards,
            board_activity: boardActivity,
            poll_timestamp: now.toISOString(),
          },
        });

        await supabase.from('integration_ingestion_state').upsert({
          user_id: integration.user_id,
          user_integration_id: integration.user_integration_id,
          service_name: 'trello',
          last_polled_at: now.toISOString(),
          next_poll_after: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
          metadata: { boards: activeBoards.length, cards: totalCards, overdue: overdueCards },
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
    console.error('[trello-poll] Error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
