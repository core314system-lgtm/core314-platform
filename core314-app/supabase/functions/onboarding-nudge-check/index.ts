import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// =============================================================================
// ONBOARDING NUDGE CHECK
// Runs on a schedule (pg_cron every 2 hours) to send activation nudge emails.
//
// Dual-track cadence:
//   Beta Testers (45-day free):  2 nudges — gentler, less frequent
//   Trial Users (14-day trial):  5 nudges — more assertive, faster cadence
//
// Respects email_suppressed flag and never re-sends a nudge.
// =============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// =============================================================================
// EMAIL TEMPLATES — TRIAL USERS
// =============================================================================

function trialNudge1HTML(name: string): string {
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
        <tr><td style="background:linear-gradient(135deg,#00BFFF 0%,#007BFF 100%);padding:40px 30px;border-radius:12px;text-align:center;">
          <h1 style="margin:0;font-size:24px;font-weight:700;color:#ffffff;">Your First Insight Is One Connection Away</h1>
        </td></tr>
        <tr><td style="height:24px;"></td></tr>
        <tr><td style="background-color:#1A1F2E;padding:30px;border-radius:12px;border:1px solid #2A3F5F;">
          <p style="font-size:16px;line-height:1.6;color:#E0E0E0;margin:0 0 20px 0;">${name},</p>
          <p style="font-size:16px;line-height:1.6;color:#E0E0E0;margin:0 0 20px 0;">We noticed you haven't connected your first integration yet.</p>
          <p style="font-size:16px;line-height:1.6;color:#E0E0E0;margin:0 0 20px 0;">Without a connected system, Core314 can't generate the operational insights that make it valuable. Your data is currently spread across multiple tools — Core314 brings it together and identifies patterns that aren't visible when looking at systems individually.</p>
          <p style="font-size:16px;line-height:1.6;color:#E0E0E0;margin:0 0 10px 0;"><strong style="color:#00BFFF;">Once connected, your Operational Brief will surface:</strong></p>
          <ul style="margin:0 0 20px 0;padding-left:24px;font-size:16px;line-height:1.8;color:#E0E0E0;">
            <li>Where activity is slowing down across your teams</li>
            <li>Where operational risk is building undetected</li>
            <li>What actions should be taken before issues escalate</li>
          </ul>
          <p style="font-size:16px;line-height:1.6;color:#E0E0E0;margin:0 0 24px 0;">It takes about 2–3 minutes to connect your first system. Most users connect 2–3 for a clearer picture.</p>
          <center>
            <a href="https://app.core314.com/integration-manager" style="display:inline-block;background:linear-gradient(90deg,#00BFFF,#007BFF);color:#ffffff;text-decoration:none;padding:16px 40px;border-radius:8px;font-weight:600;font-size:16px;">Connect Your First Integration</a>
          </center>
        </td></tr>
        <tr><td style="height:24px;"></td></tr>
        <tr><td style="text-align:center;padding:20px;">
          <p style="margin:0 0 8px 0;font-size:14px;color:#64748b;">Questions? Reply to this email — we read every one.</p>
          <p style="margin:0;font-size:12px;color:#94a3b8;">&copy; 2026 Core314&trade; Technologies LLC. All rights reserved.</p>
          <p style="margin:8px 0 0 0;font-size:12px;">
            <a href="https://core314.com/privacy" style="color:#00BFFF;text-decoration:none;">Privacy Policy</a> |
            <a href="https://core314.com/terms" style="color:#00BFFF;text-decoration:none;">Terms of Service</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function trialNudge1Text(name: string): string {
  return `Your First Insight Is One Connection Away

${name},

We noticed you haven't connected your first integration yet.

Without a connected system, Core314 can't generate the operational insights that make it valuable. Your data is currently spread across multiple tools — Core314 brings it together and identifies patterns that aren't visible when looking at systems individually.

Once connected, your Operational Brief will surface:
- Where activity is slowing down across your teams
- Where operational risk is building undetected
- What actions should be taken before issues escalate

It takes about 2-3 minutes to connect your first system. Most users connect 2-3 for a clearer picture.

Connect your first integration: https://app.core314.com/integration-manager

Questions? Reply to this email — we read every one.

© 2026 Core314 Technologies LLC. All rights reserved.`;
}

function trialNudge2HTML(name: string): string {
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
          <p style="font-size:16px;line-height:1.6;color:#E0E0E0;margin:0 0 20px 0;">Your integration is connected — <strong style="color:#00BFFF;">your data is ready.</strong></p>
          <p style="font-size:16px;line-height:1.6;color:#E0E0E0;margin:0 0 20px 0;">Now generate your first Operational Brief. This is where Core314 becomes valuable.</p>
          <p style="font-size:16px;line-height:1.6;color:#E0E0E0;margin:0 0 10px 0;"><strong style="color:#00BFFF;">The brief will analyze your data and surface:</strong></p>
          <ul style="margin:0 0 20px 0;padding-left:24px;font-size:16px;line-height:1.8;color:#E0E0E0;">
            <li>Cross-system signals your team may be missing</li>
            <li>Patterns affecting operational performance</li>
            <li>Specific areas that require immediate attention</li>
          </ul>
          <p style="font-size:16px;line-height:1.6;color:#E0E0E0;margin:0 0 24px 0;">Most users discover at least one issue or opportunity they weren't aware of.</p>
          <center>
            <a href="https://app.core314.com/brief" style="display:inline-block;background:linear-gradient(90deg,#00BFFF,#007BFF);color:#ffffff;text-decoration:none;padding:16px 40px;border-radius:8px;font-weight:600;font-size:16px;">Generate Your First Brief</a>
          </center>
        </td></tr>
        <tr><td style="height:24px;"></td></tr>
        <tr><td style="text-align:center;padding:20px;">
          <p style="margin:0 0 8px 0;font-size:14px;color:#64748b;">Questions? Reply to this email.</p>
          <p style="margin:0;font-size:12px;color:#94a3b8;">&copy; 2026 Core314&trade; Technologies LLC. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function trialNudge2Text(name: string): string {
  return `Your Data Is Ready — Generate Your First Brief

${name},

Your integration is connected — your data is ready.

Now generate your first Operational Brief. This is where Core314 becomes valuable.

The brief will analyze your data and surface:
- Cross-system signals your team may be missing
- Patterns affecting operational performance
- Specific areas that require immediate attention

Most users discover at least one issue or opportunity they weren't aware of.

Generate your first brief: https://app.core314.com/brief

Questions? Reply to this email.

© 2026 Core314 Technologies LLC. All rights reserved.`;
}

function trialNudge3HTML(name: string): string {
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
          <p style="font-size:16px;line-height:1.6;color:#E0E0E0;margin:0 0 20px 0;">Your operations data is waiting for you.</p>
          <p style="font-size:16px;line-height:1.6;color:#E0E0E0;margin:0 0 20px 0;">Core314 only works when it can analyze your data. Right now, you're one step away from seeing real operational insight.</p>
          <p style="font-size:16px;line-height:1.6;color:#E0E0E0;margin:0 0 10px 0;"><strong style="color:#00BFFF;">Users typically discover:</strong></p>
          <ul style="margin:0 0 20px 0;padding-left:24px;font-size:16px;line-height:1.8;color:#E0E0E0;">
            <li>Delays in revenue progression that weren't visible</li>
            <li>Gaps in follow-up activity across teams</li>
            <li>Misalignment between systems causing friction</li>
          </ul>
          <p style="font-size:16px;line-height:1.6;color:#E0E0E0;margin:0 0 24px 0;">All from one Operational Brief.</p>
          <center>
            <a href="https://app.core314.com/integration-manager" style="display:inline-block;background:linear-gradient(90deg,#00BFFF,#007BFF);color:#ffffff;text-decoration:none;padding:16px 40px;border-radius:8px;font-weight:600;font-size:16px;">Continue Setup</a>
          </center>
        </td></tr>
        <tr><td style="height:24px;"></td></tr>
        <tr><td style="text-align:center;padding:20px;">
          <p style="margin:0 0 8px 0;font-size:14px;color:#64748b;">Questions? Reply to this email.</p>
          <p style="margin:0;font-size:12px;color:#94a3b8;">&copy; 2026 Core314&trade; Technologies LLC. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function trialNudge3Text(name: string): string {
  return `Don't Miss What Your Data Is Telling You

${name},

Your operations data is waiting for you.

Core314 only works when it can analyze your data. Right now, you're one step away from seeing real operational insight.

Users typically discover:
- Delays in revenue progression that weren't visible
- Gaps in follow-up activity across teams
- Misalignment between systems causing friction

All from one Operational Brief.

Continue setup: https://app.core314.com/integration-manager

Questions? Reply to this email.

© 2026 Core314 Technologies LLC. All rights reserved.`;
}

function trialNudge4HTML(name: string): string {
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
        <tr><td style="background:linear-gradient(135deg,#F59E0B 0%,#D97706 100%);padding:30px;border-radius:12px;text-align:center;">
          <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;">Your Trial Is Halfway Through</h1>
        </td></tr>
        <tr><td style="height:24px;"></td></tr>
        <tr><td style="background-color:#1A1F2E;padding:30px;border-radius:12px;border:1px solid #2A3F5F;">
          <p style="font-size:16px;line-height:1.6;color:#E0E0E0;margin:0 0 20px 0;">${name},</p>
          <p style="font-size:16px;line-height:1.6;color:#E0E0E0;margin:0 0 20px 0;">By now, most users have generated their first Operational Brief — and almost every time, they uncover something unexpected.</p>
          <p style="font-size:16px;line-height:1.6;color:#E0E0E0;margin:0 0 20px 0;">Core314 is designed to surface signals you wouldn't normally see:</p>
          <ul style="margin:0 0 20px 0;padding-left:24px;font-size:16px;line-height:1.8;color:#E0E0E0;">
            <li>Hidden inefficiencies costing time and money</li>
            <li>Early-stage risks before they become problems</li>
            <li>Missed opportunities across your operations</li>
          </ul>
          <p style="font-size:16px;line-height:1.6;color:#E0E0E0;margin:0 0 24px 0;">If you haven't generated your first brief yet, this is the moment to do it.</p>
          <center>
            <a href="https://app.core314.com/brief" style="display:inline-block;background:linear-gradient(90deg,#00BFFF,#007BFF);color:#ffffff;text-decoration:none;padding:16px 40px;border-radius:8px;font-weight:600;font-size:16px;">Generate Your First Brief</a>
          </center>
        </td></tr>
        <tr><td style="height:24px;"></td></tr>
        <tr><td style="text-align:center;padding:20px;">
          <p style="margin:0 0 8px 0;font-size:14px;color:#64748b;">Questions? Reply to this email.</p>
          <p style="margin:0;font-size:12px;color:#94a3b8;">&copy; 2026 Core314&trade; Technologies LLC. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function trialNudge4Text(name: string): string {
  return `Most Users Find Something Within Their First Brief

${name},

By now, most users have generated their first Operational Brief — and almost every time, they uncover something unexpected.

Core314 is designed to surface signals you wouldn't normally see:
- Hidden inefficiencies costing time and money
- Early-stage risks before they become problems
- Missed opportunities across your operations

If you haven't generated your first brief yet, this is the moment to do it.

Generate your first brief: https://app.core314.com/brief

Questions? Reply to this email.

© 2026 Core314 Technologies LLC. All rights reserved.`;
}

function trialNudge5HTML(name: string): string {
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
        <tr><td style="background:linear-gradient(135deg,#EF4444 0%,#DC2626 100%);padding:30px;border-radius:12px;text-align:center;">
          <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;">Your Trial Ends Soon</h1>
        </td></tr>
        <tr><td style="height:24px;"></td></tr>
        <tr><td style="background-color:#1A1F2E;padding:30px;border-radius:12px;border:1px solid #2A3F5F;">
          <p style="font-size:16px;line-height:1.6;color:#E0E0E0;margin:0 0 20px 0;">${name},</p>
          <p style="font-size:16px;line-height:1.6;color:#E0E0E0;margin:0 0 20px 0;">Your trial is coming to an end. Before it does, make sure you've seen the full value of Core314.</p>
          <p style="font-size:16px;line-height:1.6;color:#E0E0E0;margin:0 0 10px 0;"><strong style="color:#00BFFF;">Complete these two steps:</strong></p>
          <ol style="margin:0 0 20px 0;padding-left:24px;font-size:16px;line-height:1.8;color:#E0E0E0;">
            <li>Connect at least one integration (CRM, accounting, or project system)</li>
            <li>Generate your first Operational Brief</li>
          </ol>
          <p style="font-size:16px;line-height:1.6;color:#E0E0E0;margin:0 0 24px 0;">Users who complete these steps typically continue because they rely on the insights to make decisions they couldn't make before.</p>
          <center>
            <a href="https://app.core314.com/integration-manager" style="display:inline-block;background:linear-gradient(90deg,#00BFFF,#007BFF);color:#ffffff;text-decoration:none;padding:16px 40px;border-radius:8px;font-weight:600;font-size:16px;">Complete Setup Now</a>
          </center>
        </td></tr>
        <tr><td style="height:24px;"></td></tr>
        <tr><td style="text-align:center;padding:20px;">
          <p style="margin:0 0 8px 0;font-size:14px;color:#64748b;">Questions? Reply to this email.</p>
          <p style="margin:0;font-size:12px;color:#94a3b8;">&copy; 2026 Core314&trade; Technologies LLC. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function trialNudge5Text(name: string): string {
  return `Your Trial Ends Soon — Don't Leave Insights on the Table

${name},

Your trial is coming to an end. Before it does, make sure you've seen the full value of Core314.

Complete these two steps:
1. Connect at least one integration (CRM, accounting, or project system)
2. Generate your first Operational Brief

Users who complete these steps typically continue because they rely on the insights to make decisions they couldn't make before.

Complete setup now: https://app.core314.com/integration-manager

Questions? Reply to this email.

© 2026 Core314 Technologies LLC. All rights reserved.`;
}

// =============================================================================
// EMAIL TEMPLATES — BETA TESTERS
// =============================================================================

function betaNudge1HTML(name: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background-color:#0A0F1A;color:#ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0A0F1A;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0">
        <tr><td style="text-align:center;padding-bottom:30px;">
          <span style="font-size:32px;font-weight:700;color:#00BFFF;letter-spacing:2px;">CORE314</span>
          <span style="display:block;font-size:11px;color:#94a3b8;letter-spacing:1px;margin-top:4px;">BETA PROGRAM</span>
        </td></tr>
        <tr><td style="background-color:#1A1F2E;padding:30px;border-radius:12px;border:1px solid #2A3F5F;">
          <p style="font-size:16px;line-height:1.6;color:#E0E0E0;margin:0 0 20px 0;">${name},</p>
          <p style="font-size:16px;line-height:1.6;color:#E0E0E0;margin:0 0 20px 0;">Welcome to the beta! We're glad you're here.</p>
          <p style="font-size:16px;line-height:1.6;color:#E0E0E0;margin:0 0 20px 0;">To start seeing what Core314 can do, the first step is connecting one of your existing tools — Slack, HubSpot, Jira, QuickBooks, or any of our 16 supported integrations.</p>
          <p style="font-size:16px;line-height:1.6;color:#E0E0E0;margin:0 0 20px 0;"><strong style="color:#00BFFF;">Why this matters for your beta experience:</strong></p>
          <p style="font-size:16px;line-height:1.6;color:#E0E0E0;margin:0 0 20px 0;">Core314 generates an Operational Brief by analyzing signals across your connected systems. Without at least one connection, there's nothing to analyze — and you won't be able to see the intelligence layer that makes this platform different.</p>
          <p style="font-size:16px;line-height:1.6;color:#E0E0E0;margin:0 0 20px 0;">The brief surfaces things like stalled revenue, missed follow-ups, resource bottlenecks, and emerging risks — insights you wouldn't normally see by looking at each tool individually.</p>
          <p style="font-size:16px;line-height:1.6;color:#E0E0E0;margin:0 0 24px 0;">Most beta testers connect 2–3 integrations for the best results. It takes about 2 minutes per connection.</p>
          <center>
            <a href="https://app.core314.com/integration-manager" style="display:inline-block;background:linear-gradient(90deg,#00BFFF,#007BFF);color:#ffffff;text-decoration:none;padding:16px 40px;border-radius:8px;font-weight:600;font-size:16px;">Connect Your First Integration</a>
          </center>
          <p style="font-size:14px;line-height:1.6;color:#94a3b8;margin:20px 0 0 0;text-align:center;">Your feedback during beta directly shapes the product. We'd love to hear what you think once you see your first brief.</p>
        </td></tr>
        <tr><td style="height:24px;"></td></tr>
        <tr><td style="text-align:center;padding:20px;">
          <p style="margin:0 0 8px 0;font-size:14px;color:#64748b;">Questions? Reply to this email — we read every one.</p>
          <p style="margin:0;font-size:12px;color:#94a3b8;">&copy; 2026 Core314&trade; Technologies LLC. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function betaNudge1Text(name: string): string {
  return `Welcome to the Core314 Beta — Let's Get Started

${name},

Welcome to the beta! We're glad you're here.

To start seeing what Core314 can do, the first step is connecting one of your existing tools — Slack, HubSpot, Jira, QuickBooks, or any of our 16 supported integrations.

WHY THIS MATTERS FOR YOUR BETA EXPERIENCE:

Core314 generates an Operational Brief by analyzing signals across your connected systems. Without at least one connection, there's nothing to analyze — and you won't be able to see the intelligence layer that makes this platform different.

The brief surfaces things like stalled revenue, missed follow-ups, resource bottlenecks, and emerging risks — insights you wouldn't normally see by looking at each tool individually.

Most beta testers connect 2-3 integrations for the best results. It takes about 2 minutes per connection.

Connect your first integration: https://app.core314.com/integration-manager

Your feedback during beta directly shapes the product. We'd love to hear what you think once you see your first brief.

Questions? Reply to this email — we read every one.

© 2026 Core314 Technologies LLC. All rights reserved.`;
}

function betaNudge2HTML(name: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background-color:#0A0F1A;color:#ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0A0F1A;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0">
        <tr><td style="text-align:center;padding-bottom:30px;">
          <span style="font-size:32px;font-weight:700;color:#00BFFF;letter-spacing:2px;">CORE314</span>
          <span style="display:block;font-size:11px;color:#94a3b8;letter-spacing:1px;margin-top:4px;">BETA PROGRAM</span>
        </td></tr>
        <tr><td style="background-color:#1A1F2E;padding:30px;border-radius:12px;border:1px solid #2A3F5F;">
          <p style="font-size:16px;line-height:1.6;color:#E0E0E0;margin:0 0 20px 0;">${name},</p>
          <p style="font-size:16px;line-height:1.6;color:#E0E0E0;margin:0 0 20px 0;">Quick check-in on your beta experience — we want to make sure you're getting value from Core314.</p>
          <p style="font-size:16px;line-height:1.6;color:#E0E0E0;margin:0 0 20px 0;">The heart of the platform is the <strong style="color:#00BFFF;">Operational Brief</strong> — an AI-generated analysis of activity across your connected systems. If you haven't generated one yet, here's what you're missing:</p>
          <ul style="margin:0 0 20px 0;padding-left:24px;font-size:16px;line-height:1.8;color:#E0E0E0;">
            <li><strong>Cross-system signal detection</strong> — patterns invisible when looking at tools individually</li>
            <li><strong>Health scoring</strong> — a real-time pulse on your operational state</li>
            <li><strong>Actionable recommendations</strong> — what to do next, prioritized by impact</li>
          </ul>
          <p style="font-size:16px;line-height:1.6;color:#E0E0E0;margin:0 0 24px 0;">We'd really value your feedback on the brief once you've seen it. Your perspective as a beta tester is what helps us build this the right way.</p>
          <center>
            <a href="https://app.core314.com/brief" style="display:inline-block;background:linear-gradient(90deg,#00BFFF,#007BFF);color:#ffffff;text-decoration:none;padding:16px 40px;border-radius:8px;font-weight:600;font-size:16px;">Generate Your Operational Brief</a>
          </center>
        </td></tr>
        <tr><td style="height:24px;"></td></tr>
        <tr><td style="text-align:center;padding:20px;">
          <p style="margin:0 0 8px 0;font-size:14px;color:#64748b;">Questions or feedback? Reply to this email.</p>
          <p style="margin:0;font-size:12px;color:#94a3b8;">&copy; 2026 Core314&trade; Technologies LLC. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function betaNudge2Text(name: string): string {
  return `Beta Check-In: Have You Seen Your Operational Brief Yet?

${name},

Quick check-in on your beta experience — we want to make sure you're getting value from Core314.

The heart of the platform is the Operational Brief — an AI-generated analysis of activity across your connected systems. If you haven't generated one yet, here's what you're missing:

- Cross-system signal detection — patterns invisible when looking at tools individually
- Health scoring — a real-time pulse on your operational state
- Actionable recommendations — what to do next, prioritized by impact

We'd really value your feedback on the brief once you've seen it. Your perspective as a beta tester is what helps us build this the right way.

Generate your Operational Brief: https://app.core314.com/brief

Questions or feedback? Reply to this email.

© 2026 Core314 Technologies LLC. All rights reserved.`;
}

// =============================================================================
// EMAIL SENDING (shared with beta-lifecycle-check pattern)
// =============================================================================

async function sendNudgeEmail(
  to: string,
  subject: string,
  html: string,
  text: string
): Promise<{ success: boolean; error?: string }> {
  const sendgridApiKey = Deno.env.get('SENDGRID_API_KEY');
  const senderEmail = Deno.env.get('SENDGRID_SENDER_EMAIL') || 'noreply@core314.com';
  const senderName = Deno.env.get('SENDGRID_SENDER_NAME') || 'Core314';

  if (!sendgridApiKey) {
    console.error('[NUDGE] SENDGRID_API_KEY not configured');
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
      console.error('[NUDGE] SendGrid error:', errorText);
      return { success: false, error: `SendGrid ${response.status}: ${errorText}` };
    }

    return { success: true };
  } catch (error) {
    console.error('[NUDGE] Email send error:', error);
    return { success: false, error: String(error) };
  }
}

// =============================================================================
// NUDGE CADENCE LOGIC
// =============================================================================

interface NudgeCandidate {
  user_id: string;
  user_type: 'beta_tester' | 'trial_user';
  activation_status: string;
  signed_up_at: string;
  first_integration_at: string | null;
  first_brief_at: string | null;
  nudge_1_sent_at: string | null;
  nudge_2_sent_at: string | null;
  nudge_3_sent_at: string | null;
  nudge_4_sent_at: string | null;
  nudge_5_sent_at: string | null;
  email: string;
  full_name: string;
}

function hoursSince(dateStr: string): number {
  return (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60);
}

function daysSince(dateStr: string): number {
  return hoursSince(dateStr) / 24;
}

interface NudgeAction {
  nudge_number: number;
  subject: string;
  html: string;
  text: string;
}

function determineTrialNudge(user: NudgeCandidate): NudgeAction | null {
  const name = user.full_name || 'there';
  const signupHours = hoursSince(user.signed_up_at);
  const signupDays = daysSince(user.signed_up_at);

  // Nudge 1: No integration after 24 hours
  if (
    !user.nudge_1_sent_at &&
    user.activation_status === 'signed_up' &&
    signupHours >= 24
  ) {
    return {
      nudge_number: 1,
      subject: 'Your first insight is one connection away',
      html: trialNudge1HTML(name),
      text: trialNudge1Text(name),
    };
  }

  // Nudge 2: Integration connected but no brief after 6 hours
  if (
    !user.nudge_2_sent_at &&
    user.activation_status === 'integrating' &&
    user.first_integration_at &&
    hoursSince(user.first_integration_at) >= 6
  ) {
    return {
      nudge_number: 2,
      subject: 'Your data is ready — generate your first brief',
      html: trialNudge2HTML(name),
      text: trialNudge2Text(name),
    };
  }

  // Nudge 3: Still signed_up after 72 hours (re-engage dormant)
  if (
    !user.nudge_3_sent_at &&
    user.nudge_1_sent_at &&
    user.activation_status === 'signed_up' &&
    signupHours >= 72
  ) {
    return {
      nudge_number: 3,
      subject: "Don't miss what your data is telling you",
      html: trialNudge3HTML(name),
      text: trialNudge3Text(name),
    };
  }

  // Nudge 4: Day 5-7, still not activated
  if (
    !user.nudge_4_sent_at &&
    !user.first_brief_at &&
    signupDays >= 5 &&
    signupDays <= 8
  ) {
    return {
      nudge_number: 4,
      subject: 'Most users find something within their first brief',
      html: trialNudge4HTML(name),
      text: trialNudge4Text(name),
    };
  }

  // Nudge 5: Day 11-12, trial ending soon
  if (
    !user.nudge_5_sent_at &&
    !user.first_brief_at &&
    signupDays >= 11 &&
    signupDays <= 13
  ) {
    return {
      nudge_number: 5,
      subject: "Your trial ends soon — don't leave insights on the table",
      html: trialNudge5HTML(name),
      text: trialNudge5Text(name),
    };
  }

  return null;
}

function determineBetaNudge(user: NudgeCandidate): NudgeAction | null {
  const name = user.full_name || 'there';
  const signupHours = hoursSince(user.signed_up_at);
  const signupDays = daysSince(user.signed_up_at);

  // Beta Nudge 1: No integration after 48 hours (gentler timing)
  if (
    !user.nudge_1_sent_at &&
    user.activation_status === 'signed_up' &&
    signupHours >= 48
  ) {
    return {
      nudge_number: 1,
      subject: "Let's get your beta experience started",
      html: betaNudge1HTML(name),
      text: betaNudge1Text(name),
    };
  }

  // Beta Nudge 2: Day 5 check-in, still not activated
  if (
    !user.nudge_2_sent_at &&
    !user.first_brief_at &&
    signupDays >= 5 &&
    signupDays <= 8
  ) {
    return {
      nudge_number: 2,
      subject: 'Beta check-in: have you seen your Operational Brief yet?',
      html: betaNudge2HTML(name),
      text: betaNudge2Text(name),
    };
  }

  // No more beta nudges — Day 38/41/44 lifecycle emails handle the rest
  return null;
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
    nudges_sent: 0,
    nudges_failed: 0,
    details: [] as Array<{ user_id: string; nudge: number; user_type: string; success: boolean; error?: string }>,
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

    // Fetch all users who potentially need nudges
    // - Not suppressed
    // - Not yet activated (or not fully onboarded for integrating users)
    // - Not paid users
    const { data: candidates, error: fetchError } = await supabase
      .from('user_activation_state')
      .select(`
        user_id,
        user_type,
        activation_status,
        signed_up_at,
        first_integration_at,
        first_brief_at,
        nudge_1_sent_at,
        nudge_2_sent_at,
        nudge_3_sent_at,
        nudge_4_sent_at,
        nudge_5_sent_at
      `)
      .eq('email_suppressed', false)
      .in('activation_status', ['signed_up', 'integrating'])
      .neq('user_type', 'paid');

    if (fetchError) {
      console.error('[NUDGE] Failed to fetch candidates:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch candidates', details: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!candidates || candidates.length === 0) {
      console.log('[NUDGE] No candidates found');
      return new Response(
        JSON.stringify({ ...results, duration_ms: Date.now() - startTime }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    results.checked = candidates.length;
    console.log(`[NUDGE] Found ${candidates.length} candidates to evaluate`);

    // Fetch profile info for all candidates
    const userIds = candidates.map(c => c.user_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', userIds);

    const profileMap = new Map(
      (profiles || []).map(p => [p.id, { full_name: p.full_name || '', email: p.email || '' }])
    );

    // Process each candidate
    for (const candidate of candidates) {
      const profile = profileMap.get(candidate.user_id);
      if (!profile || !profile.email) {
        console.warn(`[NUDGE] No profile/email for user ${candidate.user_id}, skipping`);
        continue;
      }

      const enrichedCandidate: NudgeCandidate = {
        ...candidate,
        email: profile.email,
        full_name: profile.full_name,
      };

      // Determine which nudge to send based on user type
      const nudgeAction = candidate.user_type === 'beta_tester'
        ? determineBetaNudge(enrichedCandidate)
        : determineTrialNudge(enrichedCandidate);

      if (!nudgeAction) continue;

      // Send the email
      console.log(`[NUDGE] Sending nudge ${nudgeAction.nudge_number} to ${profile.email} (${candidate.user_type})`);
      const emailResult = await sendNudgeEmail(
        profile.email,
        nudgeAction.subject,
        nudgeAction.html,
        nudgeAction.text
      );

      if (emailResult.success) {
        // Mark nudge as sent
        const nudgeField = `nudge_${nudgeAction.nudge_number}_sent_at`;
        await supabase
          .from('user_activation_state')
          .update({ [nudgeField]: new Date().toISOString(), last_active_at: new Date().toISOString() })
          .eq('user_id', candidate.user_id);

        results.nudges_sent++;
        results.details.push({
          user_id: candidate.user_id,
          nudge: nudgeAction.nudge_number,
          user_type: candidate.user_type,
          success: true,
        });
      } else {
        results.nudges_failed++;
        results.details.push({
          user_id: candidate.user_id,
          nudge: nudgeAction.nudge_number,
          user_type: candidate.user_type,
          success: false,
          error: emailResult.error,
        });
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[NUDGE] Complete: ${results.nudges_sent} sent, ${results.nudges_failed} failed, ${duration}ms`);

    return new Response(
      JSON.stringify({ ...results, duration_ms: duration }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[NUDGE] Unhandled error:', error);
    return new Response(
      JSON.stringify({ error: String(error), ...results, duration_ms: Date.now() - startTime }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
