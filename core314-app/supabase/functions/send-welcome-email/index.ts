import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { sendEmail, wrapEmailHTML, appendTextFooter } from '../_shared/email-utils.ts';

// =============================================================================
// SEND WELCOME EMAIL
// Triggered after successful signup (checkout.session.completed or direct signup).
// Sends a branded welcome email with getting-started steps.
// Can be called by stripe-webhook or directly by signup flow.
// =============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// =============================================================================
// EMAIL TEMPLATES
// =============================================================================

function getWelcomeEmailBody(name: string, plan: string, passwordSetupLink?: string): string {
  const planDisplay = plan === 'command_center' ? 'Command Center' : plan === 'intelligence' ? 'Intelligence' : 'Enterprise';
  
  const passwordSection = passwordSetupLink ? `
          <!-- Password Setup -->
          <tr><td style="height:24px;"></td></tr>
          <tr>
            <td style="background-color:#1A1F2E;padding:30px;border-radius:12px;border:1px solid #2A3F5F;">
              <h2 style="font-size:20px;color:#00BFFF;margin:0 0 15px 0;">First: Set Your Password</h2>
              <p style="font-size:16px;line-height:1.6;color:#E0E0E0;margin:0 0 20px 0;">
                Click the button below to create your password and access your account.
              </p>
              <center>
                <a href="${passwordSetupLink}" style="display:inline-block;background:linear-gradient(90deg,#00BFFF,#007BFF);color:#ffffff;text-decoration:none;padding:16px 40px;border-radius:8px;font-weight:600;font-size:16px;">Set Your Password</a>
              </center>
              <p style="font-size:13px;line-height:1.6;color:#94a3b8;margin:16px 0 0 0;text-align:center;">
                This link expires in 24 hours. If it expires, use "Forgot Password" at <a href="https://app.core314.com/reset-password" style="color:#00BFFF;text-decoration:none;">app.core314.com</a>.
              </p>
            </td>
          </tr>` : '';

  return `
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#00BFFF 0%,#007BFF 100%);padding:40px 30px;border-radius:12px;text-align:center;">
              <h1 style="margin:0;font-size:26px;font-weight:700;color:#ffffff;">Welcome to Core314!</h1>
              <p style="margin:10px 0 0 0;font-size:16px;color:rgba(255,255,255,0.9);">Your ${planDisplay} trial is active</p>
            </td>
          </tr>
          <!-- Spacer -->
          <tr><td style="height:24px;"></td></tr>
          <!-- Main Content -->
          <tr>
            <td style="background-color:#1A1F2E;padding:30px;border-radius:12px;border:1px solid #2A3F5F;">
              <p style="font-size:16px;line-height:1.6;color:#E0E0E0;margin:0 0 20px 0;">
                Hi ${name},
              </p>
              <p style="font-size:16px;line-height:1.6;color:#E0E0E0;margin:0 0 20px 0;">
                Thank you for starting your <strong style="color:#00BFFF;">14-day free trial</strong> of Core314's ${planDisplay} plan. You're about to discover operational insights that most teams miss.
              </p>
              <p style="font-size:16px;line-height:1.6;color:#E0E0E0;margin:0 0 10px 0;">
                <strong style="color:#00BFFF;">Here's how to get started in 3 steps:</strong>
              </p>
              <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 20px 0;">
                <tr>
                  <td style="padding:12px 0;border-bottom:1px solid #2A3F5F;">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="width:36px;vertical-align:top;">
                          <span style="display:inline-block;width:28px;height:28px;line-height:28px;text-align:center;border-radius:50%;background:#00BFFF;color:#fff;font-weight:700;font-size:14px;">1</span>
                        </td>
                        <td style="padding-left:12px;">
                          <p style="margin:0;font-size:15px;color:#E0E0E0;line-height:1.5;"><strong style="color:#ffffff;">Connect your first integration</strong> — Link Slack, HubSpot, Jira, or any of our 16 supported tools. Takes ~2 minutes.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 0;border-bottom:1px solid #2A3F5F;">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="width:36px;vertical-align:top;">
                          <span style="display:inline-block;width:28px;height:28px;line-height:28px;text-align:center;border-radius:50%;background:#00BFFF;color:#fff;font-weight:700;font-size:14px;">2</span>
                        </td>
                        <td style="padding-left:12px;">
                          <p style="margin:0;font-size:15px;color:#E0E0E0;line-height:1.5;"><strong style="color:#ffffff;">Generate your first Operational Brief</strong> — Core314 analyzes your data and surfaces signals you wouldn't normally see.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 0;">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="width:36px;vertical-align:top;">
                          <span style="display:inline-block;width:28px;height:28px;line-height:28px;text-align:center;border-radius:50%;background:#00BFFF;color:#fff;font-weight:700;font-size:14px;">3</span>
                        </td>
                        <td style="padding-left:12px;">
                          <p style="margin:0;font-size:15px;color:#E0E0E0;line-height:1.5;"><strong style="color:#ffffff;">Review detected signals</strong> — Act on the insights that matter most to your team's performance.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <p style="font-size:15px;line-height:1.6;color:#94a3b8;margin:0 0 24px 0;">
                Most users discover their first actionable insight within 10 minutes of connecting an integration.
              </p>
              <center>
                <a href="https://app.core314.com/integration-manager" style="display:inline-block;background:linear-gradient(90deg,#00BFFF,#007BFF);color:#ffffff;text-decoration:none;padding:16px 40px;border-radius:8px;font-weight:600;font-size:16px;">Connect Your First Integration</a>
              </center>
            </td>
          </tr>
          ${passwordSection}
          <!-- Spacer -->
          <tr><td style="height:24px;"></td></tr>
          <!-- What You Get -->
          <tr>
            <td style="background-color:#1A1F2E;padding:30px;border-radius:12px;border:1px solid #2A3F5F;">
              <h2 style="font-size:20px;color:#00BFFF;margin:0 0 15px 0;">What's Included in Your Trial</h2>
              <ul style="margin:0;padding-left:24px;font-size:15px;line-height:1.8;color:#E0E0E0;">
                <li>Full access to the <strong>${planDisplay}</strong> plan for 14 days</li>
                <li>AI-powered Operational Briefs</li>
                <li>Cross-system signal detection</li>
                <li>Health score monitoring</li>
                <li>PowerPoint export (Command Center & Enterprise)</li>
              </ul>
              <p style="font-size:14px;line-height:1.6;color:#94a3b8;margin:16px 0 0 0;">
                Your card will not be charged during the trial period. Cancel anytime.
              </p>
            </td>
          </tr>
          <!-- Spacer -->
          <tr><td style="height:24px;"></td></tr>
          <!-- Support -->
          <tr>
            <td style="background-color:#1A1F2E;padding:20px 30px;border-radius:12px;border:1px solid #2A3F5F;">
              <p style="font-size:14px;line-height:1.6;color:#94a3b8;margin:0;">
                <strong style="color:#E0E0E0;">Need help?</strong> Reply to this email or reach us at <a href="mailto:admin@core314.com" style="color:#00BFFF;text-decoration:none;">admin@core314.com</a>. We typically respond within a few hours.
              </p>
            </td>
          </tr>`;
}

