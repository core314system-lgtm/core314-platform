import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// =============================================================================
// TYPES
// =============================================================================

interface SendMessageRequest {
  action: 'send_beta_invite' | 'send_beta_reminder' | 'send_beta_checkin' | 'send_reengagement';
  recipient_email: string;
  recipient_name?: string;
  recipient_company?: string;
  admin_user_id: string;
  context?: Record<string, unknown>;
}

interface SendGridTemplateData {
  name?: string;
  company?: string;
  beta_link: string;
  support_email: string;
}

// =============================================================================
// SENDGRID TEMPLATE CONFIGURATION
// =============================================================================
// Templates must be created in SendGrid as transactional templates
// These IDs should be set as environment variables after template creation

const TEMPLATE_IDS = {
  beta_invite: Deno.env.get('SENDGRID_TEMPLATE_BETA_INVITE') || 'd-placeholder-beta-invite',
  beta_reminder: Deno.env.get('SENDGRID_TEMPLATE_BETA_REMINDER') || 'd-placeholder-beta-reminder',
  beta_checkin: Deno.env.get('SENDGRID_TEMPLATE_BETA_CHECKIN') || 'd-placeholder-beta-checkin',
  beta_acceptance: Deno.env.get('SENDGRID_TEMPLATE_BETA_ACCEPTANCE') || 'd-placeholder-beta-acceptance',
  reengagement: Deno.env.get('SENDGRID_TEMPLATE_REENGAGEMENT') || 'd-placeholder-reengagement',
};

// Message type to template mapping
const MESSAGE_TYPE_TO_TEMPLATE: Record<string, string> = {
  beta_invite: 'beta_invite',
  beta_reminder: 'beta_reminder',
  beta_checkin: 'beta_checkin',
  reengagement: 'reengagement',
};

// =============================================================================
// FALLBACK HTML TEMPLATES (Used if SendGrid template IDs not configured)
// These are fully branded, enterprise-grade templates
// =============================================================================

