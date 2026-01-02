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
    const { organization_id, email, role } = await req.json();
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

    const appUrl = Deno.env.get('APP_URL') || 'https://polite-mochi-fc5be5.netlify.app';
    const inviteLink = `${appUrl}/invite?token=${token}`;

    // Send invite email (fire and forget - don't fail if email fails)
    try {
      const emailUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-transactional-email`;
      await fetch(emailUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({
          type: 'organization_invite',
          to: email,
          name: email.split('@')[0], // Use email prefix as name if we don't know their name
          data: {
            organization: org?.name || 'your organization',
            inviter_name: inviterProfile?.full_name || inviterProfile?.email || 'A team member',
            role: role || 'member',
            invite_link: inviteLink,
          },
        }),
      });
    } catch (emailError) {
      console.error('Failed to send invite email:', emailError);
      // Don't fail the request - invitation was created successfully
    }

    return new Response(JSON.stringify({ 
      success: true, 
      invitation,
      invite_link: inviteLink
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
