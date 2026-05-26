
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as Sentry from 'https://deno.land/x/sentry@7.119.0/index.mjs';
import { withSentry, breadcrumb, handleSentryTest, jsonError } from "../_shared/sentry.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SENTRY_DSN = Deno.env.get('SENTRY_DSN');
const SLACK_WEBHOOK_URL = Deno.env.get('SLACK_WEBHOOK_URL');
const TEAMS_WEBHOOK_URL = Deno.env.get('TEAMS_WEBHOOK_URL') ?? Deno.env.get('MICROSOFT_TEAMS_WEBHOOK_URL');
const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY');
const SENDGRID_FROM = Deno.env.get('SENDGRID_FROM') || 'noreply@core314.com';
const ADMIN_EMAIL = Deno.env.get('ADMIN_EMAIL') || 'admin@core314.com';
const NOTIFICATIONS_TEST_MODE = Deno.env.get('NOTIFICATIONS_TEST_MODE') === 'true';

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: Deno.env.get('ENVIRONMENT') || 'production',
    release: 'phase60-external-notifications',
    tracesSampleRate: 0.1,
  });
}

interface NotificationRequest {
  user_id: string;
  rule_id?: string;
  type: 'alert' | 'notify' | 'info' | 'warning' | 'error';
  title: string;
  message: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  action_url?: string;
  metadata?: Record<string, any>;
  delivery?: 'slack' | 'teams' | 'email' | 'in-app';
  email_to?: string;
}

interface NotificationRecord {
  user_id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  action_url?: string;
  metadata?: string;
}

interface ExternalDeliveryResult {
  channel: string;
  success: boolean;
  message?: string;
  error?: string;
}

async function getAdaptiveRetryDelay(
  supabaseClient: any,
  channel: 'slack' | 'email'
): Promise<number> {
  const ADAPTIVE_OPTIMIZATION_ENABLED = (Deno.env.get('ADAPTIVE_OPTIMIZATION_ENABLED') || 'false').toLowerCase() === 'true';
  
  if (!ADAPTIVE_OPTIMIZATION_ENABLED) {
    return channel === 'slack' ? 2000 : 3000;
  }

  try {
    const { data, error } = await supabaseClient
      .from('fusion_adaptive_reliability')
      .select('recommended_retry_ms')
      .eq('channel', channel)
      .single();

    if (error || !data) {
      const fallback = channel === 'slack' ? 2000 : 3000;
      console.log(`[Adaptive Retry] No data for ${channel}, using fallback: ${fallback}ms`);
      return fallback;
    }

    const adaptiveDelay = Math.max(500, Math.min(10000, data.recommended_retry_ms));
    console.log(`[Adaptive Retry] Using adaptive delay for ${channel}: ${adaptiveDelay}ms`);
    return adaptiveDelay;
  } catch (error) {
    const fallback = channel === 'slack' ? 2000 : 3000;
    console.error(`[Adaptive Retry] Error fetching delay for ${channel}:`, error);
    return fallback;
  }
}

