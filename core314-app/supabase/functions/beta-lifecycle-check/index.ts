import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// =============================================================================
// BETA LIFECYCLE CHECK
// Runs daily (via pg_cron or manual trigger) to:
// 1. Identify Day 38 users who need thank-you emails
// 2. Identify Day 45 users whose beta period is complete
// 3. Send appropriate emails via SendGrid
// 4. Update lifecycle statuses
// =============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// =============================================================================
// EMAIL TEMPLATES
// =============================================================================

interface BetaLifecycleEmailData {
  name: string;
  email: string;
  days_elapsed: number;
  days_remaining: number;
  total_logins: number;
  checkout_url: string;
  day_45_date: string;
  day_46_date: string;
  discount_amount: string;
  monthly_price: string;
  full_price: string;
}

function getDay38ThankYouHTML(data: BetaLifecycleEmailData): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Thank You - Core314 Beta Program</title>
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
            <td style="background: linear-gradient(135deg, #00BFFF 0%, #007BFF 100%); padding: 40px 30px; border-radius: 12px; text-align: center; margin-bottom: 30px;">
              <h1 style="margin: 0; font-size: 26px; font-weight: 700; color: #ffffff;">Thank You for Shaping Core314</h1>
            </td>
          </tr>
          <!-- Spacer -->
          <tr><td style="height: 24px;"></td></tr>
          <!-- Main Content -->
          <tr>
            <td style="background-color: #1A1F2E; padding: 30px; border-radius: 12px; border: 1px solid #2A3F5F;">
              <p style="font-size: 16px; line-height: 1.6; color: #E0E0E0; margin: 0 0 20px 0;">
                ${data.name},
              </p>
              <p style="font-size: 16px; line-height: 1.6; color: #E0E0E0; margin: 0 0 20px 0;">
                We want to take a moment to say something important: <strong style="color: #00BFFF;">thank you.</strong>
              </p>
              <p style="font-size: 16px; line-height: 1.6; color: #E0E0E0; margin: 0 0 20px 0;">
                Over the past ${data.days_elapsed} days, you've been one of the people helping us build something we believe will change how leadership teams understand their operations. Your feedback hasn't just been heard — it's been built into the product.
              </p>
              <p style="font-size: 16px; line-height: 1.6; color: #E0E0E0; margin: 0 0 10px 0;">
                <strong style="color: #00BFFF;">Your participation by the numbers:</strong>
              </p>
              <ul style="margin: 0 0 20px 0; padding-left: 24px; font-size: 16px; line-height: 1.8; color: #E0E0E0;">
                <li>${data.total_logins} sessions logged</li>
                <li>Operational briefs generated for your team</li>
                <li>Your feedback directly influenced product improvements</li>
              </ul>
              <p style="font-size: 16px; line-height: 1.6; color: #E0E0E0; margin: 0 0 20px 0;">
                That kind of engagement is exactly why we created this beta program. You didn't just test Core314 — you helped shape it.
              </p>
            </td>
          </tr>
          <!-- Spacer -->
          <tr><td style="height: 24px;"></td></tr>
          <!-- What Happens Next -->
          <tr>
            <td style="background-color: #1A1F2E; padding: 30px; border-radius: 12px; border: 1px solid #2A3F5F;">
              <h2 style="font-size: 20px; color: #00BFFF; margin: 0 0 15px 0;">What Happens Next</h2>
              <p style="font-size: 16px; line-height: 1.6; color: #E0E0E0; margin: 0 0 20px 0;">
                Your 45-day beta period completes on <strong>${data.day_45_date}</strong>. Here's what that means for you:
              </p>
              <p style="font-size: 16px; line-height: 1.6; color: #E0E0E0; margin: 0 0 20px 0;">
                As promised, you've earned an <strong style="color: #00BFFF;">exclusive 30% discount</strong> on the Command Center plan for your first 6 months. That's <strong>${data.discount_amount}/mo</strong> instead of ${data.full_price}/mo — a savings of <strong>$1,438.20 over 6 months</strong>.
              </p>
              <p style="font-size: 16px; line-height: 1.6; color: #E0E0E0; margin: 0 0 24px 0;">
                This discount is exclusively for beta participants who completed the full program. It's our way of saying: we value the people who believed in us early.
              </p>
              <!-- CTA Button -->
              <center>
                <a href="${data.checkout_url}" style="display: inline-block; background: linear-gradient(90deg, #00BFFF, #007BFF); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                  Claim Your 30% Beta Reward
                </a>
              </center>
              <p style="font-size: 14px; line-height: 1.6; color: #94a3b8; margin: 20px 0 0 0; text-align: center;">
                Your first payment of ${data.discount_amount} won't be charged until <strong>${data.day_46_date}</strong>.<br>
                You'll continue to have full access to everything you've been using.
              </p>
            </td>
          </tr>
          <!-- Spacer -->
          <tr><td style="height: 24px;"></td></tr>
          <!-- Fine Print -->
          <tr>
            <td style="background-color: #1A1F2E; padding: 20px 30px; border-radius: 12px; border: 1px solid #2A3F5F;">
              <p style="font-size: 14px; line-height: 1.6; color: #94a3b8; margin: 0;">
                After 6 months at the discounted rate, your plan will continue at the standard ${data.full_price}/mo. You can manage or cancel your subscription at any time from your Billing page.
              </p>
            </td>
          </tr>
          <!-- Spacer -->
          <tr><td style="height: 24px;"></td></tr>
          <!-- Footer -->
          <tr>
            <td style="text-align: center; padding: 20px;">
              <p style="margin: 0 0 8px 0; font-size: 14px; color: #64748b;">
                Questions? Reply to this email — we read every one.
              </p>
              <p style="margin: 0 0 8px 0; font-size: 14px; color: #64748b;">
                <a href="mailto:admin@core314.com" style="color: #00BFFF; text-decoration: none;">admin@core314.com</a>
              </p>
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                © 2026 Core314™ Technologies LLC. All rights reserved.
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