const BETA_INVITE_HTML = (data: SendGridTemplateData) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Core314 Beta Invitation</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header with Logo -->
          <tr>
            <td style="padding: 32px 40px; border-bottom: 1px solid #e2e8f0; text-align: center;">
              <img src="https://core314.com/logo-icon.svg" alt="Core314" width="48" height="48" style="display: inline-block;">
              <h1 style="margin: 16px 0 0 0; font-size: 24px; font-weight: 600; color: #0f172a;">Core314</h1>
            </td>
          </tr>
          <!-- Main Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 24px 0; font-size: 22px; font-weight: 600; color: #0f172a; line-height: 1.3;">
                You're Invited to Shape the Future of Operational Intelligence
              </h2>
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #334155;">
                ${data.name ? `${data.name},` : 'Hello,'}
              </p>
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #334155;">
                We're opening a limited, invitation-only beta for Core314—a platform designed to bring clarity to complex operational environments.
              </p>
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #334155;">
                This beta is not early access. It's a working partnership with operators who understand the challenges of multi-system environments and want to influence how modern systems are observed, analyzed, and acted upon.
              </p>
              <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.6; color: #334155;">
                <strong>What you'll receive:</strong>
              </p>
              <ul style="margin: 0 0 24px 0; padding-left: 24px; font-size: 16px; line-height: 1.8; color: #334155;">
                <li>Full Core314 access during the beta period</li>
                <li>Direct influence on product direction</li>
                <li>Priority onboarding post-launch</li>
                <li>50% discount for the first 6 months after launch</li>
              </ul>
              <p style="margin: 0 0 32px 0; font-size: 16px; line-height: 1.6; color: #334155;">
                If this aligns with your operational challenges, we'd welcome your participation.
              </p>
              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                <tr>
                  <td style="background-color: #0ea5e9; border-radius: 6px;">
                    <a href="${data.beta_link}" style="display: inline-block; padding: 14px 32px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none;">
                      Accept Beta Invitation
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; border-radius: 0 0 8px 8px;">
              <p style="margin: 0 0 8px 0; font-size: 14px; color: #64748b; text-align: center;">
                Questions? Contact us at <a href="mailto:${data.support_email}" style="color: #0ea5e9; text-decoration: none;">${data.support_email}</a>
              </p>
              <p style="margin: 0; font-size: 12px; color: #94a3b8; text-align: center;">
                © 2026 Core314™ Technologies LLC. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const BETA_REMINDER_HTML = (data: SendGridTemplateData) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Core314 Beta Invitation Reminder</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header with Logo -->
          <tr>
            <td style="padding: 32px 40px; border-bottom: 1px solid #e2e8f0; text-align: center;">
              <img src="https://core314.com/logo-icon.svg" alt="Core314" width="48" height="48" style="display: inline-block;">
              <h1 style="margin: 16px 0 0 0; font-size: 24px; font-weight: 600; color: #0f172a;">Core314</h1>
            </td>
          </tr>
          <!-- Main Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 24px 0; font-size: 22px; font-weight: 600; color: #0f172a; line-height: 1.3;">
                Your Beta Invitation Is Still Available
              </h2>
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #334155;">
                ${data.name ? `${data.name},` : 'Hello,'}
              </p>
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #334155;">
                We recently invited you to participate in the Core314 beta program. Your invitation is still open, and we wanted to follow up in case it was missed.
              </p>
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #334155;">
                Our beta is limited to 25 participants, and spots are filling. If you're interested in shaping how operational intelligence is delivered to modern teams, we'd welcome your participation.
              </p>
              <p style="margin: 0 0 32px 0; font-size: 16px; line-height: 1.6; color: #334155;">
                No pressure—if the timing isn't right, we understand. But if it is, we'd be glad to have you.
              </p>
              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                <tr>
                  <td style="background-color: #0ea5e9; border-radius: 6px;">
                    <a href="${data.beta_link}" style="display: inline-block; padding: 14px 32px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none;">
                      Accept Beta Invitation
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; border-radius: 0 0 8px 8px;">
              <p style="margin: 0 0 8px 0; font-size: 14px; color: #64748b; text-align: center;">
                Questions? Contact us at <a href="mailto:${data.support_email}" style="color: #0ea5e9; text-decoration: none;">${data.support_email}</a>
              </p>
              <p style="margin: 0; font-size: 12px; color: #94a3b8; text-align: center;">
                © 2026 Core314™ Technologies LLC. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const BETA_CHECKIN_HTML = (data: SendGridTemplateData) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Core314 Beta Check-In</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header with Logo -->
          <tr>
            <td style="padding: 32px 40px; border-bottom: 1px solid #e2e8f0; text-align: center;">
              <img src="https://core314.com/logo-icon.svg" alt="Core314" width="48" height="48" style="display: inline-block;">
              <h1 style="margin: 16px 0 0 0; font-size: 24px; font-weight: 600; color: #0f172a;">Core314</h1>
            </td>
          </tr>
          <!-- Main Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 24px 0; font-size: 22px; font-weight: 600; color: #0f172a; line-height: 1.3;">
                Checking In on Your Beta Experience
              </h2>
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #334155;">
                ${data.name ? `${data.name},` : 'Hello,'}
              </p>
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #334155;">
                We noticed it's been a while since you've logged into Core314. We wanted to check in and see how things are going.
              </p>
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #334155;">
                Your feedback during this beta period is invaluable. If you've encountered any challenges, have questions, or simply haven't had time to explore—we're here to help.
              </p>
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #334155;">
                <strong>A few things you might find useful:</strong>
              </p>
              <ul style="margin: 0 0 24px 0; padding-left: 24px; font-size: 16px; line-height: 1.8; color: #334155;">
                <li>Connect your first integration to see Core314 in action</li>
                <li>Explore the System Intelligence dashboard</li>
                <li>Share feedback directly through the platform</li>
              </ul>
              <p style="margin: 0 0 32px 0; font-size: 16px; line-height: 1.6; color: #334155;">
                If the beta isn't the right fit right now, that's completely fine. Just let us know, and we'll adjust accordingly.
              </p>
              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                <tr>
                  <td style="background-color: #0ea5e9; border-radius: 6px;">
                    <a href="${data.beta_link}" style="display: inline-block; padding: 14px 32px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none;">
                      Return to Core314
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; border-radius: 0 0 8px 8px;">
              <p style="margin: 0 0 8px 0; font-size: 14px; color: #64748b; text-align: center;">
                Need help? Reply to this email or contact <a href="mailto:${data.support_email}" style="color: #0ea5e9; text-decoration: none;">${data.support_email}</a>
              </p>
              <p style="margin: 0; font-size: 12px; color: #94a3b8; text-align: center;">
                © 2026 Core314™ Technologies LLC. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const REENGAGEMENT_HTML = (data: SendGridTemplateData) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Core314 - We'd Like to Reconnect</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header with Logo -->
          <tr>
            <td style="padding: 32px 40px; border-bottom: 1px solid #e2e8f0; text-align: center;">
              <img src="https://core314.com/logo-icon.svg" alt="Core314" width="48" height="48" style="display: inline-block;">
              <h1 style="margin: 16px 0 0 0; font-size: 24px; font-weight: 600; color: #0f172a;">Core314</h1>
            </td>
          </tr>
          <!-- Main Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 24px 0; font-size: 22px; font-weight: 600; color: #0f172a; line-height: 1.3;">
                We'd Like to Reconnect
              </h2>
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #334155;">
                ${data.name ? `${data.name},` : 'Hello,'}
              </p>
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #334155;">
                It's been some time since we've connected, and we wanted to reach out. Core314 has continued to evolve, and we think there may be value in reconnecting.
              </p>
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #334155;">
                If your operational challenges have changed, or if you're now in a position to explore how Core314 can help, we'd welcome the conversation.
              </p>
              <p style="margin: 0 0 32px 0; font-size: 16px; line-height: 1.6; color: #334155;">
                No pressure—just an open door if the timing is right.
              </p>
              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                <tr>
                  <td style="background-color: #0ea5e9; border-radius: 6px;">
                    <a href="${data.beta_link}" style="display: inline-block; padding: 14px 32px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none;">
                      Explore Core314
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; border-radius: 0 0 8px 8px;">
              <p style="margin: 0 0 8px 0; font-size: 14px; color: #64748b; text-align: center;">
                Questions? Contact us at <a href="mailto:${data.support_email}" style="color: #0ea5e9; text-decoration: none;">${data.support_email}</a>
              </p>
              <p style="margin: 0; font-size: 12px; color: #94a3b8; text-align: center;">
                © 2026 Core314™ Technologies LLC. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

