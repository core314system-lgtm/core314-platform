import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// =============================================================================
// TRIAL EXPIRATION CHECK
// Runs daily via pg_cron to send trial expiration emails:
//   Day 12: "Your trial ends in 2 days" — last chance to explore
//   Day 14: "Your trial has expired" — conversion CTA
//   Day 17: "We miss you" — final win-back attempt (3 days after expiry)
//
// Targets trial_user types only (not beta testers — they have lifecycle emails).
// Separate from onboarding-nudge-check because these fire regardless of
// activation status (even fully onboarded users need expiration warnings).
// =============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// =============================================================================
// EMAIL TEMPLATES
// =============================================================================

function day12HTML(name: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background-color:#0A0F1A;color:#ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0A0F1A;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0">
        <tr><td style="text-align:center;padding-bottom:30px;">
          <span style="font-size:32px;font-weight:700;color:#00BFFF;letter-spacing:2px;">CORE314</span>
        </td></tr>
        <tr><td style="background:linear-gradient(135deg,#F59E0B 0%,#D97706 100%);padding:40px 30px;border-radius:12px;text-align:center;">
          <h1 style="margin:0;font-size:26px;font-weight:700;color:#ffffff;">Your Trial Ends in 2 Days</h1>
        </td></tr>
        <tr><td style="height:24px;"></td></tr>
        <tr><td style="background-color:#1A1F2E;padding:30px;border-radius:12px;border:1px solid #2A3F5F;">
          <p style="font-size:16px;line-height:1.6;color:#E0E0E0;margin:0 0 20px 0;">${name},</p>
          <p style="font-size:16px;line-height:1.6;color:#E0E0E0;margin:0 0 20px 0;">
            Your Core314 trial ends in <strong style="color:#F59E0B;">2 days</strong>. After that, you'll lose access to your operational intelligence dashboard, briefs, and signal detection.
          </p>
          <p style="font-size:16px;line-height:1.6;color:#E0E0E0;margin:0 0 20px 0;">
            If you've found value in Core314's insights, now is the time to continue. Your data, integrations, and brief history will all be preserved when you subscribe.
          </p>
          <p style="font-size:16px;line-height:1.6;color:#E0E0E0;margin:0 0 10px 0;">
            <strong style="color:#00BFFF;">What you keep when you subscribe:</strong>
          </p>
          <ul style="margin:0 0 20px 0;padding-left:24px;font-size:16px;line-height:1.8;color:#E0E0E0;">
            <li>All connected integrations stay active</li>
            <li>Your brief history and signal data are preserved</li>
            <li>Continuous health score monitoring</li>
            <li>AI-powered operational intelligence</li>
          </ul>
          <center>
            <a href="https://app.core314.com/billing" style="display:inline-block;background:linear-gradient(90deg,#00BFFF,#007BFF);color:#ffffff;text-decoration:none;padding:16px 40px;border-radius:8px;font-weight:600;font-size:16px;">Continue With Core314</a>
          </center>
          <p style="font-size:14px;line-height:1.6;color:#94a3b8;margin:20px 0 0 0;text-align:center;">
            Not ready? No worries — your account stays active for 30 days after trial ends so you can come back anytime.
          </p>
        </td></tr>
        <tr><td style="height:24px;"></td></tr>
        <tr><td style="text-align:center;padding:20px;">
          <p style="margin:0 0 8px 0;font-size:14px;color:#64748b;">Questions? Reply to this email — we read every one.</p>
          <p style="margin:0 0 8px 0;font-size:12px;color:#94a3b8;">&copy; 2026 Core314&trade; Technologies LLC. All rights reserved.</p>
          <p style="margin:0 0 8px 0;font-size:12px;">
            <a href="https://core314.com/privacy" style="color:#00BFFF;text-decoration:none;">Privacy Policy</a> &nbsp;|&nbsp;
            <a href="https://core314.com/terms" style="color:#00BFFF;text-decoration:none;">Terms of Service</a>
          </p>
          <p style="margin:0;font-size:11px;color:#64748b;">
            1603 Capitol Ave, Suite 413A #4640, Cheyenne, WY 82001
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function day12Text(name: string): string {
  return `Your Trial Ends in 2 Days

${name},

Your Core314 trial ends in 2 days. After that, you'll lose access to your operational intelligence dashboard, briefs, and signal detection.

If you've found value in Core314's insights, now is the time to continue. Your data, integrations, and brief history will all be preserved when you subscribe.

WHAT YOU KEEP WHEN YOU SUBSCRIBE:
- All connected integrations stay active
- Your brief history and signal data are preserved
- Continuous health score monitoring
- AI-powered operational intelligence

Continue with Core314: https://app.core314.com/billing

Not ready? No worries — your account stays active for 30 days after trial ends so you can come back anytime.

Questions? Reply to this email.

(c) 2026 Core314 Technologies LLC. All rights reserved.`;
}

function day14HTML(name: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background-color:#0A0F1A;color:#ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0A0F1A;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0">
        <tr><td style="text-align:center;padding-bottom:30px;">
          <span style="font-size:32px;font-weight:700;color:#00BFFF;letter-spacing:2px;">CORE314</span>
        </td></tr>
        <tr><td style="background:linear-gradient(135deg,#EF4444 0%,#DC2626 100%);padding:40px 30px;border-radius:12px;text-align:center;">
          <h1 style="margin:0;font-size:26px;font-weight:700;color:#ffffff;">Your Trial Has Ended</h1>
        </td></tr>
        <tr><td style="height:24px;"></td></tr>
        <tr><td style="background-color:#1A1F2E;padding:30px;border-radius:12px;border:1px solid #2A3F5F;">
          <p style="font-size:16px;line-height:1.6;color:#E0E0E0;margin:0 0 20px 0;">${name},</p>
          <p style="font-size:16px;line-height:1.6;color:#E0E0E0;margin:0 0 20px 0;">
            Your 14-day Core314 trial has ended. Your account is now in read-only mode — you can still log in and view your past briefs, but new brief generation and signal detection are paused.
          </p>
          <p style="font-size:16px;line-height:1.6;color:#E0E0E0;margin:0 0 20px 0;">
            <strong style="color:#00BFFF;">Ready to continue?</strong> Subscribe now and everything picks up right where you left off — your integrations, data, and brief history are all waiting.
          </p>
          <center>
            <a href="https://app.core314.com/billing" style="display:inline-block;background:linear-gradient(90deg,#00BFFF,#007BFF);color:#ffffff;text-decoration:none;padding:16px 40px;border-radius:8px;font-weight:600;font-size:16px;">Subscribe Now</a>
          </center>
          <p style="font-size:14px;line-height:1.6;color:#94a3b8;margin:20px 0 0 0;text-align:center;">
            Your data is preserved for 30 days. After that, it will be permanently deleted.
          </p>
        </td></tr>
        <tr><td style="height:24px;"></td></tr>
        <tr><td style="text-align:center;padding:20px;">
          <p style="margin:0 0 8px 0;font-size:14px;color:#64748b;">Questions? Reply to this email — we read every one.</p>
          <p style="margin:0 0 8px 0;font-size:12px;color:#94a3b8;">&copy; 2026 Core314&trade; Technologies LLC. All rights reserved.</p>
          <p style="margin:0 0 8px 0;font-size:12px;">
            <a href="https://core314.com/privacy" style="color:#00BFFF;text-decoration:none;">Privacy Policy</a> &nbsp;|&nbsp;
            <a href="https://core314.com/terms" style="color:#00BFFF;text-decoration:none;">Terms of Service</a>
          </p>
          <p style="margin:0;font-size:11px;color:#64748b;">
            1603 Capitol Ave, Suite 413A #4640, Cheyenne, WY 82001
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function day14Text(name: string): string {
  return `Your Trial Has Ended

${name},

Your 14-day Core314 trial has ended. Your account is now in read-only mode — you can still log in and view your past briefs, but new brief generation and signal detection are paused.

Ready to continue? Subscribe now and everything picks up right where you left off — your integrations, data, and brief history are all waiting.

Subscribe now: https://app.core314.com/billing

Your data is preserved for 30 days. After that, it will be permanently deleted.

Questions? Reply to this email.

(c) 2026 Core314 Technologies LLC. All rights reserved.`;
}

function day17HTML(name: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background-color:#0A0F1A;color:#ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0A0F1A;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0">
        <tr><td style="text-align:center;padding-bottom:30px;">
          <span style="font-size:32px;font-weight:700;color:#00BFFF;letter-spacing:2px;">CORE314</span>
        </td></tr>
        <tr><td style="background-color:#1A1F2E;padding:30px;border-radius:12px;border:1px solid #2A3F5F;">
          <p style="font-size:16px;line-height:1.6;color:#E0E0E0;margin:0 0 20px 0;">${name},</p>
          <p style="font-size:16px;line-height:1.6;color:#E0E0E0;margin:0 0 20px 0;">
            It's been a few days since your Core314 trial ended. We wanted to check in one last time.
          </p>
          <p style="font-size:16px;line-height:1.6;color:#E0E0E0;margin:0 0 20px 0;">
            If timing wasn't right, we understand. Your account and data are still there — you can reactivate anytime in the next 27 days.
          </p>
          <p style="font-size:16px;line-height:1.6;color:#E0E0E0;margin:0 0 20px 0;">
            If there was something missing or something that didn't work as expected, we'd genuinely love to hear about it. Your feedback helps us build a better product for everyone.
          </p>
          <center>
            <a href="https://app.core314.com/billing" style="display:inline-block;background:linear-gradient(90deg,#00BFFF,#007BFF);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px;">Reactivate Your Account</a>
          </center>
          <p style="font-size:14px;line-height:1.6;color:#94a3b8;margin:20px 0 0 0;text-align:center;">
            Or simply reply to this email to share your thoughts — we read every response.
          </p>
        </td></tr>
        <tr><td style="height:24px;"></td></tr>
        <tr><td style="text-align:center;padding:20px;">
          <p style="margin:0 0 8px 0;font-size:12px;color:#94a3b8;">&copy; 2026 Core314&trade; Technologies LLC. All rights reserved.</p>
          <p style="margin:0 0 8px 0;font-size:12px;">
            <a href="https://core314.com/privacy" style="color:#00BFFF;text-decoration:none;">Privacy Policy</a> &nbsp;|&nbsp;
            <a href="https://core314.com/terms" style="color:#00BFFF;text-decoration:none;">Terms of Service</a>
          </p>
          <p style="margin:0;font-size:11px;color:#64748b;">
            1603 Capitol Ave, Suite 413A #4640, Cheyenne, WY 82001
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function day17Text(name: string): string {
  return `We Miss You — Core314

${name},

It's been a few days since your Core314 trial ended. We wanted to check in one last time.

If timing wasn't right, we understand. Your account and data are still there — you can reactivate anytime in the next 27 days.

If there was something missing or something that didn't work as expected, we'd genuinely love to hear about it. Your feedback helps us build a better product for everyone.

Reactivate your account: https://app.core314.com/billing

Or simply reply to this email to share your thoughts — we read every response.

(c) 2026 Core314 Technologies LLC. All rights reserved.`;
}

// =============================================================================
// EMAIL SENDING
// =============================================================================

async function sendExpirationEmail(
  to: string,
  subject: string,
  html: string,
  text: string
): Promise<{ success: boolean; error?: string }> {
  const sendgridApiKey = Deno.env.get('SENDGRID_API_KEY');
  const senderEmail = Deno.env.get('SENDGRID_SENDER_EMAIL') || 'support@core314.com';
  const senderName = Deno.env.get('SENDGRID_SENDER_NAME') || 'Core314';

  if (!sendgridApiKey) {
    console.error('[TRIAL-EXP] SENDGRID_API_KEY not configured');
    return { success: false, error: 'Email service not configured' };
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
      console.error('[TRIAL-EXP] SendGrid error:', errorText);
      return { success: false, error: `SendGrid error: ${response.status}` };
    }

    return { success: true };
  } catch (error) {
    console.error('[TRIAL-EXP] Email send error:', error);
    return { success: false, error: String(error) };
  }
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const startTime = Date.now();
  const results = {
    checked: 0,
    emails_sent: 0,
    emails_failed: 0,
    details: [] as Array<{ user_id: string; email_type: string; success: boolean; error?: string }>,
  };

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

    // Fetch trial users who may need expiration emails
    // We target trial_user types with active subscriptions in trial status
    const { data: trialUsers, error: fetchError } = await supabase
      .from('user_activation_state')
      .select('user_id, signed_up_at, trial_expiry_email_day12, trial_expiry_email_day14, trial_expiry_email_day17, email_suppressed')
      .eq('user_type', 'trial_user')
      .eq('email_suppressed', false);

    if (fetchError) {
      console.error('[TRIAL-EXP] Failed to fetch trial users:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch trial users', details: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!trialUsers || trialUsers.length === 0) {
      console.log('[TRIAL-EXP] No trial users found');
      return new Response(
        JSON.stringify({ ...results, duration_ms: Date.now() - startTime }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    results.checked = trialUsers.length;

    // Fetch profiles for all trial users
    const userIds = trialUsers.map(u => u.user_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', userIds);

    const profileMap = new Map(
      (profiles || []).map(p => [p.id, { full_name: p.full_name || 'there', email: p.email || '' }])
    );

    // Also check which users have active paid subscriptions (skip them)
    const { data: paidSubs } = await supabase
      .from('subscriptions')
      .select('user_id')
      .in('user_id', userIds)
      .eq('status', 'active');

    const paidUserIds = new Set((paidSubs || []).map(s => s.user_id));

    for (const user of trialUsers) {
      // Skip users who already have paid subscriptions
      if (paidUserIds.has(user.user_id)) continue;

      const profile = profileMap.get(user.user_id);
      if (!profile || !profile.email) continue;

      const daysSinceSignup = (Date.now() - new Date(user.signed_up_at).getTime()) / (1000 * 60 * 60 * 24);

      // Day 12: Trial ends in 2 days
      if (
        !user.trial_expiry_email_day12 &&
        daysSinceSignup >= 12 &&
        daysSinceSignup < 14
      ) {
        console.log(`[TRIAL-EXP] Sending Day 12 email to ${profile.email}`);
        const result = await sendExpirationEmail(
          profile.email,
          'Your Core314 trial ends in 2 days',
          day12HTML(profile.full_name),
          day12Text(profile.full_name)
        );

        if (result.success) {
          await supabase
            .from('user_activation_state')
            .update({ trial_expiry_email_day12: new Date().toISOString() })
            .eq('user_id', user.user_id);
          results.emails_sent++;
        } else {
          results.emails_failed++;
        }

        results.details.push({
          user_id: user.user_id,
          email_type: 'day12_warning',
          success: result.success,
          error: result.error,
        });
      }

      // Day 14: Trial has ended
      if (
        !user.trial_expiry_email_day14 &&
        daysSinceSignup >= 14 &&
        daysSinceSignup < 17
      ) {
        console.log(`[TRIAL-EXP] Sending Day 14 email to ${profile.email}`);
        const result = await sendExpirationEmail(
          profile.email,
          'Your Core314 trial has ended',
          day14HTML(profile.full_name),
          day14Text(profile.full_name)
        );

        if (result.success) {
          await supabase
            .from('user_activation_state')
            .update({ trial_expiry_email_day14: new Date().toISOString() })
            .eq('user_id', user.user_id);
          results.emails_sent++;
        } else {
          results.emails_failed++;
        }

        results.details.push({
          user_id: user.user_id,
          email_type: 'day14_expired',
          success: result.success,
          error: result.error,
        });
      }

      // Day 17: Win-back attempt (3 days after expiry)
      if (
        !user.trial_expiry_email_day17 &&
        daysSinceSignup >= 17 &&
        daysSinceSignup < 30
      ) {
        console.log(`[TRIAL-EXP] Sending Day 17 email to ${profile.email}`);
        const result = await sendExpirationEmail(
          profile.email,
          'We miss you — your Core314 data is still waiting',
          day17HTML(profile.full_name),
          day17Text(profile.full_name)
        );

        if (result.success) {
          await supabase
            .from('user_activation_state')
            .update({ trial_expiry_email_day17: new Date().toISOString() })
            .eq('user_id', user.user_id);
          results.emails_sent++;
        } else {
          results.emails_failed++;
        }

        results.details.push({
          user_id: user.user_id,
          email_type: 'day17_winback',
          success: result.success,
          error: result.error,
        });
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[TRIAL-EXP] Complete: ${results.emails_sent} sent, ${results.emails_failed} failed, ${duration}ms`);

    return new Response(
      JSON.stringify({ ...results, duration_ms: duration }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[TRIAL-EXP] Unhandled error:', error);
    return new Response(
      JSON.stringify({ error: String(error), ...results, duration_ms: Date.now() - startTime }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
