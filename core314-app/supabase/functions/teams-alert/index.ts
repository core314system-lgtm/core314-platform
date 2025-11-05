
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import {
  createAdminClient,
  createUserClient,
  logEvent,
  postToTeams,
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

    const teamsWebhookUrl = Deno.env.get('MICROSOFT_TEAMS_WEBHOOK_URL');
    if (!teamsWebhookUrl) {
      return new Response(
        JSON.stringify({ error: 'Microsoft Teams webhook URL not configured' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const teamsResult = await postToTeams(message, teamsWebhookUrl, title);

    if (!teamsResult.success) {
      return new Response(
        JSON.stringify({ error: 'Failed to send Teams alert', details: teamsResult.error }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabaseAdmin = createAdminClient();
    await logEvent(supabaseAdmin, {
      service_name: 'teams',
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
        service: 'teams',
        message: 'Alert sent successfully',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Teams alert error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