function getDay38ThankYouText(data: BetaLifecycleEmailData): string {
  return `Thank You for Shaping Core314

${data.name},

We want to take a moment to say something important: thank you.

Over the past ${data.days_elapsed} days, you've been one of the people helping us build something we believe will change how leadership teams understand their operations. Your feedback hasn't just been heard — it's been built into the product.

YOUR PARTICIPATION BY THE NUMBERS:
- ${data.total_logins} sessions logged
- Operational briefs generated for your team
- Your feedback directly influenced product improvements

That kind of engagement is exactly why we created this beta program. You didn't just test Core314 — you helped shape it.

WHAT HAPPENS NEXT

Your 45-day beta period completes on ${data.day_45_date}. Here's what that means for you:

As promised, you've earned an exclusive 30% discount on the Command Center plan for your first 6 months. That's ${data.discount_amount}/mo instead of ${data.full_price}/mo — a savings of $1,438.20 over 6 months.

This discount is exclusively for beta participants who completed the full program. It's our way of saying: we value the people who believed in us early.

CLAIM YOUR 30% BETA REWARD: ${data.checkout_url}

Your first payment of ${data.discount_amount} won't be charged until ${data.day_46_date}. You'll continue to have full access to everything you've been using.

After 6 months at the discounted rate, your plan will continue at the standard ${data.full_price}/mo. You can manage or cancel your subscription at any time from your Billing page.

Questions? Reply to this email — we read every one.

Thank you for being part of this,
The Core314 Team

© 2026 Core314™ Technologies LLC. All rights reserved.`;
}

function getDay41ReminderHTML(data: BetaLifecycleEmailData): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Don't Miss Your Exclusive Discount - Core314</title>
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
                ${data.name},
              </p>
              <p style="font-size: 16px; line-height: 1.6; color: #E0E0E0; margin: 0 0 20px 0;">
                A few days ago we sent you a thank-you note for your incredible participation in the Core314 beta program — along with your exclusive <strong style="color: #00BFFF;">30% discount</strong> on the Command Center plan.
              </p>
              <p style="font-size: 16px; line-height: 1.6; color: #E0E0E0; margin: 0 0 20px 0;">
                We wanted to make sure you saw it. Your beta period completes on <strong>${data.day_45_date}</strong>, and we'd love to keep you on board.
              </p>
              <p style="font-size: 16px; line-height: 1.6; color: #E0E0E0; margin: 0 0 24px 0;">
                <strong>Quick recap:</strong> ${data.discount_amount}/mo instead of ${data.full_price}/mo for 6 months. Your first charge won't happen until ${data.day_46_date}.
              </p>
              <!-- CTA Button -->
              <center>
                <a href="${data.checkout_url}" style="display: inline-block; background: linear-gradient(90deg, #00BFFF, #007BFF); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                  Claim Your 30% Discount
                </a>
              </center>
              <p style="font-size: 14px; line-height: 1.6; color: #94a3b8; margin: 20px 0 0 0; text-align: center;">
                If you have any questions, just reply to this email.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="text-align: center; padding: 20px;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                © 2026 Core314™ Technologies LLC. All rights reserved.
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

