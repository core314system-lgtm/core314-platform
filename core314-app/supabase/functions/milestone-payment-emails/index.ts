import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// =============================================================================
// MILESTONE & PAYMENT EMAILS
// Handles:
// 1. integration_connected — First integration connected milestone
// 2. first_brief — First operational brief generated
// 3. payment_success — Payment/subscription confirmation
// 4. payment_failed — Dunning / failed payment notification
// =============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// =============================================================================
// EMAIL TEMPLATES
// =============================================================================

function getIntegrationConnectedHTML(name: string, integrationName: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Integration Connected - Core314</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0A0F1A; color: #ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0A0F1A; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0">
          <tr>
            <td style="text-align: center; padding-bottom: 30px;">
              <span style="font-size: 32px; font-weight: 700; color: #00BFFF; letter-spacing: 2px;">CORE314</span>
            </td>
          </tr>
          <tr>
            <td style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); padding: 40px 30px; border-radius: 12px; text-align: center;">
              <h1 style="margin: 0; font-size: 26px; font-weight: 700; color: #ffffff;">Integration Connected!</h1>
            </td>
          </tr>
          <tr><td style="height: 24px;"></td></tr>
          <tr>
            <td style="background-color: #1A1F2E; padding: 30px; border-radius: 12px; border: 1px solid #2A3F5F;">
              <p style="font-size: 16px; line-height: 1.6; color: #E0E0E0; margin: 0 0 20px 0;">
                ${name},
              </p>
              <p style="font-size: 16px; line-height: 1.6; color: #E0E0E0; margin: 0 0 20px 0;">
                Great news — your <strong style="color: #10B981;">${integrationName}</strong> integration is now connected and pulling data into Core314.
              </p>
              <p style="font-size: 16px; line-height: 1.6; color: #E0E0E0; margin: 0 0 10px 0;">
                <strong style="color: #00BFFF;">What happens next:</strong>
              </p>
              <ul style="margin: 0 0 20px 0; padding-left: 24px; font-size: 16px; line-height: 1.8; color: #E0E0E0;">
                <li>Core314 begins analyzing signals from ${integrationName}</li>
                <li>Your next operational brief will include insights from this source</li>
                <li>Your Health Score will update to reflect the new data</li>
              </ul>
              <p style="font-size: 16px; line-height: 1.6; color: #E0E0E0; margin: 0 0 20px 0;">
                <strong style="color: #00BFFF;">Pro tip:</strong> Connect 3+ integrations for the richest intelligence. More data sources = better pattern detection.
              </p>
              <center>
                <a href="https://app.core314.com/integrations" style="display: inline-block; background: linear-gradient(90deg, #10B981, #059669); color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                  Manage Integrations
                </a>
              </center>
            </td>
          </tr>
          <tr><td style="height: 24px;"></td></tr>
          <tr>
            <td style="text-align: center; padding: 20px;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">&copy; 2026 Core314&trade; Technologies LLC. All rights reserved.</p>
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

function getIntegrationConnectedText(name: string, integrationName: string): string {
  return `Integration Connected! - Core314

${name},

Great news - your ${integrationName} integration is now connected and pulling data into Core314.

WHAT HAPPENS NEXT:
- Core314 begins analyzing signals from ${integrationName}
- Your next operational brief will include insights from this source
- Your Health Score will update to reflect the new data

PRO TIP: Connect 3+ integrations for the richest intelligence. More data sources = better pattern detection.

Manage Integrations: https://app.core314.com/integrations

(c) 2026 Core314 Technologies LLC. All rights reserved.`;
}

