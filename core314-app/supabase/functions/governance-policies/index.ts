import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { withSentry, breadcrumb, handleSentryTest, jsonError } from "../_shared/sentry.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

serve(withSentry(async (req) => {
  const testResponse = await handleSentryTest(req);
  if (testResponse) return testResponse;

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const policyId = pathParts[pathParts.length - 1];

    if (req.method === 'GET') {
      const { data: policies, error } = await supabase
        .from('fusion_governance_policies')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, policies }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (req.method === 'POST') {
      const { policy_name, description, policy_type, condition, action } = await req.json();

      const { data: policy, error } = await supabase
        .from('fusion_governance_policies')
        .insert({
          policy_name,
          description,
          policy_type,
          condition,
          action,
          active: true,
        })
        .select()
        .single();

      if (error) throw error;

      await supabase.from('fusion_audit_log').insert({
        organization_id: null,
        user_id: user.id,
        event_type: 'governance_policy_created',
        event_data: { policy_id: policy.id, policy_name },
      });

      return new Response(JSON.stringify({ success: true, policy }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (req.method === 'PUT' && policyId) {
      const updates = await req.json();

      const { data: policy, error } = await supabase
        .from('fusion_governance_policies')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', policyId)
        .select()
        .single();

      if (error) throw error;

      await supabase.from('fusion_audit_log').insert({
        organization_id: null,
        user_id: user.id,
        event_type: 'governance_policy_updated',
        event_data: { policy_id: policyId, updates },
      });

      return new Response(JSON.stringify({ success: true, policy }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (req.method === 'DELETE' && policyId) {
      const { error } = await supabase
        .from('fusion_governance_policies')
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq('id', policyId);

      if (error) throw error;

      await supabase.from('fusion_audit_log').insert({
        organization_id: null,
        user_id: user.id,
        event_type: 'governance_policy_deleted',
        event_data: { policy_id: policyId },
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Governance policies error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}), { name: "governance-policies" }));