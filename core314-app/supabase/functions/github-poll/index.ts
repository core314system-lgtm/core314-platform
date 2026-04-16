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
      .eq('integration_registry.service_name', 'github');

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
          .eq('user_integration_id', integration.user_integration_id)
          .eq('service_name', 'github')
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
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Core314-Integration',
        };

        // Fetch authenticated user
        let username = 'Unknown';
        try {
          const userResponse = await fetch('https://api.github.com/user', { headers });
          if (userResponse.ok) {
            const userData = await userResponse.json();
            username = userData.login || 'Unknown';
          }
        } catch (apiErr) {
          console.warn('[github-poll] User fetch error:', apiErr);
        }

        // Fetch repos (recent, sorted by update)
        let totalRepos = 0;
        const repoSummary: { name: string; open_issues: number; stars: number; language: string | null }[] = [];

        try {
          const reposResponse = await fetch(
            'https://api.github.com/user/repos?sort=updated&per_page=30&type=all',
            { headers }
          );

          if (reposResponse.ok) {
            const repos = await reposResponse.json();
            totalRepos = repos.length;

            for (const repo of repos.slice(0, 15)) {
              repoSummary.push({
                name: repo.full_name as string,
                open_issues: (repo.open_issues_count as number) || 0,
                stars: (repo.stargazers_count as number) || 0,
                language: repo.language as string | null,
              });
            }
          }
        } catch (apiErr) {
          console.warn('[github-poll] Repos fetch error:', apiErr);
        }

        // Fetch open pull requests across repos
        let totalOpenPRs = 0;
        let totalOpenIssues = 0;
        let stalePRs = 0;

        try {
          // Search for open PRs authored by user
          const prResponse = await fetch(
            `https://api.github.com/search/issues?q=${encodeURIComponent(`author:${username} is:pr is:open`)}&per_page=30`,
            { headers }
          );

          if (prResponse.ok) {
            const prData = await prResponse.json();
            totalOpenPRs = prData.total_count || 0;

            // Check for stale PRs (> 7 days old)
            const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            for (const pr of (prData.items || [])) {
              if (new Date(pr.created_at as string) < sevenDaysAgo) {
                stalePRs++;
              }
            }
          }
        } catch (apiErr) {
          console.warn('[github-poll] PR search error:', apiErr);
        }

        // Fetch open issues assigned to user
        try {
          const issueResponse = await fetch(
            `https://api.github.com/search/issues?q=${encodeURIComponent(`assignee:${username} is:issue is:open`)}&per_page=5`,
            { headers }
          );

          if (issueResponse.ok) {
            const issueData = await issueResponse.json();
            totalOpenIssues = issueData.total_count || 0;
          }
        } catch (apiErr) {
          console.warn('[github-poll] Issue search error:', apiErr);
        }

        // Fetch recent events (commits, PRs, reviews)
        let recentCommits = 0;
        let recentPRsOpened = 0;
        try {
          const eventsResponse = await fetch(
            `https://api.github.com/users/${username}/events?per_page=50`,
            { headers }
          );

          if (eventsResponse.ok) {
            const events = await eventsResponse.json();
            const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            for (const event of events) {
              if (new Date(event.created_at as string) < sevenDaysAgo) break;
              if (event.type === 'PushEvent') {
                recentCommits += ((event.payload as Record<string, unknown[]>)?.commits || []).length;
              } else if (event.type === 'PullRequestEvent' && (event.payload as Record<string, string>)?.action === 'opened') {
                recentPRsOpened++;
              }
            }
          }
        } catch (apiErr) {
          console.warn('[github-poll] Events fetch error:', apiErr);
        }

        await supabase.from('integration_events').insert({
          user_id: integration.user_id,
          user_integration_id: integration.user_integration_id,
          integration_registry_id: integration.integration_registry_id,
          service_name: 'github',
          event_type: 'github.dev_activity',
          occurred_at: now.toISOString(),
          source: 'github_api_poll',
          metadata: {
            username,
            total_repos: totalRepos,
            open_prs: totalOpenPRs,
            stale_prs: stalePRs,
            open_issues: totalOpenIssues,
            recent_commits_7d: recentCommits,
            recent_prs_opened_7d: recentPRsOpened,
            repo_summary: repoSummary.slice(0, 10),
            poll_timestamp: now.toISOString(),
          },
        });

        await supabase.from('integration_ingestion_state').upsert({
          user_id: integration.user_id,
          user_integration_id: integration.user_integration_id,
          service_name: 'github',
          last_polled_at: now.toISOString(),
          next_poll_after: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
          metadata: { repos: totalRepos, open_prs: totalOpenPRs, open_issues: totalOpenIssues, commits_7d: recentCommits },
          updated_at: now.toISOString(),
        }, { onConflict: 'user_id,user_integration_id,service_name' });

        processedCount++;
      } catch (userError) {
        errors.push(`Error for user ${integration.user_id}: ${(userError as Error).message}`);
      }
    }

    return new Response(JSON.stringify({ success: true, processed: processedCount, total: integrations.length, errors: errors.length > 0 ? errors : undefined }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[github-poll] Error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
