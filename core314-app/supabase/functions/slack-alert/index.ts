
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { withSentry, breadcrumb, handleSentryTest, jsonError } from "../_shared/sentry.ts";
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

serve(withSentry(async (req) => {
  const testResponse = await handleSentryTest(req);
  if (testResponse) return testResponse;

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

    const forceFailure = req.headers.get('X-Force-Failure');
    if (forceFailure && Deno.env.get('ENVIRONMENT') === 'development') {
      const mockErrors: Record<string, { status: number; code: string; message: string }> = {
        auth: { status: 401, code: 'invalid_token', message: 'Token expired' },
        rate_limit: { status: 429, code: 'rate_limit_exceeded', message: 'Too many requests' },
        network: { status: 503, code: 'service_unavailable', message: 'Service temporarily unavailable' },
        data: { status: 400, code: 'validation_error', message: 'Invalid payload structure' }
      };
      
      const mockError = mockErrors[forceFailure];
      if (mockError) {
        const supabaseAdmin = createAdminClient();
        const { data: eventData } = await supabaseAdmin
          .from('integration_events')
          .insert({
            service_name: 'slack',
            event_type: 'alert.failed',
            status: 'error',
            error_code: mockError.code,
            error_message: mockError.message,
            http_status: mockError.status,
            payload: { message, title, forced: true },
            user_id: adminUserId,
          })
          .select()
          .single();
        
        if (eventData) {
          const supabaseUrl = Deno.env.get('SUPABASE_URL');
          const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
          const internalToken = Deno.env.get('INTERNAL_WEBHOOK_TOKEN');
          
          try {
            await fetch(`${supabaseUrl}/functions/v1/integration-self-heal`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${supabaseAnonKey}`,
                'X-Internal-Token': internalToken || '',
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                mode: 'webhook',
                event_id: eventData.id,
                service_name: 'slack',
                http_status: mockError.status,
                error_code: mockError.code,
                error_message: mockError.message,
                retry_count: 0,
                user_id: adminUserId
              })
            });
          } catch (err) {
            console.error('Failed to call self-heal:', err);
          }
        }
        
        return new Response(
          JSON.stringify({ error: mockError.message, forced: true }),
          {
            status: mockError.status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
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
}, { name: "slack-alert" }));