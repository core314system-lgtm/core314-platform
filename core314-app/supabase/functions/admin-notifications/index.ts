import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// =============================================================================
// ADMIN NOTIFICATIONS
// Sends daily digest email to admin with key platform metrics:
// - New signups (last 24h)
// - Active trials expiring soon
// - Beta testers approaching conversion deadline
// - NPS summary
// - Failed payments
// Intended to be triggered by pg_cron daily at 8am UTC.
// =============================================================================

const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY') || '';
const ADMIN_EMAIL = 'admin@core314.com';
const FROM_EMAIL = 'notifications@core314.com';

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // 1. New signups in last 24h
    const { count: newSignups } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', yesterday.toISOString());

    // 2. Trials expiring in next 3 days
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const { count: expiringTrials } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('subscription_status', 'trialing')
      .lte('trial_ends_at', threeDaysFromNow.toISOString())
      .gte('trial_ends_at', now.toISOString());

    // 3. Beta testers approaching deadline (within 7 days)
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const { count: betaDeadlines } = await supabase
      .from('beta_lifecycle')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')
      .lte('beta_ends_at', sevenDaysFromNow.toISOString())
      .gte('beta_ends_at', now.toISOString());

    // 4. NPS responses in last 24h
    const { data: recentNps } = await supabase
      .from('nps_responses')
      .select('score')
      .gte('created_at', yesterday.toISOString());

    const npsCount = recentNps?.length || 0;
    const npsAvg = npsCount > 0
      ? (recentNps!.reduce((sum: number, r: { score: number }) => sum + r.score, 0) / npsCount).toFixed(1)
      : 'N/A';

    // 5. Total active users
    const { count: totalUsers } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true });

    // 6. Active integrations
    const { count: activeIntegrations } = await supabase
      .from('user_integrations')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active');

    // Build email
    const dateStr = now.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <div style="background: linear-gradient(135deg, #0ea5e9, #6366f1); border-radius: 12px; padding: 24px; margin-bottom: 24px;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Core314 Admin Digest</h1>
          <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0 0; font-size: 14px;">${dateStr}</p>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
          <tr>
            <td style="padding: 16px; background: #f8fafc; border-radius: 8px; text-align: center; width: 50%;">
              <div style="font-size: 32px; font-weight: 700; color: #0ea5e9;">${newSignups || 0}</div>
              <div style="font-size: 13px; color: #64748b; margin-top: 4px;">New Signups (24h)</div>
            </td>
            <td style="width: 12px;"></td>
            <td style="padding: 16px; background: #f8fafc; border-radius: 8px; text-align: center; width: 50%;">
              <div style="font-size: 32px; font-weight: 700; color: #6366f1;">${totalUsers || 0}</div>
              <div style="font-size: 13px; color: #64748b; margin-top: 4px;">Total Users</div>
            </td>
          </tr>
        </table>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
          <tr>
            <td style="padding: 16px; background: #f8fafc; border-radius: 8px; text-align: center; width: 50%;">
              <div style="font-size: 32px; font-weight: 700; color: #f59e0b;">${expiringTrials || 0}</div>
              <div style="font-size: 13px; color: #64748b; margin-top: 4px;">Trials Expiring (3d)</div>
            </td>
            <td style="width: 12px;"></td>
            <td style="padding: 16px; background: #f8fafc; border-radius: 8px; text-align: center; width: 50%;">
              <div style="font-size: 32px; font-weight: 700; color: #10b981;">${activeIntegrations || 0}</div>
              <div style="font-size: 13px; color: #64748b; margin-top: 4px;">Active Integrations</div>
            </td>
          </tr>
        </table>

        ${(betaDeadlines || 0) > 0 ? `
        <div style="background: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
          <strong style="color: #92400e;">Beta Alert:</strong>
          <span style="color: #78350f;"> ${betaDeadlines} beta tester(s) approaching conversion deadline in the next 7 days.</span>
        </div>
        ` : ''}

        <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
          <h3 style="margin: 0 0 8px 0; color: #1e293b;">NPS Summary (24h)</h3>
          <p style="margin: 0; color: #64748b;">
            ${npsCount} response${npsCount !== 1 ? 's' : ''} — Average score: ${npsAvg}
          </p>
        </div>

        <div style="text-align: center; padding: 16px 0; border-top: 1px solid #e2e8f0;">
          <a href="https://admin.core314.com" style="color: #0ea5e9; text-decoration: none; font-weight: 600;">
            Open Admin Dashboard →
          </a>
        </div>

        <p style="text-align: center; color: #94a3b8; font-size: 12px; margin-top: 24px;">
          Core314 · Operational Intelligence Platform<br>
          This is an automated admin notification.
        </p>
      </div>
    `;

    // Send via SendGrid
    if (SENDGRID_API_KEY) {
      const sgResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SENDGRID_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: ADMIN_EMAIL }] }],
          from: { email: FROM_EMAIL, name: 'Core314 System' },
          subject: `Core314 Daily Digest — ${newSignups || 0} new signups, ${expiringTrials || 0} expiring trials`,
          content: [{ type: 'text/html', value: html }],
        }),
      });

      if (!sgResponse.ok) {
        const errorText = await sgResponse.text();
        console.error('SendGrid error:', errorText);
      }
    } else {
      console.warn('SENDGRID_API_KEY not set, skipping email send');
    }

    return new Response(
      JSON.stringify({
        success: true,
        metrics: {
          new_signups: newSignups || 0,
          total_users: totalUsers || 0,
          expiring_trials: expiringTrials || 0,
          beta_deadlines: betaDeadlines || 0,
          active_integrations: activeIntegrations || 0,
          nps_responses_24h: npsCount,
          nps_average: npsAvg,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Admin notifications error:', error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
