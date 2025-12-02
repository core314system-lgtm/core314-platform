import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';
import { withSentry, breadcrumb, handleSentryTest } from "../_shared/sentry.ts";

interface BetaReadinessResult {
  total_subsystems: number;
  operational_count: number;
  degraded_count: number;
  failed_count: number;
  avg_confidence: number;
  avg_latency: number;
  readiness_score: number;
}

interface BetaAuditRecord {
  id: string;
  component_name: string;
  status: 'operational' | 'degraded' | 'failed';
  confidence: number;
  latency_ms: number;
  last_verified: string;
  remarks: string;
}

interface ReadinessSummary {
  id: string;
  total_subsystems: number;
  operational_count: number;
  degraded_count: number;
  failed_count: number;
  avg_confidence: number;
  avg_latency: number;
  readiness_score: number;
  created_at: string;
}

async function verifyPlatformAdmin(supabase: any, userId: string): Promise<boolean> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('is_platform_admin, role')
    .eq('id', userId)
    .single();

  if (error || !profile) {
    return false;
  }

  return profile.is_platform_admin === true || profile.role === 'platform_admin';
}

Deno.serve(withSentry(async (req) => {
  const testResponse = await handleSentryTest(req);
  if (testResponse) return testResponse;

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const token = authHeader.replace('Bearer ', '');
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isAdmin = await verifyPlatformAdmin(supabase, user.id);
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized - platform admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (req.method === 'POST') {
      const { data: auditResult, error: auditError } = await supabase
        .rpc('run_beta_readiness_audit');

      if (auditError) {
        console.error('Audit execution error:', auditError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Failed to run audit: ${auditError.message}` 
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const result: BetaReadinessResult = auditResult && auditResult.length > 0 
        ? auditResult[0] 
        : {
            total_subsystems: 0,
            operational_count: 0,
            degraded_count: 0,
            failed_count: 0,
            avg_confidence: 0,
            avg_latency: 0,
            readiness_score: 0
          };

      return new Response(
        JSON.stringify({ 
          success: true, 
          result: result
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (req.method === 'GET') {
      const url = new URL(req.url);
      const summaryId = url.searchParams.get('summary_id');
      const limit = parseInt(url.searchParams.get('limit') || '10');

      if (summaryId) {
        const { data: summary, error: summaryError } = await supabase
          .from('fusion_readiness_summary')
          .select('*')
          .eq('id', summaryId)
          .single();

        if (summaryError) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: `Failed to fetch summary: ${summaryError.message}` 
            }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: auditRecords, error: auditError } = await supabase
          .from('fusion_beta_audit')
          .select('*')
          .order('last_verified', { ascending: false })
          .limit(100);

        return new Response(
          JSON.stringify({ 
            success: true, 
            summary: summary,
            audit_records: auditRecords || []
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: summaries, error: summariesError } = await supabase
        .from('fusion_readiness_summary')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (summariesError) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Failed to fetch summaries: ${summariesError.message}` 
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: auditRecords, error: auditError } = await supabase
        .from('fusion_beta_audit')
        .select('*')
        .order('confidence', { ascending: false });

      return new Response(
        JSON.stringify({ 
          success: true, 
          summaries: summaries || [],
          current_audit: auditRecords || []
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}), { name: "beta-readiness-engine" }));