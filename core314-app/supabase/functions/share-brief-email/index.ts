import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { sendEmail, wrapEmailHTML, appendTextFooter } from '../_shared/email-utils.ts';

// =============================================================================
// SHARE BRIEF VIA EMAIL
// Sends the operational brief summary to a specified recipient via SendGrid.
// Authenticated endpoint — only the brief owner can share.
// =============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Not authenticated' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body = await req.json();
    const { recipientEmail, recipientName, briefTitle, healthScore, confidence, signals, businessImpact, recommendedActions, riskAssessment, message } = body;

    if (!recipientEmail || !briefTitle) {
      return new Response(
        JSON.stringify({ error: 'recipientEmail and briefTitle are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email address' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get sender's profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();

    const senderName = profile?.full_name || user.email || 'A Core314 user';

    // Build signal list HTML
    const signalListHTML = signals && signals.length > 0
      ? signals.map((s: string) => `<li style="margin-bottom:6px;color:#cbd5e1;">${s}</li>`).join('')
      : '<li style="color:#64748b;">No signals detected</li>';

    // Build recommended actions HTML
    const actionsHTML = recommendedActions && recommendedActions.length > 0
      ? recommendedActions.map((a: string, i: number) => `<li style="margin-bottom:6px;color:#cbd5e1;">${i + 1}. ${a}</li>`).join('')
      : '';

    // Build the email body
    const bodyContent = `
          <tr>
            <td style="background-color:#1e293b;border-radius:12px;padding:32px;">
              <h1 style="margin:0 0 8px 0;font-size:22px;color:#ffffff;">Operational Brief Shared With You</h1>
              <p style="margin:0 0 24px 0;font-size:14px;color:#94a3b8;">
                ${senderName} shared an operational brief with you${message ? ': "' + message + '"' : '.'}
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;border-radius:8px;padding:20px;margin-bottom:20px;">
                <tr>
                  <td>
                    <h2 style="margin:0 0 12px 0;font-size:18px;color:#38bdf8;">${briefTitle}</h2>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:4px 0;">
                          <span style="color:#94a3b8;font-size:13px;">Health Score:</span>
                          <span style="color:#ffffff;font-size:14px;font-weight:600;margin-left:8px;">${healthScore ?? 'N/A'} / 100</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;">
                          <span style="color:#94a3b8;font-size:13px;">Confidence:</span>
                          <span style="color:#ffffff;font-size:14px;font-weight:600;margin-left:8px;">${confidence ?? 'N/A'}%</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <h3 style="margin:16px 0 8px 0;font-size:15px;color:#38bdf8;">Detected Signals</h3>
              <ul style="margin:0 0 16px 0;padding-left:20px;font-size:14px;">
                ${signalListHTML}
              </ul>

              ${businessImpact ? `
              <h3 style="margin:16px 0 8px 0;font-size:15px;color:#38bdf8;">Business Impact</h3>
              <p style="margin:0 0 16px 0;font-size:14px;color:#cbd5e1;">${businessImpact}</p>
              ` : ''}

              ${actionsHTML ? `
              <h3 style="margin:16px 0 8px 0;font-size:15px;color:#38bdf8;">Recommended Actions</h3>
              <ul style="margin:0 0 16px 0;padding-left:20px;font-size:14px;">
                ${actionsHTML}
              </ul>
              ` : ''}

              ${riskAssessment ? `
              <h3 style="margin:16px 0 8px 0;font-size:15px;color:#38bdf8;">Risk Assessment</h3>
              <p style="margin:0 0 16px 0;font-size:14px;color:#cbd5e1;">${riskAssessment}</p>
              ` : ''}

              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;">
                <tr>
                  <td align="center">
                    <a href="https://app.core314.com/brief"
                       style="display:inline-block;background-color:#0ea5e9;color:#ffffff;font-size:14px;font-weight:600;padding:12px 28px;border-radius:8px;text-decoration:none;">
                      View Full Brief in Core314
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;

    const html = wrapEmailHTML({ bodyContent, preheader: `${senderName} shared an operational brief: ${briefTitle}` });

    // Plain text version
    const signalListText = signals && signals.length > 0
      ? signals.map((s: string) => `  - ${s}`).join('\n')
      : '  No signals detected';

    const actionsText = recommendedActions && recommendedActions.length > 0
      ? recommendedActions.map((a: string, i: number) => `  ${i + 1}. ${a}`).join('\n')
      : '';

    let plainText = `${senderName} shared an operational brief with you${message ? ': "' + message + '"' : '.'}\n\n`;
    plainText += `${briefTitle}\n`;
    plainText += `Health Score: ${healthScore ?? 'N/A'} / 100 | Confidence: ${confidence ?? 'N/A'}%\n\n`;
    plainText += `Key Signals:\n${signalListText}\n\n`;
    if (businessImpact) plainText += `Business Impact:\n${businessImpact}\n\n`;
    if (actionsText) plainText += `Recommended Actions:\n${actionsText}\n\n`;
    if (riskAssessment) plainText += `Risk Assessment:\n${riskAssessment}\n\n`;
    plainText += `View the full brief: https://app.core314.com/brief\n`;

    const text = appendTextFooter(plainText);

    // Send the email
    const result = await sendEmail({
      to: recipientEmail,
      subject: `${senderName} shared a Core314 Brief: ${briefTitle}`,
      html,
      text,
      replyTo: user.email || undefined,
    });

    if (!result.success) {
      return new Response(
        JSON.stringify({ error: result.error || 'Failed to send email' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: `Brief shared with ${recipientEmail}` }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[share-brief-email] Error:', msg);
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred', details: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
