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
      .eq('integration_registry.service_name', 'monday');

    if (!integrations || integrations.length === 0) {
      return new Response(JSON.stringify({ message: 'No Monday.com integrations found', processed: 0 }), {
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
          .eq('service_name', 'monday')
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

        // Monday.com uses GraphQL API
        const graphqlEndpoint = 'https://api.monday.com/v2';
        const headers = {
          'Authorization': accessToken,
          'Content-Type': 'application/json',
          'API-Version': '2024-10',
        };

        // Fetch boards with items summary
        let totalBoards = 0;
        let totalItems = 0;
        let overdueItems = 0;
        let stuckItems = 0;
        let doneItems = 0;
        const boardSummary: { id: string; name: string; items_count: number; state: string }[] = [];

        try {
          const boardsQuery = `{
            boards(limit: 20, order_by: created_at) {
              id
              name
              state
              items_count
              columns { id title type }
            }
          }`;

          const boardsResponse = await fetch(graphqlEndpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify({ query: boardsQuery }),
          });

          if (boardsResponse.ok) {
            const boardsData = await boardsResponse.json();
            const boards = boardsData.data?.boards || [];
            totalBoards = boards.length;

            for (const board of boards.slice(0, 10)) {
              boardSummary.push({
                id: board.id as string,
                name: board.name as string,
                items_count: (board.items_count as number) || 0,
                state: board.state as string,
              });
              totalItems += (board.items_count as number) || 0;
            }
          }
        } catch (apiErr) {
          console.warn('[monday-poll] Boards fetch error:', apiErr);
        }

        // Fetch items with status from top boards
        try {
          if (boardSummary.length > 0) {
            const topBoardIds = boardSummary.slice(0, 5).map(b => b.id);
            const itemsQuery = `{
              boards(ids: [${topBoardIds.join(',')}]) {
                items_page(limit: 100) {
                  items {
                    id
                    name
                    state
                    column_values {
                      id
                      type
                      text
                      value
                    }
                  }
                }
              }
            }`;

            const itemsResponse = await fetch(graphqlEndpoint, {
              method: 'POST',
              headers,
              body: JSON.stringify({ query: itemsQuery }),
            });

            if (itemsResponse.ok) {
              const itemsData = await itemsResponse.json();
              const boards = itemsData.data?.boards || [];

              for (const board of boards) {
                const items = board.items_page?.items || [];
                for (const item of items) {
                  // Check status columns for stuck/done/overdue
                  const columnValues = (item.column_values || []) as Array<{
                    type: string;
                    text: string;
                    value: string | null;
                  }>;
                  for (const col of columnValues) {
                    if (col.type === 'status' || col.type === 'color') {
                      const statusText = (col.text || '').toLowerCase();
                      if (statusText === 'stuck' || statusText === 'blocked') stuckItems++;
                      if (statusText === 'done' || statusText === 'complete' || statusText === 'completed') doneItems++;
                    }
                    if (col.type === 'date' && col.value) {
                      try {
                        const parsed = JSON.parse(col.value);
                        if (parsed.date && new Date(parsed.date as string) < now) {
                          overdueItems++;
                        }
                      } catch { /* skip unparseable dates */ }
                    }
                  }
                }
              }
            }
          }
        } catch (apiErr) {
          console.warn('[monday-poll] Items fetch error:', apiErr);
        }

        // Fetch workspace users
        let totalUsers = 0;
        try {
          const usersQuery = `{ users(limit: 50) { id name email } }`;
          const usersResponse = await fetch(graphqlEndpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify({ query: usersQuery }),
          });

          if (usersResponse.ok) {
            const usersData = await usersResponse.json();
            totalUsers = (usersData.data?.users || []).length;
          }
        } catch (apiErr) {
          console.warn('[monday-poll] Users fetch error:', apiErr);
        }

        const completionRate = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;

        await supabase.from('integration_events').insert({
          user_id: integration.user_id,
          user_integration_id: integration.user_integration_id,
          integration_registry_id: integration.integration_registry_id,
          service_name: 'monday',
          event_type: 'monday.board_activity',
          occurred_at: now.toISOString(),
          source: 'monday_api_poll',
          metadata: {
            total_boards: totalBoards,
            total_items: totalItems,
            overdue_items: overdueItems,
            stuck_items: stuckItems,
            done_items: doneItems,
            completion_rate: completionRate,
            total_users: totalUsers,
            board_summary: boardSummary.slice(0, 5),
            poll_timestamp: now.toISOString(),
          },
        });

        await supabase.from('integration_ingestion_state').upsert({
          user_id: integration.user_id,
          user_integration_id: integration.user_integration_id,
          service_name: 'monday',
          last_polled_at: now.toISOString(),
          next_poll_after: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
          metadata: {
            boards: totalBoards,
            items: totalItems,
            overdue: overdueItems,
            stuck: stuckItems,
            done: doneItems,
            completion_rate: completionRate,
          },
          updated_at: now.toISOString(),
        }, { onConflict: 'user_id,user_integration_id,service_name' });

        processedCount++;
      } catch (userError) {
        errors.push(`Error for user ${integration.user_id}: ${(userError as Error).message}`);
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
  } catch (error) {
    console.error('[monday-poll] Error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
