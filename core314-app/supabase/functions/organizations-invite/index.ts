import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { withSentry, breadcrumb, handleSentryTest, jsonError } from "../_shared/sentry.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function generateInviteToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

serve(withSentry(async (req) => {
  const testResponse = await handleSentryTest(req);
  if (testResponse) return testResponse;

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { organization_id, email, role, first_name, last_name, invitee_name } = await req.json();
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: member } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', organization_id)
      .eq('user_id', user.id)
      .single();

    if (!member || !['owner', 'admin'].includes(member.role)) {
      return new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check plan limits before creating invitation
    const { data: limitCheck, error: limitError } = await supabase
      .rpc('check_organization_user_limit', { p_organization_id: organization_id });
    
    if (limitError) {
      console.error('Error checking user limit:', limitError);
      // Continue if function doesn't exist yet (migration not applied)
    } else if (limitCheck && limitCheck.length > 0) {
      const limit = limitCheck[0];
      if (!limit.can_add_member) {
        return new Response(JSON.stringify({ 
          error: limit.message,
          current_count: limit.current_count,
          user_limit: limit.user_limit,
          plan_name: limit.plan_name,
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const token = generateInviteToken();

    const { data: invitation, error: inviteError } = await supabase
      .from('organization_invitations')
      .insert({
        organization_id,
        email,
        role: role || 'member',
        token,
        invited_by: user.id,
        first_name: first_name || null,
        last_name: last_name || null,
      })
      .select()
      .single();

    if (inviteError) throw inviteError;

    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'organization_invite_sent',
      resource_type: 'organization',
      resource_id: organization_id,
      details: { invited_email: email, role },
    });

    // Get organization name and inviter profile for the email
    const { data: org } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', organization_id)
      .single();

    const { data: inviterProfile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .single();

    const appUrl = Deno.env.get('APP_URL') || 'https://app.core314.com';
    const inviteLink = `${appUrl}/invite?token=${token}`;

    // Send invite email via SendGrid
    const sendgridApiKey = Deno.env.get('SENDGRID_API_KEY');
    const senderEmail = Deno.env.get('SENDGRID_SENDER_EMAIL') || 'support@core314.com';
    const senderName = Deno.env.get('SENDGRID_SENDER_NAME') || 'Core314';
    let emailSent = false;
    let emailError: string | null = null;

    if (!sendgridApiKey) {
      console.error('SENDGRID_API_KEY not set — cannot send invitation email');
      emailError = 'Email service not configured. Please contact support.';
    } else {
      const inviterName = inviterProfile?.full_name || inviterProfile?.email || 'A team member';
      const orgName = org?.name || 'your organization';
      const inviteeName = first_name
        ? (last_name ? `${first_name} ${last_name}` : first_name)
        : (invitee_name || email.split('@')[0]);

      const emailHtml = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background-color:#f4f4f4;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f4f4f4;padding:20px;">
    <tr><td align="center">
      <table cellpadding="0" cellspacing="0" border="0" width="600" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 4px rgba(0,0,0,0.1);">
        <tr><td style="padding:40px 40px 30px 40px;">
          <h2 style="margin:0 0 20px 0;color:#0ea5e9;font-size:28px;font-weight:bold;">You're Invited to Join Core314</h2>
          <p style="margin:0 0 15px 0;color:#222;font-size:16px;line-height:1.6;">Hi ${inviteeName},</p>
          <p style="margin:0 0 15px 0;color:#222;font-size:16px;line-height:1.6;"><strong>${inviterName}</strong> has invited you to join <strong>${orgName}</strong> on Core314.</p>
          <p style="margin:0 0 25px 0;color:#222;font-size:16px;line-height:1.6;">Click the button below to accept the invitation and get started.</p>
          <table cellpadding="0" cellspacing="0" border="0">
            <tr><td style="background-color:#0ea5e9;border-radius:6px;text-align:center;">
              <a href="${inviteLink}" style="display:inline-block;padding:14px 32px;color:#ffffff;text-decoration:none;font-size:16px;font-weight:bold;">Accept Invitation</a>
            </td></tr>
          </table>
          <p style="margin:20px 0 0 0;color:#999;font-size:12px;">This invitation expires in 7 days. If you didn't expect this email, you can safely ignore it.</p>
        </td></tr>
        <tr><td style="padding:20px 40px 40px 40px;border-top:1px solid #e0e0e0;">
          <p style="margin:0;color:#777;font-size:12px;line-height:1.4;">Core314 Operational Intelligence<br>© ${new Date().getFullYear()} Core314. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

      const emailSubject = `${inviterName} invited you to join ${orgName} on Core314`;

      try {
        const sendgridResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${sendgridApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email }] }],
            from: { email: senderEmail, name: senderName },
            subject: emailSubject,
            content: [
              { type: 'text/plain', value: `${inviterName} has invited you to join ${orgName} on Core314. Accept your invitation: ${inviteLink}` },
              { type: 'text/html', value: emailHtml },
            ],
          }),
        });

        if (!sendgridResponse.ok) {
          const errBody = await sendgridResponse.text();
          console.error('SendGrid API error:', sendgridResponse.status, errBody);
          emailError = `Email delivery failed (${sendgridResponse.status}): ${errBody}`;
        } else {
          emailSent = true;
          breadcrumb('invite_email_sent', { email, org: orgName });
          console.log('Invite email sent successfully via SendGrid:', { email });
        }
      } catch (sendError) {
        console.error('Failed to send invite email via SendGrid:', sendError);
        emailError = `Email send failed: ${sendError instanceof Error ? sendError.message : String(sendError)}`;
      }
    }

    // If email failed, return error so the frontend shows the actual problem
    if (!emailSent) {
      // Log to audit that email failed
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'organization_invite_email_failed',
        resource_type: 'organization',
        resource_id: organization_id,
        details: { invited_email: email, error: emailError },
      }).then(() => {}).catch(() => {});

      return new Response(JSON.stringify({
        error: `Invitation created but email delivery failed: ${emailError}`,
        invitation,
        invite_link: inviteLink,
        email_sent: false,
      }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      invitation,
      invite_link: inviteLink,
      email_sent: true,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}, { name: "organizations-invite" }));
