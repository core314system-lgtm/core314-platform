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
      .eq('integration_registry.service_name', 'asana');

    if (!integrations || integrations.length === 0) {
      return new Response(JSON.stringify({ message: 'No Asana integrations found', processed: 0 }), {
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
          .eq('service_name', 'asana')
          .single();

        const now = new Date();
        if (state?.next_poll_after && new Date(state.next_poll_after) > now) continue;

        // Get API token from vault (stored as JSON)
        const { data: credentialJson } = await supabase
          .rpc('get_decrypted_secret', { secret_id: integration.access_token_secret_id });

        if (!credentialJson) { errors.push(`No credentials for user ${integration.user_id}`); continue; }

        let apiToken: string;
        try {
          const parsed = JSON.parse(credentialJson);
          apiToken = parsed.api_token;
        } catch {
          // If it's a plain token string (not JSON), use it directly
          apiToken = credentialJson;
        }

        const headers = {
          'Authorization': `Bearer ${apiToken}`,
          'Accept': 'application/json',
        };

        // Get workspaces
        const workspacesResponse = await fetch('https://app.asana.com/api/1.0/workspaces', { headers });
        if (!workspacesResponse.ok) {
          errors.push(`Asana API error for user ${integration.user_id}: ${workspacesResponse.status}`);
          continue;
        }

        const workspacesData = await workspacesResponse.json();
        const workspaces = workspacesData.data || [];

        let totalProjects = 0;
        let totalTasks = 0;
        let completedTasks = 0;
        let overdueTasks = 0;
        const projectSummary: { name: string; tasks: number }[] = [];

        // Sample first workspace for project/task data
        if (workspaces.length > 0) {
          const workspace = workspaces[0];

          // Get projects
          const projectsResponse = await fetch(
            `https://app.asana.com/api/1.0/workspaces/${workspace.gid}/projects?opt_fields=name,modified_at,archived&limit=20`,
            { headers }
          );

          if (projectsResponse.ok) {
            const projectsData = await projectsResponse.json();
            const projects = (projectsData.data || []).filter((p: Record<string, unknown>) => !p.archived);
            totalProjects = projects.length;

            // Get tasks from up to 3 projects
            for (const project of projects.slice(0, 3)) {
              await new Promise(resolve => setTimeout(resolve, 200));

              const tasksResponse = await fetch(
                `https://app.asana.com/api/1.0/projects/${project.gid}/tasks?opt_fields=name,completed,due_on&limit=100`,
                { headers }
              );

              if (tasksResponse.ok) {
                const tasksData = await tasksResponse.json();
                const tasks = tasksData.data || [];

                totalTasks += tasks.length;
                let projectTaskCount = 0;

                for (const task of tasks) {
                  projectTaskCount++;
                  if (task.completed) {
                    completedTasks++;
                  } else if (task.due_on && new Date(task.due_on as string) < now) {
                    overdueTasks++;
                  }
                }

                projectSummary.push({ name: project.name as string, tasks: projectTaskCount });
              }
            }
          }
        }

        await supabase.from('integration_events').insert({
          user_id: integration.user_id,
          user_integration_id: integration.user_integration_id,
          integration_registry_id: integration.integration_registry_id,
          service_name: 'asana',
          event_type: 'asana.project_summary',
          occurred_at: now.toISOString(),
          source: 'asana_api_poll',
          metadata: {
            total_workspaces: workspaces.length,
            total_projects: totalProjects,
            total_tasks: totalTasks,
            completed_tasks: completedTasks,
            overdue_tasks: overdueTasks,
            completion_rate: totalTasks > 0 ? Math.round(completedTasks / totalTasks * 100) : 0,
            project_summary: projectSummary,
            poll_timestamp: now.toISOString(),
          },
        });

        await supabase.from('integration_ingestion_state').upsert({
          user_id: integration.user_id,
          user_integration_id: integration.user_integration_id,
          service_name: 'asana',
          last_polled_at: now.toISOString(),
          next_poll_after: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
          metadata: { projects: totalProjects, tasks: totalTasks, completed: completedTasks, overdue: overdueTasks },
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
    console.error('[asana-poll] Error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}, { name: 'asana-poll' }));
