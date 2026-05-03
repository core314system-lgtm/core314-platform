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
                As promised, you've earned an <strong style="color: #00BFFF;">exclusive 50% discount</strong> on the Command Center plan for your first 6 months. That's <strong>${data.discount_amount}/mo</strong> instead of ${data.full_price}/mo — a savings of <strong>$2,397.00 over 6 months</strong>.
              </p>
              <p style="font-size: 16px; line-height: 1.6; color: #E0E0E0; margin: 0 0 24px 0;">
                This discount is exclusively for beta participants who completed the full program. It's our way of saying: we value the people who believed in us early.
              </p>
              <!-- CTA Button -->
              <center>
                <a href="${data.checkout_url}" style="display: inline-block; background: linear-gradient(90deg, #00BFFF, #007BFF); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                  Claim Your 50% Beta Reward
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

As promised, you've earned an exclusive 50% discount on the Command Center plan for your first 6 months. That's ${data.discount_amount}/mo instead of ${data.full_price}/mo — a savings of $2,397.00 over 6 months.

This discount is exclusively for beta participants who completed the full program. It's our way of saying: we value the people who believed in us early.

CLAIM YOUR 50% BETA REWARD: ${data.checkout_url}

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
                A few days ago we sent you a thank-you note for your incredible participation in the Core314 beta program — along with your exclusive <strong style="color: #00BFFF;">50% discount</strong> on the Command Center plan.
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
                  Claim Your 50% Discount
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

A few days ago we sent you a thank-you note for your incredible participation in the Core314 beta program — along with your exclusive 50% discount on the Command Center plan.

We wanted to make sure you saw it. Your beta period completes on ${data.day_45_date}, and we'd love to keep you on board.

Quick recap: ${data.discount_amount}/mo instead of ${data.full_price}/mo for 6 months. Your first charge won't happen until ${data.day_46_date}.

CLAIM YOUR 50% DISCOUNT: ${data.checkout_url}

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
                Your exclusive <strong style="color: #00BFFF;">50% beta reward</strong> is still available. Lock in ${data.discount_amount}/mo for your first 6 months before it expires.
              </p>
              <p style="font-size: 16px; line-height: 1.6; color: #E0E0E0; margin: 0 0 24px 0;">
                Once secured, your first charge won't occur until ${data.day_46_date} — and you'll continue with uninterrupted access to everything you've been using.
              </p>
              <!-- CTA Button -->
              <center>
                <a href="${data.checkout_url}" style="display: inline-block; background: linear-gradient(90deg, #f59e0b, #d97706); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                  Lock In Your 50% Discount Now
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

Your exclusive 50% beta reward is still available. Lock in ${data.discount_amount}/mo for your first 6 months before it expires.

Once secured, your first charge won't occur until ${data.day_46_date} — and you'll continue with uninterrupted access to everything you've been using.

LOCK IN YOUR 50% DISCOUNT NOW: ${data.checkout_url}

Questions? Reply to this email or contact admin@core314.com

