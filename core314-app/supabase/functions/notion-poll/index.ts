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
      .eq('integration_registry.service_name', 'notion');

    if (!integrations || integrations.length === 0) {
      return new Response(JSON.stringify({ message: 'No Notion integrations found', processed: 0 }), {
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
          .eq('service_name', 'notion')
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

        const headers = {
          'Authorization': `Bearer ${accessToken}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        };

        // Fetch databases (workspaces)
        let totalDatabases = 0;
        const databaseSummary: { id: string; title: string; last_edited: string }[] = [];

        try {
          const searchResponse = await fetch('https://api.notion.com/v1/search', {
            method: 'POST',
            headers,
            body: JSON.stringify({
              filter: { property: 'object', value: 'database' },
              sort: { direction: 'descending', timestamp: 'last_edited_time' },
              page_size: 20,
            }),
          });

          if (searchResponse.ok) {
            const searchData = await searchResponse.json();
            const databases = searchData.results || [];
            totalDatabases = databases.length;

            for (const db of databases.slice(0, 10)) {
              const titleParts = (db.title || []) as Array<{ plain_text: string }>;
              const title = titleParts.map((t: { plain_text: string }) => t.plain_text).join('') || 'Untitled';
              databaseSummary.push({
                id: db.id as string,
                title,
                last_edited: db.last_edited_time as string,
              });
            }
          }
        } catch (apiErr) {
          console.warn('[notion-poll] Database search error:', apiErr);
        }

        // Fetch recent pages
        let totalPages = 0;
        let recentlyEditedPages = 0;
        let stalePages = 0;
        const pageSummary: { id: string; title: string; last_edited: string }[] = [];

        try {
          const pagesResponse = await fetch('https://api.notion.com/v1/search', {
            method: 'POST',
            headers,
            body: JSON.stringify({
              filter: { property: 'object', value: 'page' },
              sort: { direction: 'descending', timestamp: 'last_edited_time' },
              page_size: 50,
            }),
          });

          if (pagesResponse.ok) {
            const pagesData = await pagesResponse.json();
            const pages = pagesData.results || [];
            totalPages = pages.length;

            const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

            for (const page of pages) {
              const lastEdited = new Date(page.last_edited_time as string);
              if (lastEdited > sevenDaysAgo) recentlyEditedPages++;
              if (lastEdited < thirtyDaysAgo) stalePages++;

              if (pageSummary.length < 10) {
                const titleProp = (page.properties?.title || page.properties?.Name || page.properties?.name) as {
                  title?: Array<{ plain_text: string }>;
                } | undefined;
                const titleParts = titleProp?.title || [];
                const title = titleParts.map((t: { plain_text: string }) => t.plain_text).join('') || 'Untitled';
                pageSummary.push({
                  id: page.id as string,
                  title,
                  last_edited: page.last_edited_time as string,
                });
              }
            }
          }
        } catch (apiErr) {
          console.warn('[notion-poll] Pages search error:', apiErr);
        }

        // Fetch workspace users
        let totalUsers = 0;
        try {
          const usersResponse = await fetch('https://api.notion.com/v1/users', { headers });
          if (usersResponse.ok) {
            const usersData = await usersResponse.json();
            totalUsers = (usersData.results || []).length;
          }
        } catch (apiErr) {
          console.warn('[notion-poll] Users fetch error:', apiErr);
        }

        await supabase.from('integration_events').insert({
          user_id: integration.user_id,
          user_integration_id: integration.user_integration_id,
          integration_registry_id: integration.integration_registry_id,
          service_name: 'notion',
          event_type: 'notion.workspace_activity',
          occurred_at: now.toISOString(),
          source: 'notion_api_poll',
          metadata: {
            total_databases: totalDatabases,
            total_pages: totalPages,
            recently_edited_pages_7d: recentlyEditedPages,
            stale_pages_30d: stalePages,
            total_users: totalUsers,
            database_summary: databaseSummary.slice(0, 5),
            page_summary: pageSummary.slice(0, 5),
            poll_timestamp: now.toISOString(),
          },
        });

        await supabase.from('integration_ingestion_state').upsert({
          user_id: integration.user_id,
          user_integration_id: integration.user_integration_id,
          service_name: 'notion',
          last_polled_at: now.toISOString(),
          next_poll_after: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
          metadata: {
            databases: totalDatabases,
            pages: totalPages,
            recently_edited_7d: recentlyEditedPages,
            stale_30d: stalePages,
            users: totalUsers,
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
    console.error('[notion-poll] Error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
