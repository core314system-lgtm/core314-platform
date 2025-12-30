import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface JiraMetrics {
  issueCount: number;
  openIssues: number;
  inProgressIssues: number;
  doneIssues: number;
  projectCount: number;
  lastActivityTimestamp: string | null;
}

async function fetchJiraMetrics(apiKey: string, domain: string, email: string): Promise<JiraMetrics> {
  const metrics: JiraMetrics = {
    issueCount: 0,
    openIssues: 0,
    inProgressIssues: 0,
    doneIssues: 0,
    projectCount: 0,
    lastActivityTimestamp: null,
  };

  try {
    const auth = btoa(`${email}:${apiKey}`);
    const baseUrl = `https://${domain}.atlassian.net`;

    const projectsResponse = await fetch(`${baseUrl}/rest/api/3/project/search?maxResults=50`, {
      headers: { 
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
      },
    });

    if (projectsResponse.ok) {
      const projectsData = await projectsResponse.json();
      metrics.projectCount = (projectsData.values || []).length;
    }

    const issuesResponse = await fetch(`${baseUrl}/rest/api/3/search?jql=assignee=currentUser()&maxResults=100&fields=status,updated`, {
      headers: { 
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
      },
    });

    if (issuesResponse.ok) {
      const issuesData = await issuesResponse.json();
      const issues = issuesData.issues || [];
      
      metrics.issueCount = issues.length;
      
      for (const issue of issues) {
        const statusCategory = issue.fields?.status?.statusCategory?.key;
        if (statusCategory === 'new' || statusCategory === 'undefined') {
          metrics.openIssues++;
        } else if (statusCategory === 'indeterminate') {
          metrics.inProgressIssues++;
        } else if (statusCategory === 'done') {
          metrics.doneIssues++;
        }
      }
      
      if (issues.length > 0 && issues[0].fields?.updated) {
        metrics.lastActivityTimestamp = issues[0].fields.updated;
      }
    } else {
      console.log('[jira-poll] Failed to fetch issues:', issuesResponse.status, await issuesResponse.text());
    }
  } catch (error) {
    console.error('[jira-poll] Error fetching Jira metrics:', error);
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

    const { data: jiraIntegrations, error: intError } = await supabase
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
      .eq('integration_registry.service_name', 'jira')
      .eq('status', 'active');

    if (intError) {
      console.error('[jira-poll] Error fetching integrations:', intError);
      return new Response(JSON.stringify({ error: 'Failed to fetch integrations' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!jiraIntegrations || jiraIntegrations.length === 0) {
      return new Response(JSON.stringify({ message: 'No Jira integrations found', processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let processedCount = 0;
    const errors: string[] = [];

    for (const integration of jiraIntegrations) {
      try {
        const { data: state } = await supabase
          .from('integration_ingestion_state')
          .select('*')
          .eq('user_id', integration.user_id)
          .eq('user_integration_id', integration.id)
          .eq('service_name', 'jira')
          .single();

        const now = new Date();
        if (state?.next_poll_after && new Date(state.next_poll_after) > now) {
          console.log('[jira-poll] Skipping user (rate limited):', integration.user_id);
          continue;
        }

        const config = integration.config as { api_key?: string; domain?: string; email?: string } | null;
        if (!config?.api_key || !config?.domain) {
          console.error('[jira-poll] Missing credentials for user:', integration.user_id);
          errors.push(`Missing credentials for user ${integration.user_id}`);
          continue;
        }

        const email = config.email || '';
        const metrics = await fetchJiraMetrics(config.api_key, config.domain, email);
        const eventTime = metrics.lastActivityTimestamp || now.toISOString();

        if (metrics.issueCount > 0 || metrics.projectCount > 0) {
          await supabase.from('integration_events').insert({
            user_id: integration.user_id,
            user_integration_id: integration.id,
            integration_registry_id: integration.provider_id,
            service_name: 'jira',
            event_type: 'jira.issue_activity',
            occurred_at: eventTime,
            source: 'jira_api_poll',
            metadata: {
              issue_count: metrics.issueCount,
              open_issues: metrics.openIssues,
              in_progress_issues: metrics.inProgressIssues,
              done_issues: metrics.doneIssues,
              project_count: metrics.projectCount,
              poll_timestamp: now.toISOString(),
            },
          });
        }

        await supabase.from('integration_ingestion_state').upsert({
          user_id: integration.user_id,
          user_integration_id: integration.id,
          service_name: 'jira',
          last_polled_at: now.toISOString(),
          last_event_timestamp: eventTime,
          next_poll_after: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
          metadata: { last_metrics: metrics },
          updated_at: now.toISOString(),
        }, { onConflict: 'user_id,user_integration_id,service_name' });

        processedCount++;
        console.log('[jira-poll] Processed user:', integration.user_id, metrics);
      } catch (userError: unknown) {
        const errorMessage = userError instanceof Error ? userError.message : String(userError);
        console.error('[jira-poll] Error processing user:', integration.user_id, userError);
        errors.push(`Error for user ${integration.user_id}: ${errorMessage}`);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      processed: processedCount,
      total: jiraIntegrations.length,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[jira-poll] Error:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