The Core314 Team
© 2026 Core314™ Technologies LLC. All rights reserved.`;
}

// =============================================================================
// DAY 7 CHECK-IN EMAIL
// =============================================================================

function getDay7CheckInHTML(data: BetaLifecycleEmailData): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Week 1 Check-In - Core314 Beta</title>
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
            <td style="background: linear-gradient(135deg, #00BFFF 0%, #007BFF 100%); padding: 40px 30px; border-radius: 12px; text-align: center;">
              <h1 style="margin: 0; font-size: 26px; font-weight: 700; color: #ffffff;">Your First Week in the Beta</h1>
            </td>
          </tr>
          <tr><td style="height: 24px;"></td></tr>
          <tr>
            <td style="background-color: #1A1F2E; padding: 30px; border-radius: 12px; border: 1px solid #2A3F5F;">
              <p style="font-size: 16px; line-height: 1.6; color: #E0E0E0; margin: 0 0 20px 0;">
                ${data.name},
              </p>
              <p style="font-size: 16px; line-height: 1.6; color: #E0E0E0; margin: 0 0 20px 0;">
                It's been a week since you started the Core314 beta. We wanted to check in and make sure you're getting the most out of your experience.
              </p>
              <p style="font-size: 16px; line-height: 1.6; color: #E0E0E0; margin: 0 0 10px 0;">
                <strong style="color: #00BFFF;">Quick tips to get the most value:</strong>
              </p>
              <ul style="margin: 0 0 20px 0; padding-left: 24px; font-size: 16px; line-height: 1.8; color: #E0E0E0;">
                <li><strong>Connect 2-3 integrations</strong> — More data sources = richer operational intelligence</li>
                <li><strong>Generate your first brief</strong> — See real insights from your connected tools</li>
                <li><strong>Review your Health Score</strong> — Understand where your operations stand</li>
              </ul>
              <p style="font-size: 16px; line-height: 1.6; color: #E0E0E0; margin: 0 0 20px 0;">
                You have <strong style="color: #00BFFF;">${data.days_remaining} days</strong> remaining in your beta period. The more you use Core314, the more valuable it becomes.
              </p>
              <center>
                <a href="https://app.core314.com/brief" style="display: inline-block; background: linear-gradient(90deg, #00BFFF, #007BFF); color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                  Open Your Dashboard
                </a>
              </center>
            </td>
          </tr>
          <tr><td style="height: 24px;"></td></tr>
          <tr>
            <td style="background-color: #1A1F2E; padding: 20px 30px; border-radius: 12px; border: 1px solid #2A3F5F;">
              <p style="font-size: 14px; line-height: 1.6; color: #94a3b8; margin: 0;">
                Having trouble or need help? Reply to this email — we're here for you. Your feedback directly shapes the product.
              </p>
            </td>
          </tr>
          <tr><td style="height: 24px;"></td></tr>
          <tr>
            <td style="text-align: center; padding: 20px;">
              <p style="margin: 0 0 8px 0; font-size: 14px; color: #64748b;">
                <a href="mailto:admin@core314.com" style="color: #00BFFF; text-decoration: none;">admin@core314.com</a>
              </p>
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

function getDay7CheckInText(data: BetaLifecycleEmailData): string {
  return `Your First Week in the Core314 Beta

${data.name},

It's been a week since you started the Core314 beta. We wanted to check in and make sure you're getting the most out of your experience.

QUICK TIPS TO GET THE MOST VALUE:
- Connect 2-3 integrations — More data sources = richer operational intelligence
- Generate your first brief — See real insights from your connected tools
- Review your Health Score — Understand where your operations stand

You have ${data.days_remaining} days remaining in your beta period. The more you use Core314, the more valuable it becomes.

OPEN YOUR DASHBOARD: https://app.core314.com/brief

Having trouble or need help? Reply to this email — we're here for you. Your feedback directly shapes the product.

