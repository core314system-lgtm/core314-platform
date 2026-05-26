import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ClickUpMetrics {
  taskCount: number;
  openTasks: number;
  inProgressTasks: number;
  completedTasks: number;
  spaceCount: number;
  lastActivityTimestamp: string | null;
}

async function fetchClickUpMetrics(apiKey: string): Promise<ClickUpMetrics> {
  const metrics: ClickUpMetrics = {
    taskCount: 0,
    openTasks: 0,
    inProgressTasks: 0,
    completedTasks: 0,
    spaceCount: 0,
    lastActivityTimestamp: null,
  };

  try {
    // First get teams to find workspaces
    const teamsResponse = await fetch('https://api.clickup.com/api/v2/team', {
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!teamsResponse.ok) {
      console.log('[clickup-poll] Failed to fetch teams:', teamsResponse.status, await teamsResponse.text());
      return metrics;
    }

    const teamsData = await teamsResponse.json();
    const teams = teamsData.teams || [];

    if (teams.length === 0) {
      return metrics;
    }

    // Get spaces for the first team
    const teamId = teams[0].id;
    const spacesResponse = await fetch(`https://api.clickup.com/api/v2/team/${teamId}/space`, {
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (spacesResponse.ok) {
      const spacesData = await spacesResponse.json();
      const spaces = spacesData.spaces || [];
      metrics.spaceCount = spaces.length;

      // Get tasks from the first space (limited scope for metadata only)
      if (spaces.length > 0) {
        const spaceId = spaces[0].id;
        const tasksResponse = await fetch(`https://api.clickup.com/api/v2/space/${spaceId}/task?subtasks=false&page=0`, {
          headers: {
            'Authorization': apiKey,
            'Content-Type': 'application/json',
          },
        });

        if (tasksResponse.ok) {
          const tasksData = await tasksResponse.json();
          const tasks = tasksData.tasks || [];
          
          metrics.taskCount = tasks.length;
          
          for (const task of tasks) {
            const status = task.status?.type?.toLowerCase() || '';
            if (status === 'open') {
              metrics.openTasks++;
            } else if (status === 'custom' || status === 'in progress') {
              metrics.inProgressTasks++;
            } else if (status === 'closed' || status === 'done') {
              metrics.completedTasks++;
            }
          }
          
          if (tasks.length > 0 && tasks[0].date_updated) {
            metrics.lastActivityTimestamp = new Date(parseInt(tasks[0].date_updated)).toISOString();
          }
        }
      }
    }
  } catch (error) {
    console.error('[clickup-poll] Error fetching ClickUp metrics:', error);
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
      .eq('integration_registry.service_name', 'clickup')
      .eq('status', 'active');

    if (intError) {
      console.error('[clickup-poll] Error fetching integrations:', intError);
      return new Response(JSON.stringify({ error: 'Failed to fetch integrations' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!integrations || integrations.length === 0) {
      return new Response(JSON.stringify({ message: 'No ClickUp integrations found', processed: 0 }), {
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
          .eq('service_name', 'clickup')
          .single();

        const now = new Date();
        if (state?.next_poll_after && new Date(state.next_poll_after) > now) {
          console.log('[clickup-poll] Skipping user (rate limited):', integration.user_id);
          continue;
        }

        const config = integration.config as { api_key?: string } | null;
        if (!config?.api_key) {
          console.error('[clickup-poll] Missing credentials for user:', integration.user_id);
          errors.push(`Missing credentials for user ${integration.user_id}`);
          continue;
        }

        const metrics = await fetchClickUpMetrics(config.api_key);
        const eventTime = metrics.lastActivityTimestamp || now.toISOString();

        if (metrics.taskCount > 0 || metrics.spaceCount > 0) {
          await supabase.from('integration_events').insert({
            user_id: integration.user_id,
            user_integration_id: integration.id,
            integration_registry_id: integration.provider_id,
            service_name: 'clickup',
            event_type: 'clickup.task_activity',
            occurred_at: eventTime,
            source: 'clickup_api_poll',
            metadata: {
              task_count: metrics.taskCount,
              open_tasks: metrics.openTasks,
              in_progress_tasks: metrics.inProgressTasks,
              completed_tasks: metrics.completedTasks,
              space_count: metrics.spaceCount,
              poll_timestamp: now.toISOString(),
            },
          });
        }

        await supabase.from('integration_ingestion_state').upsert({
          user_id: integration.user_id,
          user_integration_id: integration.id,
          service_name: 'clickup',
          last_polled_at: now.toISOString(),
          last_event_timestamp: eventTime,
          next_poll_after: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
          metadata: { last_metrics: metrics },
          updated_at: now.toISOString(),
        }, { onConflict: 'user_id,user_integration_id,service_name' });

        processedCount++;
        console.log('[clickup-poll] Processed user:', integration.user_id, metrics);
      } catch (userError: unknown) {
        const errorMessage = userError instanceof Error ? userError.message : String(userError);
        console.error('[clickup-poll] Error processing user:', integration.user_id, userError);
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
    console.error('[clickup-poll] Error:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
