/**
 * Supabase Auth Email Hook - SendGrid Integration
 * 
 * This function intercepts Supabase Auth email events and sends branded
 * transactional emails via SendGrid for:
 * - Email verification (signup confirmation)
 * - Password reset
 * - Magic link login
 * - Email change confirmation
 * 
 * Professional, minimal HTML templates with Core314 branding.
 * No marketing content. Clear subject lines. Plain, readable body copy.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY') || '';
const SENDGRID_SENDER_EMAIL = Deno.env.get('SENDGRID_SENDER_EMAIL') || 'noreply@core314.com';
const SENDGRID_SENDER_NAME = Deno.env.get('SENDGRID_SENDER_NAME') || 'Core314';
const APP_URL = Deno.env.get('APP_URL') || 'https://app.core314.com';

// Base email template wrapper - professional, minimal design
const createEmailTemplate = (content: string, preheader: string = '') => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Core314</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    body { margin: 0; padding: 0; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
    a { color: #0066cc; text-decoration: none; }
    @media only screen and (max-width: 600px) {
      .container { width: 100% !important; padding: 10px !important; }
      .content { padding: 20px !important; }
      .button { width: 100% !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc; line-height: 1.6;">
  ${preheader ? `<div style="display: none; max-height: 0; overflow: hidden;">${preheader}</div>` : ''}
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f8fafc;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="container" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header with Logo -->
          <tr>
            <td style="padding: 32px 40px 24px 40px; border-bottom: 1px solid #e2e8f0;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td>
                    <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #0f172a; letter-spacing: -0.5px;">Core314</h1>
                    <p style="margin: 4px 0 0 0; font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">System Intelligence</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td class="content" style="padding: 32px 40px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; border-radius: 0 0 8px 8px;">
              <p style="margin: 0 0 8px 0; font-size: 12px; color: #64748b;">
                This is an automated message from Core314. Please do not reply directly to this email.
              </p>
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                &copy; ${new Date().getFullYear()} Core314. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

// Email Verification Template
const EMAIL_VERIFICATION_HTML = (confirmationUrl: string) => createEmailTemplate(`
  <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #0f172a;">Verify your email address</h2>
  <p style="margin: 0 0 24px 0; font-size: 15px; color: #475569;">
    Thank you for signing up for Core314. To complete your registration and access your account, please verify your email address by clicking the button below.
  </p>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 24px 0;">
    <tr>
      <td style="background-color: #0f172a; border-radius: 6px;">
        <a href="${confirmationUrl}" class="button" style="display: inline-block; padding: 14px 28px; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none;">Verify Email Address</a>
      </td>
    </tr>
  </table>
  <p style="margin: 0 0 16px 0; font-size: 14px; color: #64748b;">
    If the button above doesn't work, copy and paste this link into your browser:
  </p>
  <p style="margin: 0 0 24px 0; font-size: 13px; color: #0066cc; word-break: break-all;">
    ${confirmationUrl}
  </p>
  <p style="margin: 0; font-size: 13px; color: #94a3b8;">
    This link will expire in 24 hours. If you did not create an account with Core314, you can safely ignore this email.
  </p>
`, 'Verify your email address to complete your Core314 registration');

const EMAIL_VERIFICATION_TEXT = (confirmationUrl: string) => `Verify your email address

Thank you for signing up for Core314. To complete your registration and access your account, please verify your email address by clicking the link below.

Verify Email: ${confirmationUrl}

This link will expire in 24 hours. If you did not create an account with Core314, you can safely ignore this email.

---
Core314 - System Intelligence
This is an automated message. Please do not reply directly to this email.`;

// Password Reset Template
const PASSWORD_RESET_HTML = (resetUrl: string) => createEmailTemplate(`
  <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #0f172a;">Reset your password</h2>
  <p style="margin: 0 0 24px 0; font-size: 15px; color: #475569;">
    We received a request to reset the password for your Core314 account. Click the button below to choose a new password.
  </p>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 24px 0;">
    <tr>
      <td style="background-color: #0f172a; border-radius: 6px;">
        <a href="${resetUrl}" class="button" style="display: inline-block; padding: 14px 28px; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none;">Reset Password</a>
      </td>
    </tr>
  </table>
  <p style="margin: 0 0 16px 0; font-size: 14px; color: #64748b;">
    If the button above doesn't work, copy and paste this link into your browser:
  </p>
  <p style="margin: 0 0 24px 0; font-size: 13px; color: #0066cc; word-break: break-all;">
    ${resetUrl}
  </p>
  <p style="margin: 0; font-size: 13px; color: #94a3b8;">
    This link will expire in 1 hour. If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.
  </p>
`, 'Reset your Core314 password');

const PASSWORD_RESET_TEXT = (resetUrl: string) => `Reset your password

We received a request to reset the password for your Core314 account. Click the link below to choose a new password.

Reset Password: ${resetUrl}

This link will expire in 1 hour. If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.

---
Core314 - System Intelligence
This is an automated message. Please do not reply directly to this email.`;

// Magic Link Template
const MAGIC_LINK_HTML = (magicLinkUrl: string) => createEmailTemplate(`
  <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #0f172a;">Sign in to Core314</h2>
  <p style="margin: 0 0 24px 0; font-size: 15px; color: #475569;">
    Click the button below to securely sign in to your Core314 account. No password required.
  </p>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 24px 0;">
    <tr>
      <td style="background-color: #0f172a; border-radius: 6px;">
        <a href="${magicLinkUrl}" class="button" style="display: inline-block; padding: 14px 28px; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none;">Sign In to Core314</a>
      </td>
    </tr>
  </table>
  <p style="margin: 0 0 16px 0; font-size: 14px; color: #64748b;">
    If the button above doesn't work, copy and paste this link into your browser:
  </p>
  <p style="margin: 0 0 24px 0; font-size: 13px; color: #0066cc; word-break: break-all;">
    ${magicLinkUrl}
  </p>
  <p style="margin: 0; font-size: 13px; color: #94a3b8;">
    This link will expire in 1 hour and can only be used once. If you did not request this sign-in link, you can safely ignore this email.
  </p>
`, 'Sign in to your Core314 account');

const MAGIC_LINK_TEXT = (magicLinkUrl: string) => `Sign in to Core314

Click the link below to securely sign in to your Core314 account. No password required.

Sign In: ${magicLinkUrl}

This link will expire in 1 hour and can only be used once. If you did not request this sign-in link, you can safely ignore this email.

---
Core314 - System Intelligence
This is an automated message. Please do not reply directly to this email.`;

// Email Change Confirmation Template
const EMAIL_CHANGE_HTML = (confirmationUrl: string, newEmail: string) => createEmailTemplate(`
  <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #0f172a;">Confirm your new email address</h2>
  <p style="margin: 0 0 24px 0; font-size: 15px; color: #475569;">
    You requested to change your Core314 account email to <strong>${newEmail}</strong>. Click the button below to confirm this change.
  </p>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 24px 0;">
    <tr>
      <td style="background-color: #0f172a; border-radius: 6px;">
        <a href="${confirmationUrl}" class="button" style="display: inline-block; padding: 14px 28px; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none;">Confirm Email Change</a>
      </td>
    </tr>
  </table>
  <p style="margin: 0 0 16px 0; font-size: 14px; color: #64748b;">
    If the button above doesn't work, copy and paste this link into your browser:
  </p>
  <p style="margin: 0 0 24px 0; font-size: 13px; color: #0066cc; word-break: break-all;">
    ${confirmationUrl}
  </p>
  <p style="margin: 0; font-size: 13px; color: #94a3b8;">
    This link will expire in 24 hours. If you did not request this email change, please contact support immediately.
  </p>
`, 'Confirm your new Core314 email address');

const EMAIL_CHANGE_TEXT = (confirmationUrl: string, newEmail: string) => `Confirm your new email address

You requested to change your Core314 account email to ${newEmail}. Click the link below to confirm this change.

Confirm Email Change: ${confirmationUrl}

This link will expire in 24 hours. If you did not request this email change, please contact support immediately.

---
Core314 - System Intelligence
This is an automated message. Please do not reply directly to this email.`;

// System Notification Template (generic)
const SYSTEM_NOTIFICATION_HTML = (title: string, message: string, actionUrl?: string, actionText?: string) => createEmailTemplate(`
  <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #0f172a;">${title}</h2>
  <p style="margin: 0 0 24px 0; font-size: 15px; color: #475569;">
    ${message}
  </p>
  ${actionUrl && actionText ? `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 24px 0;">
    <tr>
      <td style="background-color: #0f172a; border-radius: 6px;">
        <a href="${actionUrl}" class="button" style="display: inline-block; padding: 14px 28px; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none;">${actionText}</a>
      </td>
    </tr>
  </table>
  ` : ''}
`, title);

const SYSTEM_NOTIFICATION_TEXT = (title: string, message: string, actionUrl?: string, actionText?: string) => `${title}

${message}

${actionUrl ? `${actionText || 'Take Action'}: ${actionUrl}` : ''}

---
Core314 - System Intelligence
This is an automated message. Please do not reply directly to this email.`;

// Email type configurations
interface EmailConfig {
  subject: string;
  html: string;
  text: string;
}

function getEmailConfig(type: string, data: Record<string, string>): EmailConfig | null {
  const confirmationUrl = data.confirmation_url || data.action_link || '';
  const newEmail = data.new_email || '';
  const title = data.title || 'System Notification';
  const message = data.message || '';
  const actionUrl = data.action_url || '';
  const actionText = data.action_text || '';

  switch (type) {
    case 'signup':
    case 'email_verification':
    case 'confirm_signup':
      return {
        subject: 'Verify your Core314 email address',
        html: EMAIL_VERIFICATION_HTML(confirmationUrl),
        text: EMAIL_VERIFICATION_TEXT(confirmationUrl),
      };
    
    case 'recovery':
    case 'password_reset':
    case 'reset_password':
      return {
        subject: 'Reset your Core314 password',
        html: PASSWORD_RESET_HTML(confirmationUrl),
        text: PASSWORD_RESET_TEXT(confirmationUrl),
      };
    
    case 'magiclink':
    case 'magic_link':
      return {
        subject: 'Sign in to Core314',
        html: MAGIC_LINK_HTML(confirmationUrl),
        text: MAGIC_LINK_TEXT(confirmationUrl),
      };
    
    case 'email_change':
    case 'change_email':
      return {
        subject: 'Confirm your new Core314 email address',
        html: EMAIL_CHANGE_HTML(confirmationUrl, newEmail),
        text: EMAIL_CHANGE_TEXT(confirmationUrl, newEmail),
      };
    
    case 'system_notification':
    case 'notification':
      return {
        subject: title,
        html: SYSTEM_NOTIFICATION_HTML(title, message, actionUrl, actionText),
        text: SYSTEM_NOTIFICATION_TEXT(title, message, actionUrl, actionText),
      };
    
    default:
      return null;
  }
}

async function sendEmail(to: string, config: EmailConfig): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!SENDGRID_API_KEY) {
    console.error('SENDGRID_API_KEY is not configured');
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: {
          email: SENDGRID_SENDER_EMAIL,
          name: SENDGRID_SENDER_NAME,
        },
        subject: config.subject,
        content: [
          { type: 'text/plain', value: config.text },
          { type: 'text/html', value: config.html },
        ],
      }),
    });

    if (response.ok) {
      const messageId = response.headers.get('x-message-id') || undefined;
      return { success: true, messageId };
    } else {
      const errorText = await response.text();
      console.error('SendGrid API error:', errorText);
      return { success: false, error: errorText };
    }
  } catch (error) {
    console.error('SendGrid request failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Supabase Auth Hooks are trusted system calls - no authorization verification needed
  // Supabase handles verification internally before calling this function
  // See: https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook

  try {
    const payload = await req.json();
    
    // Supabase Auth Hook payload structure
    // https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook
    const { user, email_data } = payload;
    
    if (!user?.email || !email_data?.token_hash) {
      // Fallback for direct API calls (non-hook usage)
      const { type, to, data } = payload;
      
      if (!type || !to) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields: type, to' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const config = getEmailConfig(type, data || {});
      if (!config) {
        return new Response(
          JSON.stringify({ error: `Unknown email type: ${type}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const result = await sendEmail(to, config);
      
      if (result.success) {
        return new Response(
          JSON.stringify({ success: true, message_id: result.messageId }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        return new Response(
          JSON.stringify({ error: 'Failed to send email', details: result.error }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Handle Supabase Auth Hook
    const emailType = email_data.email_action_type || 'signup';
    const recipientEmail = user.email;
    
    // Build confirmation URL from token
    const baseUrl = APP_URL;
    const tokenHash = email_data.token_hash;
    const redirectTo = email_data.redirect_to || `${baseUrl}/dashboard`;
    
    // Construct the confirmation URL based on email type
    let confirmationUrl = '';
    switch (emailType) {
      case 'signup':
      case 'email_verification':
        confirmationUrl = `${baseUrl}/auth/confirm?token_hash=${tokenHash}&type=signup&redirect_to=${encodeURIComponent(redirectTo)}`;
        break;
      case 'recovery':
        confirmationUrl = `${baseUrl}/auth/confirm?token_hash=${tokenHash}&type=recovery&redirect_to=${encodeURIComponent(redirectTo)}`;
        break;
      case 'magiclink':
        confirmationUrl = `${baseUrl}/auth/confirm?token_hash=${tokenHash}&type=magiclink&redirect_to=${encodeURIComponent(redirectTo)}`;
        break;
      case 'email_change':
        confirmationUrl = `${baseUrl}/auth/confirm?token_hash=${tokenHash}&type=email_change&redirect_to=${encodeURIComponent(redirectTo)}`;
        break;
      default:
        confirmationUrl = `${baseUrl}/auth/confirm?token_hash=${tokenHash}&type=${emailType}&redirect_to=${encodeURIComponent(redirectTo)}`;
    }

    const config = getEmailConfig(emailType, {
      confirmation_url: confirmationUrl,
      new_email: email_data.new_email || '',
    });

    if (!config) {
      console.error(`Unknown email type from auth hook: ${emailType}`);
      return new Response(
        JSON.stringify({ error: `Unknown email type: ${emailType}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = await sendEmail(recipientEmail, config);

    // Log the email event
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      await supabase.from('fusion_audit_log').insert({
        user_id: user.id || null,
        event_type: result.success ? 'auth_email_sent' : 'auth_email_failed',
        event_data: {
          email_type: emailType,
          recipient: recipientEmail,
          message_id: result.messageId,
          error: result.error,
          status: result.success ? 'sent' : 'failed',
        },
      });
    } catch (logError) {
      console.error('Failed to log email event:', logError);
    }

    if (result.success) {
      return new Response(
        JSON.stringify({ success: true, message_id: result.messageId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      return new Response(
        JSON.stringify({ error: 'Failed to send email', details: result.error }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Auth email hook error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