admin@core314.com
(c) 2026 Core314 Technologies LLC. All rights reserved.`;
}

// =============================================================================
// DAY 21 MID-POINT CHECK-IN EMAIL
// =============================================================================

function getDay21MidPointHTML(data: BetaLifecycleEmailData): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Halfway Through Your Beta - Core314</title>
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
              <h1 style="margin: 0; font-size: 26px; font-weight: 700; color: #ffffff;">You're Halfway There</h1>
            </td>
          </tr>
          <tr><td style="height: 24px;"></td></tr>
          <tr>
            <td style="background-color: #1A1F2E; padding: 30px; border-radius: 12px; border: 1px solid #2A3F5F;">
              <p style="font-size: 16px; line-height: 1.6; color: #E0E0E0; margin: 0 0 20px 0;">
                ${data.name},
              </p>
              <p style="font-size: 16px; line-height: 1.6; color: #E0E0E0; margin: 0 0 20px 0;">
                You're at the halfway mark of your Core314 beta! Here's a quick snapshot of your journey so far:
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0F172A; border-radius: 8px; margin: 0 0 20px 0;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="font-size: 14px; color: #94a3b8; margin: 0 0 8px 0;">YOUR BETA STATS</p>
                    <p style="font-size: 16px; color: #E0E0E0; margin: 0 0 4px 0;"><strong style="color: #00BFFF;">${data.days_elapsed}</strong> days in the beta</p>
                    <p style="font-size: 16px; color: #E0E0E0; margin: 0 0 4px 0;"><strong style="color: #00BFFF;">${data.total_logins}</strong> sessions logged</p>
                    <p style="font-size: 16px; color: #E0E0E0; margin: 0;"><strong style="color: #00BFFF;">${data.days_remaining}</strong> days remaining</p>
                  </td>
                </tr>
              </table>
              <p style="font-size: 16px; line-height: 1.6; color: #E0E0E0; margin: 0 0 20px 0;">
                The second half is where things get interesting. As you build more history, your operational briefs become more insightful and your health score trends become meaningful.
              </p>
              <p style="font-size: 16px; line-height: 1.6; color: #E0E0E0; margin: 0 0 10px 0;">
                <strong style="color: #8B5CF6;">Things to try in the next 3 weeks:</strong>
              </p>
              <ul style="margin: 0 0 20px 0; padding-left: 24px; font-size: 16px; line-height: 1.8; color: #E0E0E0;">
                <li>Add more integrations to expand your intelligence coverage</li>
                <li>Review your operational brief trends over time</li>
                <li>Share insights with your team members</li>
                <li>Send us feedback — your input shapes the product</li>
              </ul>
              <p style="font-size: 16px; line-height: 1.6; color: #E0E0E0; margin: 0 0 24px 0;">
                Remember: beta testers who complete the full program earn an exclusive <strong style="color: #00BFFF;">50% discount</strong> — ${data.discount_amount}/mo instead of ${data.full_price}/mo for 6 months.
              </p>
              <center>
                <a href="https://app.core314.com/brief" style="display: inline-block; background: linear-gradient(90deg, #8B5CF6, #6D28D9); color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                  Continue Exploring
                </a>
              </center>
            </td>
          </tr>
          <tr><td style="height: 24px;"></td></tr>
          <tr>
            <td style="text-align: center; padding: 20px;">
              <p style="margin: 0 0 8px 0; font-size: 14px; color: #64748b;">
                <a href="mailto:admin@core314.com" style="color: #00BFFF; text-decoration: none;">admin@core314.com</a>
              </p>
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

function getDay21MidPointText(data: BetaLifecycleEmailData): string {
  return `You're Halfway Through Your Core314 Beta!

${data.name},

You're at the halfway mark of your Core314 beta! Here's a quick snapshot:

YOUR BETA STATS:
- ${data.days_elapsed} days in the beta
- ${data.total_logins} sessions logged
- ${data.days_remaining} days remaining

The second half is where things get interesting. As you build more history, your operational briefs become more insightful and your health score trends become meaningful.

THINGS TO TRY IN THE NEXT 3 WEEKS:
- Add more integrations to expand your intelligence coverage
- Review your operational brief trends over time
- Share insights with your team members
- Send us feedback — your input shapes the product

Remember: beta testers who complete the full program earn an exclusive 50% discount — ${data.discount_amount}/mo instead of ${data.full_price}/mo for 6 months.

CONTINUE EXPLORING: https://app.core314.com/brief

