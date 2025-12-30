import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ConfluenceMetrics {
  spaceCount: number;
  pageCount: number;
  lastActivityTimestamp: string | null;
}

async function fetchConfluenceMetrics(email: string, apiToken: string, domain: string): Promise<ConfluenceMetrics> {
  const metrics: ConfluenceMetrics = {
    spaceCount: 0,
    pageCount: 0,
    lastActivityTimestamp: null,
  };

  try {
    const auth = btoa(`${email}:${apiToken}`);
    
    // Get spaces
    const spacesResponse = await fetch(`https://${domain}.atlassian.net/wiki/rest/api/space?limit=100`, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
      },
    });

    if (spacesResponse.ok) {
      const spacesData = await spacesResponse.json();
      const spaces = spacesData.results || [];
      metrics.spaceCount = spaces.length;

      // Get page count from content API
      const contentResponse = await fetch(`https://${domain}.atlassian.net/wiki/rest/api/content?type=page&limit=100`, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json',
        },
      });

      if (contentResponse.ok) {
        const contentData = await contentResponse.json();
        const pages = contentData.results || [];
        metrics.pageCount = contentData.size || pages.length;
        
        if (pages.length > 0) {
          // Get the most recent page's last modified date
          const recentPage = pages[0];
          if (recentPage.version?.when) {
            metrics.lastActivityTimestamp = recentPage.version.when;
          }
        }
      }
    } else {
      console.log('[confluence-poll] Failed to fetch spaces:', spacesResponse.status, await spacesResponse.text());
    }
  } catch (error) {
    console.error('[confluence-poll] Error fetching Confluence metrics:', error);
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
      .eq('integration_registry.service_name', 'confluence')
      .eq('status', 'active');

    if (intError) {
      console.error('[confluence-poll] Error fetching integrations:', intError);
      return new Response(JSON.stringify({ error: 'Failed to fetch integrations' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!integrations || integrations.length === 0) {
      return new Response(JSON.stringify({ message: 'No Confluence integrations found', processed: 0 }), {
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
          .eq('service_name', 'confluence')
          .single();

        const now = new Date();
        if (state?.next_poll_after && new Date(state.next_poll_after) > now) {
          console.log('[confluence-poll] Skipping user (rate limited):', integration.user_id);
          continue;
        }

        const config = integration.config as { email?: string; api_token?: string; domain?: string } | null;
        if (!config?.email || !config?.api_token || !config?.domain) {
          console.error('[confluence-poll] Missing credentials for user:', integration.user_id);
          errors.push(`Missing credentials for user ${integration.user_id}`);
          continue;
        }

        const metrics = await fetchConfluenceMetrics(config.email, config.api_token, config.domain);
        const eventTime = metrics.lastActivityTimestamp || now.toISOString();

        if (metrics.spaceCount > 0 || metrics.pageCount > 0) {
          await supabase.from('integration_events').insert({
            user_id: integration.user_id,
            user_integration_id: integration.id,
            integration_registry_id: integration.provider_id,
            service_name: 'confluence',
            event_type: 'confluence.content_activity',
            occurred_at: eventTime,
            source: 'confluence_api_poll',
            metadata: {
              space_count: metrics.spaceCount,
              page_count: metrics.pageCount,
              poll_timestamp: now.toISOString(),
            },
          });
        }

        await supabase.from('integration_ingestion_state').upsert({
          user_id: integration.user_id,
          user_integration_id: integration.id,
          service_name: 'confluence',
          last_polled_at: now.toISOString(),
          last_event_timestamp: eventTime,
          next_poll_after: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
          metadata: { last_metrics: metrics },
          updated_at: now.toISOString(),
        }, { onConflict: 'user_id,user_integration_id,service_name' });

        processedCount++;
        console.log('[confluence-poll] Processed user:', integration.user_id, metrics);
      } catch (userError: unknown) {
        const errorMessage = userError instanceof Error ? userError.message : String(userError);
        console.error('[confluence-poll] Error processing user:', integration.user_id, userError);
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
    console.error('[confluence-poll] Error:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