function getDay41ReminderText(data: BetaLifecycleEmailData): string {
  return `Don't Miss Your Exclusive Discount - Core314

${data.name},

A few days ago we sent you a thank-you note for your incredible participation in the Core314 beta program — along with your exclusive 30% discount on the Command Center plan.

We wanted to make sure you saw it. Your beta period completes on ${data.day_45_date}, and we'd love to keep you on board.

Quick recap: ${data.discount_amount}/mo instead of ${data.full_price}/mo for 6 months. Your first charge won't happen until ${data.day_46_date}.

CLAIM YOUR 30% DISCOUNT: ${data.checkout_url}

If you have any questions, just reply to this email.

The Core314 Team
© 2026 Core314™ Technologies LLC. All rights reserved.`;
}

function getDay44FinalReminderHTML(data: BetaLifecycleEmailData): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Beta Access Ends Tomorrow - Core314</title>
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
          <!-- Urgency Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; border-radius: 12px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #ffffff;">Your Beta Access Ends Tomorrow</h1>
            </td>
          </tr>
          <!-- Spacer -->
          <tr><td style="height: 24px;"></td></tr>
          <!-- Main Content -->
          <tr>
            <td style="background-color: #1A1F2E; padding: 30px; border-radius: 12px; border: 1px solid #2A3F5F;">
              <p style="font-size: 16px; line-height: 1.6; color: #E0E0E0; margin: 0 0 20px 0;">
                ${data.name},
              </p>
              <p style="font-size: 16px; line-height: 1.6; color: #E0E0E0; margin: 0 0 20px 0;">
                This is a friendly heads-up: your 45-day beta period ends <strong>tomorrow</strong> (${data.day_45_date}).
              </p>
              <p style="font-size: 16px; line-height: 1.6; color: #E0E0E0; margin: 0 0 20px 0;">
                Your exclusive <strong style="color: #00BFFF;">30% beta reward</strong> is still available. Lock in ${data.discount_amount}/mo for your first 6 months before it expires.
              </p>
              <p style="font-size: 16px; line-height: 1.6; color: #E0E0E0; margin: 0 0 24px 0;">
                Once secured, your first charge won't occur until ${data.day_46_date} — and you'll continue with uninterrupted access to everything you've been using.
              </p>
              <!-- CTA Button -->
              <center>
                <a href="${data.checkout_url}" style="display: inline-block; background: linear-gradient(90deg, #f59e0b, #d97706); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                  Lock In Your 30% Discount Now
                </a>
              </center>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="text-align: center; padding: 20px;">
              <p style="margin: 0 0 8px 0; font-size: 14px; color: #64748b;">
                Questions? <a href="mailto:admin@core314.com" style="color: #00BFFF; text-decoration: none;">admin@core314.com</a>
              </p>
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                © 2026 Core314™ Technologies LLC. All rights reserved.
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

function getDay44FinalReminderText(data: BetaLifecycleEmailData): string {
  return `YOUR BETA ACCESS ENDS TOMORROW - Core314

${data.name},

This is a friendly heads-up: your 45-day beta period ends tomorrow (${data.day_45_date}).

Your exclusive 30% beta reward is still available. Lock in ${data.discount_amount}/mo for your first 6 months before it expires.

Once secured, your first charge won't occur until ${data.day_46_date} — and you'll continue with uninterrupted access to everything you've been using.

LOCK IN YOUR 30% DISCOUNT NOW: ${data.checkout_url}

Questions? Reply to this email or contact admin@core314.com

The Core314 Team
© 2026 Core314™ Technologies LLC. All rights reserved.`;
}

