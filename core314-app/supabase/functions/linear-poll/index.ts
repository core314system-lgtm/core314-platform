import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface LinearMetrics {
  issueCount: number;
  backlogIssues: number;
  todoIssues: number;
  inProgressIssues: number;
  doneIssues: number;
  canceledIssues: number;
  projectCount: number;
  lastActivityTimestamp: string | null;
}

async function fetchLinearMetrics(apiKey: string): Promise<LinearMetrics> {
  const metrics: LinearMetrics = {
    issueCount: 0,
    backlogIssues: 0,
    todoIssues: 0,
    inProgressIssues: 0,
    doneIssues: 0,
    canceledIssues: 0,
    projectCount: 0,
    lastActivityTimestamp: null,
  };

  try {
    // Linear uses GraphQL API
    const query = `
      query {
        issues(first: 100) {
          nodes {
            id
            updatedAt
            state {
              type
            }
          }
        }
        projects(first: 50) {
          nodes {
            id
          }
        }
      }
    `;

    const response = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    if (response.ok) {
      const data = await response.json();
      const issues = data.data?.issues?.nodes || [];
      const projects = data.data?.projects?.nodes || [];
      
      metrics.issueCount = issues.length;
      metrics.projectCount = projects.length;
      
      for (const issue of issues) {
        const stateType = issue.state?.type?.toLowerCase() || '';
        if (stateType === 'backlog') {
          metrics.backlogIssues++;
        } else if (stateType === 'unstarted' || stateType === 'triage') {
          metrics.todoIssues++;
        } else if (stateType === 'started') {
          metrics.inProgressIssues++;
        } else if (stateType === 'completed') {
          metrics.doneIssues++;
        } else if (stateType === 'canceled') {
          metrics.canceledIssues++;
        }
      }
      
      if (issues.length > 0 && issues[0].updatedAt) {
        metrics.lastActivityTimestamp = issues[0].updatedAt;
      }
    } else {
      console.log('[linear-poll] Failed to fetch issues:', response.status, await response.text());
    }
  } catch (error) {
    console.error('[linear-poll] Error fetching Linear metrics:', error);
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
      .eq('integration_registry.service_name', 'linear')
      .eq('status', 'active');

    if (intError) {
      console.error('[linear-poll] Error fetching integrations:', intError);
      return new Response(JSON.stringify({ error: 'Failed to fetch integrations' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!integrations || integrations.length === 0) {
      return new Response(JSON.stringify({ message: 'No Linear integrations found', processed: 0 }), {
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
          .eq('service_name', 'linear')
          .single();

        const now = new Date();
        if (state?.next_poll_after && new Date(state.next_poll_after) > now) {
          console.log('[linear-poll] Skipping user (rate limited):', integration.user_id);
          continue;
        }

        const config = integration.config as { api_key?: string } | null;
        if (!config?.api_key) {
          console.error('[linear-poll] Missing credentials for user:', integration.user_id);
          errors.push(`Missing credentials for user ${integration.user_id}`);
          continue;
        }

        const metrics = await fetchLinearMetrics(config.api_key);
        const eventTime = metrics.lastActivityTimestamp || now.toISOString();

        if (metrics.issueCount > 0) {
          await supabase.from('integration_events').insert({
            user_id: integration.user_id,
            user_integration_id: integration.id,
            integration_registry_id: integration.provider_id,
            service_name: 'linear',
            event_type: 'linear.issue_activity',
            occurred_at: eventTime,
            source: 'linear_api_poll',
            metadata: {
              issue_count: metrics.issueCount,
              backlog_issues: metrics.backlogIssues,
              todo_issues: metrics.todoIssues,
              in_progress_issues: metrics.inProgressIssues,
              done_issues: metrics.doneIssues,
              canceled_issues: metrics.canceledIssues,
              project_count: metrics.projectCount,
              poll_timestamp: now.toISOString(),
            },
          });
        }

        await supabase.from('integration_ingestion_state').upsert({
          user_id: integration.user_id,
          user_integration_id: integration.id,
          service_name: 'linear',
          last_polled_at: now.toISOString(),
          last_event_timestamp: eventTime,
          next_poll_after: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
          metadata: { last_metrics: metrics },
          updated_at: now.toISOString(),
        }, { onConflict: 'user_id,user_integration_id,service_name' });

        processedCount++;
        console.log('[linear-poll] Processed user:', integration.user_id, metrics);
      } catch (userError: unknown) {
        const errorMessage = userError instanceof Error ? userError.message : String(userError);
        console.error('[linear-poll] Error processing user:', integration.user_id, userError);
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
    console.error('[linear-poll] Error:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