admin@core314.com
(c) 2026 Core314 Technologies LLC. All rights reserved.`;
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
    // STEP 0A: Send Day 7 check-in emails
    // =========================================================================
    const { data: day7Users } = await supabase
      .from('beta_tester_lifecycle')
      .select('id, user_id, first_login_at, total_logins, extension_days, checkout_url')
      .eq('lifecycle_status', 'active')
      .not('first_login_at', 'is', null);

    const day7Emails: string[] = [];

    if (day7Users && day7Users.length > 0) {
      for (const user of day7Users) {
        const firstLogin = new Date(user.first_login_at);
        const totalDays = 45 + (user.extension_days || 0);
        const daysElapsed = Math.floor((Date.now() - firstLogin.getTime()) / (1000 * 60 * 60 * 24));

        if (daysElapsed >= 7 && daysElapsed < 14) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', user.user_id)
            .single();

          if (!profile) continue;

          // Check if already sent
          const { data: existing } = await supabase
            .from('admin_messaging_log')
            .select('id')
            .eq('recipient_email', profile.email)
            .eq('template_name', 'beta_day7_checkin')
            .limit(1);

          if (existing && existing.length > 0) continue;

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
            discount_amount: '$399.50',
            monthly_price: '$399.50',
            full_price: '$799',
          };

          const emailResult = await sendLifecycleEmail(
            profile.email,
            'Your first week in the Core314 beta — tips to get the most value',
            getDay7CheckInHTML(emailData),
            getDay7CheckInText(emailData),
          );

          if (emailResult.success) {
            day7Emails.push(profile.email);
          }

          await supabase.from('admin_messaging_log').insert({
            admin_user_id: '00000000-0000-0000-0000-000000000000',
            recipient_email: profile.email,
            recipient_name: profile.full_name,
            template_name: 'beta_day7_checkin',
            message_type: 'beta_lifecycle',
            send_status: emailResult.success ? 'sent' : 'failed',
            error_message: emailResult.error || null,
            context: { lifecycle_id: user.id, days_elapsed: daysElapsed },
          });
        }
      }
    }

    results.day7_emails_sent = day7Emails;
    results.day7_count = day7Emails.length;

    // =========================================================================
    // STEP 0B: Send Day 21 mid-point check-in emails
    // =========================================================================
    const { data: day21Users } = await supabase
      .from('beta_tester_lifecycle')
      .select('id, user_id, first_login_at, total_logins, extension_days, checkout_url')
      .eq('lifecycle_status', 'active')
      .not('first_login_at', 'is', null);

    const day21Emails: string[] = [];

    if (day21Users && day21Users.length > 0) {
      for (const user of day21Users) {
        const firstLogin = new Date(user.first_login_at);
        const totalDays = 45 + (user.extension_days || 0);
        const daysElapsed = Math.floor((Date.now() - firstLogin.getTime()) / (1000 * 60 * 60 * 24));

        if (daysElapsed >= 21 && daysElapsed < 28) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', user.user_id)
            .single();

          if (!profile) continue;

          // Check if already sent
          const { data: existing } = await supabase
            .from('admin_messaging_log')
            .select('id')
            .eq('recipient_email', profile.email)
            .eq('template_name', 'beta_day21_midpoint')
            .limit(1);

          if (existing && existing.length > 0) continue;

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
            discount_amount: '$399.50',
            monthly_price: '$399.50',
            full_price: '$799',
          };

          const emailResult = await sendLifecycleEmail(
            profile.email,
            'You\'re halfway through your Core314 beta — here\'s your progress',
            getDay21MidPointHTML(emailData),
            getDay21MidPointText(emailData),
          );

          if (emailResult.success) {
            day21Emails.push(profile.email);
          }

          await supabase.from('admin_messaging_log').insert({
            admin_user_id: '00000000-0000-0000-0000-000000000000',
            recipient_email: profile.email,
            recipient_name: profile.full_name,
            template_name: 'beta_day21_midpoint',
            message_type: 'beta_lifecycle',
            send_status: emailResult.success ? 'sent' : 'failed',
            error_message: emailResult.error || null,
            context: { lifecycle_id: user.id, days_elapsed: daysElapsed },
          });
        }
      }
    }

    results.day21_emails_sent = day21Emails;
    results.day21_count = day21Emails.length;

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
            discount_amount: '$399.50',
            monthly_price: '$399.50',
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
            discount_amount: '$399.50',
            monthly_price: '$399.50',
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
            discount_amount: '$399.50',
            monthly_price: '$399.50',
            full_price: '$799',
          };

          const emailResult = await sendLifecycleEmail(
            profile.email,
            'Your beta access ends tomorrow — last chance for 50% off',
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
