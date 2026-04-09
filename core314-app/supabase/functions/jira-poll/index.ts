import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { withSentry } from '../_shared/sentry.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(withSentry(async (req) => {
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
        access_token_secret_id, expires_at,
        integration_registry!inner ( service_name )
      `)
      .eq('integration_registry.service_name', 'jira');

    if (!integrations || integrations.length === 0) {
      return new Response(JSON.stringify({ message: 'No Jira integrations found', processed: 0 }), {
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
          .eq('service_name', 'jira')
          .single();

        const now = new Date();
        if (state?.next_poll_after && new Date(state.next_poll_after) > now) continue;

        // Get credentials from vault (stored as JSON)
        const { data: credentialJson } = await supabase
          .rpc('get_decrypted_secret', { secret_id: integration.access_token_secret_id });

        if (!credentialJson) { errors.push(`No credentials for user ${integration.user_id}`); continue; }

        let credentials: { domain: string; email: string; api_token: string };
        try {
          credentials = JSON.parse(credentialJson);
        } catch {
          errors.push(`Invalid credentials format for user ${integration.user_id}`);
          continue;
        }

        const headers = {
          'Authorization': `Basic ${btoa(`${credentials.email}:${credentials.api_token}`)}`,
          'Accept': 'application/json',
        };

        // Fetch recent issues updated in last 7 days
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const jqlQuery = encodeURIComponent(`updated >= "${weekAgo}" ORDER BY updated DESC`);

        const issuesResponse = await fetch(
          `https://${credentials.domain}/rest/api/3/search?jql=${jqlQuery}&maxResults=100&fields=status,priority,assignee,issuetype,summary,updated,created`,
          { headers }
        );

        if (!issuesResponse.ok) {
          errors.push(`Jira API error for user ${integration.user_id}: ${issuesResponse.status}`);
          continue;
        }

        const issuesData = await issuesResponse.json();
        const issues = issuesData.issues || [];

        // Calculate metrics
        const totalIssues = issues.length;
        const statusCounts: Record<string, number> = {};
        const priorityCounts: Record<string, number> = {};
        const typeCounts: Record<string, number> = {};
        let overdueCount = 0;

        for (const issue of issues) {
          const fields = issue.fields || {};
          const statusName = fields.status?.name || 'Unknown';
          const priorityName = fields.priority?.name || 'None';
          const typeName = fields.issuetype?.name || 'Unknown';

          statusCounts[statusName] = (statusCounts[statusName] || 0) + 1;
          priorityCounts[priorityName] = (priorityCounts[priorityName] || 0) + 1;
          typeCounts[typeName] = (typeCounts[typeName] || 0) + 1;

          // Check for overdue (simple heuristic: open issues older than 14 days)
          if (!['Done', 'Closed', 'Resolved'].includes(statusName)) {
            const created = new Date(fields.created);
            if (now.getTime() - created.getTime() > 14 * 24 * 60 * 60 * 1000) {
              overdueCount++;
            }
          }
        }

        const doneCount = (statusCounts['Done'] || 0) + (statusCounts['Closed'] || 0) + (statusCounts['Resolved'] || 0);
        const inProgressCount = statusCounts['In Progress'] || 0;

        await supabase.from('integration_events').insert({
          user_id: integration.user_id,
          user_integration_id: integration.user_integration_id,
          integration_registry_id: integration.integration_registry_id,
          service_name: 'jira',
          event_type: 'jira.weekly_summary',
          occurred_at: now.toISOString(),
          source: 'jira_api_poll',
          metadata: {
            total_issues_updated: totalIssues,
            total_results: issuesData.total || totalIssues,
            status_breakdown: statusCounts,
            priority_breakdown: priorityCounts,
            type_breakdown: typeCounts,
            done_count: doneCount,
            in_progress_count: inProgressCount,
            overdue_count: overdueCount,
            poll_timestamp: now.toISOString(),
            period: '7_days',
          },
        });

        await supabase.from('integration_ingestion_state').upsert({
          user_id: integration.user_id,
          user_integration_id: integration.user_integration_id,
          service_name: 'jira',
          last_polled_at: now.toISOString(),
          next_poll_after: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
          metadata: { total_issues: totalIssues, done: doneCount, in_progress: inProgressCount, overdue: overdueCount },
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
    console.error('[jira-poll] Error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}, { name: 'jira-poll' }));
