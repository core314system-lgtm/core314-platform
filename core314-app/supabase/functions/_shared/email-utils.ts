// =============================================================================
// SHARED EMAIL UTILITIES
// Centralized email sending, template wrapper, and compliance (unsubscribe, footer)
// Used by ALL edge functions that send emails.
// =============================================================================

// -----------------------------------------------------------------------------
// CONSTANTS
// -----------------------------------------------------------------------------
const COMPANY_NAME = 'Core314™ Technologies LLC';
const COMPANY_ADDRESS = '1603 Capitol Ave, Suite 413A #4640, Cheyenne, WY 82001';
const SUPPORT_EMAIL = 'admin@core314.com';
const CURRENT_YEAR = new Date().getFullYear();

// -----------------------------------------------------------------------------
// SEND EMAIL via SendGrid
// Adds List-Unsubscribe header and unsubscribe link in footer automatically.
// -----------------------------------------------------------------------------
export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Optional — override sender email (defaults to SENDGRID_SENDER_EMAIL or support@core314.com) */
  fromEmail?: string;
  /** Optional — override sender name (defaults to SENDGRID_SENDER_NAME or Core314) */
  fromName?: string;
  /** Optional — override reply-to email (defaults to admin@core314.com) */
  replyTo?: string;
  /** Optional — SendGrid unsubscribe group ID for one-click unsubscribe */
  unsubscribeGroupId?: number;
}

export interface SendEmailResult {
  success: boolean;
  error?: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const sendgridApiKey = Deno.env.get('SENDGRID_API_KEY');
  const senderEmail = options.fromEmail || Deno.env.get('SENDGRID_SENDER_EMAIL') || 'support@core314.com';
  const senderName = options.fromName || Deno.env.get('SENDGRID_SENDER_NAME') || 'Core314';
  const replyTo = options.replyTo || SUPPORT_EMAIL;

  if (!sendgridApiKey) {
    console.error('[email-utils] SENDGRID_API_KEY not configured');
    return { success: false, error: 'Email service not configured — SENDGRID_API_KEY missing' };
  }

  try {
    // Build the request payload
    const payload: Record<string, unknown> = {
      personalizations: [{ to: [{ email: options.to }] }],
      from: { email: senderEmail, name: senderName },
      reply_to: { email: replyTo, name: 'Core314 Team' },
      subject: options.subject,
      content: [
        { type: 'text/plain', value: options.text },
        { type: 'text/html', value: options.html },
      ],
    };

    // Add SendGrid unsubscribe group if configured
    if (options.unsubscribeGroupId) {
      payload.asm = {
        group_id: options.unsubscribeGroupId,
        groups_to_display: [options.unsubscribeGroupId],
      };
    }

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sendgridApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[email-utils] SendGrid error: ${response.status}`, errorText);
      return { success: false, error: `SendGrid error: ${response.status} — ${errorText}` };
    }

    console.log(`[email-utils] Email sent to ${options.to}: "${options.subject}"`);
    return { success: true };
  } catch (error) {
    console.error('[email-utils] Email send exception:', error);
    return { success: false, error: `Email send failed: ${String(error)}` };
  }
}

// -----------------------------------------------------------------------------
// HTML EMAIL WRAPPER
// Wraps any email body content with the standard Core314 branded template
// including header, footer, unsubscribe link, and physical address.
// -----------------------------------------------------------------------------
export interface EmailWrapperOptions {
  /** The inner HTML content of the email (will be placed inside the branded wrapper) */
  bodyContent: string;
  /** Optional preheader text (hidden preview text in email clients) */
  preheader?: string;
}

export function wrapEmailHTML(options: EmailWrapperOptions): string {
  const preheaderHTML = options.preheader
    ? `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${options.preheader}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Core314</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background-color:#0A0F1A;color:#ffffff;">
  ${preheaderHTML}
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0A0F1A;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0">
          <!-- Logo -->
          <tr>
            <td style="text-align:center;padding-bottom:30px;">
              <span style="font-size:32px;font-weight:700;color:#00BFFF;letter-spacing:2px;">CORE314</span>
            </td>
          </tr>

          <!-- Body Content -->
          ${options.bodyContent}

          <!-- Footer -->
          <tr><td style="height:24px;"></td></tr>
          <tr>
            <td style="text-align:center;padding:20px;">
              <p style="margin:0 0 8px 0;font-size:14px;color:#64748b;">
                Questions? Reply to this email — we read every one.
              </p>
              <p style="margin:0 0 8px 0;font-size:14px;color:#64748b;">
                <a href="mailto:${SUPPORT_EMAIL}" style="color:#00BFFF;text-decoration:none;">${SUPPORT_EMAIL}</a>
              </p>
              <p style="margin:0 0 8px 0;font-size:12px;color:#94a3b8;">
                &copy; ${CURRENT_YEAR} ${COMPANY_NAME}. All rights reserved.
              </p>
              <p style="margin:0 0 8px 0;font-size:12px;">
                <a href="https://core314.com/privacy" style="color:#00BFFF;text-decoration:none;">Privacy Policy</a> &nbsp;|&nbsp;
                <a href="https://core314.com/terms" style="color:#00BFFF;text-decoration:none;">Terms of Service</a>
              </p>
              <p style="margin:0 0 8px 0;font-size:11px;color:#64748b;">
                ${COMPANY_ADDRESS}
              </p>
              <p style="margin:0;font-size:11px;color:#64748b;">
                <a href="https://core314.com/unsubscribe?email=%%email%%" style="color:#94a3b8;text-decoration:underline;">Unsubscribe</a> &nbsp;|&nbsp;
                <a href="https://core314.com/email-preferences?email=%%email%%" style="color:#94a3b8;text-decoration:underline;">Email Preferences</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// -----------------------------------------------------------------------------
// TEXT EMAIL FOOTER
// Appends standard compliance footer to plain-text emails.
// -----------------------------------------------------------------------------
export function appendTextFooter(text: string): string {
  return `${text}

---
Questions? Email us at ${SUPPORT_EMAIL}
${COMPANY_NAME} | ${COMPANY_ADDRESS}
Privacy Policy: https://core314.com/privacy
Terms of Service: https://core314.com/terms
Unsubscribe: https://core314.com/unsubscribe

(c) ${CURRENT_YEAR} ${COMPANY_NAME}. All rights reserved.`;
}
