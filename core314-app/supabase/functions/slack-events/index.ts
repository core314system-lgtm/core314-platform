import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Slack Events API Receiver
 * Handles incoming webhook events from Slack's Events API
 * Part of Integration Architecture v2.0
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-slack-signature, x-slack-request-timestamp',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Slack event types we handle
const SUPPORTED_EVENT_TYPES = [
  'message',
  'reaction_added',
  'reaction_removed',
  'channel_created',
  'member_joined_channel',
  'member_left_channel',
  'app_mention',
  'file_shared',
];

/**
 * Verify Slack request signature
 * https://api.slack.com/authentication/verifying-requests-from-slack
 */
function verifySlackSignature(
  signingSecret: string,
  signature: string,
  timestamp: string,
  body: string
): boolean {
  // Check timestamp is within 5 minutes to prevent replay attacks
  const currentTime = Math.floor(Date.now() / 1000);
  if (Math.abs(currentTime - parseInt(timestamp)) > 60 * 5) {
    console.log('[slack-events] Request timestamp too old');
    return false;
  }

  const sigBasestring = `v0:${timestamp}:${body}`;
  const mySignature = 'v0=' + createHmac('sha256', signingSecret)
    .update(sigBasestring)
    .digest('hex');

  try {
    return timingSafeEqual(
      Buffer.from(mySignature, 'utf8'),
      Buffer.from(signature, 'utf8')
    );
  } catch {
    return false;
  }
}

/**
 * Find user by Slack team_id from webhook_subscriptions
 */
async function findUserByTeamId(
  supabase: ReturnType<typeof createClient>,
  teamId: string
): Promise<{ userId: string; userIntegrationId: string; integrationRegistryId: string } | null> {
  // First, try to find from webhook_subscriptions
  const { data: subscription } = await supabase
    .from('webhook_subscriptions')
    .select('user_id, user_integration_id')
    .eq('integration_type', 'slack')
    .eq('status', 'active')
    .limit(1);

  if (subscription && subscription.length > 0) {
    // Get integration_registry_id
    const { data: registry } = await supabase
      .from('integration_registry')
      .select('id')
      .eq('service_name', 'slack')
      .single();

    return {
      userId: subscription[0].user_id,
      userIntegrationId: subscription[0].user_integration_id,
      integrationRegistryId: registry?.id || '',
    };
  }

  // Fallback: Find from oauth_tokens by looking up team_id in user_integrations config
  const { data: integrations } = await supabase
    .from('user_integrations')
    .select(`
      id,
      user_id,
      config,
      integration_registry!inner (
        id,
        service_name
      )
    `)
    .eq('integration_registry.service_name', 'slack')
    .eq('status', 'connected');

  if (integrations) {
    for (const integration of integrations) {
      const config = integration.config as Record<string, unknown> | null;
      if (config?.team_id === teamId) {
        return {
          userId: integration.user_id,
          userIntegrationId: integration.id,
          integrationRegistryId: (integration.integration_registry as { id: string }).id,
        };
      }
    }
  }

  // Last resort: Return first connected Slack integration
  // This is a temporary measure until team_id is properly stored
  if (integrations && integrations.length > 0) {
    console.log('[slack-events] Using first connected Slack integration as fallback');
    return {
      userId: integrations[0].user_id,
      userIntegrationId: integrations[0].id,
      integrationRegistryId: (integrations[0].integration_registry as { id: string }).id,
    };
  }

  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const body = await req.text();
    const slackSignature = req.headers.get('x-slack-signature') || '';
    const slackTimestamp = req.headers.get('x-slack-request-timestamp') || '';
    const signingSecret = Deno.env.get('SLACK_SIGNING_SECRET') || '';

    // Verify signature if signing secret is configured
    if (signingSecret) {
      const isValid = verifySlackSignature(signingSecret, slackSignature, slackTimestamp, body);
      if (!isValid) {
        console.error('[slack-events] Invalid signature');
        return new Response(JSON.stringify({ error: 'Invalid signature' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      console.warn('[slack-events] SLACK_SIGNING_SECRET not configured - skipping signature verification');
    }

    const payload = JSON.parse(body);

    // Handle URL verification challenge (required for Slack Events API setup)
    if (payload.type === 'url_verification') {
      console.log('[slack-events] URL verification challenge received');
      return new Response(JSON.stringify({ challenge: payload.challenge }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle event_callback
    if (payload.type === 'event_callback') {
      const event = payload.event;
      const teamId = payload.team_id;
      const eventId = payload.event_id;
      const eventTime = payload.event_time;

      console.log('[slack-events] Received event:', {
        type: event?.type,
        subtype: event?.subtype,
        team_id: teamId,
        event_id: eventId,
      });

      // Find user by team_id
      const userInfo = await findUserByTeamId(supabase, teamId);
      if (!userInfo) {
        console.error('[slack-events] No user found for team_id:', teamId);
        // Still return 200 to acknowledge receipt (Slack will retry otherwise)
        return new Response(JSON.stringify({ ok: true, warning: 'No user found for team' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check for duplicate event (Slack may retry)
      const { data: existingEvent } = await supabase
        .from('integration_events')
        .select('id')
        .eq('metadata->>event_id', eventId)
        .limit(1);

      if (existingEvent && existingEvent.length > 0) {
        console.log('[slack-events] Duplicate event, skipping:', eventId);
        return new Response(JSON.stringify({ ok: true, duplicate: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Determine event type (handle subtypes like message.channels)
      let eventType = event.type;
      if (event.type === 'message' && event.channel_type) {
        eventType = `message.${event.channel_type === 'channel' ? 'channels' : event.channel_type}`;
      }

      // Skip unsupported event types
      const baseType = eventType.split('.')[0];
      if (!SUPPORTED_EVENT_TYPES.includes(baseType)) {
        console.log('[slack-events] Unsupported event type:', eventType);
        return new Response(JSON.stringify({ ok: true, skipped: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Skip bot messages to avoid loops
      if (event.bot_id || event.subtype === 'bot_message') {
        console.log('[slack-events] Skipping bot message');
        return new Response(JSON.stringify({ ok: true, skipped: 'bot_message' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Insert event into integration_events
      // The trigger will automatically extract signals and calculate metrics
      const { error: insertError } = await supabase.from('integration_events').insert({
        user_id: userInfo.userId,
        user_integration_id: userInfo.userIntegrationId,
        integration_registry_id: userInfo.integrationRegistryId,
        service_name: 'slack',
        event_type: eventType,
        occurred_at: new Date(eventTime * 1000).toISOString(),
        source: 'slack_events_api',
        metadata: {
          event_id: eventId,
          team_id: teamId,
          channel: event.channel,
          user: event.user,
          text: event.text?.substring(0, 500), // Truncate long messages
          reaction: event.reaction,
          file_id: event.file_id,
          ts: event.ts,
          thread_ts: event.thread_ts,
        },
      });

      if (insertError) {
        console.error('[slack-events] Error inserting event:', insertError);
        // Still return 200 to prevent Slack retries
        return new Response(JSON.stringify({ ok: true, error: 'Insert failed' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Update webhook subscription last_event_at
      await supabase
        .from('webhook_subscriptions')
        .update({
          last_event_at: new Date().toISOString(),
          last_event_id: eventId,
        })
        .eq('user_id', userInfo.userId)
        .eq('integration_type', 'slack');

      console.log('[slack-events] Event processed successfully:', eventId);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Unknown payload type
    console.log('[slack-events] Unknown payload type:', payload.type);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[slack-events] Error:', error);
    // Return 200 to prevent Slack retries on our errors
    return new Response(JSON.stringify({ ok: true, error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
