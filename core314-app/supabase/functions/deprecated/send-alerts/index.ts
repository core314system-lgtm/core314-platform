
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { withSentry, breadcrumb, handleSentryTest, jsonError } from "../_shared/sentry.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AlertChannel {
  type: 'email' | 'slack' | 'teams';
  config: Record<string, any>;
}

serve(withSentry(async (req) => {
  const testResponse = await handleSentryTest(req);
  if (testResponse) return testResponse;

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const {
      threshold_id,
      metric_name,
      metric_value,
      threshold_value,
      alert_level,
      alert_message,
      channels = ['email'],
    } = body;

    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseClient = createClient(supabaseUrl, serviceKey);

    let actingUserId: string | null = null;

    if (token && token === serviceKey) {
      if (!body?.user_id) {
        throw new Error('user_id required in request body when using service role key');
      }
      actingUserId = body.user_id;
    } else {
      if (!token) {
        throw new Error('Missing authorization header');
      }
      const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
      if (authError || !user) {
        throw new Error('Invalid authentication token');
      }
      actingUserId = user.id;
    }

    if (!metric_name || metric_value === undefined || !alert_level) {
      throw new Error('Missing required fields: metric_name, metric_value, alert_level');
    }

    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('email, full_name')
      .eq('id', actingUserId)
      .single();

    if (profileError || !profile) {
      throw new Error('Failed to fetch user profile');
    }

    const finalAlertMessage = alert_message || 
      `Alert: ${metric_name} is ${metric_value} (threshold: ${threshold_value})`;

    const deliveryStatus: Record<string, any> = {};
    const channelsSent: string[] = [];

    for (const channel of channels) {
      try {
        switch (channel) {
          case 'email':
            await sendEmailAlert({
              to: profile.email,
              name: profile.full_name || profile.email,
              metric_name,
              metric_value,
              threshold_value,
              alert_level,
              alert_message: finalAlertMessage,
            });
            deliveryStatus.email = { success: true, sent_at: new Date().toISOString() };
            channelsSent.push('email');
            break;

          case 'slack':
            await sendSlackAlert({
              user_id: actingUserId,
              metric_name,
              metric_value,
              threshold_value,
              alert_level,
              alert_message: finalAlertMessage,
              supabaseClient,
            });
            deliveryStatus.slack = { success: true, sent_at: new Date().toISOString() };
            channelsSent.push('slack');
            break;

          case 'teams':
            await sendTeamsAlert({
              user_id: actingUserId,
              metric_name,
              metric_value,
              threshold_value,
              alert_level,
              alert_message: finalAlertMessage,
              supabaseClient,
            });
            deliveryStatus.teams = { success: true, sent_at: new Date().toISOString() };
            channelsSent.push('teams');
            break;

          default:
            deliveryStatus[channel] = { success: false, error: 'Unsupported channel' };
        }
      } catch (error) {
        console.error(`Error sending alert to ${channel}:`, error);
        deliveryStatus[channel] = { success: false, error: error.message };
      }
    }

    const { data: alertHistory, error: historyError } = await supabaseClient
      .from('alert_history')
      .insert({
        user_id: actingUserId,
        threshold_id: threshold_id || null,
        metric_name,
        metric_value,
        threshold_value: threshold_value || metric_value,
        alert_level,
        alert_message: finalAlertMessage,
        channels_sent: channelsSent,
        delivery_status: deliveryStatus,
      })
      .select()
      .single();

    if (historyError) {
      console.error('Error storing alert history:', historyError);
    }

    if (threshold_id) {
      const { data: threshold } = await supabaseClient
        .from('metric_thresholds')
        .select('trigger_count')
        .eq('id', threshold_id)
        .single();
      
      await supabaseClient
        .from('metric_thresholds')
        .update({
          last_triggered_at: new Date().toISOString(),
          trigger_count: (threshold?.trigger_count || 0) + 1,
        })
        .eq('id', threshold_id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Alert sent successfully',
        alert_id: alertHistory?.id,
        channels_sent: channelsSent,
        delivery_status: deliveryStatus,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in send-alerts:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error',
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}, { name: "send-alerts" }));

async function sendEmailAlert(params: {
  to: string;
  name: string;
  metric_name: string;
  metric_value: number;
  threshold_value: number;
  alert_level: string;
  alert_message: string;
}) {
  const sendgridApiKey = Deno.env.get('SENDGRID_API_KEY');
  if (!sendgridApiKey) {
    throw new Error('SENDGRID_API_KEY not configured');
  }

  const alertLevelColors: Record<string, string> = {
    info: '#3B82F6',
    warning: '#F59E0B',
    critical: '#EF4444',
  };

  const color = alertLevelColors[params.alert_level] || '#6B7280';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <body style="margin:0;background-color:#f3f4f6;font-family:Arial,sans-serif;padding:40px 20px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;">
          <tr>
            <td style="background:${color};padding:20px;text-align:center;">
              <h1 style="color:#ffffff;margin:0;font-size:24px;">Core314 Alert</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:30px;">
              <p style="font-size:16px;color:#374151;margin:0 0 20px;">Hello ${params.name},</p>
              <p style="font-size:16px;color:#374151;margin:0 0 20px;">${params.alert_message}</p>
              <table width="100%" cellpadding="10" style="background:#f9fafb;border-radius:4px;margin:20px 0;">
                <tr>
                  <td style="font-weight:bold;color:#6b7280;">Metric:</td>
                  <td style="color:#111827;">${params.metric_name}</td>
                </tr>
                <tr>
                  <td style="font-weight:bold;color:#6b7280;">Current Value:</td>
                  <td style="color:#111827;">${params.metric_value}</td>
                </tr>
                <tr>
                  <td style="font-weight:bold;color:#6b7280;">Threshold:</td>
                  <td style="color:#111827;">${params.threshold_value}</td>
                </tr>
                <tr>
                  <td style="font-weight:bold;color:#6b7280;">Alert Level:</td>
                  <td style="color:${color};font-weight:bold;text-transform:uppercase;">${params.alert_level}</td>
                </tr>
              </table>
              <p style="font-size:14px;color:#6b7280;margin:20px 0 0;">
                Log in to your <a href="https://app.core314.com/dashboard" style="color:${color};">Core314 Dashboard</a> to view more details and acknowledge this alert.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f9fafb;padding:20px;text-align:center;border-top:1px solid #e5e7eb;">
              <p style="font-size:12px;color:#9ca3af;margin:0;">
                © 2025 Core314. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${sendgridApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: params.to }] }],
      from: { email: 'alerts@core314.com', name: 'Core314 Alerts' },
      subject: `[${params.alert_level.toUpperCase()}] Core314 Alert: ${params.metric_name}`,
      content: [{ type: 'text/html', value: htmlContent }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`SendGrid error: ${response.status} - ${errorText}`);
  }
}

