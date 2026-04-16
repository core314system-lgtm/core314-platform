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
  channelsAnalyzed: number;
  lastActivityTimestamp: string | null;
  workspaceInfo: {
    teamId: string | null;
    teamName: string | null;
  };
  // Enhanced metrics for operational intelligence
  channelActivity: { name: string; messages: number; id: string }[];
  avgResponseTimeMinutes: number | null;
  uniqueUsers: number;
  // Production hardening: data completeness & scope tracking
  privateChannelsAccessible: boolean;
  scopeWarning: string | null;
  ingestionWindowDays: number;
  apiErrors: string[];
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
// Maximum number of member channels to fetch history from per poll cycle
const MAX_CHANNELS_TO_ANALYZE = 50;
// Message ingestion window: 90 days for comprehensive signal accuracy
const INGESTION_WINDOW_DAYS = 90;
// Max messages per channel per API call (Slack limit)
const MAX_MESSAGES_PER_CHANNEL = 200;

async function fetchSlackMetrics(accessToken: string, supabase: ReturnType<typeof createClient>, userIntegrationId: string): Promise<SlackMetrics> {
  const metrics: SlackMetrics = {
    messageCount: 0,
    channelCount: 0,
    activeChannels: 0,
    channelsAnalyzed: 0,
    lastActivityTimestamp: null,
    workspaceInfo: {
      teamId: null,
      teamName: null,
    },
    channelActivity: [],
    avgResponseTimeMinutes: null,
    uniqueUsers: 0,
    privateChannelsAccessible: false,
    scopeWarning: null,
    ingestionWindowDays: INGESTION_WINDOW_DAYS,
    apiErrors: [],
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
      } else {
        const errMsg = `team.info API returned ok=false: ${teamData.error || 'unknown'}`;
        console.error('[slack-poll]', errMsg);
        metrics.apiErrors.push(errMsg);
      }
    } else {
      const errMsg = `team.info HTTP error: ${teamResponse.status}`;
      console.error('[slack-poll]', errMsg);
      metrics.apiErrors.push(errMsg);
    }

    // Small delay to respect rate limits (Tier 3: ~50 requests/minute)
    await new Promise(resolve => setTimeout(resolve, 100));

    // 2. Get list of channels using explicit types parameter
    // IMPORTANT: Do not rely on Slack defaults — conversations.list may return empty without explicit types
    // Strategy: Try public_channel + private_channel first; if missing_scope (groups:read not granted),
    // fall back to public_channel only so we still discover public channels.
    const allChannels: SlackChannel[] = [];
    const typesToTry = ['public_channel,private_channel', 'public_channel'];
    let privateChannelScopeAvailable = false;
    
    for (const channelTypes of typesToTry) {
      let cursor: string | undefined = undefined;
      let pageCount = 0;
      let scopeError = false;
      
      do {
        const params = new URLSearchParams({
          types: channelTypes,
          exclude_archived: 'true',
          limit: '1000',
        });
        if (cursor) params.set('cursor', cursor);
        
        console.log('[slack-poll] Calling conversations.list with params:', {
          types: channelTypes,
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
            // If we succeeded with private_channel included, mark scope as available
            if (channelTypes.includes('private_channel')) {
              privateChannelScopeAvailable = true;
            }
          } else if (channelsData.error === 'missing_scope' && channelTypes.includes('private_channel')) {
            // Bot token lacks groups:read scope — will retry with public_channel only
            const scopeMsg = `Private channels inaccessible (missing groups:read scope). Only public channels are monitored. needed: ${channelsData.needed || 'groups:read'}, provided: ${channelsData.provided || 'unknown'}`;
            console.warn('[slack-poll]', scopeMsg);
            metrics.scopeWarning = scopeMsg;
            scopeError = true;
            break;
          } else {
            const errMsg = `conversations.list returned ok=false: ${channelsData.error || 'unknown'}`;
            console.error('[slack-poll]', errMsg);
            metrics.apiErrors.push(errMsg);
            break;
          }
        } else {
          const errBody = await channelsResponse.text();
          const errMsg = `conversations.list HTTP error: ${channelsResponse.status} - ${errBody.slice(0, 200)}`;
          console.error('[slack-poll]', errMsg);
          metrics.apiErrors.push(errMsg);
          break;
        }
        pageCount++;
        if (pageCount > 10) break; // Safety limit: max 10 pages (10000 channels)
        if (cursor) await new Promise(resolve => setTimeout(resolve, 200)); // Rate limit between pages
      } while (cursor);
      
      // If we got channels or didn't hit a scope error, stop trying
      if (allChannels.length > 0 || !scopeError) break;
    }

    metrics.privateChannelsAccessible = privateChannelScopeAvailable;
    console.log('[slack-poll] Channel discovery complete:', {
      total_channels: allChannels.length,
      private_channels_accessible: privateChannelScopeAvailable,
      scope_warning: metrics.scopeWarning || 'none',
    });

    if (allChannels.length > 0) {
        const channels: SlackChannel[] = allChannels;
        metrics.channelCount = channels.length;
        
        // Count channels where the bot is a member
        const memberChannels = channels.filter(ch => ch.is_member);
        metrics.activeChannels = memberChannels.length;

        // 3. Get message history from ALL member channels (up to MAX_CHANNELS_TO_ANALYZE)
        // Extended window: INGESTION_WINDOW_DAYS days for comprehensive signal accuracy
        const now = Math.floor(Date.now() / 1000);
        const ingestionStart = now - (INGESTION_WINDOW_DAYS * 24 * 60 * 60);
        let latestTimestamp: number | null = null;
        const globalUserSet = new Set<string>();
        const channelsToAnalyze = memberChannels.slice(0, MAX_CHANNELS_TO_ANALYZE);
        let channelErrors = 0;

        console.log('[slack-poll] Starting message ingestion:', {
          member_channels: memberChannels.length,
          channels_to_analyze: channelsToAnalyze.length,
          ingestion_window_days: INGESTION_WINDOW_DAYS,
          max_messages_per_channel: MAX_MESSAGES_PER_CHANNEL,
        });

        for (const channel of channelsToAnalyze) {
          await new Promise(resolve => setTimeout(resolve, 200)); // Rate limit delay

          try {
            const historyResponse = await fetch(
              `https://slack.com/api/conversations.history?channel=${channel.id}&oldest=${ingestionStart}&limit=${MAX_MESSAGES_PER_CHANNEL}`,
              { method: 'GET', headers }
            );

            if (historyResponse.ok) {
              const historyData = await historyResponse.json();
              if (historyData.ok && historyData.messages) {
                  const messages: SlackMessage[] = historyData.messages;
                  metrics.messageCount += messages.length;
                  metrics.channelsAnalyzed++;

                  // Track per-channel activity with channel ID for traceability
                  metrics.channelActivity.push({
                    name: channel.name,
                    id: channel.id,
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
              } else if (!historyData.ok) {
                const errMsg = `conversations.history error for #${channel.name} (${channel.id}): ${historyData.error || 'unknown'}`;
                console.error('[slack-poll]', errMsg);
                metrics.apiErrors.push(errMsg);
                channelErrors++;
              }
            } else {
              const errMsg = `conversations.history HTTP ${historyResponse.status} for #${channel.name} (${channel.id})`;
              console.error('[slack-poll]', errMsg);
              metrics.apiErrors.push(errMsg);
              channelErrors++;
            }
          } catch (e) {
            const errMsg = `Exception fetching history for #${channel.name} (${channel.id}): ${e instanceof Error ? e.message : String(e)}`;
            console.error('[slack-poll]', errMsg);
            metrics.apiErrors.push(errMsg);
            channelErrors++;
          }
        }

        // Set unique users from cross-channel deduplicated set
        metrics.uniqueUsers = globalUserSet.size;

        if (latestTimestamp) {
          metrics.lastActivityTimestamp = new Date(latestTimestamp * 1000).toISOString();
        }

        // Data completeness check
        if (metrics.channelsAnalyzed < memberChannels.length) {
          const gap = memberChannels.length - metrics.channelsAnalyzed;
          console.warn(`[slack-poll] DATA COMPLETENESS WARNING: Analyzed ${metrics.channelsAnalyzed} of ${memberChannels.length} member channels (${gap} not analyzed). Max limit: ${MAX_CHANNELS_TO_ANALYZE}, errors: ${channelErrors}`);
        }

        console.log('[slack-poll] Message ingestion complete:', {
          channels_analyzed: metrics.channelsAnalyzed,
          channels_member: memberChannels.length,
          total_messages: metrics.messageCount,
          unique_users: metrics.uniqueUsers,
          channel_errors: channelErrors,
          api_errors_count: metrics.apiErrors.length,
        });
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
        channels_analyzed: metrics.channelsAnalyzed,
        channel_names: channelNames,
        channels_synced_at: new Date().toISOString(),
        workspace_name: metrics.workspaceInfo.teamName,
        workspace_id: metrics.workspaceInfo.teamId,
        // Production hardening: scope and completeness tracking
        private_channels_accessible: metrics.privateChannelsAccessible,
        scope_warning: metrics.scopeWarning,
        ingestion_window_days: metrics.ingestionWindowDays,
        messages_analyzed: metrics.messageCount,
        unique_users_detected: metrics.uniqueUsers,
        last_api_errors: metrics.apiErrors.slice(0, 10), // Store up to 10 recent errors
        data_completeness: metrics.channelsAnalyzed > 0 ? {
          channels_detected: allChannels.length,
          channels_member: allChannels.filter(ch => ch.is_member).length,
          channels_analyzed: metrics.channelsAnalyzed,
          coverage_pct: Math.round((metrics.channelsAnalyzed / Math.max(allChannels.filter(ch => ch.is_member).length, 1)) * 100),
          messages_total: metrics.messageCount,
          ingestion_window_days: metrics.ingestionWindowDays,
        } : null,
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

        // Structured logging: records retrieved
        console.log('[slack-poll] Records retrieved', {
          user_id: integration.user_id,
          message_count: metrics.messageCount,
          active_channels: metrics.activeChannels,
          total_channels: metrics.channelCount,
          channels_analyzed: metrics.channelsAnalyzed,
          unique_users: metrics.uniqueUsers,
          api_errors: metrics.apiErrors.length,
        });

        // Insert consolidated workspace activity event with ALL metrics
        // This event is used by the dashboard to display metrics
        const { error: eventError } = await supabase.from('integration_events').insert({
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
            channels_analyzed: metrics.channelsAnalyzed,
            unique_users: metrics.uniqueUsers,
            avg_response_time_minutes: metrics.avgResponseTimeMinutes !== null ? Math.round(metrics.avgResponseTimeMinutes * 10) / 10 : null,
            channel_activity: metrics.channelActivity,
            // Workspace info
            team_id: metrics.workspaceInfo.teamId,
            team_name: metrics.workspaceInfo.teamName,
            // Production hardening: completeness & scope metadata
            channels_sampled: metrics.channelsAnalyzed,
            ingestion_window_days: metrics.ingestionWindowDays,
            private_channels_accessible: metrics.privateChannelsAccessible,
            scope_warning: metrics.scopeWarning,
            data_complete: metrics.channelsAnalyzed >= metrics.activeChannels,
            api_errors: metrics.apiErrors.length > 0 ? metrics.apiErrors.slice(0, 5) : undefined,
            poll_timestamp: now.toISOString(),
          },
        });

        // Structured logging: write success/failure
        if (eventError) {
          console.error('[slack-poll] Event write FAILED', {
            user_id: integration.user_id, error: eventError.message,
          });
          errors.push(`Event insert error for user ${integration.user_id}: ${eventError.message}`);
        } else {
          console.log('[slack-poll] Event write SUCCESS', {
            user_id: integration.user_id,
            records_written: 1,
            messages: metrics.messageCount,
            channels: metrics.channelCount,
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
        console.log('[slack-poll] Processed user:', integration.user_id, {
          messages: metrics.messageCount,
          channels: metrics.channelCount,
          analyzed: metrics.channelsAnalyzed,
        });
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
