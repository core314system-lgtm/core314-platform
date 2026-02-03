import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
async function fetchSlackMetrics(accessToken: string): Promise<SlackMetrics> {
  const metrics: SlackMetrics = {
    messageCount: 0,
    channelCount: 0,
    activeChannels: 0,
    lastActivityTimestamp: null,
    workspaceInfo: {
      teamId: null,
      teamName: null,
    },
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

    // 2. Get list of channels the bot/user is a member of
    const channelsResponse = await fetch('https://slack.com/api/conversations.list?types=public_channel,private_channel&limit=200', {
      method: 'GET',
      headers,
    });

    if (channelsResponse.ok) {
      const channelsData = await channelsResponse.json();
      if (channelsData.ok && channelsData.channels) {
        const channels: SlackChannel[] = channelsData.channels;
        metrics.channelCount = channels.length;
        
        // Count channels where the user/bot is a member
        const memberChannels = channels.filter(ch => ch.is_member);
        metrics.activeChannels = memberChannels.length;

        // 3. Get message history from up to 5 most active channels
        // to calculate message volume (last 7 days)
        const now = Math.floor(Date.now() / 1000);
        const weekAgo = now - (7 * 24 * 60 * 60);
        let latestTimestamp: number | null = null;

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

        if (latestTimestamp) {
          metrics.lastActivityTimestamp = new Date(latestTimestamp * 1000).toISOString();
        }
      }
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

        // Retrieve access token from vault
        const { data: tokenData } = await supabase
          .from('vault.decrypted_secrets')
          .select('decrypted_secret')
          .eq('id', integration.access_token_secret_id)
          .single();

        if (!tokenData?.decrypted_secret) {
          console.error('[slack-poll] No access token found for user:', integration.user_id);
          errors.push(`No token for user ${integration.user_id}`);
          continue;
        }

        const accessToken = tokenData.decrypted_secret;

        // Note: Slack tokens don't expire unless revoked, but check anyway
        if (integration.expires_at && new Date(integration.expires_at) < now) {
          console.log('[slack-poll] Token expired for user:', integration.user_id);
          errors.push(`Token expired for user ${integration.user_id}`);
          continue;
        }

        // Fetch Slack metrics
        const metrics = await fetchSlackMetrics(accessToken);
        const eventTime = metrics.lastActivityTimestamp || now.toISOString();

        // Insert message activity event
        if (metrics.messageCount > 0) {
          await supabase.from('integration_events').insert({
            user_id: integration.user_id,
            user_integration_id: integration.user_integration_id,
            integration_registry_id: integration.integration_registry_id,
            service_name: 'slack',
            event_type: 'slack.message_activity',
            occurred_at: eventTime,
            source: 'slack_api_poll',
            metadata: {
              message_count: metrics.messageCount,
              channels_sampled: Math.min(metrics.activeChannels, 5),
              poll_timestamp: now.toISOString(),
            },
          });
        }

        // Insert channel activity event
        if (metrics.channelCount > 0) {
          await supabase.from('integration_events').insert({
            user_id: integration.user_id,
            user_integration_id: integration.user_integration_id,
            integration_registry_id: integration.integration_registry_id,
            service_name: 'slack',
            event_type: 'slack.channel_activity',
            occurred_at: eventTime,
            source: 'slack_api_poll',
            metadata: {
              total_channels: metrics.channelCount,
              active_channels: metrics.activeChannels,
              poll_timestamp: now.toISOString(),
            },
          });
        }

        // Insert workspace activity event
        if (metrics.workspaceInfo.teamId) {
          await supabase.from('integration_events').insert({
            user_id: integration.user_id,
            user_integration_id: integration.user_integration_id,
            integration_registry_id: integration.integration_registry_id,
            service_name: 'slack',
            event_type: 'slack.workspace_activity',
            occurred_at: eventTime,
            source: 'slack_api_poll',
            metadata: {
              team_id: metrics.workspaceInfo.teamId,
              team_name: metrics.workspaceInfo.teamName,
              poll_timestamp: now.toISOString(),
            },
          });
        }

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
