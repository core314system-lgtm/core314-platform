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
      .eq('integration_registry.service_name', 'microsoft_teams');

    if (!integrations || integrations.length === 0) {
      return new Response(JSON.stringify({ message: 'No Microsoft Teams integrations found', processed: 0 }), {
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
          .eq('service_name', 'microsoft_teams')
          .single();

        const now = new Date();
        if (state?.next_poll_after && new Date(state.next_poll_after) > now) continue;

        const { data: accessToken } = await supabase
          .rpc('get_decrypted_secret', { secret_id: integration.access_token_secret_id });

        if (!accessToken) { errors.push(`No token for user ${integration.user_id}`); continue; }

        // Refresh token if expired
        if (integration.expires_at && new Date(integration.expires_at) < now && integration.refresh_token_secret_id) {
          const { data: refreshToken } = await supabase.rpc('get_decrypted_secret', { secret_id: integration.refresh_token_secret_id });
          if (refreshToken) {
            const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                grant_type: 'refresh_token', refresh_token: refreshToken,
                client_id: Deno.env.get('TEAMS_CLIENT_ID') ?? '',
                client_secret: Deno.env.get('TEAMS_CLIENT_SECRET') ?? '',
                scope: 'openid profile offline_access User.Read Team.ReadBasic.All Channel.ReadBasic.All',
              }),
            });
            if (tokenResponse.ok) {
              const tokenData = await tokenResponse.json();
              const { data: newSecretId } = await supabase.rpc('vault_create_secret', { secret: tokenData.access_token });
              await supabase.from('oauth_tokens').update({
                access_token_secret_id: newSecretId,
                expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
              }).eq('id', integration.id);
            }
          }
        }

        const graphHeaders = {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        };

        // Fetch joined teams
        const teamsResponse = await fetch('https://graph.microsoft.com/v1.0/me/joinedTeams', {
          headers: graphHeaders,
        });

        let totalTeams = 0;
        let totalChannels = 0;
        const teamSummary: { name: string; channels: number }[] = [];

        if (teamsResponse.ok) {
          const teamsData = await teamsResponse.json();
          const teams = teamsData.value || [];
          totalTeams = teams.length;

          // Fetch channels for up to 5 teams
          for (const team of teams.slice(0, 5)) {
            await new Promise(resolve => setTimeout(resolve, 200));

            const channelsResponse = await fetch(
              `https://graph.microsoft.com/v1.0/teams/${team.id}/channels`,
              { headers: graphHeaders }
            );

            if (channelsResponse.ok) {
              const channelsData = await channelsResponse.json();
              const channelCount = channelsData.value?.length || 0;
              totalChannels += channelCount;
              teamSummary.push({ name: team.displayName, channels: channelCount });
            }
          }
        }

        // Fetch user profile for context
        const profileResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
          headers: graphHeaders,
        });

        let displayName = '';
        if (profileResponse.ok) {
          const profileData = await profileResponse.json();
          displayName = profileData.displayName || '';
        }

        await supabase.from('integration_events').insert({
          user_id: integration.user_id,
          user_integration_id: integration.user_integration_id,
          integration_registry_id: integration.integration_registry_id,
          service_name: 'microsoft_teams',
          event_type: 'teams.workspace_summary',
          occurred_at: now.toISOString(),
          source: 'teams_api_poll',
          metadata: {
            total_teams: totalTeams,
            total_channels: totalChannels,
            team_summary: teamSummary,
            user_display_name: displayName,
            poll_timestamp: now.toISOString(),
          },
        });

        await supabase.from('integration_ingestion_state').upsert({
          user_id: integration.user_id,
          user_integration_id: integration.user_integration_id,
          service_name: 'microsoft_teams',
          last_polled_at: now.toISOString(),
          next_poll_after: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
          metadata: { teams: totalTeams, channels: totalChannels },
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
    console.error('[teams-poll] Error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
