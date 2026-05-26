// ============================================================================
// SYSTEM HEALTH LOGGER — RELIABILITY LAYER (Node.js / Netlify Functions)
// ============================================================================
// Node-compatible version of the system health logger.
// Logs events to system_health_logs table and sends alert emails on failure.
// ============================================================================

import { SupabaseClient } from '@supabase/supabase-js';

type ServiceName =
  | 'stripe_webhook'
  | 'stripe_checkout'
  | 'user_creation'
  | 'email_send'
  | 'integration_ingestion'
  | string;

type EventStatus = 'success' | 'failure';

const ALERT_RECIPIENT = process.env.ALERT_RECIPIENT_EMAIL || 'chris.brown@core314.com';

/**
 * Log a system health event to the database.
 * If status is "failure", also sends an alert email via SendGrid.
 */
export async function logSystemEvent(
  supabase: SupabaseClient,
  service: ServiceName,
  status: EventStatus,
  message: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  // 1. Insert into system_health_logs
  try {
    const { error: insertError } = await supabase
      .from('system_health_logs')
      .insert({
        service,
        status,
        message,
        metadata: metadata || {},
      });

    if (insertError) {
      console.error(
        `[SystemHealthLogger] Failed to insert health log: ${JSON.stringify(insertError)}`
      );
    } else {
      console.log(
        `[SystemHealthLogger] Logged: service=${service} status=${status} message=${message}`
      );
    }
  } catch (err) {
    console.error(
      `[SystemHealthLogger] Exception inserting health log: ${String(err)}`
    );
  }

  // 2. If failure, send alert email
  if (status === 'failure') {
    await sendFailureAlert(service, message, metadata);
  }
}

/**
 * Send a failure alert email via SendGrid.
 */
async function sendFailureAlert(
  service: string,
  message: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const sendgridApiKey = process.env.SENDGRID_API_KEY;
  const senderEmail = process.env.SENDGRID_SENDER_EMAIL || 'support@core314.com';
  const senderName = process.env.SENDGRID_SENDER_NAME || 'Core314';

  if (!sendgridApiKey) {
    console.error('[SystemHealthLogger] SENDGRID_API_KEY not set — cannot send failure alert');
    return;
  }

  const timestamp = new Date().toISOString();
  const metadataStr = metadata ? JSON.stringify(metadata, null, 2) : 'None';

  const emailHtml = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background-color:#f4f4f4;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f4f4f4;padding:20px;">
    <tr><td align="center">
      <table cellpadding="0" cellspacing="0" border="0" width="600" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 4px rgba(0,0,0,0.1);">
        <tr><td style="background-color:#dc2626;padding:24px 40px;">
          <h2 style="margin:0;color:#ffffff;font-size:22px;">Core314 System Alert: FAILURE</h2>
        </td></tr>
        <tr><td style="padding:30px 40px;">
          <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
            <tr>
              <td style="padding:12px;border-bottom:1px solid #e5e7eb;font-weight:bold;color:#374151;width:140px;">Service</td>
              <td style="padding:12px;border-bottom:1px solid #e5e7eb;color:#111827;">${service}</td>
            </tr>
            <tr>
              <td style="padding:12px;border-bottom:1px solid #e5e7eb;font-weight:bold;color:#374151;">Status</td>
              <td style="padding:12px;border-bottom:1px solid #e5e7eb;color:#dc2626;font-weight:bold;">FAILURE</td>
            </tr>
            <tr>
              <td style="padding:12px;border-bottom:1px solid #e5e7eb;font-weight:bold;color:#374151;">Error Message</td>
              <td style="padding:12px;border-bottom:1px solid #e5e7eb;color:#111827;">${message}</td>
            </tr>
            <tr>
              <td style="padding:12px;border-bottom:1px solid #e5e7eb;font-weight:bold;color:#374151;">Timestamp</td>
              <td style="padding:12px;border-bottom:1px solid #e5e7eb;color:#111827;">${timestamp}</td>
            </tr>
            <tr>
              <td style="padding:12px;font-weight:bold;color:#374151;vertical-align:top;">Metadata</td>
              <td style="padding:12px;color:#111827;"><pre style="margin:0;font-size:12px;background:#f9fafb;padding:8px;border-radius:4px;overflow-x:auto;">${metadataStr}</pre></td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="padding:20px 40px;border-top:1px solid #e5e7eb;background-color:#f9fafb;">
          <p style="margin:0;color:#6b7280;font-size:12px;">Core314 System Health Monitoring &mdash; Reliability Layer<br>&copy; ${new Date().getFullYear()} Core314. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    const sgResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sendgridApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ email: ALERT_RECIPIENT }],
            subject: `[FAILURE] Core314 Alert: ${service}`,
          },
        ],
        from: { email: senderEmail, name: `${senderName} Alerts` },
        content: [
          {
            type: 'text/plain',
            value: `FAILURE ALERT\n\nService: ${service}\nMessage: ${message}\nTimestamp: ${timestamp}\nMetadata: ${metadataStr}`,
          },
          { type: 'text/html', value: emailHtml },
        ],
      }),
    });

    if (!sgResponse.ok) {
      const errBody = await sgResponse.text();
      console.error(
        `[SystemHealthLogger] Failed to send alert email: status=${sgResponse.status} body=${errBody}`
      );
    } else {
      console.log(
        `[SystemHealthLogger] Alert email sent to ${ALERT_RECIPIENT} for service=${service}`
      );
    }
  } catch (err) {
    console.error(
      `[SystemHealthLogger] Exception sending alert email: ${String(err)}`
    );
  }
}