// Plain text versions
const BETA_INVITE_TEXT = (data: SendGridTemplateData) => `
Core314 Beta Invitation

${data.name ? `${data.name},` : 'Hello,'}

We're opening a limited, invitation-only beta for Core314—a platform designed to bring clarity to complex operational environments.

This beta is not early access. It's a working partnership with operators who understand the challenges of multi-system environments and want to influence how modern systems are observed, analyzed, and acted upon.

What you'll receive:
- Full Core314 access during the beta period
- Direct influence on product direction
- Priority onboarding post-launch
- 50% discount for the first 6 months after launch

If this aligns with your operational challenges, we'd welcome your participation.

Accept your invitation: ${data.beta_link}

Questions? Contact us at ${data.support_email}

© 2026 Core314™ Technologies LLC. All rights reserved.
`;

const BETA_REMINDER_TEXT = (data: SendGridTemplateData) => `
Core314 Beta Invitation Reminder

${data.name ? `${data.name},` : 'Hello,'}

We recently invited you to participate in the Core314 beta program. Your invitation is still open, and we wanted to follow up in case it was missed.

Our beta is limited to 25 participants, and spots are filling. If you're interested in shaping how operational intelligence is delivered to modern teams, we'd welcome your participation.

No pressure—if the timing isn't right, we understand. But if it is, we'd be glad to have you.

Accept your invitation: ${data.beta_link}

Questions? Contact us at ${data.support_email}

© 2026 Core314™ Technologies LLC. All rights reserved.
`;

const BETA_CHECKIN_TEXT = (data: SendGridTemplateData) => `
Core314 Beta Check-In

${data.name ? `${data.name},` : 'Hello,'}

We noticed it's been a while since you've logged into Core314. We wanted to check in and see how things are going.

Your feedback during this beta period is invaluable. If you've encountered any challenges, have questions, or simply haven't had time to explore—we're here to help.

A few things you might find useful:
- Connect your first integration to see Core314 in action
- Explore the System Intelligence dashboard
- Share feedback directly through the platform

If the beta isn't the right fit right now, that's completely fine. Just let us know, and we'll adjust accordingly.

Return to Core314: ${data.beta_link}

Need help? Contact ${data.support_email}

© 2026 Core314™ Technologies LLC. All rights reserved.
`;

const REENGAGEMENT_TEXT = (data: SendGridTemplateData) => `
Core314 - We'd Like to Reconnect

${data.name ? `${data.name},` : 'Hello,'}

It's been some time since we've connected, and we wanted to reach out. Core314 has continued to evolve, and we think there may be value in reconnecting.

If your operational challenges have changed, or if you're now in a position to explore how Core314 can help, we'd welcome the conversation.

No pressure—just an open door if the timing is right.

Explore Core314: ${data.beta_link}

Questions? Contact us at ${data.support_email}

© 2026 Core314™ Technologies LLC. All rights reserved.
`;

// =============================================================================
// EMAIL SENDING
// =============================================================================

