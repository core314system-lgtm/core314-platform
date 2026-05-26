import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface GitLabMetrics {
  projectCount: number;
  openIssues: number;
  openMergeRequests: number;
  lastActivityTimestamp: string | null;
}

async function fetchGitLabMetrics(token: string, baseUrl: string = 'https://gitlab.com'): Promise<GitLabMetrics> {
  const metrics: GitLabMetrics = {
    projectCount: 0,
    openIssues: 0,
    openMergeRequests: 0,
    lastActivityTimestamp: null,
  };

  try {
    // Get user's projects
    const projectsResponse = await fetch(`${baseUrl}/api/v4/projects?membership=true&per_page=100&order_by=updated_at`, {
      headers: {
        'PRIVATE-TOKEN': token,
      },
    });

    if (projectsResponse.ok) {
      const projects = await projectsResponse.json();
      metrics.projectCount = projects.length;
      
      // Sum open issues across projects
      for (const project of projects) {
        metrics.openIssues += project.open_issues_count || 0;
      }
      
      if (projects.length > 0 && projects[0].last_activity_at) {
        metrics.lastActivityTimestamp = projects[0].last_activity_at;
      }

      // Get open MRs for the user
      const mrsResponse = await fetch(`${baseUrl}/api/v4/merge_requests?state=opened&scope=created_by_me&per_page=1`, {
        headers: {
          'PRIVATE-TOKEN': token,
        },
      });

      if (mrsResponse.ok) {
        const totalHeader = mrsResponse.headers.get('x-total');
        metrics.openMergeRequests = totalHeader ? parseInt(totalHeader, 10) : 0;
      }
    } else {
      console.log('[gitlab-poll] Failed to fetch projects:', projectsResponse.status, await projectsResponse.text());
    }
  } catch (error) {
    console.error('[gitlab-poll] Error fetching GitLab metrics:', error);
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
      .eq('integration_registry.service_name', 'gitlab')
      .eq('status', 'active');

    if (intError) {
      console.error('[gitlab-poll] Error fetching integrations:', intError);
      return new Response(JSON.stringify({ error: 'Failed to fetch integrations' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!integrations || integrations.length === 0) {
      return new Response(JSON.stringify({ message: 'No GitLab integrations found', processed: 0 }), {
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
          .eq('service_name', 'gitlab')
          .single();

        const now = new Date();
        if (state?.next_poll_after && new Date(state.next_poll_after) > now) {
          console.log('[gitlab-poll] Skipping user (rate limited):', integration.user_id);
          continue;
        }

        const config = integration.config as { access_token?: string; base_url?: string } | null;
        if (!config?.access_token) {
          console.error('[gitlab-poll] Missing credentials for user:', integration.user_id);
          errors.push(`Missing credentials for user ${integration.user_id}`);
          continue;
        }

        const metrics = await fetchGitLabMetrics(config.access_token, config.base_url || 'https://gitlab.com');
        const eventTime = metrics.lastActivityTimestamp || now.toISOString();

        if (metrics.projectCount > 0) {
          await supabase.from('integration_events').insert({
            user_id: integration.user_id,
            user_integration_id: integration.id,
            integration_registry_id: integration.provider_id,
            service_name: 'gitlab',
            event_type: 'gitlab.project_activity',
            occurred_at: eventTime,
            source: 'gitlab_api_poll',
            metadata: {
              project_count: metrics.projectCount,
              open_issues: metrics.openIssues,
              open_merge_requests: metrics.openMergeRequests,
              poll_timestamp: now.toISOString(),
            },
          });
        }

        await supabase.from('integration_ingestion_state').upsert({
          user_id: integration.user_id,
          user_integration_id: integration.id,
          service_name: 'gitlab',
          last_polled_at: now.toISOString(),
          last_event_timestamp: eventTime,
          next_poll_after: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
          metadata: { last_metrics: metrics },
          updated_at: now.toISOString(),
        }, { onConflict: 'user_id,user_integration_id,service_name' });

        processedCount++;
        console.log('[gitlab-poll] Processed user:', integration.user_id, metrics);
      } catch (userError: unknown) {
        const errorMessage = userError instanceof Error ? userError.message : String(userError);
        console.error('[gitlab-poll] Error processing user:', integration.user_id, userError);
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
    console.error('[gitlab-poll] Error:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
