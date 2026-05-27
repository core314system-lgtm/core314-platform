import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// =============================================================================
// BETA APPLICATION EMAILS
// Handles:
// 1. Application confirmation (sent immediately when form is submitted)
// 2. Rejection notification (called by admin when rejecting an application)
// =============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// =============================================================================
// EMAIL TEMPLATES
// =============================================================================

function getApplicationConfirmHTML(name: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Application Received - Core314 Beta Program</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0A0F1A; color: #ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0A0F1A; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0">
          <!-- Logo -->
          <tr>
            <td style="text-align: center; padding-bottom: 30px;">
              <span style="font-size: 32px; font-weight: 700; color: #00BFFF; letter-spacing: 2px;">CORE314</span>
            </td>
          </tr>
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #00BFFF 0%, #007BFF 100%); padding: 40px 30px; border-radius: 12px; text-align: center;">
              <h1 style="margin: 0; font-size: 26px; font-weight: 700; color: #ffffff;">Application Received</h1>
            </td>
          </tr>
          <tr><td style="height: 24px;"></td></tr>
          <!-- Main Content -->
          <tr>
            <td style="background-color: #1A1F2E; padding: 30px; border-radius: 12px; border: 1px solid #2A3F5F;">
              <p style="font-size: 16px; line-height: 1.6; color: #E0E0E0; margin: 0 0 20px 0;">
                ${name},
              </p>
              <p style="font-size: 16px; line-height: 1.6; color: #E0E0E0; margin: 0 0 20px 0;">
                Thank you for applying to the <strong style="color: #00BFFF;">Core314 Beta Program</strong>. We've received your application and our team is reviewing it now.
              </p>
              <p style="font-size: 16px; line-height: 1.6; color: #E0E0E0; margin: 0 0 10px 0;">
                <strong style="color: #00BFFF;">What happens next:</strong>
              </p>
              <ul style="margin: 0 0 20px 0; padding-left: 24px; font-size: 16px; line-height: 1.8; color: #E0E0E0;">
                <li>Our team reviews applications within <strong>1-2 business days</strong></li>
                <li>You'll receive an email with your acceptance or next steps</li>
                <li>If accepted, you'll get <strong>45 days</strong> of full Command Center access</li>
                <li>Beta testers earn an exclusive <strong style="color: #00BFFF;">50% discount</strong> for 6 months</li>
              </ul>
              <p style="font-size: 16px; line-height: 1.6; color: #E0E0E0; margin: 0 0 0 0;">
                We're selecting a small group of forward-thinking leaders to help shape the future of operational intelligence. We'll be in touch soon.
              </p>
            </td>
          </tr>
          <tr><td style="height: 24px;"></td></tr>
          <!-- Footer -->
          <tr>
            <td style="text-align: center; padding: 20px;">
              <p style="margin: 0 0 8px 0; font-size: 14px; color: #64748b;">
                Questions? <a href="mailto:admin@core314.com" style="color: #00BFFF; text-decoration: none;">admin@core314.com</a>
              </p>
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                &copy; 2026 Core314&trade; Technologies LLC. All rights reserved.
              </p>
              <p style="margin: 8px 0 0 0; font-size: 12px;">
                <a href="https://core314.com/privacy" style="color: #00BFFF; text-decoration: none;">Privacy Policy</a> |
                <a href="https://core314.com/terms" style="color: #00BFFF; text-decoration: none;">Terms of Service</a>
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

function getApplicationConfirmText(name: string): string {
  return `Application Received - Core314 Beta Program

${name},

Thank you for applying to the Core314 Beta Program. We've received your application and our team is reviewing it now.

WHAT HAPPENS NEXT:
- Our team reviews applications within 1-2 business days
- You'll receive an email with your acceptance or next steps
- If accepted, you'll get 45 days of full Command Center access
- Beta testers earn an exclusive 50% discount for 6 months

We're selecting a small group of forward-thinking leaders to help shape the future of operational intelligence. We'll be in touch soon.

Questions? admin@core314.com

(c) 2026 Core314 Technologies LLC. All rights reserved.`;
}

function getRejectionHTML(name: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Beta Program Update - Core314</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0A0F1A; color: #ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0A0F1A; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0">
          <!-- Logo -->
          <tr>
            <td style="text-align: center; padding-bottom: 30px;">
              <span style="font-size: 32px; font-weight: 700; color: #00BFFF; letter-spacing: 2px;">CORE314</span>
            </td>
          </tr>
          <!-- Main Content -->
          <tr>
            <td style="background-color: #1A1F2E; padding: 30px; border-radius: 12px; border: 1px solid #2A3F5F;">
              <p style="font-size: 16px; line-height: 1.6; color: #E0E0E0; margin: 0 0 20px 0;">
                ${name},
              </p>
              <p style="font-size: 16px; line-height: 1.6; color: #E0E0E0; margin: 0 0 20px 0;">
                Thank you for your interest in the Core314 Beta Program. After careful review, we're unable to offer you a spot in this round of the beta.
              </p>
              <p style="font-size: 16px; line-height: 1.6; color: #E0E0E0; margin: 0 0 20px 0;">
                This doesn't mean we aren't interested — we had an overwhelming number of qualified applicants and limited spots. We'd love to keep you in the loop for future opportunities.
              </p>
              <p style="font-size: 16px; line-height: 1.6; color: #E0E0E0; margin: 0 0 10px 0;">
                <strong style="color: #00BFFF;">What you can do now:</strong>
              </p>
              <ul style="margin: 0 0 20px 0; padding-left: 24px; font-size: 16px; line-height: 1.8; color: #E0E0E0;">
                <li>Start a <strong>14-day free trial</strong> of Core314 at <a href="https://core314.com/signup" style="color: #00BFFF;">core314.com/signup</a></li>
                <li>You'll still get full access to operational intelligence during your trial</li>
                <li>We occasionally open new beta spots — we'll reach out if one becomes available</li>
              </ul>
              <p style="font-size: 16px; line-height: 1.6; color: #E0E0E0; margin: 0 0 0 0;">
                We appreciate you taking the time to apply and we hope to work with you soon.
              </p>
            </td>
          </tr>
          <tr><td style="height: 24px;"></td></tr>
          <!-- Footer -->
          <tr>
            <td style="text-align: center; padding: 20px;">
              <p style="margin: 0 0 8px 0; font-size: 14px; color: #64748b;">
                Questions? <a href="mailto:admin@core314.com" style="color: #00BFFF; text-decoration: none;">admin@core314.com</a>
              </p>
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                &copy; 2026 Core314&trade; Technologies LLC. All rights reserved.
              </p>
              <p style="margin: 8px 0 0 0; font-size: 12px;">
                <a href="https://core314.com/privacy" style="color: #00BFFF; text-decoration: none;">Privacy Policy</a> |
                <a href="https://core314.com/terms" style="color: #00BFFF; text-decoration: none;">Terms of Service</a>
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

function getRejectionText(name: string): string {
  return `Beta Program Update - Core314

${name},

Thank you for your interest in the Core314 Beta Program. After careful review, we're unable to offer you a spot in this round of the beta.

This doesn't mean we aren't interested - we had an overwhelming number of qualified applicants and limited spots. We'd love to keep you in the loop for future opportunities.

WHAT YOU CAN DO NOW:
- Start a 14-day free trial of Core314 at core314.com/signup
- You'll still get full access to operational intelligence during your trial
- We occasionally open new beta spots - we'll reach out if one becomes available

We appreciate you taking the time to apply and we hope to work with you soon.

Questions? admin@core314.com

(c) 2026 Core314 Technologies LLC. All rights reserved.`;
}

function getConversionConfirmHTML(name: string, discountAmount: string, fullPrice: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Core314 Command Center</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0A0F1A; color: #ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0A0F1A; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0">
          <!-- Logo -->
          <tr>
            <td style="text-align: center; padding-bottom: 30px;">
              <span style="font-size: 32px; font-weight: 700; color: #00BFFF; letter-spacing: 2px;">CORE314</span>
            </td>
          </tr>
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); padding: 40px 30px; border-radius: 12px; text-align: center;">
              <h1 style="margin: 0; font-size: 26px; font-weight: 700; color: #ffffff;">You're All Set!</h1>
            </td>
          </tr>
          <tr><td style="height: 24px;"></td></tr>
          <!-- Main Content -->
          <tr>
            <td style="background-color: #1A1F2E; padding: 30px; border-radius: 12px; border: 1px solid #2A3F5F;">
              <p style="font-size: 16px; line-height: 1.6; color: #E0E0E0; margin: 0 0 20px 0;">
                ${name},
              </p>
              <p style="font-size: 16px; line-height: 1.6; color: #E0E0E0; margin: 0 0 20px 0;">
                Your beta tester discount has been activated. Welcome to the <strong style="color: #10B981;">Core314 Command Center</strong> as a paying subscriber.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0F172A; border-radius: 8px; margin: 0 0 20px 0;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="font-size: 14px; color: #94a3b8; margin: 0 0 8px 0;">YOUR PLAN</p>
                    <p style="font-size: 20px; font-weight: 700; color: #10B981; margin: 0 0 4px 0;">Command Center — ${discountAmount}/mo</p>
                    <p style="font-size: 14px; color: #94a3b8; margin: 0; text-decoration: line-through;">${fullPrice}/mo standard price</p>
                    <p style="font-size: 14px; color: #10B981; margin: 4px 0 0 0;">50% beta discount applied for 6 months</p>
                  </td>
                </tr>
              </table>
              <p style="font-size: 16px; line-height: 1.6; color: #E0E0E0; margin: 0 0 10px 0;">
                <strong style="color: #00BFFF;">What's included:</strong>
              </p>
              <ul style="margin: 0 0 20px 0; padding-left: 24px; font-size: 16px; line-height: 1.8; color: #E0E0E0;">
                <li>Up to 10 integrations</li>
                <li>Advanced signal analytics</li>
                <li>Operational pattern detection</li>
                <li>Weekly executive reports</li>
                <li>Up to 25 team members</li>
                <li>Priority support</li>
              </ul>
              <p style="font-size: 14px; line-height: 1.6; color: #94a3b8; margin: 0;">
                You can manage your subscription anytime from your <a href="https://app.core314.com/billing" style="color: #00BFFF; text-decoration: none;">Billing page</a>.
              </p>
            </td>
          </tr>
          <tr><td style="height: 24px;"></td></tr>
          <!-- Footer -->
          <tr>
            <td style="text-align: center; padding: 20px;">
              <p style="margin: 0 0 8px 0; font-size: 14px; color: #64748b;">
                Questions? <a href="mailto:admin@core314.com" style="color: #00BFFF; text-decoration: none;">admin@core314.com</a>
              </p>
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                &copy; 2026 Core314&trade; Technologies LLC. All rights reserved.
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

function getConversionConfirmText(name: string, discountAmount: string, fullPrice: string): string {
  return `You're All Set! - Core314 Command Center

${name},

Your beta tester discount has been activated. Welcome to the Core314 Command Center as a paying subscriber.

YOUR PLAN:
Command Center - ${discountAmount}/mo (50% beta discount for 6 months)
Standard price: ${fullPrice}/mo

WHAT'S INCLUDED:
- Up to 10 integrations
- Advanced signal analytics
- Operational pattern detection
- Weekly executive reports
- Up to 25 team members
- Priority support

You can manage your subscription anytime from your Billing page at https://app.core314.com/billing

Questions? admin@core314.com

(c) 2026 Core314 Technologies LLC. All rights reserved.`;
}

// =============================================================================
// EMAIL SENDING
// =============================================================================

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text: string
): Promise<{ success: boolean; error?: string }> {
  const sendgridApiKey = Deno.env.get('SENDGRID_API_KEY');
  const senderEmail = Deno.env.get('SENDGRID_SENDER_EMAIL') || 'team@procuvex.com';
  const senderName = Deno.env.get('SENDGRID_SENDER_NAME') || 'Core314';

  if (!sendgridApiKey) {
    return { success: false, error: 'SENDGRID_API_KEY not configured' };
  }

  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sendgridApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: senderEmail, name: senderName },
        reply_to: { email: 'admin@core314.com', name: 'Core314 Team' },
        subject,
        content: [
          { type: 'text/plain', value: text },
          { type: 'text/html', value: html },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('SendGrid error:', errorText);
      return { success: false, error: `SendGrid ${response.status}` };
    }

    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, error: msg };
  }
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.json();
    const { action, email, name, application_id } = body;

    if (!action) {
      return new Response(
        JSON.stringify({ error: 'action is required (confirm | reject | conversion_confirm)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =========================================================================
    // ACTION: confirm — Send application confirmation
    // =========================================================================
    if (action === 'confirm') {
      if (!email || !name) {
        return new Response(
          JSON.stringify({ error: 'email and name are required for confirm action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const result = await sendEmail(
        email,
        'Application Received — Core314 Beta Program',
        getApplicationConfirmHTML(name),
        getApplicationConfirmText(name),
      );

      // Log to admin_messaging_log
      await supabase.from('admin_messaging_log').insert({
        admin_user_id: '00000000-0000-0000-0000-000000000000',
        recipient_email: email,
        recipient_name: name,
        template_name: 'beta_application_confirm',
        message_type: 'beta_lifecycle',
        send_status: result.success ? 'sent' : 'failed',
        error_message: result.error || null,
        context: { application_id },
      });

      return new Response(
        JSON.stringify({ success: result.success, error: result.error }),
        { status: result.success ? 200 : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =========================================================================
    // ACTION: reject — Send rejection notification
    // =========================================================================
    if (action === 'reject') {
      if (!email || !name) {
        return new Response(
          JSON.stringify({ error: 'email and name are required for reject action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const result = await sendEmail(
        email,
        'Beta Program Update — Core314',
        getRejectionHTML(name),
        getRejectionText(name),
      );

      // Update application status if application_id provided
      if (application_id) {
        await supabase
          .from('beta_applications')
          .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
          .eq('id', application_id);
      }

      await supabase.from('admin_messaging_log').insert({
        admin_user_id: '00000000-0000-0000-0000-000000000000',
        recipient_email: email,
        recipient_name: name,
        template_name: 'beta_application_reject',
        message_type: 'beta_lifecycle',
        send_status: result.success ? 'sent' : 'failed',
        error_message: result.error || null,
        context: { application_id },
      });

      return new Response(
        JSON.stringify({ success: result.success, error: result.error }),
        { status: result.success ? 200 : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =========================================================================
    // ACTION: conversion_confirm — Send beta conversion confirmation
    // =========================================================================
    if (action === 'conversion_confirm') {
      if (!email || !name) {
        return new Response(
          JSON.stringify({ error: 'email and name are required for conversion_confirm action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const result = await sendEmail(
        email,
        'Welcome to Core314 Command Center — Your Beta Discount is Active',
        getConversionConfirmHTML(name, '$399.50', '$799'),
        getConversionConfirmText(name, '$399.50', '$799'),
      );

      await supabase.from('admin_messaging_log').insert({
        admin_user_id: '00000000-0000-0000-0000-000000000000',
        recipient_email: email,
        recipient_name: name,
        template_name: 'beta_conversion_confirm',
        message_type: 'beta_lifecycle',
        send_status: result.success ? 'sent' : 'failed',
        error_message: result.error || null,
        context: { application_id },
      });

      return new Response(
        JSON.stringify({ success: result.success, error: result.error }),
        { status: result.success ? 200 : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}. Valid: confirm, reject, conversion_confirm` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Unexpected error:', msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
