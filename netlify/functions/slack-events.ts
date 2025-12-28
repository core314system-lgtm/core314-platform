import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

interface SlackEvent {
  type: string;
  event?: {
    type: string;
    user?: string;
    channel?: string;
    ts?: string;
    text?: string;
    reaction?: string;
    item?: {
      type: string;
      channel?: string;
      ts?: string;
    };
  };
  team_id?: string;
  event_id?: string;
  event_time?: number;
  challenge?: string;
}

// Verify Slack request signature
function verifySlackSignature(
  signingSecret: string,
  signature: string,
  timestamp: string,
  body: string
): boolean {
  const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 60 * 5;
  if (parseInt(timestamp) < fiveMinutesAgo) {
    return false; // Request is too old
  }

  const sigBasestring = `v0:${timestamp}:${body}`;
  const mySignature = 'v0=' + crypto
    .createHmac('sha256', signingSecret)
    .update(sigBasestring)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(mySignature),
    Buffer.from(signature)
  );
}

export const handler = async (event: any) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  // Handle OPTIONS for CORS
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const body = event.body;
    const slackSignature = event.headers['x-slack-signature'] || event.headers['X-Slack-Signature'];
    const slackTimestamp = event.headers['x-slack-request-timestamp'] || event.headers['X-Slack-Request-Timestamp'];
    const signingSecret = process.env.SLACK_SIGNING_SECRET;

    // Verify signature if signing secret is configured
    if (signingSecret && slackSignature && slackTimestamp) {
      if (!verifySlackSignature(signingSecret, slackSignature, slackTimestamp, body)) {
        console.error('[slack-events] Invalid signature');
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: 'Invalid signature' }),
        };
      }
    }

    const payload: SlackEvent = JSON.parse(body);

    // Handle URL verification challenge
    if (payload.type === 'url_verification' && payload.challenge) {
      console.log('[slack-events] URL verification challenge received');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ challenge: payload.challenge }),
      };
    }

    // Handle event callbacks
    if (payload.type === 'event_callback' && payload.event) {
      const slackEvent = payload.event;
      const eventType = slackEvent.type;
      const teamId = payload.team_id;
      const eventTime = payload.event_time ? new Date(payload.event_time * 1000).toISOString() : new Date().toISOString();

      console.log('[slack-events] Event received:', {
        type: eventType,
        team_id: teamId,
        event_id: payload.event_id,
      });

      // Initialize Supabase client with service role
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseServiceKey) {
        console.error('[slack-events] Missing Supabase credentials');
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: 'Server configuration error' }),
        };
      }

      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Find user by team_id from oauth_tokens metadata
      const { data: tokenRecords, error: tokenError } = await supabase
        .from('oauth_tokens')
        .select(`
          user_id,
          user_integration_id,
          integration_registry_id,
          metadata
        `)
        .filter('metadata->team->id', 'eq', teamId);

      if (tokenError || !tokenRecords || tokenRecords.length === 0) {
        // Try alternative lookup by team_id in metadata
        const { data: altTokenRecords } = await supabase
          .from('oauth_tokens')
          .select(`
            user_id,
            user_integration_id,
            integration_registry_id,
            metadata
          `)
          .not('metadata', 'is', null);

        const matchingRecord = altTokenRecords?.find((record: any) => {
          const metadata = record.metadata;
          return metadata?.team?.id === teamId || metadata?.team === teamId;
        });

        if (!matchingRecord) {
          console.log('[slack-events] No user found for team_id:', teamId);
          // Still return 200 to acknowledge receipt
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ ok: true, message: 'Event received but no matching user' }),
          };
        }

        // Insert event for matched user
        await insertEvent(supabase, matchingRecord, eventType, eventTime, slackEvent, payload);
      } else {
        // Insert event for all matching users (could be multiple users in same workspace)
        for (const tokenRecord of tokenRecords) {
          await insertEvent(supabase, tokenRecord, eventType, eventTime, slackEvent, payload);
        }
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ ok: true }),
      };
    }

    // Unknown event type
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true, message: 'Event type not handled' }),
    };
  } catch (error: any) {
    console.error('[slack-events] Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

async function insertEvent(
  supabase: any,
  tokenRecord: any,
  eventType: string,
  eventTime: string,
  slackEvent: any,
  payload: any
) {
  const metadata: Record<string, any> = {
    channel: slackEvent.channel,
    user: slackEvent.user,
    event_id: payload.event_id,
    team_id: payload.team_id,
  };

  // Add event-specific metadata
  if (eventType === 'reaction_added' || eventType === 'reaction_removed') {
    metadata.reaction = slackEvent.reaction;
    metadata.item = slackEvent.item;
  }

  const { error: insertError } = await supabase
    .from('integration_events')
    .insert({
      user_id: tokenRecord.user_id,
      user_integration_id: tokenRecord.user_integration_id,
      integration_registry_id: tokenRecord.integration_registry_id,
      service_name: 'slack',
      event_type: `slack.${eventType}`,
      occurred_at: eventTime,
      source: 'slack_events_api',
      metadata,
    });

  if (insertError) {
    console.error('[slack-events] Error inserting event:', insertError);
  } else {
    console.log('[slack-events] Event inserted for user:', tokenRecord.user_id);
  }
}
