import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// =============================================================================
// GDPR DATA EXPORT
// Allows authenticated users to request a full export of their personal data.
// Returns a JSON file containing all user data stored in the system.
// Complies with GDPR Article 20 (Right to Data Portability).
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

    const userId = user.id;
    const exportData: Record<string, unknown> = {
      export_metadata: {
        exported_at: new Date().toISOString(),
        user_id: userId,
        user_email: user.email,
        format: 'JSON',
        gdpr_article: 'Article 20 - Right to Data Portability',
      },
    };

    // 1. Profile data
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    exportData.profile = profile || null;

    // 2. Organization memberships
    const { data: orgMembers } = await supabase
      .from('organization_members')
      .select('organization_id, role, joined_at')
      .eq('user_id', userId);

    exportData.organization_memberships = orgMembers || [];

    // 3. Integrations
    const { data: integrations } = await supabase
      .from('user_integrations')
      .select('provider, status, created_at, last_synced_at, connection_metadata')
      .eq('user_id', userId);

    exportData.integrations = integrations || [];

    // 4. Subscriptions
    const { data: subscriptions } = await supabase
      .from('subscriptions')
      .select('stripe_subscription_id, status, plan_id, current_period_start, current_period_end, created_at')
      .eq('user_id', userId);

    exportData.subscriptions = subscriptions || [];

    // 5. Activation state
    const { data: activationState } = await supabase
      .from('user_activation_state')
      .select('*')
      .eq('user_id', userId)
      .single();

    exportData.activation_state = activationState || null;

    // 6. Beta lifecycle (if applicable)
    const { data: betaLifecycle } = await supabase
      .from('beta_tester_lifecycle')
      .select('lifecycle_status, first_login_at, total_logins, day_45_completed_at, created_at')
      .eq('user_id', userId)
      .maybeSingle();

    exportData.beta_lifecycle = betaLifecycle || null;

    // 7. Beta applications (by email)
    if (user.email) {
      const { data: betaApps } = await supabase
        .from('beta_applications')
        .select('full_name, email, company, role, team_size, status, created_at, reviewed_at')
        .eq('email', user.email);

      exportData.beta_applications = betaApps || [];
    }

    // 8. Operational signals (user's org signals)
    if (orgMembers && orgMembers.length > 0) {
      const orgIds = orgMembers.map(m => m.organization_id);
      const { data: signals } = await supabase
        .from('operational_signals')
        .select('signal_type, severity, source_integration, title, detected_at, status')
        .in('organization_id', orgIds)
        .order('detected_at', { ascending: false })
        .limit(500);

      exportData.operational_signals = signals || [];
    }

    // 9. Email communications sent to this user
    if (user.email) {
      const { data: emails } = await supabase
        .from('admin_messaging_log')
        .select('template_name, message_type, send_status, created_at')
        .eq('recipient_email', user.email)
        .order('created_at', { ascending: false });

      exportData.email_communications = emails || [];
    }

    // 10. Team invites sent by this user
    const { data: invites } = await supabase
      .from('team_invites')
      .select('email, role, status, created_at, accepted_at')
      .eq('invited_by', userId);

    exportData.team_invites_sent = invites || [];

    // Log the export request
    await supabase.from('admin_messaging_log').insert({
      admin_user_id: '00000000-0000-0000-0000-000000000000',
      recipient_email: user.email || 'unknown',
      recipient_name: profile?.full_name || 'Unknown',
      template_name: 'gdpr_data_export',
      message_type: 'compliance',
      send_status: 'sent',
      context: { user_id: userId, tables_exported: Object.keys(exportData).length },
    });

    return new Response(
      JSON.stringify(exportData, null, 2),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="core314-data-export-${userId}.json"`,
        },
      }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('GDPR export error:', msg);
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred', details: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
