
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import {
  createAdminClient,
  createUserClient,
  logEvent,
  postToSlack,
  requireAdmin,
} from '../_shared/integration-utils.ts';

interface AlertRequest {
  message: string;
  title?: string;
  user_id?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const supabaseClient = createUserClient(authHeader);
    
    let adminUserId: string;
    try {
      adminUserId = await requireAdmin(supabaseClient);
    } catch (err) {
      return new Response(
        JSON.stringify({ error: String(err) }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { message, title, user_id }: AlertRequest = await req.json();

    if (!message) {
      return new Response(
        JSON.stringify({ error: 'Message is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const slackWebhookUrl = Deno.env.get('SLACK_WEBHOOK_URL');
    if (!slackWebhookUrl) {
      return new Response(
        JSON.stringify({ error: 'Slack webhook URL not configured' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const slackResult = await postToSlack(message, slackWebhookUrl, title);

    if (!slackResult.success) {
      return new Response(
        JSON.stringify({ error: 'Failed to send Slack alert', details: slackResult.error }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabaseAdmin = createAdminClient();
    await logEvent(supabaseAdmin, {
      service_name: 'slack',
      event_type: 'alert.sent',
      payload: {
        message,
        title: title || null,
        triggered_by: adminUserId,
        target_user_id: user_id || null,
      },
      user_id: user_id || adminUserId,
    });

    return new Response(
      JSON.stringify({
        success: true,
        service: 'slack',
        message: 'Alert sent successfully',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Slack alert error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
