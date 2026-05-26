import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface PlannerMetrics {
  planCount: number;
  taskCount: number;
  notStartedTasks: number;
  inProgressTasks: number;
  completedTasks: number;
  lastActivityTimestamp: string | null;
}

async function fetchPlannerMetrics(accessToken: string): Promise<PlannerMetrics> {
  const metrics: PlannerMetrics = {
    planCount: 0,
    taskCount: 0,
    notStartedTasks: 0,
    inProgressTasks: 0,
    completedTasks: 0,
    lastActivityTimestamp: null,
  };

  try {
    // Get user's plans
    const plansResponse = await fetch('https://graph.microsoft.com/v1.0/me/planner/plans', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (plansResponse.ok) {
      const plansData = await plansResponse.json();
      const plans = plansData.value || [];
      metrics.planCount = plans.length;

      // Get tasks from first plan (limited scope for metadata)
      if (plans.length > 0) {
        const planId = plans[0].id;
        
        const tasksResponse = await fetch(`https://graph.microsoft.com/v1.0/planner/plans/${planId}/tasks`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });

        if (tasksResponse.ok) {
          const tasksData = await tasksResponse.json();
          const tasks = tasksData.value || [];
          
          metrics.taskCount = tasks.length;
          
          for (const task of tasks) {
            if (task.percentComplete === 0) {
              metrics.notStartedTasks++;
            } else if (task.percentComplete === 100) {
              metrics.completedTasks++;
            } else {
              metrics.inProgressTasks++;
            }
          }
          
          // Find most recent activity
          if (tasks.length > 0) {
            const sortedTasks = tasks.sort((a: { createdDateTime?: string }, b: { createdDateTime?: string }) => 
              new Date(b.createdDateTime || 0).getTime() - new Date(a.createdDateTime || 0).getTime()
            );
            metrics.lastActivityTimestamp = sortedTasks[0].createdDateTime;
          }
        }
      }
    } else {
      console.log('[planner-poll] Failed to fetch plans:', plansResponse.status, await plansResponse.text());
    }
  } catch (error) {
    console.error('[planner-poll] Error fetching Planner metrics:', error);
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
      .eq('integration_registry.service_name', 'microsoft_planner')
      .eq('status', 'active');

    if (intError) {
      console.error('[planner-poll] Error fetching integrations:', intError);
      return new Response(JSON.stringify({ error: 'Failed to fetch integrations' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!integrations || integrations.length === 0) {
      return new Response(JSON.stringify({ message: 'No Microsoft Planner integrations found', processed: 0 }), {
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
          .eq('service_name', 'microsoft_planner')
          .single();

        const now = new Date();
        if (state?.next_poll_after && new Date(state.next_poll_after) > now) {
          console.log('[planner-poll] Skipping user (rate limited):', integration.user_id);
          continue;
        }

        const config = integration.config as { access_token?: string } | null;
        if (!config?.access_token) {
          console.error('[planner-poll] Missing credentials for user:', integration.user_id);
          errors.push(`Missing credentials for user ${integration.user_id}`);
          continue;
        }

        const metrics = await fetchPlannerMetrics(config.access_token);
        const eventTime = metrics.lastActivityTimestamp || now.toISOString();

        if (metrics.planCount > 0 || metrics.taskCount > 0) {
          await supabase.from('integration_events').insert({
            user_id: integration.user_id,
            user_integration_id: integration.id,
            integration_registry_id: integration.provider_id,
            service_name: 'microsoft_planner',
            event_type: 'microsoft_planner.task_activity',
            occurred_at: eventTime,
            source: 'planner_api_poll',
            metadata: {
              plan_count: metrics.planCount,
              task_count: metrics.taskCount,
              not_started_tasks: metrics.notStartedTasks,
              in_progress_tasks: metrics.inProgressTasks,
              completed_tasks: metrics.completedTasks,
              poll_timestamp: now.toISOString(),
            },
          });
        }

        await supabase.from('integration_ingestion_state').upsert({
          user_id: integration.user_id,
          user_integration_id: integration.id,
          service_name: 'microsoft_planner',
          last_polled_at: now.toISOString(),
          last_event_timestamp: eventTime,
          next_poll_after: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
          metadata: { last_metrics: metrics },
          updated_at: now.toISOString(),
        }, { onConflict: 'user_id,user_integration_id,service_name' });

        processedCount++;
        console.log('[planner-poll] Processed user:', integration.user_id, metrics);
      } catch (userError: unknown) {
        const errorMessage = userError instanceof Error ? userError.message : String(userError);
        console.error('[planner-poll] Error processing user:', integration.user_id, userError);
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
    console.error('[planner-poll] Error:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