async function sendEmailWithTemplate(
  to: string,
  templateId: string,
  templateData: SendGridTemplateData
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const sendgridApiKey = Deno.env.get('SENDGRID_API_KEY');
  const senderEmail = Deno.env.get('SENDGRID_SENDER_EMAIL') || 'noreply@core314.com';
  const senderName = Deno.env.get('SENDGRID_SENDER_NAME') || 'Core314';

  if (!sendgridApiKey) {
    console.error('SENDGRID_API_KEY not configured');
    return { success: false, error: 'Email service not configured' };
  }

  // Check if using a real SendGrid template ID (starts with 'd-')
  const useTemplateId = templateId.startsWith('d-') && !templateId.includes('placeholder');

  try {
    let body: Record<string, unknown>;

    if (useTemplateId) {
      // Use SendGrid dynamic template
      body = {
        personalizations: [{
          to: [{ email: to }],
          dynamic_template_data: {
            name: templateData.name || '',
            company: templateData.company || '',
            beta_link: templateData.beta_link,
            support_email: templateData.support_email,
          },
        }],
        from: { email: senderEmail, name: senderName },
        template_id: templateId,
      };
    } else {
      // Use fallback HTML templates
      const templateType = Object.entries(TEMPLATE_IDS).find(([, id]) => id === templateId)?.[0] || 'beta_invite';
      
      let html: string;
      let text: string;
      let subject: string;

      switch (templateType) {
        case 'beta_reminder':
          html = BETA_REMINDER_HTML(templateData);
          text = BETA_REMINDER_TEXT(templateData);
          subject = 'Your Core314 Beta Invitation Is Still Available';
          break;
        case 'beta_checkin':
          html = BETA_CHECKIN_HTML(templateData);
          text = BETA_CHECKIN_TEXT(templateData);
          subject = 'Checking In on Your Core314 Beta Experience';
          break;
        case 'reengagement':
          html = REENGAGEMENT_HTML(templateData);
          text = REENGAGEMENT_TEXT(templateData);
          subject = 'Core314 - We\'d Like to Reconnect';
          break;
        default:
          html = BETA_INVITE_HTML(templateData);
          text = BETA_INVITE_TEXT(templateData);
          subject = 'You\'re Invited to the Core314 Beta Program';
      }

      body = {
        personalizations: [{ to: [{ email: to }] }],
        from: { email: senderEmail, name: senderName },
        subject,
        content: [
          { type: 'text/plain', value: text },
          { type: 'text/html', value: html },
        ],
      };
    }

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sendgridApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('SendGrid error:', errorText);
      return { success: false, error: 'Failed to send email' };
    }

    // Extract message ID from headers if available
    const messageId = response.headers.get('X-Message-Id') || undefined;

    return { success: true, messageId };
  } catch (error) {
    console.error('Email send error:', error);
    return { success: false, error: 'Failed to send email' };
  }
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

serve(async (req) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Parse request body
    const body: SendMessageRequest = await req.json();

    // Validate required fields
    if (!body.action || !body.recipient_email || !body.admin_user_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: action, recipient_email, admin_user_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.recipient_email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Supabase configuration missing');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Determine message type and template
    const messageType = body.action.replace('send_', '');
    const templateName = MESSAGE_TYPE_TO_TEMPLATE[messageType] || 'beta_invite';
    const templateId = TEMPLATE_IDS[templateName as keyof typeof TEMPLATE_IDS] || TEMPLATE_IDS.beta_invite;

    // Prepare template data
    const betaLink = Deno.env.get('BETA_SIGNUP_URL') || 'https://app.core314.com/beta-invite';
    const supportEmail = Deno.env.get('SUPPORT_EMAIL') || 'support@core314.com';

    const templateData: SendGridTemplateData = {
      name: body.recipient_name,
      company: body.recipient_company,
      beta_link: betaLink,
      support_email: supportEmail,
    };

    // Send the email
    const emailResult = await sendEmailWithTemplate(
      body.recipient_email,
      templateId,
      templateData
    );

    // Log the message send
    const { data: logEntry, error: logError } = await supabase
      .from('admin_messaging_log')
      .insert({
        admin_user_id: body.admin_user_id,
        recipient_email: body.recipient_email,
        recipient_name: body.recipient_name || null,
        recipient_company: body.recipient_company || null,
        template_name: templateName,
        message_type: messageType,
        send_status: emailResult.success ? 'sent' : 'failed',
        sendgrid_message_id: emailResult.messageId || null,
        error_message: emailResult.error || null,
        context: body.context || {},
        sent_at: emailResult.success ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (logError) {
      console.error('Failed to log message:', logError);
    }

    // If this is a beta invite, also create/update the beta_invitations record
    if (messageType === 'beta_invite' && emailResult.success) {
      const { error: inviteError } = await supabase
        .from('beta_invitations')
        .upsert({
          email: body.recipient_email,
          name: body.recipient_name || null,
          company: body.recipient_company || null,
          status: 'sent',
          invited_by: body.admin_user_id,
          sent_count: 1,
          last_sent_at: new Date().toISOString(),
          last_message_id: logEntry?.id || null,
        }, {
          onConflict: 'email',
        });

      if (inviteError) {
        console.error('Failed to update beta invitation:', inviteError);
      }
    }

    // Return response
    if (emailResult.success) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Email sent successfully',
          log_id: logEntry?.id,
          message_id: emailResult.messageId,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          error: emailResult.error || 'Failed to send email',
          log_id: logEntry?.id,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
