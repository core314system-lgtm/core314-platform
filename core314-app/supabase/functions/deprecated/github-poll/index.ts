import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface GitHubMetrics {
  repoCount: number;
  openIssues: number;
  openPullRequests: number;
  lastActivityTimestamp: string | null;
}

async function fetchGitHubMetrics(token: string): Promise<GitHubMetrics> {
  const metrics: GitHubMetrics = {
    repoCount: 0,
    openIssues: 0,
    openPullRequests: 0,
    lastActivityTimestamp: null,
  };

  try {
    // Get user's repos
    const reposResponse = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Core314-Integration',
      },
    });

    if (reposResponse.ok) {
      const repos = await reposResponse.json();
      metrics.repoCount = repos.length;
      
      // Sum open issues across repos
      for (const repo of repos) {
        metrics.openIssues += repo.open_issues_count || 0;
      }
      
      if (repos.length > 0 && repos[0].updated_at) {
        metrics.lastActivityTimestamp = repos[0].updated_at;
      }

      // Get open PRs for the user
      const prsResponse = await fetch('https://api.github.com/search/issues?q=is:pr+is:open+author:@me&per_page=1', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Core314-Integration',
        },
      });

      if (prsResponse.ok) {
        const prsData = await prsResponse.json();
        metrics.openPullRequests = prsData.total_count || 0;
      }
    } else {
      console.log('[github-poll] Failed to fetch repos:', reposResponse.status, await reposResponse.text());
    }
  } catch (error) {
    console.error('[github-poll] Error fetching GitHub metrics:', error);
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
      .eq('integration_registry.service_name', 'github')
      .eq('status', 'active');

    if (intError) {
      console.error('[github-poll] Error fetching integrations:', intError);
      return new Response(JSON.stringify({ error: 'Failed to fetch integrations' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!integrations || integrations.length === 0) {
      return new Response(JSON.stringify({ message: 'No GitHub integrations found', processed: 0 }), {
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
          .eq('service_name', 'github')
          .single();

        const now = new Date();
        if (state?.next_poll_after && new Date(state.next_poll_after) > now) {
          console.log('[github-poll] Skipping user (rate limited):', integration.user_id);
          continue;
        }

        const config = integration.config as { access_token?: string } | null;
        if (!config?.access_token) {
          console.error('[github-poll] Missing credentials for user:', integration.user_id);
          errors.push(`Missing credentials for user ${integration.user_id}`);
          continue;
        }

        const metrics = await fetchGitHubMetrics(config.access_token);
        const eventTime = metrics.lastActivityTimestamp || now.toISOString();

        if (metrics.repoCount > 0) {
          await supabase.from('integration_events').insert({
            user_id: integration.user_id,
            user_integration_id: integration.id,
            integration_registry_id: integration.provider_id,
            service_name: 'github',
            event_type: 'github.repo_activity',
            occurred_at: eventTime,
            source: 'github_api_poll',
            metadata: {
              repo_count: metrics.repoCount,
              open_issues: metrics.openIssues,
              open_pull_requests: metrics.openPullRequests,
              poll_timestamp: now.toISOString(),
            },
          });
        }

        await supabase.from('integration_ingestion_state').upsert({
          user_id: integration.user_id,
          user_integration_id: integration.id,
          service_name: 'github',
          last_polled_at: now.toISOString(),
          last_event_timestamp: eventTime,
          next_poll_after: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
          metadata: { last_metrics: metrics },
          updated_at: now.toISOString(),
        }, { onConflict: 'user_id,user_integration_id,service_name' });

        processedCount++;
        console.log('[github-poll] Processed user:', integration.user_id, metrics);
      } catch (userError: unknown) {
        const errorMessage = userError instanceof Error ? userError.message : String(userError);
        console.error('[github-poll] Error processing user:', integration.user_id, userError);
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
    console.error('[github-poll] Error:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
