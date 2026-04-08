import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const slackWebhookUrl = Deno.env.get('SLACK_WEBHOOK_URL');

    // Create authenticated client to verify user
    const supabaseAuth = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { request_id } = await req.json();
    if (!request_id) {
      return new Response(
        JSON.stringify({ error: 'Missing request_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch the integration request using service role (bypasses RLS)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { data: requestData, error: fetchError } = await supabaseAdmin
      .from('integration_requests')
      .select('*')
      .eq('id', request_id)
      .single();

    if (fetchError || !requestData) {
      console.error('[notify-integration-request] Failed to fetch request:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Request not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch user profile for context
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('full_name, email')
      .eq('id', requestData.user_id)
      .single();

    console.log('[notify-integration-request] Processing request:', requestData.id);

    // Send Slack notification if webhook is configured
    if (slackWebhookUrl) {
      const slackMessage = {
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: '🚨 New Integration Request',
              emoji: true,
            },
          },
          {
            type: 'section',
            fields: [
              { type: 'mrkdwn', text: `*Integration:*\n${requestData.integration_name}` },
              { type: 'mrkdwn', text: `*Category:*\n${requestData.category}` },
              { type: 'mrkdwn', text: `*User:*\n${profile?.full_name || profile?.email || requestData.user_id}` },
              { type: 'mrkdwn', text: `*URL:*\n${requestData.url || 'N/A'}` },
            ],
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Use Case:*\n${requestData.use_case}`,
            },
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `Request ID: ${requestData.id} | Created: ${new Date(requestData.created_at).toISOString()}`,
              },
            ],
          },
        ],
      };

      try {
        const slackResponse = await fetch(slackWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(slackMessage),
        });

        if (!slackResponse.ok) {
          console.error('[notify-integration-request] Slack webhook failed:', slackResponse.status, await slackResponse.text());
        } else {
          console.log('[notify-integration-request] Slack notification sent successfully');
        }
      } catch (slackErr) {
        console.error('[notify-integration-request] Slack webhook error:', slackErr);
      }
    } else {
      console.warn('[notify-integration-request] SLACK_WEBHOOK_URL not configured, skipping notification');
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Notification processed' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('[notify-integration-request] Unexpected error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
