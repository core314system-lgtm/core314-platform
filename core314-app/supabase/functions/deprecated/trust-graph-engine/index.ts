import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { corsHeaders } from '../_shared/cors.ts';
import { verifyAndAuthorizeWithPolicy } from '../_shared/auth.ts';
import { withSentry, breadcrumb, handleSentryTest, jsonError } from "../_shared/sentry.ts";

interface TrustEngineResult {
  success: boolean;
  timestamp: string;
  result: {
    avg_trust_score: number;
    users_updated: number;
    high_risk_users: number;
    low_risk_users: number;
  } | null;
  error?: string;
}

Deno.serve(withSentry(async (req) => {
  const testResponse = await handleSentryTest(req);
  if (testResponse) return testResponse;

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authResult = await verifyAndAuthorizeWithPolicy(
      req,
      supabase,
      ['platform_admin'],
      'trust-graph-engine'
    );

    if (!authResult.ok) {
      return authResult.response;
    }

    const { context } = authResult;

    console.log(`[trust-graph-engine] Triggered by ${context.userRole} (${context.userId})`);

    const { data, error } = await supabase.rpc('fusion_trust_scoring_engine');

    if (error) {
      console.error('[trust-graph-engine] Error executing trust scoring engine:', error);
      
      const result: TrustEngineResult = {
        success: false,
        timestamp: new Date().toISOString(),
        result: null,
        error: error.message,
      };

      return new Response(
        JSON.stringify(result),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const engineResult = data && data.length > 0 ? data[0] : null;

    if (!engineResult) {
      console.error('[trust-graph-engine] No data returned from trust scoring engine');
      
      const result: TrustEngineResult = {
        success: false,
        timestamp: new Date().toISOString(),
        result: null,
        error: 'No data returned from trust scoring engine',
      };

      return new Response(
        JSON.stringify(result),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`[trust-graph-engine] Trust scoring complete:`, {
      avg_trust_score: engineResult.avg_trust_score,
      users_updated: engineResult.users_updated,
      high_risk_users: engineResult.high_risk_users,
      low_risk_users: engineResult.low_risk_users,
    });

    const result: TrustEngineResult = {
      success: true,
      timestamp: new Date().toISOString(),
      result: {
        avg_trust_score: parseFloat(engineResult.avg_trust_score),
        users_updated: engineResult.users_updated,
        high_risk_users: engineResult.high_risk_users,
        low_risk_users: engineResult.low_risk_users,
      },
    };

    return new Response(
      JSON.stringify(result),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[trust-graph-engine] Unexpected error:', error);
    
    const result: TrustEngineResult = {
      success: false,
      timestamp: new Date().toISOString(),
      result: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };

    return new Response(
      JSON.stringify(result),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}, { name: "trust-graph-engine" }));