async function sendSlackAlert(params: {
  user_id: string;
  metric_name: string;
  metric_value: number;
  threshold_value: number;
  alert_level: string;
  alert_message: string;
  supabaseClient: any;
}) {
  const { data: integration, error: integrationError } = await params.supabaseClient
    .from('user_integrations')
    .select('config')
    .eq('user_id', params.user_id)
    .eq('provider_id', (await params.supabaseClient
      .from('integration_registry')
      .select('id')
      .eq('service_name', 'slack')
      .single()).data?.id)
    .eq('status', 'active')
    .single();

  if (integrationError || !integration) {
    throw new Error('Slack integration not configured or inactive');
  }

  console.log('Slack alert would be sent:', params);
}

async function sendTeamsAlert(params: {
  user_id: string;
  metric_name: string;
  metric_value: number;
  threshold_value: number;
  alert_level: string;
  alert_message: string;
  supabaseClient: any;
}) {
  const { data: integration, error: integrationError } = await params.supabaseClient
    .from('user_integrations')
    .select('config')
    .eq('user_id', params.user_id)
    .eq('provider_id', (await params.supabaseClient
      .from('integration_registry')
      .select('id')
      .eq('service_name', 'teams')
      .single()).data?.id)
    .eq('status', 'active')
    .single();

  if (integrationError || !integration) {
    throw new Error('Teams integration not configured or inactive');
  }

  console.log('Teams alert would be sent:', params);
}
