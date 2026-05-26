import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { withSentry, handleSentryTest } from "../_shared/sentry.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(withSentry(async (req) => {
  const testResponse = await handleSentryTest(req);
  if (testResponse) return testResponse;

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { organization_id, user_id: target_user_id } = await req.json();
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!organization_id || !target_user_id) {
      return new Response(JSON.stringify({ error: 'Missing organization_id or user_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create client with user's auth to get their info
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

    // Use service role client for privileged operations
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Call the SQL function to remove the member
    const { data, error } = await supabase.rpc('remove_organization_member', {
      p_caller_id: user.id,
      p_target_user_id: target_user_id,
      p_organization_id: organization_id,
    });

    if (error) throw error;

    const result = data?.[0];
    if (!result) {
      return new Response(JSON.stringify({ error: 'Failed to process removal' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!result.success) {
      return new Response(JSON.stringify({ error: result.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Invalidate the removed user's sessions using auth admin API
    // This ensures they can't access any data even with existing tokens
    try {
      const { error: signOutError } = await supabase.auth.admin.signOut(target_user_id, 'global');
      if (signOutError) {
        console.error('Failed to sign out user:', signOutError);
        // Don't fail the request, membership is already removed
      }
    } catch (signOutErr) {
      console.error('Error signing out user:', signOutErr);
      // Don't fail the request, membership is already removed
    }

    // Log the event
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'organization_member_removed',
      resource_type: 'organization',
      resource_id: organization_id,
      details: { removed_user_id: target_user_id },
    });

    return new Response(JSON.stringify({ 
      success: true, 
      message: result.message,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error removing member:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}, { name: "organizations-remove-member" }));
