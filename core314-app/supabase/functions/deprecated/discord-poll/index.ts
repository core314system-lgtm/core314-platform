import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface DiscordMetrics {
  guildCount: number;
  channelCount: number;
  memberCount: number;
  lastActivityTimestamp: string | null;
}

async function fetchDiscordMetrics(botToken: string): Promise<DiscordMetrics> {
  const metrics: DiscordMetrics = {
    guildCount: 0,
    channelCount: 0,
    memberCount: 0,
    lastActivityTimestamp: null,
  };

  try {
    // Get guilds the bot is in
    const guildsResponse = await fetch('https://discord.com/api/v10/users/@me/guilds', {
      headers: {
        'Authorization': `Bot ${botToken}`,
      },
    });

    if (guildsResponse.ok) {
      const guilds = await guildsResponse.json();
      metrics.guildCount = guilds.length;
      
      // Get channel count from first guild (limited scope for metadata)
      if (guilds.length > 0) {
        const guildId = guilds[0].id;
        
        const channelsResponse = await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
          headers: {
            'Authorization': `Bot ${botToken}`,
          },
        });

        if (channelsResponse.ok) {
          const channels = await channelsResponse.json();
          metrics.channelCount = channels.length;
        }

        // Get approximate member count
        const guildResponse = await fetch(`https://discord.com/api/v10/guilds/${guildId}?with_counts=true`, {
          headers: {
            'Authorization': `Bot ${botToken}`,
          },
        });

        if (guildResponse.ok) {
          const guildData = await guildResponse.json();
          metrics.memberCount = guildData.approximate_member_count || 0;
        }
      }
      
      metrics.lastActivityTimestamp = new Date().toISOString();
    } else {
      console.log('[discord-poll] Failed to fetch guilds:', guildsResponse.status, await guildsResponse.text());
    }
  } catch (error) {
    console.error('[discord-poll] Error fetching Discord metrics:', error);
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

    const { data: integrations, error: intError } = await supabase
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
      .eq('integration_registry.service_name', 'discord')
      .eq('status', 'active');

    if (intError) {
      console.error('[discord-poll] Error fetching integrations:', intError);
      return new Response(JSON.stringify({ error: 'Failed to fetch integrations' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!integrations || integrations.length === 0) {
      return new Response(JSON.stringify({ message: 'No Discord integrations found', processed: 0 }), {
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
          .eq('user_integration_id', integration.id)
          .eq('service_name', 'discord')
          .single();

        const now = new Date();
        if (state?.next_poll_after && new Date(state.next_poll_after) > now) {
          console.log('[discord-poll] Skipping user (rate limited):', integration.user_id);
          continue;
        }

        const config = integration.config as { bot_token?: string } | null;
        if (!config?.bot_token) {
          console.error('[discord-poll] Missing credentials for user:', integration.user_id);
          errors.push(`Missing credentials for user ${integration.user_id}`);
          continue;
        }

        const metrics = await fetchDiscordMetrics(config.bot_token);
        const eventTime = metrics.lastActivityTimestamp || now.toISOString();

        if (metrics.guildCount > 0) {
          await supabase.from('integration_events').insert({
            user_id: integration.user_id,
            user_integration_id: integration.id,
            integration_registry_id: integration.provider_id,
            service_name: 'discord',
            event_type: 'discord.guild_activity',
            occurred_at: eventTime,
            source: 'discord_api_poll',
            metadata: {
              guild_count: metrics.guildCount,
              channel_count: metrics.channelCount,
              member_count: metrics.memberCount,
              poll_timestamp: now.toISOString(),
            },
          });
        }

        await supabase.from('integration_ingestion_state').upsert({
          user_id: integration.user_id,
          user_integration_id: integration.id,
          service_name: 'discord',
          last_polled_at: now.toISOString(),
          last_event_timestamp: eventTime,
          next_poll_after: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
          metadata: { last_metrics: metrics },
          updated_at: now.toISOString(),
        }, { onConflict: 'user_id,user_integration_id,service_name' });

        processedCount++;
        console.log('[discord-poll] Processed user:', integration.user_id, metrics);
      } catch (userError: unknown) {
        const errorMessage = userError instanceof Error ? userError.message : String(userError);
        console.error('[discord-poll] Error processing user:', integration.user_id, userError);
        errors.push(`Error for user ${integration.user_id}: ${errorMessage}`);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      processed: processedCount,
      total: integrations.length,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[discord-poll] Error:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
