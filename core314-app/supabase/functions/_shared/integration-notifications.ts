/**
 * Integration Notification Helper
 * 
 * Sends SendGrid emails for integration lifecycle events:
 * - Connection confirmation
 * - Polling failure alerts (3+ consecutive failures)
 * - Upgrade prompts (Intelligence user tries Command Center integration)
 */

const SENDGRID_API_URL = 'https://api.sendgrid.com/v3/mail/send';

interface NotificationOptions {
  recipientEmail: string;
  recipientName?: string;
}

async function sendEmail(
  subject: string,
  htmlContent: string,
  options: NotificationOptions
): Promise<boolean> {
  const sendgridApiKey = Deno.env.get('SENDGRID_API_KEY');
  const senderEmail = Deno.env.get('SENDGRID_SENDER_EMAIL') || 'alerts@core314.com';

  if (!sendgridApiKey) {
    console.warn('[integration-notifications] SENDGRID_API_KEY not configured, skipping email');
    return false;
  }

  try {
    const response = await fetch(SENDGRID_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sendgridApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{
          to: [{ email: options.recipientEmail, name: options.recipientName }],
          subject,
        }],
        from: { email: senderEmail, name: 'Core314' },
        content: [{ type: 'text/html', value: htmlContent }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[integration-notifications] SendGrid error ${response.status}:`, errorText);
      return false;
    }

    console.log(`[integration-notifications] Email sent: "${subject}" to ${options.recipientEmail}`);
    return true;
  } catch (error) {
    console.error('[integration-notifications] Failed to send email:', error);
    return false;
  }
}

const SERVICE_DISPLAY_NAMES: Record<string, string> = {
  slack: 'Slack',
  hubspot: 'HubSpot',
  quickbooks: 'QuickBooks',
  google_calendar: 'Google Calendar',
  gmail: 'Gmail',
  jira: 'Jira',
  trello: 'Trello',
  microsoft_teams: 'Microsoft Teams',
  google_sheets: 'Google Sheets',
  asana: 'Asana',
};

function getDisplayName(serviceName: string): string {
  return SERVICE_DISPLAY_NAMES[serviceName] || serviceName;
}

/**
 * Send confirmation email when an integration is successfully connected
 */
export async function sendIntegrationConnectedEmail(
  serviceName: string,
  options: NotificationOptions
): Promise<boolean> {
  const displayName = getDisplayName(serviceName);
  const subject = `${displayName} Connected to Core314`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a2e;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 32px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; color: white; font-size: 22px;">${displayName} Connected</h1>
      </div>
      <div style="padding: 32px; background: #ffffff; border: 1px solid #e2e8f0; border-top: none;">
        <p style="margin: 0 0 16px;">Your <strong>${displayName}</strong> integration is now active and connected to Core314.</p>
        <p style="margin: 0 0 16px;">What happens next:</p>
        <ul style="margin: 0 0 16px; padding-left: 20px;">
          <li style="margin-bottom: 8px;">Data polling will begin within the next 15 minutes</li>
          <li style="margin-bottom: 8px;">Operational signals will be generated from ${displayName} data</li>
          <li style="margin-bottom: 8px;">Your Operational Brief will include ${displayName} insights</li>
          <li style="margin-bottom: 8px;">Health Score will reflect ${displayName} operational metrics</li>
        </ul>
        <p style="margin: 0; color: #64748b; font-size: 13px;">You can manage your integrations from the <a href="https://app.core314.com/integrations" style="color: #667eea;">Integration Manager</a>.</p>
      </div>
      <div style="padding: 16px; text-align: center; color: #94a3b8; font-size: 12px;">
        Core314 Operational Intelligence Platform
      </div>
    </div>
  `;
  return sendEmail(subject, html, options);
}

/**
 * Send alert email when integration polling fails repeatedly
 */
export async function sendIntegrationFailureEmail(
  serviceName: string,
  failureCount: number,
  errorMessage: string,
  options: NotificationOptions
): Promise<boolean> {
  const displayName = getDisplayName(serviceName);
  const subject = `Action Required: ${displayName} Integration Issue`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a2e;">
      <div style="background: #dc2626; padding: 32px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; color: white; font-size: 22px;">${displayName} Integration Issue</h1>
      </div>
      <div style="padding: 32px; background: #ffffff; border: 1px solid #e2e8f0; border-top: none;">
        <p style="margin: 0 0 16px;">Your <strong>${displayName}</strong> integration has experienced <strong>${failureCount} consecutive polling failure${failureCount > 1 ? 's' : ''}</strong>.</p>
        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 16px; margin: 0 0 16px;">
          <p style="margin: 0; font-size: 13px; color: #991b1b;"><strong>Error:</strong> ${errorMessage}</p>
        </div>
        <p style="margin: 0 0 16px;">Recommended actions:</p>
        <ul style="margin: 0 0 16px; padding-left: 20px;">
          <li style="margin-bottom: 8px;">Verify your ${displayName} credentials are still valid</li>
          <li style="margin-bottom: 8px;">Disconnect and reconnect the integration from the <a href="https://app.core314.com/integrations" style="color: #667eea;">Integration Manager</a></li>
          <li style="margin-bottom: 8px;">Check if your ${displayName} account has any access restrictions</li>
        </ul>
        <p style="margin: 0; color: #64748b; font-size: 13px;">Core314 will continue retrying automatically. If the issue persists, the integration will be marked as unhealthy.</p>
      </div>
      <div style="padding: 16px; text-align: center; color: #94a3b8; font-size: 12px;">
        Core314 Operational Intelligence Platform
      </div>
    </div>
  `;
  return sendEmail(subject, html, options);
}

/**
 * Send upgrade prompt when Intelligence user tries to access Command Center integration
 */
export async function sendUpgradePromptEmail(
  serviceName: string,
  options: NotificationOptions
): Promise<boolean> {
  const displayName = getDisplayName(serviceName);
  const subject = `Unlock ${displayName} with Command Center`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a2e;">
      <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 32px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; color: white; font-size: 22px;">Unlock ${displayName}</h1>
      </div>
      <div style="padding: 32px; background: #ffffff; border: 1px solid #e2e8f0; border-top: none;">
        <p style="margin: 0 0 16px;"><strong>${displayName}</strong> is available on the <strong>Command Center</strong> plan.</p>
        <p style="margin: 0 0 16px;">Your current Intelligence plan includes Slack, HubSpot, and QuickBooks. Upgrade to Command Center to unlock all 10 integrations:</p>
        <ul style="margin: 0 0 16px; padding-left: 20px;">
          <li style="margin-bottom: 4px;">Google Calendar &mdash; scheduling intelligence</li>
          <li style="margin-bottom: 4px;">Gmail &mdash; communication patterns</li>
          <li style="margin-bottom: 4px;">Jira &mdash; project delivery tracking</li>
          <li style="margin-bottom: 4px;">Trello &mdash; task management signals</li>
          <li style="margin-bottom: 4px;">Microsoft Teams &mdash; team collaboration</li>
          <li style="margin-bottom: 4px;">Google Sheets &mdash; KPI data tracking</li>
          <li style="margin-bottom: 4px;">Asana &mdash; project milestone monitoring</li>
        </ul>
        <div style="text-align: center; margin: 24px 0;">
          <a href="https://app.core314.com/billing" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 600;">Upgrade to Command Center</a>
        </div>
      </div>
      <div style="padding: 16px; text-align: center; color: #94a3b8; font-size: 12px;">
        Core314 Operational Intelligence Platform
      </div>
    </div>
  `;
  return sendEmail(subject, html, options);
}