// =============================================================================
// SEND EMAIL VIA SENDGRID
// =============================================================================

async function sendLifecycleEmail(
  to: string,
  subject: string,
  html: string,
  text: string,
): Promise<{ success: boolean; error?: string }> {
  const sendgridApiKey = Deno.env.get('SENDGRID_API_KEY');
  const senderEmail = Deno.env.get('SENDGRID_SENDER_EMAIL') || 'noreply@core314.com';
  const senderName = Deno.env.get('SENDGRID_SENDER_NAME') || 'Core314';

  if (!sendgridApiKey) {
    console.error('[LIFECYCLE] SENDGRID_API_KEY not configured');
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
      console.error('[LIFECYCLE] SendGrid error:', response.status, errorText);
      return { success: false, error: `SendGrid ${response.status}: ${errorText}` };
    }

    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[LIFECYCLE] Email send error:', msg);
    return { success: false, error: msg };
  }
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

serve(async (req) => {
  const requestId = crypto.randomUUID().substring(0, 8);
  const log = (step: string, data?: unknown) =>
    console.log(`[${requestId}] ${step}`, data ? JSON.stringify(data) : '');

  log('FUNCTION_ENTRY', { method: req.method });

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
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

    // Parse optional body for manual triggers
    let action = 'auto'; // auto = run all checks
    try {
      if (req.method === 'POST') {
        const body = await req.json();
        action = body.action || 'auto';
      }
    } catch {
      // No body or invalid JSON — use default auto mode
    }

    log('ACTION', { action });

    const results: Record<string, unknown> = { action, checked_at: new Date().toISOString() };

    // =========================================================================
    // STEP 1: Find Day 38 users who need thank-you emails
    // =========================================================================
    const { data: day38Users, error: day38Error } = await supabase
      .from('beta_tester_lifecycle')
      .select(`
        id, user_id, first_login_at, total_logins, extension_days, checkout_url
      `)
      .eq('lifecycle_status', 'active')
      .not('first_login_at', 'is', null)
      .is('day_38_email_sent_at', null);

    if (day38Error) {
      log('DAY38_QUERY_ERROR', { error: day38Error.message });
    }

    const day38Emails: string[] = [];

    if (day38Users && day38Users.length > 0) {
      for (const user of day38Users) {
        const firstLogin = new Date(user.first_login_at);
        const totalDays = 45 + (user.extension_days || 0);
        const day38Threshold = totalDays - 7; // 7 days before end
        const daysElapsed = Math.floor((Date.now() - firstLogin.getTime()) / (1000 * 60 * 60 * 24));

        if (daysElapsed >= day38Threshold) {
          // Get user profile
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', user.user_id)
            .single();

          if (!profile) continue;

          const day45Date = new Date(firstLogin.getTime() + totalDays * 24 * 60 * 60 * 1000);
          const day46Date = new Date(day45Date.getTime() + 24 * 60 * 60 * 1000);

          const emailData: BetaLifecycleEmailData = {
            name: profile.full_name || 'there',
            email: profile.email,
            days_elapsed: daysElapsed,
            days_remaining: Math.max(0, totalDays - daysElapsed),
            total_logins: user.total_logins || 0,
            checkout_url: user.checkout_url || `${supabaseUrl}/functions/v1/beta-create-checkout?user_id=${user.user_id}`,
            day_45_date: day45Date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
            day_46_date: day46Date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
            discount_amount: '$559.30',
            monthly_price: '$559.30',
            full_price: '$799',
          };

          log('SENDING_DAY38_EMAIL', { email: profile.email, daysElapsed });

          const emailResult = await sendLifecycleEmail(
            profile.email,
            'Thank you for shaping Core314 — here\'s what you\'ve earned',
            getDay38ThankYouHTML(emailData),
            getDay38ThankYouText(emailData),
          );

          if (emailResult.success) {
            await supabase
              .from('beta_tester_lifecycle')
              .update({
                lifecycle_status: 'thanked',
                day_38_email_sent_at: new Date().toISOString(),
              })
              .eq('id', user.id);

            day38Emails.push(profile.email);
            log('DAY38_EMAIL_SENT', { email: profile.email });
          } else {
            log('DAY38_EMAIL_FAILED', { email: profile.email, error: emailResult.error });
          }

          // Log to admin_messaging_log
          await supabase.from('admin_messaging_log').insert({
            admin_user_id: '00000000-0000-0000-0000-000000000000', // system
            recipient_email: profile.email,
            recipient_name: profile.full_name,
            template_name: 'beta_thankyou_day38',
            message_type: 'beta_lifecycle',
            send_status: emailResult.success ? 'sent' : 'failed',
            error_message: emailResult.error || null,
            context: { lifecycle_id: user.id, days_elapsed: daysElapsed },
          });
        }
      }
    }

    results.day38_emails_sent = day38Emails;
    results.day38_count = day38Emails.length;

    // =========================================================================
    // STEP 2: Send Day 41 reminders (for 'thanked' users who haven't converted)
    // =========================================================================
    const { data: day41Users } = await supabase
      .from('beta_tester_lifecycle')
      .select('id, user_id, first_login_at, total_logins, extension_days, checkout_url, day_38_email_sent_at')
      .eq('lifecycle_status', 'thanked')
      .not('first_login_at', 'is', null)
      .is('stripe_subscription_id', null);

    const day41Emails: string[] = [];

    if (day41Users && day41Users.length > 0) {
      for (const user of day41Users) {
        const firstLogin = new Date(user.first_login_at);
        const totalDays = 45 + (user.extension_days || 0);
        const daysElapsed = Math.floor((Date.now() - firstLogin.getTime()) / (1000 * 60 * 60 * 24));
        const day41Threshold = totalDays - 4; // 4 days before end

        // Only send if day 38 email was sent 3+ days ago and we're at day 41+
        const day38Sent = user.day_38_email_sent_at ? new Date(user.day_38_email_sent_at) : null;
        const daysSinceDay38 = day38Sent ? Math.floor((Date.now() - day38Sent.getTime()) / (1000 * 60 * 60 * 24)) : 0;

        if (daysElapsed >= day41Threshold && daysSinceDay38 >= 3) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', user.user_id)
            .single();

          if (!profile) continue;

          // Check if we already sent a day 41 reminder (check messaging log)
          const { data: existingReminder } = await supabase
            .from('admin_messaging_log')
            .select('id')
            .eq('recipient_email', profile.email)
            .eq('template_name', 'beta_reminder_day41')
            .limit(1);

          if (existingReminder && existingReminder.length > 0) continue;

          const day45Date = new Date(firstLogin.getTime() + totalDays * 24 * 60 * 60 * 1000);
          const day46Date = new Date(day45Date.getTime() + 24 * 60 * 60 * 1000);

          const emailData: BetaLifecycleEmailData = {
            name: profile.full_name || 'there',
            email: profile.email,
            days_elapsed: daysElapsed,
            days_remaining: Math.max(0, totalDays - daysElapsed),
            total_logins: user.total_logins || 0,
            checkout_url: user.checkout_url || `${supabaseUrl}/functions/v1/beta-create-checkout?user_id=${user.user_id}`,
            day_45_date: day45Date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
            day_46_date: day46Date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
            discount_amount: '$559.30',
            monthly_price: '$559.30',
            full_price: '$799',
          };

          const emailResult = await sendLifecycleEmail(
            profile.email,
            'Don\'t miss your exclusive Core314 beta discount',
            getDay41ReminderHTML(emailData),
            getDay41ReminderText(emailData),
          );

          if (emailResult.success) {
            day41Emails.push(profile.email);
          }

          await supabase.from('admin_messaging_log').insert({
            admin_user_id: '00000000-0000-0000-0000-000000000000',
            recipient_email: profile.email,
            recipient_name: profile.full_name,
            template_name: 'beta_reminder_day41',
            message_type: 'beta_lifecycle',
            send_status: emailResult.success ? 'sent' : 'failed',
            error_message: emailResult.error || null,
            context: { lifecycle_id: user.id, days_elapsed: daysElapsed },
          });
        }
      }
    }

    results.day41_reminders_sent = day41Emails;
    results.day41_count = day41Emails.length;

    // =========================================================================
    // STEP 3: Send Day 44 final reminders
    // =========================================================================
    const { data: day44Users } = await supabase
      .from('beta_tester_lifecycle')
      .select('id, user_id, first_login_at, total_logins, extension_days, checkout_url')
      .eq('lifecycle_status', 'thanked')
      .not('first_login_at', 'is', null)
      .is('stripe_subscription_id', null);

    const day44Emails: string[] = [];

    if (day44Users && day44Users.length > 0) {
      for (const user of day44Users) {
        const firstLogin = new Date(user.first_login_at);
        const totalDays = 45 + (user.extension_days || 0);
        const daysElapsed = Math.floor((Date.now() - firstLogin.getTime()) / (1000 * 60 * 60 * 24));
        const day44Threshold = totalDays - 1; // 1 day before end

        if (daysElapsed >= day44Threshold) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', user.user_id)
            .single();

          if (!profile) continue;

          // Check if already sent
          const { data: existingReminder } = await supabase
            .from('admin_messaging_log')
            .select('id')
            .eq('recipient_email', profile.email)
            .eq('template_name', 'beta_final_day44')
            .limit(1);

          if (existingReminder && existingReminder.length > 0) continue;

          const day45Date = new Date(firstLogin.getTime() + totalDays * 24 * 60 * 60 * 1000);
          const day46Date = new Date(day45Date.getTime() + 24 * 60 * 60 * 1000);

          const emailData: BetaLifecycleEmailData = {
            name: profile.full_name || 'there',
            email: profile.email,
            days_elapsed: daysElapsed,
            days_remaining: Math.max(0, totalDays - daysElapsed),
            total_logins: user.total_logins || 0,
            checkout_url: user.checkout_url || `${supabaseUrl}/functions/v1/beta-create-checkout?user_id=${user.user_id}`,
            day_45_date: day45Date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
            day_46_date: day46Date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
            discount_amount: '$559.30',
            monthly_price: '$559.30',
            full_price: '$799',
          };

          const emailResult = await sendLifecycleEmail(
            profile.email,
            'Your beta access ends tomorrow — last chance for 30% off',
            getDay44FinalReminderHTML(emailData),
            getDay44FinalReminderText(emailData),
          );

          if (emailResult.success) {
            day44Emails.push(profile.email);
          }

          await supabase.from('admin_messaging_log').insert({
            admin_user_id: '00000000-0000-0000-0000-000000000000',
            recipient_email: profile.email,
            recipient_name: profile.full_name,
            template_name: 'beta_final_day44',
            message_type: 'beta_lifecycle',
            send_status: emailResult.success ? 'sent' : 'failed',
            error_message: emailResult.error || null,
            context: { lifecycle_id: user.id, days_elapsed: daysElapsed },
          });
        }
      }
    }

    results.day44_reminders_sent = day44Emails;
    results.day44_count = day44Emails.length;

    // =========================================================================
    // STEP 4: Mark Day 45 completions
    // =========================================================================
    const { data: completedUsers } = await supabase
      .from('beta_tester_lifecycle')
      .select('id, user_id, first_login_at, extension_days')
      .in('lifecycle_status', ['active', 'thanked'])
      .not('first_login_at', 'is', null)
      .is('day_45_completed_at', null);

    const completedIds: string[] = [];

    if (completedUsers && completedUsers.length > 0) {
      for (const user of completedUsers) {
        const firstLogin = new Date(user.first_login_at);
        const totalDays = 45 + (user.extension_days || 0);
        const daysElapsed = Math.floor((Date.now() - firstLogin.getTime()) / (1000 * 60 * 60 * 24));

        if (daysElapsed >= totalDays) {
          await supabase
            .from('beta_tester_lifecycle')
            .update({
              lifecycle_status: 'completed',
              day_45_completed_at: new Date().toISOString(),
            })
            .eq('id', user.id);

          completedIds.push(user.user_id);
          log('DAY45_COMPLETED', { user_id: user.user_id });
        }
      }
    }

    results.day45_completed = completedIds;
    results.day45_count = completedIds.length;

    log('CHECK_COMPLETE', results);

    return new Response(
      JSON.stringify({ success: true, ...results, request_id: requestId }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log('UNEXPECTED_ERROR', { error: errorMsg });
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred', details: errorMsg, request_id: requestId }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
