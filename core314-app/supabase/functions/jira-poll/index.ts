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
        access_token_secret_id, refresh_token_secret_id, token_type, expires_at,
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

        // Determine auth method: OAuth 2.0 (bearer) or API key (basic auth)
        const tokenType = (integration as Record<string, unknown>).token_type as string | null;
        const isOAuth = tokenType === 'bearer' || tokenType === 'Bearer';

        let fetchHeaders: Record<string, string>;
        let baseUrl: string;

        if (isOAuth) {
          // OAuth 2.0 flow: check if token is expired and refresh if needed
          if (integration.expires_at && new Date(integration.expires_at) < now) {
            console.log('[jira-poll] Token expired for user:', integration.user_id, '- attempting refresh');

            if ((integration as Record<string, unknown>).refresh_token_secret_id) {
              try {
                const refreshResponse = await fetch(
                  `${Deno.env.get('SUPABASE_URL')}/functions/v1/jira-token-refresh`,
                  {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      oauth_token_id: integration.id,
                    }),
                  }
                );

                const refreshResult = await refreshResponse.json();
                if (!refreshResult.success) {
                  errors.push(`Token refresh failed for user ${integration.user_id}: ${refreshResult.error}`);
                  continue;
                }

                // Re-fetch the updated token after refresh
                const { data: updatedToken } = await supabase
                  .from('oauth_tokens')
                  .select('access_token_secret_id')
                  .eq('id', integration.id)
                  .single();

                if (updatedToken) {
                  integration.access_token_secret_id = updatedToken.access_token_secret_id;
                }
              } catch (refreshErr) {
                errors.push(`Token refresh error for user ${integration.user_id}: ${(refreshErr as Error).message}`);
                continue;
              }
            } else {
              errors.push(`Token expired and no refresh token for user ${integration.user_id}`);
              continue;
            }
          }

          // Get OAuth access token from vault
          const { data: accessToken } = await supabase
            .rpc('get_decrypted_secret', { secret_id: integration.access_token_secret_id });

          if (!accessToken) {
            errors.push(`No access token for user ${integration.user_id}`);
            continue;
          }

          // Get cloud_id from user_integrations config
          const { data: userInt } = await supabase
            .from('user_integrations')
            .select('config')
            .eq('id', integration.user_integration_id)
            .single();

          const cloudId = (userInt?.config as Record<string, unknown>)?.cloud_id as string | undefined;

          if (!cloudId) {
            errors.push(`No cloud_id found for user ${integration.user_id}`);
            continue;
          }

          fetchHeaders = {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
          };
          baseUrl = `https://api.atlassian.com/ex/jira/${cloudId}`;
        } else {
          // API key flow (legacy fallback): credentials stored as JSON in vault
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

          fetchHeaders = {
            'Authorization': `Basic ${btoa(`${credentials.email}:${credentials.api_token}`)}`,
            'Accept': 'application/json',
          };
          baseUrl = `https://${credentials.domain}`;
        }

        // Fetch recent issues updated in last 7 days
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const jqlQuery = encodeURIComponent(`updated >= "${weekAgo}" ORDER BY updated DESC`);

        const issuesResponse = await fetch(
          `${baseUrl}/rest/api/3/search?jql=${jqlQuery}&maxResults=100&fields=status,priority,assignee,issuetype,summary,updated,created,duedate,project`,
          { headers: fetchHeaders }
        );

        // Structured logging: API response status
        console.log('[jira-poll] API response', {
          user_id: integration.user_id,
          status: issuesResponse.status,
          ok: issuesResponse.ok,
          auth_method: isOAuth ? 'oauth2' : 'api_key',
        });

        if (!issuesResponse.ok) {
          const errorBody = await issuesResponse.text().catch(() => '');
          console.error('[jira-poll] API FAILED', {
            user_id: integration.user_id, status: issuesResponse.status,
            error_body: errorBody.slice(0, 200),
          });
          errors.push(`Jira API error for user ${integration.user_id}: ${issuesResponse.status} ${errorBody.slice(0, 200)}`);
          continue;
        }

        const issuesData = await issuesResponse.json();
        const issues = issuesData.issues || [];

        // Structured logging: records retrieved
        console.log('[jira-poll] Records retrieved', {
          user_id: integration.user_id,
          issues_returned: issues.length,
          total_results: issuesData.total || issues.length,
        });

        // Calculate metrics
        const totalIssues = issues.length;
        const statusCounts: Record<string, number> = {};
        const priorityCounts: Record<string, number> = {};
        const typeCounts: Record<string, number> = {};
        const projectCounts: Record<string, number> = {};
        const assigneeCounts: Record<string, number> = {};
        let overdueCount = 0;
        let stalledCount = 0;

        const overdueIssueDetails: Array<{
          id: string; key: string; name: string; project: string;
          assignee: string; status: string; priority: string;
          due_date: string | null; days_overdue: number;
          created: string; updated: string;
        }> = [];

        const stalledIssueDetails: Array<{
          id: string; key: string; name: string; project: string;
          assignee: string; status: string; priority: string;
          last_updated: string; days_stalled: number;
        }> = [];

        const projectOverdueCounts: Record<string, number> = {};

        for (const issue of issues) {
          const fields = issue.fields || {};
          const statusName = fields.status?.name || 'Unknown';
          const priorityName = fields.priority?.name || 'None';
          const typeName = fields.issuetype?.name || 'Unknown';
          const projectName = fields.project?.name || 'Unknown';
          const assigneeName = fields.assignee?.displayName || 'Unassigned';
          const dueDate = fields.duedate || null;
          const updatedAt = fields.updated || null;

          statusCounts[statusName] = (statusCounts[statusName] || 0) + 1;
          priorityCounts[priorityName] = (priorityCounts[priorityName] || 0) + 1;
          typeCounts[typeName] = (typeCounts[typeName] || 0) + 1;
          projectCounts[projectName] = (projectCounts[projectName] || 0) + 1;
          assigneeCounts[assigneeName] = (assigneeCounts[assigneeName] || 0) + 1;

          const isOpen = !['Done', 'Closed', 'Resolved'].includes(statusName);

          if (isOpen) {
            let isOverdue = false;
            let daysOverdue = 0;

            if (dueDate) {
              const due = new Date(dueDate);
              if (now.getTime() > due.getTime()) {
                isOverdue = true;
                daysOverdue = Math.floor((now.getTime() - due.getTime()) / (24 * 60 * 60 * 1000));
              }
            } else {
              const created = new Date(fields.created);
              if (now.getTime() - created.getTime() > 14 * 24 * 60 * 60 * 1000) {
                isOverdue = true;
                daysOverdue = Math.floor((now.getTime() - created.getTime()) / (24 * 60 * 60 * 1000)) - 14;
              }
            }

            if (isOverdue) {
              overdueCount++;
              projectOverdueCounts[projectName] = (projectOverdueCounts[projectName] || 0) + 1;
              overdueIssueDetails.push({
                id: issue.id, key: issue.key,
                name: fields.summary || issue.key, project: projectName,
                assignee: assigneeName, status: statusName, priority: priorityName,
                due_date: dueDate, days_overdue: daysOverdue,
                created: fields.created, updated: updatedAt,
              });
            }

            if (updatedAt) {
              const daysSinceUpdate = Math.floor((now.getTime() - new Date(updatedAt).getTime()) / (24 * 60 * 60 * 1000));
              if (daysSinceUpdate > 7) {
                stalledCount++;
                stalledIssueDetails.push({
                  id: issue.id, key: issue.key,
                  name: fields.summary || issue.key, project: projectName,
                  assignee: assigneeName, status: statusName, priority: priorityName,
                  last_updated: updatedAt, days_stalled: daysSinceUpdate,
                });
              }
            }
          }
        }

        const doneCount = (statusCounts['Done'] || 0) + (statusCounts['Closed'] || 0) + (statusCounts['Resolved'] || 0);
        const inProgressCount = statusCounts['In Progress'] || 0;

        const assigneeEntries = Object.entries(assigneeCounts).filter(([name]) => name !== 'Unassigned');
        const avgTasksPerAssignee = assigneeEntries.length > 0
          ? assigneeEntries.reduce((sum, [, count]) => sum + count, 0) / assigneeEntries.length : 0;
        const maxAssignee = assigneeEntries.length > 0
          ? assigneeEntries.reduce((max, entry) => entry[1] > max[1] ? entry : max, assigneeEntries[0]) : null;
        const workloadImbalanceRatio = maxAssignee && avgTasksPerAssignee > 0
          ? maxAssignee[1] / avgTasksPerAssignee : 0;

        const deliveryRiskProjects = Object.entries(projectOverdueCounts)
          .filter(([, count]) => count >= 3)
          .sort((a, b) => b[1] - a[1]);

        const { error: eventError } = await supabase.from('integration_events').insert({
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
            project_breakdown: projectCounts,
            assignee_breakdown: assigneeCounts,
            done_count: doneCount,
            in_progress_count: inProgressCount,
            overdue_count: overdueCount,
            stalled_count: stalledCount,
            overdue_issue_details: overdueIssueDetails.slice(0, 20),
            stalled_issue_details: stalledIssueDetails.slice(0, 20),
            delivery_risk_projects: deliveryRiskProjects,
            workload_imbalance_ratio: Math.round(workloadImbalanceRatio * 100) / 100,
            max_assignee: maxAssignee ? { name: maxAssignee[0], count: maxAssignee[1] } : null,
            avg_tasks_per_assignee: Math.round(avgTasksPerAssignee * 10) / 10,
            unique_assignees: assigneeEntries.length,
            unique_projects: Object.keys(projectCounts).length,
            auth_method: isOAuth ? 'oauth2' : 'api_key',
            poll_timestamp: now.toISOString(),
            period: '7_days',
          },
        });

        // Structured logging: write success/failure
        if (eventError) {
          console.error('[jira-poll] Event write FAILED', {
            user_id: integration.user_id, error: eventError.message,
          });
          errors.push(`Event insert error for user ${integration.user_id}: ${eventError.message}`);
        } else {
          console.log('[jira-poll] Event write SUCCESS', {
            user_id: integration.user_id,
            records_written: 1,
            issues_count: totalIssues,
            overdue: overdueCount,
            stalled: stalledCount,
          });
        }

        await supabase.from('integration_ingestion_state').upsert({
          user_id: integration.user_id,
          user_integration_id: integration.user_integration_id,
          service_name: 'jira',
          last_polled_at: now.toISOString(),
          next_poll_after: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
          metadata: {
            total_issues: totalIssues, done: doneCount, in_progress: inProgressCount,
            overdue: overdueCount, stalled: stalledCount,
            unique_projects: Object.keys(projectCounts).length,
            unique_assignees: assigneeEntries.length,
            auth_method: isOAuth ? 'oauth2' : 'api_key',
          },
          updated_at: now.toISOString(),
        }, { onConflict: 'user_id,user_integration_id,service_name' });

        processedCount++;
      } catch (userError) {
        errors.push(`Error for user ${integration.user_id}: ${(userError as Error).message}`);
      }
    }

    console.log('[jira-poll] Poll complete', {
      processed: processedCount,
      total: integrations.length,
      errors: errors.length,
    });

    return new Response(JSON.stringify({ success: true, processed: processedCount, total: integrations.length, errors: errors.length > 0 ? errors : undefined }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[jira-poll] Error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
