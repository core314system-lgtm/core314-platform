
interface AlertPayload {
  event_type: string;
  severity: 'low' | 'moderate' | 'high' | 'critical';
  message: string;
  channel: 'slack' | 'email' | 'system';
  metadata?: Record<string, unknown>;
}

interface DispatchResult {
  success: boolean;
  channel: string;
  error?: string;
}

/**
 * Dispatch alert to Slack webhook
 */
async function dispatchToSlack(payload: AlertPayload): Promise<DispatchResult> {
  const slackWebhookUrl = Deno.env.get('SLACK_WEBHOOK_URL');
  
  if (!slackWebhookUrl) {
    console.warn('[Alert Dispatcher] SLACK_WEBHOOK_URL not configured');
    return { success: false, channel: 'slack', error: 'Webhook URL not configured' };
  }

  const severityColors: Record<string, string> = {
    low: '#36a64f',      // Green
    moderate: '#ff9900', // Orange
    high: '#ff6600',     // Dark Orange
    critical: '#ff0000', // Red
  };

  const slackMessage = {
    text: `🚨 *${payload.severity.toUpperCase()} Alert*`,
    attachments: [
      {
        color: severityColors[payload.severity],
        fields: [
          {
            title: 'Event Type',
            value: payload.event_type,
            short: true,
          },
          {
            title: 'Severity',
            value: payload.severity.toUpperCase(),
            short: true,
          },
          {
            title: 'Message',
            value: payload.message,
            short: false,
          },
        ],
        footer: 'Core314 Fusion Alert System',
        ts: Math.floor(Date.now() / 1000),
      },
    ],
  };

  try {
    const response = await fetch(slackWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slackMessage),
    });

    if (!response.ok) {
      throw new Error(`Slack API error: ${response.status}`);
    }

    console.log(`[Alert Dispatcher] Slack alert sent: ${payload.event_type}`);
    return { success: true, channel: 'slack' };
  } catch (error) {
    console.error('[Alert Dispatcher] Slack dispatch failed:', error);
    return { 
      success: false, 
      channel: 'slack', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Dispatch alert via email using SendGrid
 */
async function dispatchToEmail(payload: AlertPayload): Promise<DispatchResult> {
  const sendgridApiKey = Deno.env.get('SENDGRID_API_KEY');
  const senderEmail = Deno.env.get('SENDGRID_SENDER_EMAIL');
  const alertRecipient = Deno.env.get('ALERT_RECIPIENT_EMAIL') || senderEmail;

  if (!sendgridApiKey || !senderEmail) {
    console.warn('[Alert Dispatcher] SendGrid not configured');
    return { success: false, channel: 'email', error: 'SendGrid not configured' };
  }

  const severityPriority: Record<string, string> = {
    low: 'Low',
    moderate: 'Normal',
    high: 'High',
    critical: 'Urgent',
  };

  const emailPayload = {
    personalizations: [
      {
        to: [{ email: alertRecipient }],
        subject: `[${payload.severity.toUpperCase()}] Core314 Alert: ${payload.event_type}`,
      },
    ],
    from: {
      email: senderEmail,
      name: 'Core314 Alert System',
    },
    content: [
      {
        type: 'text/html',
        value: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: ${payload.severity === 'critical' ? '#ff0000' : '#ff6600'}; color: white; padding: 20px; text-align: center;">
              <h1 style="margin: 0;">🚨 ${severityPriority[payload.severity]} Priority Alert</h1>
            </div>
            <div style="padding: 20px; background-color: #f5f5f5;">
              <h2 style="color: #333;">Alert Details</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Event Type:</strong></td>
                  <td style="padding: 10px; border-bottom: 1px solid #ddd;">${payload.event_type}</td>
                </tr>
                <tr>
                  <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Severity:</strong></td>
                  <td style="padding: 10px; border-bottom: 1px solid #ddd;">${payload.severity.toUpperCase()}</td>
                </tr>
                <tr>
                  <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Message:</strong></td>
                  <td style="padding: 10px; border-bottom: 1px solid #ddd;">${payload.message}</td>
                </tr>
                <tr>
                  <td style="padding: 10px;"><strong>Timestamp:</strong></td>
                  <td style="padding: 10px;">${new Date().toISOString()}</td>
                </tr>
              </table>
            </div>
            <div style="padding: 20px; text-align: center; color: #666; font-size: 12px;">
              <p>This is an automated alert from Core314 Fusion Intelligence System</p>
            </div>
          </div>
        `,
      },
    ],
  };

  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sendgridApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailPayload),
    });

    if (!response.ok) {
      throw new Error(`SendGrid API error: ${response.status}`);
    }

    console.log(`[Alert Dispatcher] Email alert sent: ${payload.event_type}`);
    return { success: true, channel: 'email' };
  } catch (error) {
    console.error('[Alert Dispatcher] Email dispatch failed:', error);
    return { 
      success: false, 
      channel: 'email', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Log alert to system (no external dispatch)
 */
function dispatchToSystem(payload: AlertPayload): DispatchResult {
  console.log(`[Alert Dispatcher] SYSTEM ALERT [${payload.severity.toUpperCase()}]: ${payload.message}`);
  console.log(`[Alert Dispatcher] Event Type: ${payload.event_type}`);
  if (payload.metadata) {
    console.log(`[Alert Dispatcher] Metadata:`, JSON.stringify(payload.metadata, null, 2));
  }
  return { success: true, channel: 'system' };
}

/**
 * Main dispatch function - routes to appropriate channel
 */
export async function dispatchAlert(payload: AlertPayload): Promise<DispatchResult> {
  console.log(`[Alert Dispatcher] Dispatching ${payload.severity} alert to ${payload.channel}: ${payload.event_type}`);

  switch (payload.channel) {
    case 'slack':
      return await dispatchToSlack(payload);
    case 'email':
      return await dispatchToEmail(payload);
    case 'system':
      return dispatchToSystem(payload);
    default:
      console.error(`[Alert Dispatcher] Unknown channel: ${payload.channel}`);
      return { success: false, channel: payload.channel, error: 'Unknown channel' };
  }
}

/**
 * Determine appropriate channel based on severity
 */
export function getChannelForSeverity(severity: string): 'slack' | 'email' | 'system' {
  switch (severity) {
    case 'critical':
      return 'email'; // Critical alerts go to email (and can also trigger Slack)
    case 'high':
      return 'slack'; // High alerts go to Slack
    case 'moderate':
    case 'low':
    default:
      return 'system'; // Low/moderate alerts are logged only
  }
}
