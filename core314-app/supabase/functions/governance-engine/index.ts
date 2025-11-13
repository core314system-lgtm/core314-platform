import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { corsHeaders } from '../_shared/cors.ts';
import { verifyAndAuthorizeWithPolicy } from '../_shared/auth.ts';

interface GovernanceEngineResult {
  success: boolean;
  timestamp: string;
  result: {
    audits_run: number;
    anomalies_detected: number;
    average_confidence: number;
    policy_violations: number;
  } | null;
  error?: string;
}

Deno.serve(async (req) => {
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
      ['platform_admin', 'operator', 'admin', 'manager'],
      'governance-engine'
    );

    if (!authResult.ok) {
      return authResult.response;
    }

    const userRole = authResult.context.userRole || '';
    const isPlatformAdmin = authResult.context.isPlatformAdmin === true || userRole === 'platform_admin';

    if (req.method === 'POST' && !isPlatformAdmin) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Only platform administrators can trigger governance audits' 
        }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (req.method === 'POST') {
      const { data, error } = await supabase.rpc('fusion_governance_engine');

      if (error) {
        console.error('Governance engine error:', error);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: error.message 
          }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      const result = data && data.length > 0 ? data[0] : null;

      const response: GovernanceEngineResult = {
        success: true,
        timestamp: new Date().toISOString(),
        result: result ? {
          audits_run: result.audits_run || 0,
          anomalies_detected: result.anomalies_detected || 0,
          average_confidence: parseFloat(result.average_confidence || '0'),
          policy_violations: result.policy_violations || 0,
        } : null,
      };

      return new Response(
        JSON.stringify(response),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (req.method === 'GET') {
      const { data: audits, error: auditsError } = await supabase
        .from('fusion_governance_audit')
        .select('*')
        .gte('created_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false });

      if (auditsError) {
        console.error('Error fetching audits:', auditsError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: auditsError.message 
          }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      const totalAudits = audits?.length || 0;
      const anomalies = audits?.filter(a => a.outcome === 'Escalated').length || 0;
      const avgConfidence = audits && audits.length > 0
        ? audits.reduce((sum, a) => sum + (a.confidence_level || 0), 0) / audits.length
        : 0;

      const { data: violations, error: violationsError } = await supabase
        .from('fusion_adaptive_policies')
        .select('id')
        .eq('enforced', true)
        .not('expires_at', 'is', null)
        .lt('expires_at', new Date().toISOString());

      const policyViolations = violations?.length || 0;

      const response: GovernanceEngineResult = {
        success: true,
        timestamp: new Date().toISOString(),
        result: {
          audits_run: totalAudits,
          anomalies_detected: anomalies,
          average_confidence: parseFloat(avgConfidence.toFixed(4)),
          policy_violations: policyViolations,
        },
      };

      return new Response(
        JSON.stringify(response),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Method not allowed' 
      }),
      { 
        status: 405, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
