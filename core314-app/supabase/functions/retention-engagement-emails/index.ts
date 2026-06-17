import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// =============================================================================
// RETENTION & ENGAGEMENT EMAILS
// Handles:
// 1. weekly_digest — Weekly operational intelligence summary
// 2. re_engagement — Re-engage inactive users (no login in 14+ days)
// 3. cancellation_confirm — Subscription cancellation confirmation
// 4. win_back — Win-back email for churned users (30 days post-cancel)
// =============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// =============================================================================
// EMAIL TEMPLATES
// =============================================================================

function getWeeklyDigestHTML(name: string, healthScore: number, signalCount: number, topSignals: string[]): string {
  const scoreColor = healthScore >= 75 ? '#10B981' : healthScore >= 50 ? '#F59E0B' : '#EF4444';
  const signalItems = topSignals.map(s => `<li style="padding: 4px 0;">${s}</li>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Weekly Intelligence Digest - Core314</title>
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
            <td style="background: linear-gradient(135deg, #00BFFF 0%, #007BFF 100%); padding: 30px; border-radius: 12px; text-align: center;">
              <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #ffffff;">Your Weekly Intelligence Digest</h1>
              <p style="margin: 8px 0 0; font-size: 14px; color: rgba(255,255,255,0.8);">Week of ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
            </td>
          </tr>
          <tr><td style="height: 24px;"></td></tr>
          <!-- Health Score -->
          <tr>
            <td style="background-color: #1A1F2E; padding: 24px 30px; border-radius: 12px; border: 1px solid #2A3F5F;">
              <p style="font-size: 16px; line-height: 1.6; color: #E0E0E0; margin: 0 0 16px 0;">
                ${name},
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0F172A; border-radius: 8px; margin: 0 0 16px 0;">
                <tr>
                  <td style="padding: 20px; text-align: center;">
                    <p style="font-size: 14px; color: #94a3b8; margin: 0 0 8px 0;">OPERATIONAL HEALTH SCORE</p>
                    <p style="font-size: 48px; font-weight: 700; color: ${scoreColor}; margin: 0;">${healthScore}</p>
                    <p style="font-size: 14px; color: #94a3b8; margin: 4px 0 0;">${signalCount} signals detected this week</p>
                  </td>
                </tr>
              </table>
              ${topSignals.length > 0 ? `
              <p style="font-size: 16px; color: #00BFFF; font-weight: 600; margin: 0 0 8px 0;">Top Signals This Week:</p>
              <ul style="margin: 0 0 16px 0; padding-left: 24px; font-size: 14px; line-height: 1.8; color: #E0E0E0;">
                ${signalItems}
              </ul>` : ''}
              <center>
                <a href="https://app.core314.com/brief" style="display: inline-block; background: linear-gradient(90deg, #00BFFF, #007BFF); color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 15px;">
                  View Full Brief
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

function getWeeklyDigestText(name: string, healthScore: number, signalCount: number, topSignals: string[]): string {
  const signalList = topSignals.map(s => `- ${s}`).join('\n');
  return `Weekly Intelligence Digest - Core314
Week of ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}

${name},

OPERATIONAL HEALTH SCORE: ${healthScore}
${signalCount} signals detected this week

${topSignals.length > 0 ? `TOP SIGNALS:\n${signalList}\n` : ''}
View Full Brief: https://app.core314.com/brief

(c) 2026 Core314 Technologies LLC. All rights reserved.`;
}

function getReEngagementHTML(name: string, daysSinceLogin: number): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>We Miss You - Core314</title>
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
            <td style="background-color: #1A1F2E; padding: 30px; border-radius: 12px; border: 1px solid #2A3F5F;">
              <p style="font-size: 16px; line-height: 1.6; color: #E0E0E0; margin: 0 0 20px 0;">
                ${name},
              </p>
              <p style="font-size: 16px; line-height: 1.6; color: #E0E0E0; margin: 0 0 20px 0;">
                It's been ${daysSinceLogin} days since you last logged in to Core314. Your operational intelligence is still running in the background, and there may be important signals you're missing.
              </p>
              <p style="font-size: 16px; line-height: 1.6; color: #E0E0E0; margin: 0 0 10px 0;">
                <strong style="color: #00BFFF;">Here's what's been happening:</strong>
              </p>
              <ul style="margin: 0 0 20px 0; padding-left: 24px; font-size: 16px; line-height: 1.8; color: #E0E0E0;">
                <li>New operational signals have been detected</li>
                <li>Your Health Score may have changed</li>
                <li>Fresh briefs are ready for your review</li>
              </ul>
              <center>
                <a href="https://app.core314.com/brief" style="display: inline-block; background: linear-gradient(90deg, #00BFFF, #007BFF); color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                  Check Your Dashboard
                </a>
              </center>
            </td>
          </tr>
          <tr><td style="height: 24px;"></td></tr>
          <tr>
            <td style="background-color: #1A1F2E; padding: 20px 30px; border-radius: 12px; border: 1px solid #2A3F5F;">
              <p style="font-size: 14px; line-height: 1.6; color: #94a3b8; margin: 0;">
                Not finding value? We'd love to hear your feedback — reply to this email and let us know how we can make Core314 more useful for you.
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

function getReEngagementText(name: string, daysSinceLogin: number): string {
  return `We Miss You - Core314

${name},

It's been ${daysSinceLogin} days since you last logged in to Core314. Your operational intelligence is still running in the background, and there may be important signals you're missing.

HERE'S WHAT'S BEEN HAPPENING:
- New operational signals have been detected
- Your Health Score may have changed
- Fresh briefs are ready for your review

Check Your Dashboard: https://app.core314.com/brief

Not finding value? Reply to this email and let us know how we can make Core314 more useful for you.

(c) 2026 Core314 Technologies LLC. All rights reserved.`;
}

function getCancellationConfirmHTML(name: string, endDate: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Subscription Cancelled - Core314</title>
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
            <td style="background-color: #1A1F2E; padding: 30px; border-radius: 12px; border: 1px solid #2A3F5F;">
              <p style="font-size: 16px; line-height: 1.6; color: #E0E0E0; margin: 0 0 20px 0;">
                ${name},
              </p>
              <p style="font-size: 16px; line-height: 1.6; color: #E0E0E0; margin: 0 0 20px 0;">
                We've confirmed the cancellation of your Core314 subscription. We're sorry to see you go.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0F172A; border-radius: 8px; margin: 0 0 20px 0;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="font-size: 14px; color: #94a3b8; margin: 0 0 4px 0;">ACCESS UNTIL</p>
                    <p style="font-size: 18px; font-weight: 700; color: #F59E0B; margin: 0;">${endDate}</p>
                    <p style="font-size: 14px; color: #94a3b8; margin: 4px 0 0;">You'll have full access until this date</p>
                  </td>
                </tr>
              </table>
              <p style="font-size: 16px; line-height: 1.6; color: #E0E0E0; margin: 0 0 10px 0;">
                <strong style="color: #00BFFF;">Before your access ends:</strong>
              </p>
              <ul style="margin: 0 0 20px 0; padding-left: 24px; font-size: 16px; line-height: 1.8; color: #E0E0E0;">
                <li>Export any briefs or reports you'd like to keep</li>
                <li>Download your operational data</li>
                <li>You can resubscribe anytime from your billing page</li>
              </ul>
              <p style="font-size: 14px; line-height: 1.6; color: #94a3b8; margin: 0;">
                Changed your mind? <a href="https://app.core314.com/billing" style="color: #00BFFF; text-decoration: none;">Resubscribe here</a> — your data and settings will be preserved.
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

function getCancellationConfirmText(name: string, endDate: string): string {
  return `Subscription Cancelled - Core314

${name},

We've confirmed the cancellation of your Core314 subscription. We're sorry to see you go.

ACCESS UNTIL: ${endDate}
You'll have full access until this date.

BEFORE YOUR ACCESS ENDS:
- Export any briefs or reports you'd like to keep
- Download your operational data
- You can resubscribe anytime from your billing page

Changed your mind? Resubscribe at https://app.core314.com/billing - your data and settings will be preserved.

(c) 2026 Core314 Technologies LLC. All rights reserved.`;
}

function getWinBackHTML(name: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>We'd Love to Have You Back - Core314</title>
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
              <h1 style="margin: 0; font-size: 26px; font-weight: 700; color: #ffffff;">We'd Love to Have You Back</h1>
            </td>
          </tr>
          <tr><td style="height: 24px;"></td></tr>
          <tr>
            <td style="background-color: #1A1F2E; padding: 30px; border-radius: 12px; border: 1px solid #2A3F5F;">
              <p style="font-size: 16px; line-height: 1.6; color: #E0E0E0; margin: 0 0 20px 0;">
                ${name},
              </p>
              <p style="font-size: 16px; line-height: 1.6; color: #E0E0E0; margin: 0 0 20px 0;">
                It's been a while since you left Core314, and we've been busy making things better. Here's what's new:
              </p>
              <ul style="margin: 0 0 20px 0; padding-left: 24px; font-size: 16px; line-height: 1.8; color: #E0E0E0;">
                <li>Expanded integration support (16+ platforms)</li>
                <li>Improved AI-powered operational briefs</li>
                <li>Enhanced signal detection and health scoring</li>
                <li>PowerPoint export for executive reporting</li>
              </ul>
              <p style="font-size: 16px; line-height: 1.6; color: #E0E0E0; margin: 0 0 24px 0;">
                Your account data is still here — pick up right where you left off. No setup needed.
              </p>
              <center>
                <a href="https://app.core314.com" style="display: inline-block; background: linear-gradient(90deg, #8B5CF6, #6D28D9); color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                  Reactivate Your Account
                </a>
              </center>
            </td>
          </tr>
          <tr><td style="height: 24px;"></td></tr>
          <tr>
            <td style="background-color: #1A1F2E; padding: 20px 30px; border-radius: 12px; border: 1px solid #2A3F5F;">
              <p style="font-size: 14px; line-height: 1.6; color: #94a3b8; margin: 0;">
                Have feedback about why you left? We'd genuinely love to hear it — reply to this email. Your input helps us build a better product.
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

function getWinBackText(name: string): string {
  return `We'd Love to Have You Back - Core314

${name},

It's been a while since you left Core314, and we've been busy making things better. Here's what's new:

- Expanded integration support (16+ platforms)
- Improved AI-powered operational briefs
- Enhanced signal detection and health scoring
- PowerPoint export for executive reporting

Your account data is still here - pick up right where you left off. No setup needed.

Reactivate Your Account: https://app.core314.com

Have feedback about why you left? Reply to this email. Your input helps us build a better product.

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
    const { action, email, name, health_score, signal_count, top_signals, days_since_login, end_date } = body;

    if (!action) {
      return new Response(
        JSON.stringify({ error: 'action is required (weekly_digest | re_engagement | cancellation_confirm | win_back)' }),
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
      case 'weekly_digest': {
        const score = health_score ?? 0;
        const signals = signal_count ?? 0;
        const topSigs: string[] = Array.isArray(top_signals) ? top_signals : [];
        result = await sendEmail(
          email,
          `Your Weekly Intelligence Digest — Health Score: ${score}`,
          getWeeklyDigestHTML(name, score, signals, topSigs),
          getWeeklyDigestText(name, score, signals, topSigs),
        );
        templateName = 'retention_weekly_digest';
        break;
      }

      case 're_engagement': {
        const days = days_since_login ?? 14;
        result = await sendEmail(
          email,
          'Your operational intelligence is waiting — Core314',
          getReEngagementHTML(name, days),
          getReEngagementText(name, days),
        );
        templateName = 'retention_re_engagement';
        break;
      }

      case 'cancellation_confirm': {
        const cancelEnd = end_date || 'your current billing period end';
        result = await sendEmail(
          email,
          'Subscription cancelled — Core314',
          getCancellationConfirmHTML(name, cancelEnd),
          getCancellationConfirmText(name, cancelEnd),
        );
        templateName = 'retention_cancellation_confirm';
        break;
      }

      case 'win_back': {
        result = await sendEmail(
          email,
          'We\'ve made Core314 even better — come see what\'s new',
          getWinBackHTML(name),
          getWinBackText(name),
        );
        templateName = 'retention_win_back';
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}. Valid: weekly_digest, re_engagement, cancellation_confirm, win_back` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    // Log to admin_messaging_log
    await supabase.from('admin_messaging_log').insert({
      admin_user_id: '00000000-0000-0000-0000-000000000000',
      recipient_email: email,
      recipient_name: name,
      template_name: templateName,
      message_type: 'retention',
      send_status: result.success ? 'sent' : 'failed',
      error_message: result.error || null,
      context: { action, health_score, signal_count, days_since_login },
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
