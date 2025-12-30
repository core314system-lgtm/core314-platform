import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface MiroMetrics {
  boardCount: number;
  teamCount: number;
  lastActivityTimestamp: string | null;
}

async function fetchMiroMetrics(accessToken: string): Promise<MiroMetrics> {
  const metrics: MiroMetrics = {
    boardCount: 0,
    teamCount: 0,
    lastActivityTimestamp: null,
  };

  try {
    // Get list of boards
    const boardsResponse = await fetch('https://api.miro.com/v2/boards?limit=50', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (boardsResponse.ok) {
      const boardsData = await boardsResponse.json();
      const boards = boardsData.data || [];
      metrics.boardCount = boards.length;

      // Find latest activity
      let latestModified: Date | null = null;
      for (const board of boards) {
        if (board.modifiedAt) {
          const modifiedDate = new Date(board.modifiedAt);
          if (!latestModified || modifiedDate > latestModified) {
            latestModified = modifiedDate;
          }
        }
      }
      
      if (latestModified) {
        metrics.lastActivityTimestamp = latestModified.toISOString();
      }

      // Get teams
      const teamsResponse = await fetch('https://api.miro.com/v2/orgs/teams?limit=50', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (teamsResponse.ok) {
        const teamsData = await teamsResponse.json();
        metrics.teamCount = (teamsData.data || []).length;
      }
    } else {
      console.log('[miro-poll] Failed to fetch boards:', boardsResponse.status, await boardsResponse.text());
    }
  } catch (error) {
    console.error('[miro-poll] Error fetching Miro metrics:', error);
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
      .eq('integration_registry.service_name', 'miro')
      .eq('status', 'active');

    if (intError) {
      console.error('[miro-poll] Error fetching integrations:', intError);
      return new Response(JSON.stringify({ error: 'Failed to fetch integrations' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!integrations || integrations.length === 0) {
      return new Response(JSON.stringify({ message: 'No Miro integrations found', processed: 0 }), {
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
          .eq('service_name', 'miro')
          .single();

        const now = new Date();
        if (state?.next_poll_after && new Date(state.next_poll_after) > now) {
          console.log('[miro-poll] Skipping user (rate limited):', integration.user_id);
          continue;
        }

        const config = integration.config as { access_token?: string } | null;
        if (!config?.access_token) {
          console.error('[miro-poll] Missing credentials for user:', integration.user_id);
          errors.push(`Missing credentials for user ${integration.user_id}`);
          continue;
        }

        const metrics = await fetchMiroMetrics(config.access_token);
        const eventTime = metrics.lastActivityTimestamp || now.toISOString();

        if (metrics.boardCount > 0) {
          await supabase.from('integration_events').insert({
            user_id: integration.user_id,
            user_integration_id: integration.id,
            integration_registry_id: integration.provider_id,
            service_name: 'miro',
            event_type: 'miro.board_activity',
            occurred_at: eventTime,
            source: 'miro_api_poll',
            metadata: {
              board_count: metrics.boardCount,
              team_count: metrics.teamCount,
              poll_timestamp: now.toISOString(),
            },
          });
        }

        await supabase.from('integration_ingestion_state').upsert({
          user_id: integration.user_id,
          user_integration_id: integration.id,
          service_name: 'miro',
          last_polled_at: now.toISOString(),
          last_event_timestamp: eventTime,
          next_poll_after: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
          metadata: { last_metrics: metrics },
          updated_at: now.toISOString(),
        }, { onConflict: 'user_id,user_integration_id,service_name' });

        processedCount++;
        console.log('[miro-poll] Processed user:', integration.user_id, metrics);
      } catch (userError: unknown) {
        const errorMessage = userError instanceof Error ? userError.message : String(userError);
        console.error('[miro-poll] Error processing user:', integration.user_id, userError);
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
    console.error('[miro-poll] Error:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
