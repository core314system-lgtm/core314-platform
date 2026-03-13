import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

// Cold start: Log credential presence (never log values)
const slackClientIdPresent = !!Deno.env.get('SLACK_CLIENT_ID');
const slackClientSecretPresent = !!Deno.env.get('SLACK_CLIENT_SECRET');
console.log('[slack-poll] Cold start - Credentials check:', {
  SLACK_CLIENT_ID_present: slackClientIdPresent,
  SLACK_CLIENT_SECRET_present: slackClientSecretPresent,
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface SlackMetrics {
  messageCount: number;
  channelCount: number;
  activeChannels: number;
  lastActivityTimestamp: string | null;
  workspaceInfo: {
    teamId: string | null;
    teamName: string | null;
  };
  // Enhanced metrics for operational intelligence
  channelActivity: { name: string; messages: number }[];
  avgResponseTimeMinutes: number | null;
  uniqueUsers: number;
}

interface SlackChannel {
  id: string;
  name: string;
  is_member: boolean;
  num_members?: number;
  updated?: number;
}

interface SlackMessage {
  ts: string;
  type: string;
  user?: string;
  text?: string;
}

/**
 * Fetch Slack workspace metrics using the Slack Web API
 * Respects rate limits with built-in delays between API calls
 */
async function fetchSlackMetrics(accessToken: string, supabase: ReturnType<typeof createClient>, userIntegrationId: string): Promise<SlackMetrics> {
  const metrics: SlackMetrics = {
    messageCount: 0,
    channelCount: 0,
    activeChannels: 0,
    lastActivityTimestamp: null,
    workspaceInfo: {
      teamId: null,
      teamName: null,
    },
    channelActivity: [],
    avgResponseTimeMinutes: null,
    uniqueUsers: 0,
  };

  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };

  try {
    // 1. Get workspace/team info
    const teamResponse = await fetch('https://slack.com/api/team.info', {
      method: 'GET',
      headers,
    });

    if (teamResponse.ok) {
      const teamData = await teamResponse.json();
      if (teamData.ok && teamData.team) {
        metrics.workspaceInfo.teamId = teamData.team.id;
        metrics.workspaceInfo.teamName = teamData.team.name;
      }
    }

    // Small delay to respect rate limits (Tier 3: ~50 requests/minute)
    await new Promise(resolve => setTimeout(resolve, 100));

    // 2. Get list of channels using explicit types parameter
    // IMPORTANT: Do not rely on Slack defaults — conversations.list may return empty without explicit types
    const allChannels: SlackChannel[] = [];
    let cursor: string | undefined = undefined;
    let pageCount = 0;
    
    do {
      const params = new URLSearchParams({
        types: 'public_channel,private_channel',
        exclude_archived: 'true',
        limit: '1000',
      });
      if (cursor) params.set('cursor', cursor);
      
      console.log('[slack-poll] Calling conversations.list with params:', {
        types: 'public_channel,private_channel',
        exclude_archived: 'true',
        limit: '1000',
        cursor: cursor || '(none)',
        page: pageCount + 1,
      });

      const channelsResponse = await fetch(`https://slack.com/api/conversations.list?${params.toString()}`, {
        method: 'GET',
        headers,
      });

      if (channelsResponse.ok) {
        const channelsData = await channelsResponse.json();
        if (channelsData.ok && channelsData.channels) {
          allChannels.push(...channelsData.channels);
          cursor = channelsData.response_metadata?.next_cursor || undefined;
          if (cursor === '') cursor = undefined;
        } else {
          console.error('[slack-poll] conversations.list returned ok=false:', channelsData.error, channelsData);
          break;
        }
      } else {
        console.error('[slack-poll] conversations.list HTTP error:', channelsResponse.status, await channelsResponse.text());
        break;
      }
      pageCount++;
      if (pageCount > 5) break; // Safety limit: max 5 pages (5000 channels)
      if (cursor) await new Promise(resolve => setTimeout(resolve, 200)); // Rate limit between pages
    } while (cursor);

    console.log('Slack channels detected:', allChannels.length);

    if (allChannels.length > 0) {
        const channels: SlackChannel[] = allChannels;
        metrics.channelCount = channels.length;
        
        // Count channels where the bot is a member
        const memberChannels = channels.filter(ch => ch.is_member);
        metrics.activeChannels = memberChannels.length;

        // 3. Get message history from up to 5 most active channels
        // to calculate message volume (last 7 days)
        const now = Math.floor(Date.now() / 1000);
        const weekAgo = now - (7 * 24 * 60 * 60);
        let latestTimestamp: number | null = null;
        const globalUserSet = new Set<string>();

        for (const channel of memberChannels.slice(0, 5)) {
          await new Promise(resolve => setTimeout(resolve, 200)); // Rate limit delay

          try {
            const historyResponse = await fetch(
              `https://slack.com/api/conversations.history?channel=${channel.id}&oldest=${weekAgo}&limit=100`,
              { method: 'GET', headers }
            );

            if (historyResponse.ok) {
              const historyData = await historyResponse.json();
              if (historyData.ok && historyData.messages) {
                  const messages: SlackMessage[] = historyData.messages;
                  metrics.messageCount += messages.length;

                  // Track per-channel activity
                  metrics.channelActivity.push({
                    name: channel.name,
                    messages: messages.length,
                  });

                  // Track unique users (using global set for cross-channel dedup) and estimate response times
                  const responseTimes: number[] = [];
                  let prevTs: number | null = null;

                  for (const msg of messages) {
                    if (msg.user) globalUserSet.add(msg.user);
                    const ts = parseFloat(msg.ts);
                    if (prevTs !== null && msg.user) {
                      const diffMinutes = Math.abs(prevTs - ts) / 60;
                      if (diffMinutes < 120) { // Only count gaps < 2 hours as responses
                        responseTimes.push(diffMinutes);
                      }
                    }
                    prevTs = ts;
                  }

                  if (responseTimes.length > 0) {
                    const avgResp = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
                    if (metrics.avgResponseTimeMinutes === null) {
                      metrics.avgResponseTimeMinutes = avgResp;
                    } else {
                      metrics.avgResponseTimeMinutes = (metrics.avgResponseTimeMinutes + avgResp) / 2;
                    }
                  }

                  // Track the most recent message timestamp
                  if (messages.length > 0) {
                    const msgTimestamp = parseFloat(messages[0].ts);
                    if (!latestTimestamp || msgTimestamp > latestTimestamp) {
                      latestTimestamp = msgTimestamp;
                    }
                  }
              }
            }
          } catch (e) {
            console.log('[slack-poll] Error fetching history for channel:', channel.id, e);
          }
        }

        // Set unique users from cross-channel deduplicated set
        metrics.uniqueUsers = globalUserSet.size;

        if (latestTimestamp) {
          metrics.lastActivityTimestamp = new Date(latestTimestamp * 1000).toISOString();
        }
    }

    // Store detected channels in the user_integrations config (merge with existing config)
    try {
      const channelNames = allChannels
        .filter(ch => ch.is_member)
        .slice(0, 50)
        .map(ch => ch.name);
      
      // Fetch existing config to merge (avoid overwriting OAuth fields)
      const { data: existingRow } = await supabase
        .from('user_integrations')
        .select('config')
        .eq('id', userIntegrationId)
        .single();
      
      const existingConfig = (existingRow?.config as Record<string, unknown>) || {};
      const mergedConfig = {
        ...existingConfig,
        channels_total: allChannels.length,
        channels_member: allChannels.filter(ch => ch.is_member).length,
        channel_names: channelNames,
        channels_synced_at: new Date().toISOString(),
        workspace_name: metrics.workspaceInfo.teamName,
        workspace_id: metrics.workspaceInfo.teamId,
      };

      await supabase
        .from('user_integrations')
        .update({ config: mergedConfig })
        .eq('id', userIntegrationId);
      
      console.log('[slack-poll] Stored channel data in user_integrations config:', {
        channels_total: allChannels.length,
        channels_member: allChannels.filter(ch => ch.is_member).length,
        channel_names: channelNames,
      });
    } catch (storeError) {
      console.error('[slack-poll] Error storing channels in integration config:', storeError);
    }
  } catch (error) {
    console.error('[slack-poll] Error fetching Slack metrics:', error);
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

    // Fetch all Slack OAuth integrations
    const { data: slackIntegrations, error: intError } = await supabase
      .from('oauth_tokens')
      .select(`
        id,
        user_id,
        user_integration_id,
        integration_registry_id,
        access_token_secret_id,
        expires_at,
        integration_registry!inner (
          service_name
        )
      `)
      .eq('integration_registry.service_name', 'slack');

    if (intError) {
      console.error('[slack-poll] Error fetching integrations:', intError);
      return new Response(JSON.stringify({ error: 'Failed to fetch integrations' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!slackIntegrations || slackIntegrations.length === 0) {
      return new Response(JSON.stringify({ message: 'No Slack integrations found', processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let processedCount = 0;
    const errors: string[] = [];

    for (const integration of slackIntegrations) {
      try {
        // Check rate limiting state
        const { data: state } = await supabase
          .from('integration_ingestion_state')
          .select('*')
          .eq('user_id', integration.user_id)
          .eq('user_integration_id', integration.user_integration_id)
          .eq('service_name', 'slack')
          .single();

        const now = new Date();
        if (state?.next_poll_after && new Date(state.next_poll_after) > now) {
          console.log('[slack-poll] Skipping user (rate limited):', integration.user_id);
          continue;
        }

        // Retrieve access token from vault using RPC function
        const { data: accessToken, error: tokenError } = await supabase
          .rpc('get_decrypted_secret', { secret_id: integration.access_token_secret_id });

        if (tokenError || !accessToken) {
          console.error('[slack-poll] No access token found for user:', integration.user_id, tokenError);
          errors.push(`No token for user ${integration.user_id}`);
          continue;
        }

        // Verify this is a Bot OAuth token (should start with xoxb-)
        const tokenPrefix = accessToken.substring(0, 5);
        console.log('[slack-poll] Token type check for user:', integration.user_id, {
          token_prefix: tokenPrefix,
          is_bot_token: tokenPrefix === 'xoxb-',
          is_user_token: tokenPrefix === 'xoxp-',
        });
        if (tokenPrefix !== 'xoxb-') {
          console.warn('[slack-poll] WARNING: Token for user', integration.user_id, 'is NOT a bot token (prefix:', tokenPrefix + '). Bot tokens (xoxb-) are required for conversations.list. This may cause channel discovery to fail.');
        }

        // Note: Slack tokens don't expire unless revoked, but check anyway
        if (integration.expires_at && new Date(integration.expires_at) < now) {
          console.log('[slack-poll] Token expired for user:', integration.user_id);
          errors.push(`Token expired for user ${integration.user_id}`);
          continue;
        }

        // HARD VERIFICATION: Call auth.test before any data collection
        // This ensures the token is valid and the bot has proper access
        console.log('[slack-poll] Performing auth.test verification for user:', integration.user_id);
        const authTestResponse = await fetch('https://slack.com/api/auth.test', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });
        
        const authTestData = await authTestResponse.json();
        
        if (!authTestData.ok) {
          console.error('[slack-poll] auth.test FAILED for user:', integration.user_id, {
            error: authTestData.error,
          });
          
          // Emit integration_auth_failed event
          await supabase.from('integration_events').insert({
            user_id: integration.user_id,
            user_integration_id: integration.user_integration_id,
            integration_registry_id: integration.integration_registry_id,
            service_name: 'slack',
            event_type: 'integration_auth_failed',
            occurred_at: now.toISOString(),
            source: 'slack_api_poll',
            metadata: {
              error: authTestData.error,
              error_description: authTestData.error_description || null,
              provider: 'slack',
              poll_timestamp: now.toISOString(),
            },
          });
          
          // Update user_integrations status to error
          await supabase
            .from('user_integrations')
            .update({ 
              status: 'error',
              config: {
                error_code: authTestData.error,
                error_message: authTestData.error_description || authTestData.error,
                last_auth_check: now.toISOString(),
              }
            })
            .eq('id', integration.user_integration_id);
          
          errors.push(`Auth failed for user ${integration.user_id}: ${authTestData.error}`);
          continue; // Abort poll for this user
        }
        
        console.log('[slack-poll] auth.test SUCCESS for user:', integration.user_id, {
          team_id: authTestData.team_id,
          team: authTestData.team,
          bot_user_id: authTestData.bot_user_id,
        });

        // Fetch Slack metrics (pass supabase and integration ID for storing channels)
        const metrics = await fetchSlackMetrics(accessToken, supabase, integration.user_integration_id);
        const eventTime = metrics.lastActivityTimestamp || now.toISOString();

        // Insert consolidated workspace activity event with ALL metrics
        // This event is used by the dashboard to display metrics
        await supabase.from('integration_events').insert({
          user_id: integration.user_id,
          user_integration_id: integration.user_integration_id,
          integration_registry_id: integration.integration_registry_id,
          service_name: 'slack',
          event_type: 'slack.workspace_activity',
          occurred_at: eventTime,
          source: 'slack_api_poll',
          metadata: {
            // Metrics for dashboard (matching integration_metric_definitions source_field_path)
            message_count: metrics.messageCount,
            active_channels: metrics.activeChannels,
            total_channels: metrics.channelCount,
            unique_users: metrics.uniqueUsers,
            avg_response_time_minutes: metrics.avgResponseTimeMinutes !== null ? Math.round(metrics.avgResponseTimeMinutes * 10) / 10 : null,
            channel_activity: metrics.channelActivity,
            // Workspace info
            team_id: metrics.workspaceInfo.teamId,
            team_name: metrics.workspaceInfo.teamName,
            // Poll metadata
            channels_sampled: Math.min(metrics.activeChannels, 5),
            poll_timestamp: now.toISOString(),
          },
        });

        // Update ingestion state with 15-minute rate limiting
        await supabase.from('integration_ingestion_state').upsert({
          user_id: integration.user_id,
          user_integration_id: integration.user_integration_id,
          service_name: 'slack',
          last_polled_at: now.toISOString(),
          last_event_timestamp: eventTime,
          next_poll_after: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
          metadata: { last_metrics: metrics },
          updated_at: now.toISOString(),
        }, { onConflict: 'user_id,user_integration_id,service_name' });

        processedCount++;
        console.log('[slack-poll] Processed user:', integration.user_id, metrics);
      } catch (userError: unknown) {
        const errorMessage = userError instanceof Error ? userError.message : String(userError);
        console.error('[slack-poll] Error processing user:', integration.user_id, userError);
        errors.push(`Error for user ${integration.user_id}: ${errorMessage}`);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      processed: processedCount,
      total: slackIntegrations.length,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[slack-poll] Error:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