async function sendWithRetry(
  url: string,
  options: RequestInit,
  retries: number = 2,
  backoffMs: number = 300
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      if (response.status >= 400 && response.status < 500) {
        return response;
      }
      
      if (response.status >= 500 || response.status === 429) {
        if (attempt < retries) {
          const delay = backoffMs * Math.pow(2, attempt);
          console.log(`Retry attempt ${attempt + 1}/${retries} after ${delay}ms for status ${response.status}`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
      
      return response;
    } catch (error) {
      lastError = error as Error;
      if (attempt < retries) {
        const delay = backoffMs * Math.pow(2, attempt);
        console.log(`Retry attempt ${attempt + 1}/${retries} after ${delay}ms due to error: ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
    }
  }
  
  throw lastError || new Error('Max retries exceeded');
}

async function sendSlackNotification(title: string, message: string, actionUrl?: string, supabaseClient?: any): Promise<ExternalDeliveryResult> {
  if (NOTIFICATIONS_TEST_MODE) {
    if (SENTRY_DSN) {
      Sentry.captureMessage('Simulated Slack delivery', {
        level: 'info',
        extra: { title, message, actionUrl, channel: 'slack' }
      });
    }
    return { channel: 'slack', success: true, message: 'Simulated delivery (test mode)' };
  }

  if (!SLACK_WEBHOOK_URL) {
    return { channel: 'slack', success: false, error: 'SLACK_WEBHOOK_URL not configured' };
  }

  try {
    const payload = {
      text: `*${title}*\n${message}${actionUrl ? `\n<${actionUrl}|View Details>` : ''}`
    };

    const adaptiveBackoff = supabaseClient 
      ? await getAdaptiveRetryDelay(supabaseClient, 'slack')
      : 2000;

    const response = await sendWithRetry(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }, 2, adaptiveBackoff);

    if (response.status === 200) {
      return { channel: 'slack', success: true, message: 'Delivered to Slack' };
    } else {
      const errorText = await response.text();
      const truncatedError = errorText.length > 300 ? errorText.substring(0, 300) + '...' : errorText;
      return { channel: 'slack', success: false, error: `Slack returned ${response.status}: ${truncatedError}` };
    }
  } catch (error) {
    return { channel: 'slack', success: false, error: error.message };
  }
}

async function sendTeamsNotification(title: string, message: string, actionUrl?: string): Promise<ExternalDeliveryResult> {
  if (NOTIFICATIONS_TEST_MODE) {
    if (SENTRY_DSN) {
      Sentry.captureMessage('Simulated Teams delivery', {
        level: 'info',
        extra: { title, message, actionUrl, channel: 'teams' }
      });
    }
    return { channel: 'teams', success: true, message: 'Simulated delivery (test mode)' };
  }

  if (!TEAMS_WEBHOOK_URL) {
    return { channel: 'teams', success: false, error: 'TEAMS_WEBHOOK_URL not configured' };
  }

  try {
    const payload = {
      text: `**${title}**\n\n${message}${actionUrl ? `\n\n[View Details](${actionUrl})` : ''}`
    };

    const response = await sendWithRetry(TEAMS_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (response.status === 200) {
      return { channel: 'teams', success: true, message: 'Delivered to Teams' };
    } else {
      const errorText = await response.text();
      const truncatedError = errorText.length > 300 ? errorText.substring(0, 300) + '...' : errorText;
      return { channel: 'teams', success: false, error: `Teams returned ${response.status}: ${truncatedError}` };
    }
  } catch (error) {
    return { channel: 'teams', success: false, error: error.message };
  }
}

async function sendEmailNotification(title: string, message: string, emailTo: string, actionUrl?: string, supabaseClient?: any): Promise<ExternalDeliveryResult> {
  if (NOTIFICATIONS_TEST_MODE) {
    if (SENTRY_DSN) {
      Sentry.captureMessage('Simulated Email delivery', {
        level: 'info',
        extra: { title, message, emailTo, actionUrl, channel: 'email' }
      });
    }
    return { channel: 'email', success: true, message: 'Simulated delivery (test mode)' };
  }

  if (!SENDGRID_API_KEY) {
    return { channel: 'email', success: false, error: 'SENDGRID_API_KEY not configured' };
  }

  try {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <body style="margin:0;background-color:#0b0c10;color:#ffffff;font-family:Arial,Helvetica,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#0b0c10;padding:40px;text-align:center;">
            <tr>
              <td>
                <h1 style="color:#00e5ff;font-size:28px;margin-bottom:10px;">${title}</h1>
                <p style="font-size:16px;line-height:1.6;color:#cccccc;">
                  ${message.replace(/\n/g, '<br>')}
                </p>
                ${actionUrl ? `
                  <p style="margin-top:30px;">
                    <a href="${actionUrl}" style="display:inline-block;padding:12px 24px;background:#00e5ff;color:#0b0c10;text-decoration:none;border-radius:4px;font-weight:bold;">
                      View Details
                    </a>
                  </p>
                ` : ''}
                <hr style="border:0;height:1px;background:linear-gradient(90deg,#00e5ff,#1f2833,#00e5ff);margin:30px 0;">
                <p style="color:#888;font-size:14px;">
                  This is an automated notification from Core314.<br>
                  <strong>– The Core314 Team</strong><br>
                  "Logic in Motion. Intelligence in Control."
                </p>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;

    const payload = {
      personalizations: [{
        to: [{ email: emailTo }],
        subject: title
      }],
      from: { email: SENDGRID_FROM, name: 'Core314' },
      content: [{
        type: 'text/html',
        value: htmlContent
      }]
    };

    const adaptiveBackoff = supabaseClient 
      ? await getAdaptiveRetryDelay(supabaseClient, 'email')
      : 3000;

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (response.status === 202) {
      return { channel: 'email', success: true, message: 'Email queued for delivery' };
    } else {
      const errorText = await response.text();
      return { channel: 'email', success: false, error: `SendGrid returned ${response.status}: ${errorText}` };
    }
  } catch (error) {
    return { channel: 'email', success: false, error: error.message };
  }
}

serve(withSentry(async (req) => {
  const testResponse = await handleSentryTest(req);
  if (testResponse) return testResponse;

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const notificationData: NotificationRequest = await req.json();

    if (!notificationData.user_id) {
      return new Response(
        JSON.stringify({ error: 'user_id is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!notificationData.type) {
      return new Response(
        JSON.stringify({ error: 'type is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!notificationData.title || !notificationData.message) {
      return new Response(
        JSON.stringify({ error: 'title and message are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const severity = notificationData.severity || (
      notificationData.type === 'alert' ? 'high' :
      notificationData.type === 'error' ? 'high' :
      notificationData.type === 'warning' ? 'medium' :
      'low'
    );

    const enrichedMetadata = {
      ...(notificationData.metadata || {}),
      rule_id: notificationData.rule_id || null,
      severity: severity,
      triggered_at: new Date().toISOString(),
    };

    const notification: NotificationRecord = {
      user_id: notificationData.user_id,
      type: notificationData.type,
      title: notificationData.title,
      message: notificationData.message,
      is_read: false,
      action_url: notificationData.action_url || null,
      metadata: JSON.stringify(enrichedMetadata),
    };

    const { data, error } = await supabaseClient
      .from('notifications')
      .insert(notification)
      .select()
      .single();

    if (error) {
      console.error('Error creating notification:', error);
      
      if (SENTRY_DSN) {
        Sentry.captureException(error, {
          extra: {
            function: 'core_notifications_gateway',
            user_id: notificationData.user_id,
            notification_type: notificationData.type,
            error_code: error.code,
            error_details: error.details,
            error_hint: error.hint,
          },
          tags: {
            function: 'core_notifications_gateway',
            error_type: 'database_insert',
          },
        });
        await Sentry.flush(2000);
      }
      
      return new Response(
        JSON.stringify({ 
          error: 'Failed to create notification',
          details: error.message 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const externalDeliveryResults: ExternalDeliveryResult[] = [];
    
    let deliveryChannel = notificationData.delivery;
    if (!deliveryChannel) {
      if (notificationData.type === 'alert' && SLACK_WEBHOOK_URL) {
        deliveryChannel = 'slack';
      } else if (notificationData.type === 'notify' && TEAMS_WEBHOOK_URL) {
        deliveryChannel = 'teams';
      }
    }

    if (deliveryChannel === 'slack') {
      const result = await sendSlackNotification(
        notificationData.title,
        notificationData.message,
        notificationData.action_url,
        supabaseClient
      );
      externalDeliveryResults.push(result);
      
      if (!result.success && SENTRY_DSN) {
        Sentry.captureMessage('Slack delivery failed', {
          level: 'warning',
          extra: {
            function: 'core_notifications_gateway',
            error: result.error,
            title: notificationData.title
          }
        });
      }
    } else if (deliveryChannel === 'teams') {
      const result = await sendTeamsNotification(
        notificationData.title,
        notificationData.message,
        notificationData.action_url
      );
      externalDeliveryResults.push(result);
      
      if (!result.success && SENTRY_DSN) {
        Sentry.captureMessage('Teams delivery failed', {
          level: 'warning',
          extra: {
            function: 'core_notifications_gateway',
            error: result.error,
            title: notificationData.title
          }
        });
      }
    } else if (deliveryChannel === 'email') {
      const emailTo = notificationData.email_to || ADMIN_EMAIL;
      const result = await sendEmailNotification(
        notificationData.title,
        notificationData.message,
        emailTo,
        notificationData.action_url,
        supabaseClient
      );
      externalDeliveryResults.push(result);
      
      if (!result.success && SENTRY_DSN) {
        Sentry.captureMessage('Email delivery failed', {
          level: 'warning',
          extra: {
            function: 'core_notifications_gateway',
            error: result.error,
            title: notificationData.title,
            email_to: emailTo
          }
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        notification: data,
        message: 'Notification created successfully',
        external_delivery: externalDeliveryResults.length > 0 ? externalDeliveryResults : undefined
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    
    if (SENTRY_DSN) {
      Sentry.captureException(error, {
        extra: {
          function: 'core_notifications_gateway',
          error_message: error.message,
          error_stack: error.stack,
        },
        tags: {
          function: 'core_notifications_gateway',
          error_type: 'unexpected',
        },
      });
      await Sentry.flush(2000);
    }
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}, { name: "core_notifications_gateway" }));