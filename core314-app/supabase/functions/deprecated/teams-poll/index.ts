import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface TeamsMetrics {
  chatMessageCount: number;
  channelMessageCount: number;
  meetingCount: number;
  lastActivityTimestamp: string | null;
}

async function fetchTeamsMetrics(accessToken: string): Promise<TeamsMetrics> {
  const metrics: TeamsMetrics = {
    chatMessageCount: 0,
    channelMessageCount: 0,
    meetingCount: 0,
    lastActivityTimestamp: null,
  };

  try {
    const chatsResponse = await fetch('https://graph.microsoft.com/v1.0/me/chats?$top=50', {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (chatsResponse.ok) {
      const chatsData = await chatsResponse.json();
      const chats = chatsData.value || [];
      metrics.chatMessageCount = chats.length;
      if (chats.length > 0 && chats[0].lastUpdatedDateTime) {
        metrics.lastActivityTimestamp = chats[0].lastUpdatedDateTime;
      }
    }

    const teamsResponse = await fetch('https://graph.microsoft.com/v1.0/me/joinedTeams', {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (teamsResponse.ok) {
      const teamsData = await teamsResponse.json();
      const teams = teamsData.value || [];
      for (const team of teams.slice(0, 5)) {
        try {
          const channelsResponse = await fetch(
            `https://graph.microsoft.com/v1.0/teams/${team.id}/channels`,
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
          );
          if (channelsResponse.ok) {
            const channelsData = await channelsResponse.json();
            metrics.channelMessageCount += (channelsData.value || []).length;
          }
        } catch (e) {
          console.log('[teams-poll] Error fetching channels for team:', team.id);
        }
      }
    }

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const calendarUrl = `https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=${weekAgo.toISOString()}&endDateTime=${now.toISOString()}&$filter=isOnlineMeeting eq true&$top=100`;
    
    const calendarResponse = await fetch(calendarUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (calendarResponse.ok) {
      const calendarData = await calendarResponse.json();
      metrics.meetingCount = (calendarData.value || []).length;
    }
  } catch (error) {
    console.error('[teams-poll] Error fetching Teams metrics:', error);
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

    const { data: teamsIntegrations, error: intError } = await supabase
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
      .eq('integration_registry.service_name', 'microsoft_teams');

    if (intError) {
      console.error('[teams-poll] Error fetching integrations:', intError);
      return new Response(JSON.stringify({ error: 'Failed to fetch integrations' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!teamsIntegrations || teamsIntegrations.length === 0) {
      return new Response(JSON.stringify({ message: 'No Teams integrations found', processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let processedCount = 0;
    const errors: string[] = [];

    for (const integration of teamsIntegrations) {
      try {
        const { data: state } = await supabase
          .from('integration_ingestion_state')
          .select('*')
          .eq('user_id', integration.user_id)
          .eq('user_integration_id', integration.user_integration_id)
          .eq('service_name', 'microsoft_teams')
          .single();

        const now = new Date();
        if (state?.next_poll_after && new Date(state.next_poll_after) > now) {
          console.log('[teams-poll] Skipping user (rate limited):', integration.user_id);
          continue;
        }

        const { data: tokenData } = await supabase
          .from('vault.decrypted_secrets')
          .select('decrypted_secret')
          .eq('id', integration.access_token_secret_id)
          .single();

        if (!tokenData?.decrypted_secret) {
          console.error('[teams-poll] No access token found for user:', integration.user_id);
          errors.push(`No token for user ${integration.user_id}`);
          continue;
        }

        const accessToken = tokenData.decrypted_secret;

        if (integration.expires_at && new Date(integration.expires_at) < now) {
          console.log('[teams-poll] Token expired for user:', integration.user_id);
          errors.push(`Token expired for user ${integration.user_id}`);
          continue;
        }

        const metrics = await fetchTeamsMetrics(accessToken);
        const eventTime = metrics.lastActivityTimestamp || now.toISOString();

        if (metrics.chatMessageCount > 0) {
          await supabase.from('integration_events').insert({
            user_id: integration.user_id,
            user_integration_id: integration.user_integration_id,
            integration_registry_id: integration.integration_registry_id,
            service_name: 'microsoft_teams',
            event_type: 'teams.chat_activity',
            occurred_at: eventTime,
            source: 'msgraph_poll',
            metadata: { chat_count: metrics.chatMessageCount, poll_timestamp: now.toISOString() },
          });
        }

        if (metrics.channelMessageCount > 0) {
          await supabase.from('integration_events').insert({
            user_id: integration.user_id,
            user_integration_id: integration.user_integration_id,
            integration_registry_id: integration.integration_registry_id,
            service_name: 'microsoft_teams',
            event_type: 'teams.channel_activity',
            occurred_at: eventTime,
            source: 'msgraph_poll',
            metadata: { channel_count: metrics.channelMessageCount, poll_timestamp: now.toISOString() },
          });
        }

        if (metrics.meetingCount > 0) {
          await supabase.from('integration_events').insert({
            user_id: integration.user_id,
            user_integration_id: integration.user_integration_id,
            integration_registry_id: integration.integration_registry_id,
            service_name: 'microsoft_teams',
            event_type: 'teams.meeting_activity',
            occurred_at: eventTime,
            source: 'msgraph_poll',
            metadata: {
              meeting_count: metrics.meetingCount,
              week_range: { start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(), end: now.toISOString() },
              poll_timestamp: now.toISOString(),
            },
          });
        }

        await supabase.from('integration_ingestion_state').upsert({
          user_id: integration.user_id,
          user_integration_id: integration.user_integration_id,
          service_name: 'microsoft_teams',
          last_polled_at: now.toISOString(),
          last_event_timestamp: eventTime,
          next_poll_after: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
          metadata: { last_metrics: metrics },
          updated_at: now.toISOString(),
        }, { onConflict: 'user_id,user_integration_id,service_name' });

        processedCount++;
        console.log('[teams-poll] Processed user:', integration.user_id, metrics);
      } catch (userError: any) {
        console.error('[teams-poll] Error processing user:', integration.user_id, userError);
        errors.push(`Error for user ${integration.user_id}: ${userError.message}`);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      processed: processedCount,
      total: teamsIntegrations.length,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[teams-poll] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