function getWelcomeEmailText(name: string, plan: string, passwordSetupLink?: string): string {
  const planDisplay = plan === 'command_center' ? 'Command Center' : plan === 'intelligence' ? 'Intelligence' : 'Enterprise';
  
  const passwordSection = passwordSetupLink
    ? `\n\nFIRST: SET YOUR PASSWORD\nClick this link to create your password: ${passwordSetupLink}\n(This link expires in 24 hours.)\n`
    : '';

  return `Welcome to Core314!

Hi ${name},

Thank you for starting your 14-day free trial of Core314's ${planDisplay} plan. You're about to discover operational insights that most teams miss.
${passwordSection}
HERE'S HOW TO GET STARTED IN 3 STEPS:

1. CONNECT YOUR FIRST INTEGRATION
   Link Slack, HubSpot, Jira, or any of our 16 supported tools. Takes ~2 minutes.
   https://app.core314.com/integration-manager

2. GENERATE YOUR FIRST OPERATIONAL BRIEF
   Core314 analyzes your data and surfaces signals you wouldn't normally see.

3. REVIEW DETECTED SIGNALS
   Act on the insights that matter most to your team's performance.

Most users discover their first actionable insight within 10 minutes of connecting an integration.

WHAT'S INCLUDED IN YOUR TRIAL:
- Full access to the ${planDisplay} plan for 14 days
- AI-powered Operational Briefs
- Cross-system signal detection
- Health score monitoring
- PowerPoint export (Command Center & Enterprise)

Your card will not be charged during the trial period. Cancel anytime.

Need help? Reply to this email or reach us at admin@core314.com.`;
}

// =============================================================================
// MAIN HANDLER
// Accepts: { email, name, plan, password_setup_link? }
// Can be called internally by stripe-webhook or externally via HTTP.
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
    const body = await req.json();
    const { email, name, plan, password_setup_link } = body;

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const displayName = name || 'there';
    const displayPlan = plan || 'command_center';

    // Build the email
    const bodyContent = getWelcomeEmailBody(displayName, displayPlan, password_setup_link);
    const html = wrapEmailHTML({
      bodyContent,
      preheader: `Your Core314 ${displayPlan === 'command_center' ? 'Command Center' : displayPlan === 'intelligence' ? 'Intelligence' : 'Enterprise'} trial is active — here's how to get started`,
    });
    const text = appendTextFooter(getWelcomeEmailText(displayName, displayPlan, password_setup_link));

    const result = await sendEmail({
      to: email,
      subject: `Welcome to Core314 — Your trial is active!`,
      html,
      text,
    });

    if (!result.success) {
      console.error('Welcome email failed:', result.error);
      return new Response(
        JSON.stringify({ success: false, error: result.error }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log the event
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (supabaseUrl && supabaseServiceKey) {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        await supabase.from('system_health_log').insert({
          event_type: 'email_send',
          status: 'success',
          message: 'Welcome email sent',
          details: { email, plan: displayPlan },
        });
      }
    } catch (logErr) {
      console.warn('Failed to log welcome email event:', logErr);
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Welcome email sent' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('send-welcome-email error:', error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
