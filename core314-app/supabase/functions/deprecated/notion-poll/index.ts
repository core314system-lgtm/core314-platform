import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface NotionMetrics {
  pageCount: number;
  databaseCount: number;
  lastActivityTimestamp: string | null;
}

async function fetchNotionMetrics(apiKey: string): Promise<NotionMetrics> {
  const metrics: NotionMetrics = {
    pageCount: 0,
    databaseCount: 0,
    lastActivityTimestamp: null,
  };

  try {
    const searchResponse = await fetch('https://api.notion.com/v1/search', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${apiKey}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        page_size: 100,
        sort: {
          direction: 'descending',
          timestamp: 'last_edited_time',
        },
      }),
    });

    if (searchResponse.ok) {
      const searchData = await searchResponse.json();
      const results = searchData.results || [];
      
      for (const item of results) {
        if (item.object === 'page') {
          metrics.pageCount++;
        } else if (item.object === 'database') {
          metrics.databaseCount++;
        }
      }
      
      if (results.length > 0 && results[0].last_edited_time) {
        metrics.lastActivityTimestamp = results[0].last_edited_time;
      }
    } else {
      console.log('[notion-poll] Failed to search:', searchResponse.status, await searchResponse.text());
    }
  } catch (error) {
    console.error('[notion-poll] Error fetching Notion metrics:', error);
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

    const { data: notionIntegrations, error: intError } = await supabase
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
      .eq('integration_registry.service_name', 'notion')
      .eq('status', 'active');

    if (intError) {
      console.error('[notion-poll] Error fetching integrations:', intError);
      return new Response(JSON.stringify({ error: 'Failed to fetch integrations' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!notionIntegrations || notionIntegrations.length === 0) {
      return new Response(JSON.stringify({ message: 'No Notion integrations found', processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let processedCount = 0;
    const errors: string[] = [];

    for (const integration of notionIntegrations) {
      try {
        const { data: state } = await supabase
          .from('integration_ingestion_state')
          .select('*')
          .eq('user_id', integration.user_id)
          .eq('user_integration_id', integration.id)
          .eq('service_name', 'notion')
          .single();

        const now = new Date();
        if (state?.next_poll_after && new Date(state.next_poll_after) > now) {
          console.log('[notion-poll] Skipping user (rate limited):', integration.user_id);
          continue;
        }

        const config = integration.config as { api_key?: string } | null;
        if (!config?.api_key) {
          console.error('[notion-poll] Missing API key for user:', integration.user_id);
          errors.push(`Missing API key for user ${integration.user_id}`);
          continue;
        }

        const metrics = await fetchNotionMetrics(config.api_key);
        const eventTime = metrics.lastActivityTimestamp || now.toISOString();

        if (metrics.pageCount > 0 || metrics.databaseCount > 0) {
          await supabase.from('integration_events').insert({
            user_id: integration.user_id,
            user_integration_id: integration.id,
            integration_registry_id: integration.provider_id,
            service_name: 'notion',
            event_type: 'notion.workspace_activity',
            occurred_at: eventTime,
            source: 'notion_api_poll',
            metadata: {
              page_count: metrics.pageCount,
              database_count: metrics.databaseCount,
              poll_timestamp: now.toISOString(),
            },
          });
        }

        await supabase.from('integration_ingestion_state').upsert({
          user_id: integration.user_id,
          user_integration_id: integration.id,
          service_name: 'notion',
          last_polled_at: now.toISOString(),
          last_event_timestamp: eventTime,
          next_poll_after: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
          metadata: { last_metrics: metrics },
          updated_at: now.toISOString(),
        }, { onConflict: 'user_id,user_integration_id,service_name' });

        processedCount++;
        console.log('[notion-poll] Processed user:', integration.user_id, metrics);
      } catch (userError: unknown) {
        const errorMessage = userError instanceof Error ? userError.message : String(userError);
        console.error('[notion-poll] Error processing user:', integration.user_id, userError);
        errors.push(`Error for user ${integration.user_id}: ${errorMessage}`);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      processed: processedCount,
      total: notionIntegrations.length,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[notion-poll] Error:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