function getFirstBriefHTML(name: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your First Brief is Ready - Core314</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0A0F1A; color: #ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0A0F1A; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0">
          <tr>
            <td style="text-align: center; padding-bottom: 30px;">
              <span style="font-size: 32px; font-weight: 700; color: #00BFFF; letter-spacing: 2px;">CORE314</span>
            </td>
          </tr>
          <tr>
            <td style="background: linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%); padding: 40px 30px; border-radius: 12px; text-align: center;">
              <h1 style="margin: 0; font-size: 26px; font-weight: 700; color: #ffffff;">Your First Brief is Ready</h1>
            </td>
          </tr>
          <tr><td style="height: 24px;"></td></tr>
          <tr>
            <td style="background-color: #1A1F2E; padding: 30px; border-radius: 12px; border: 1px solid #2A3F5F;">
              <p style="font-size: 16px; line-height: 1.6; color: #E0E0E0; margin: 0 0 20px 0;">
                ${name},
              </p>
              <p style="font-size: 16px; line-height: 1.6; color: #E0E0E0; margin: 0 0 20px 0;">
                Your first <strong style="color: #8B5CF6;">Operational Intelligence Brief</strong> has been generated! This is where Core314 starts delivering real value — turning your operational data into actionable insights.
              </p>
              <p style="font-size: 16px; line-height: 1.6; color: #E0E0E0; margin: 0 0 10px 0;">
                <strong style="color: #00BFFF;">Your brief includes:</strong>
              </p>
              <ul style="margin: 0 0 20px 0; padding-left: 24px; font-size: 16px; line-height: 1.8; color: #E0E0E0;">
                <li>Operational Health Score with trend analysis</li>
                <li>Key signals detected across your integrations</li>
                <li>Risk areas and recommended actions</li>
                <li>Cross-platform pattern analysis</li>
              </ul>
              <p style="font-size: 16px; line-height: 1.6; color: #E0E0E0; margin: 0 0 24px 0;">
                Briefs improve over time as Core314 learns your operational patterns. The more you use it, the sharper the insights become.
              </p>
              <center>
                <a href="https://app.core314.com/brief" style="display: inline-block; background: linear-gradient(90deg, #8B5CF6, #6D28D9); color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                  View Your Brief
                </a>
              </center>
            </td>
          </tr>
          <tr><td style="height: 24px;"></td></tr>
          <tr>
            <td style="text-align: center; padding: 20px;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">&copy; 2026 Core314&trade; Technologies LLC. All rights reserved.</p>
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

function getFirstBriefText(name: string): string {
  return `Your First Brief is Ready - Core314

${name},

Your first Operational Intelligence Brief has been generated! This is where Core314 starts delivering real value - turning your operational data into actionable insights.

YOUR BRIEF INCLUDES:
- Operational Health Score with trend analysis
- Key signals detected across your integrations
- Risk areas and recommended actions
- Cross-platform pattern analysis

Briefs improve over time as Core314 learns your operational patterns. The more you use it, the sharper the insights become.

View Your Brief: https://app.core314.com/brief

(c) 2026 Core314 Technologies LLC. All rights reserved.`;
}

function getPaymentSuccessHTML(name: string, planName: string, amount: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Confirmed - Core314</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0A0F1A; color: #ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0A0F1A; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0">
          <tr>
            <td style="text-align: center; padding-bottom: 30px;">
              <span style="font-size: 32px; font-weight: 700; color: #00BFFF; letter-spacing: 2px;">CORE314</span>
            </td>
          </tr>
          <tr>
            <td style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); padding: 40px 30px; border-radius: 12px; text-align: center;">
              <h1 style="margin: 0; font-size: 26px; font-weight: 700; color: #ffffff;">Payment Confirmed</h1>
            </td>
          </tr>
          <tr><td style="height: 24px;"></td></tr>
          <tr>
            <td style="background-color: #1A1F2E; padding: 30px; border-radius: 12px; border: 1px solid #2A3F5F;">
              <p style="font-size: 16px; line-height: 1.6; color: #E0E0E0; margin: 0 0 20px 0;">
                ${name},
              </p>
              <p style="font-size: 16px; line-height: 1.6; color: #E0E0E0; margin: 0 0 20px 0;">
                Your payment has been processed successfully. Here are the details:
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0F172A; border-radius: 8px; margin: 0 0 20px 0;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="font-size: 14px; color: #94a3b8; margin: 0 0 8px 0;">PAYMENT DETAILS</p>
                    <p style="font-size: 18px; font-weight: 700; color: #10B981; margin: 0 0 4px 0;">${planName}</p>
                    <p style="font-size: 16px; color: #E0E0E0; margin: 0;">Amount: <strong>${amount}</strong></p>
                  </td>
                </tr>
              </table>
              <p style="font-size: 14px; line-height: 1.6; color: #94a3b8; margin: 0;">
                You can view your billing history and manage your subscription from your <a href="https://app.core314.com/billing" style="color: #00BFFF; text-decoration: none;">Billing page</a>. A receipt from Stripe will also arrive in your inbox.
              </p>
            </td>
          </tr>
          <tr><td style="height: 24px;"></td></tr>
          <tr>
            <td style="text-align: center; padding: 20px;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">&copy; 2026 Core314&trade; Technologies LLC. All rights reserved.</p>
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

function getPaymentSuccessText(name: string, planName: string, amount: string): string {
  return `Payment Confirmed - Core314

${name},

Your payment has been processed successfully.

PAYMENT DETAILS:
Plan: ${planName}
Amount: ${amount}

You can view your billing history and manage your subscription at https://app.core314.com/billing

A receipt from Stripe will also arrive in your inbox.

(c) 2026 Core314 Technologies LLC. All rights reserved.`;
}

function getPaymentFailedHTML(name: string, planName: string, amount: string, retryUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Failed - Core314</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0A0F1A; color: #ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0A0F1A; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0">
          <tr>
            <td style="text-align: center; padding-bottom: 30px;">
              <span style="font-size: 32px; font-weight: 700; color: #00BFFF; letter-spacing: 2px;">CORE314</span>
            </td>
          </tr>
          <tr>
            <td style="background: linear-gradient(135deg, #EF4444 0%, #DC2626 100%); padding: 40px 30px; border-radius: 12px; text-align: center;">
              <h1 style="margin: 0; font-size: 26px; font-weight: 700; color: #ffffff;">Payment Issue</h1>
            </td>
          </tr>
          <tr><td style="height: 24px;"></td></tr>
          <tr>
            <td style="background-color: #1A1F2E; padding: 30px; border-radius: 12px; border: 1px solid #2A3F5F;">
              <p style="font-size: 16px; line-height: 1.6; color: #E0E0E0; margin: 0 0 20px 0;">
                ${name},
              </p>
              <p style="font-size: 16px; line-height: 1.6; color: #E0E0E0; margin: 0 0 20px 0;">
                We were unable to process your payment for <strong>${planName}</strong> (${amount}). This can happen if your card expired, the bank declined the charge, or the payment method needs to be updated.
              </p>
              <p style="font-size: 16px; line-height: 1.6; color: #E0E0E0; margin: 0 0 10px 0;">
                <strong style="color: #EF4444;">To keep your access active:</strong>
              </p>
              <ul style="margin: 0 0 20px 0; padding-left: 24px; font-size: 16px; line-height: 1.8; color: #E0E0E0;">
                <li>Update your payment method in your billing settings</li>
                <li>Ensure your card has sufficient funds</li>
                <li>Contact your bank if the charge was declined</li>
              </ul>
              <p style="font-size: 16px; line-height: 1.6; color: #E0E0E0; margin: 0 0 24px 0;">
                We'll automatically retry the payment in a few days. To avoid any interruption to your service, please update your payment method now.
              </p>
              <center>
                <a href="${retryUrl}" style="display: inline-block; background: linear-gradient(90deg, #EF4444, #DC2626); color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                  Update Payment Method
                </a>
              </center>
            </td>
          </tr>
          <tr><td style="height: 24px;"></td></tr>
          <tr>
            <td style="background-color: #1A1F2E; padding: 20px 30px; border-radius: 12px; border: 1px solid #2A3F5F;">
              <p style="font-size: 14px; line-height: 1.6; color: #94a3b8; margin: 0;">
                Need help? Reply to this email or contact us at <a href="mailto:admin@core314.com" style="color: #00BFFF; text-decoration: none;">admin@core314.com</a>. We'll make sure your account stays active.
              </p>
            </td>
          </tr>
          <tr><td style="height: 24px;"></td></tr>
          <tr>
            <td style="text-align: center; padding: 20px;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">&copy; 2026 Core314&trade; Technologies LLC. All rights reserved.</p>
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

function getPaymentFailedText(name: string, planName: string, amount: string, retryUrl: string): string {
  return `Payment Issue - Core314

${name},

We were unable to process your payment for ${planName} (${amount}). This can happen if your card expired, the bank declined the charge, or the payment method needs to be updated.

TO KEEP YOUR ACCESS ACTIVE:
- Update your payment method in your billing settings
- Ensure your card has sufficient funds
- Contact your bank if the charge was declined

We'll automatically retry the payment in a few days. To avoid any interruption, please update your payment method now.

Update Payment Method: ${retryUrl}

Need help? Contact us at admin@core314.com

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
  const senderEmail = Deno.env.get('SENDGRID_SENDER_EMAIL') || 'noreply@core314.com';
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
    const { action, email, name, integration_name, plan_name, amount, retry_url } = body;

    if (!action) {
      return new Response(
        JSON.stringify({ error: 'action is required (integration_connected | first_brief | payment_success | payment_failed)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!email || !name) {
      return new Response(
        JSON.stringify({ error: 'email and name are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let result: { success: boolean; error?: string };
    let templateName: string;

    switch (action) {
      case 'integration_connected': {
        const intName = integration_name || 'your tool';
        result = await sendEmail(
          email,
          `${intName} is now connected to Core314`,
          getIntegrationConnectedHTML(name, intName),
          getIntegrationConnectedText(name, intName),
        );
        templateName = 'milestone_integration_connected';
        break;
      }

      case 'first_brief': {
        result = await sendEmail(
          email,
          'Your first Operational Intelligence Brief is ready',
          getFirstBriefHTML(name),
          getFirstBriefText(name),
        );
        templateName = 'milestone_first_brief';
        break;
      }

      case 'payment_success': {
        const pName = plan_name || 'Command Center';
        const pAmount = amount || '$799/mo';
        result = await sendEmail(
          email,
          'Payment confirmed — Core314',
          getPaymentSuccessHTML(name, pName, pAmount),
          getPaymentSuccessText(name, pName, pAmount),
        );
        templateName = 'payment_success';
        break;
      }

      case 'payment_failed': {
        const fPlan = plan_name || 'Command Center';
        const fAmount = amount || '$799/mo';
        const fRetryUrl = retry_url || 'https://app.core314.com/billing';
        result = await sendEmail(
          email,
          'Action required: Payment issue with your Core314 subscription',
          getPaymentFailedHTML(name, fPlan, fAmount, fRetryUrl),
          getPaymentFailedText(name, fPlan, fAmount, fRetryUrl),
        );
        templateName = 'payment_failed';
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}. Valid: integration_connected, first_brief, payment_success, payment_failed` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    // Log to admin_messaging_log
    await supabase.from('admin_messaging_log').insert({
      admin_user_id: '00000000-0000-0000-0000-000000000000',
      recipient_email: email,
      recipient_name: name,
      template_name: templateName,
      message_type: 'milestone',
      send_status: result.success ? 'sent' : 'failed',
      error_message: result.error || null,
      context: { action, integration_name, plan_name, amount },
    });

    return new Response(
      JSON.stringify({ success: result.success, error: result.error }),
      { status: result.success ? 200 : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
