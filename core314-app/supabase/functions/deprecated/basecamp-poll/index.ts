import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface BasecampMetrics {
  projectCount: number;
  todoListCount: number;
  todoCount: number;
  completedTodos: number;
  lastActivityTimestamp: string | null;
}

async function fetchBasecampMetrics(accessToken: string, accountId: string): Promise<BasecampMetrics> {
  const metrics: BasecampMetrics = {
    projectCount: 0,
    todoListCount: 0,
    todoCount: 0,
    completedTodos: 0,
    lastActivityTimestamp: null,
  };

  try {
    // Get projects
    const projectsUrl = `https://3.basecampapi.com/${accountId}/projects.json`;
    
    const projectsResponse = await fetch(projectsUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Core314 Integration (support@core314.com)',
      },
    });

    if (projectsResponse.ok) {
      const projects = await projectsResponse.json();
      metrics.projectCount = projects.length;
      
      if (projects.length > 0 && projects[0].updated_at) {
        metrics.lastActivityTimestamp = projects[0].updated_at;
      }

      // Get todo lists from first project (limited scope for metadata)
      if (projects.length > 0) {
        const project = projects[0];
        const todoset = project.dock?.find((d: { name: string }) => d.name === 'todoset');
        
        if (todoset?.url) {
          const todosetResponse = await fetch(todoset.url, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
              'User-Agent': 'Core314 Integration (support@core314.com)',
            },
          });

          if (todosetResponse.ok) {
            const todosetData = await todosetResponse.json();
            metrics.todoListCount = todosetData.todolists_count || 0;
            metrics.todoCount = todosetData.todos_count || 0;
            metrics.completedTodos = todosetData.completed_todos_count || 0;
          }
        }
      }
    } else {
      console.log('[basecamp-poll] Failed to fetch projects:', projectsResponse.status, await projectsResponse.text());
    }
  } catch (error) {
    console.error('[basecamp-poll] Error fetching Basecamp metrics:', error);
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
      .eq('integration_registry.service_name', 'basecamp')
      .eq('status', 'active');

    if (intError) {
      console.error('[basecamp-poll] Error fetching integrations:', intError);
      return new Response(JSON.stringify({ error: 'Failed to fetch integrations' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!integrations || integrations.length === 0) {
      return new Response(JSON.stringify({ message: 'No Basecamp integrations found', processed: 0 }), {
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
          .eq('service_name', 'basecamp')
          .single();

        const now = new Date();
        if (state?.next_poll_after && new Date(state.next_poll_after) > now) {
          console.log('[basecamp-poll] Skipping user (rate limited):', integration.user_id);
          continue;
        }

        const config = integration.config as { access_token?: string; account_id?: string } | null;
        if (!config?.access_token || !config?.account_id) {
          console.error('[basecamp-poll] Missing credentials for user:', integration.user_id);
          errors.push(`Missing credentials for user ${integration.user_id}`);
          continue;
        }

        const metrics = await fetchBasecampMetrics(config.access_token, config.account_id);
        const eventTime = metrics.lastActivityTimestamp || now.toISOString();

        if (metrics.projectCount > 0) {
          await supabase.from('integration_events').insert({
            user_id: integration.user_id,
            user_integration_id: integration.id,
            integration_registry_id: integration.provider_id,
            service_name: 'basecamp',
            event_type: 'basecamp.project_activity',
            occurred_at: eventTime,
            source: 'basecamp_api_poll',
            metadata: {
              project_count: metrics.projectCount,
              todolist_count: metrics.todoListCount,
              todo_count: metrics.todoCount,
              completed_todos: metrics.completedTodos,
              poll_timestamp: now.toISOString(),
            },
          });
        }

        await supabase.from('integration_ingestion_state').upsert({
          user_id: integration.user_id,
          user_integration_id: integration.id,
          service_name: 'basecamp',
          last_polled_at: now.toISOString(),
          last_event_timestamp: eventTime,
          next_poll_after: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
          metadata: { last_metrics: metrics },
          updated_at: now.toISOString(),
        }, { onConflict: 'user_id,user_integration_id,service_name' });

        processedCount++;
        console.log('[basecamp-poll] Processed user:', integration.user_id, metrics);
      } catch (userError: unknown) {
        const errorMessage = userError instanceof Error ? userError.message : String(userError);
        console.error('[basecamp-poll] Error processing user:', integration.user_id, userError);
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
    console.error('[basecamp-poll] Error:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
