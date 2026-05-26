
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { verifyAndAuthorizeWithPolicy } from '../_shared/auth.ts';
import { withSentry, breadcrumb, handleSentryTest, jsonError } from "../_shared/sentry.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PolicyEngineResult {
  analyzed_users: number;
  policies_applied: number;
  avg_risk_score: number;
}

interface PolicyEngineSummary {
  success: boolean;
  timestamp: string;
  result: PolicyEngineResult | null;
  active_policies_count: number;
  restricted_users_count: number;
  error?: string;
}

serve(withSentry(async (req) => {
  const testResponse = await handleSentryTest(req);
  if (testResponse) return testResponse;

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({ error: 'Missing Supabase environment variables' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const authResult = await verifyAndAuthorizeWithPolicy(
    req,
    supabase,
    ['platform_admin'],
    'adaptive-policy-engine'
  );

  if (!authResult.ok) {
    return authResult.response;
  }

  const { context } = authResult;

  try {
    console.log(`[Adaptive Policy Engine] User ${context.userRole} (${context.userId}) triggering policy analysis...`);

    let action = 'analyze';
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        action = body.action || 'analyze';
      } catch {
      }
    }

    if (action !== 'analyze') {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Unknown action: ${action}. Supported actions: analyze`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('[Adaptive Policy Engine] Executing fusion_adaptive_policy_engine()...');
    
    const { data: engineData, error: engineError } = await supabase
      .rpc('fusion_adaptive_policy_engine');

    if (engineError) {
      console.error('[Adaptive Policy Engine] Error executing engine:', engineError);
      throw new Error(`Policy engine failed: ${engineError.message}`);
    }

    console.log('[Adaptive Policy Engine] Engine result:', engineData);

    const result: PolicyEngineResult = engineData && engineData.length > 0
      ? {
          analyzed_users: engineData[0].analyzed_users || 0,
          policies_applied: engineData[0].policies_applied || 0,
          avg_risk_score: parseFloat(engineData[0].avg_risk_score || '0'),
        }
      : {
          analyzed_users: 0,
          policies_applied: 0,
          avg_risk_score: 0,
        };

    const { count: activePoliciesCount, error: countError } = await supabase
      .from('fusion_adaptive_policies')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'Active')
      .or('expires_at.is.null,expires_at.gt.now()');

    if (countError) {
      console.error('[Adaptive Policy Engine] Error counting active policies:', countError);
    }

    const { data: restrictedPolicies, error: restrictedError } = await supabase
      .from('fusion_adaptive_policies')
      .select('action_value')
      .eq('status', 'Active')
      .in('action_type', ['restrict', 'throttle'])
      .or('expires_at.is.null,expires_at.gt.now()');

    if (restrictedError) {
      console.error('[Adaptive Policy Engine] Error counting restricted users:', restrictedError);
    }

    const restrictedUsersCount = restrictedPolicies 
      ? new Set(restrictedPolicies.map(p => p.action_value).filter(Boolean)).size 
      : 0;

    const summary: PolicyEngineSummary = {
      success: true,
      timestamp: new Date().toISOString(),
      result,
      active_policies_count: activePoliciesCount || 0,
      restricted_users_count: restrictedUsersCount,
    };

    console.log('[Adaptive Policy Engine] Summary:', summary);
    console.log(`[Adaptive Policy Engine] Analyzed ${result.analyzed_users} users, applied ${result.policies_applied} policies`);
    console.log(`[Adaptive Policy Engine] Average risk score: ${result.avg_risk_score}`);
    console.log(`[Adaptive Policy Engine] Active policies: ${activePoliciesCount}, Restricted users: ${restrictedUsersCount}`);

    return new Response(
      JSON.stringify(summary),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('[Adaptive Policy Engine] Error:', error);

    const errorSummary: PolicyEngineSummary = {
      success: false,
      timestamp: new Date().toISOString(),
      result: null,
      active_policies_count: 0,
      restricted_users_count: 0,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };

    return new Response(
      JSON.stringify(errorSummary),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
}, { name: "adaptive-policy-engine" }));