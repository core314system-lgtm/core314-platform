import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { corsHeaders } from '../_shared/cors.ts';
import { verifyAndAuthorizeWithPolicy } from '../_shared/auth.ts';
import { withSentry, breadcrumb, handleSentryTest } from "../_shared/sentry.ts";

interface ExplainabilityRequest {
  event_id: string;
  subsystem: string;
  metrics?: Record<string, unknown>;
}

interface ExplainabilityResult {
  success: boolean;
  timestamp: string;
  explanation?: {
    event_id: string;
    subsystem: string;
    explanation: string;
    confidence: number;
    context: Record<string, unknown>;
  };
  summary?: {
    total_explanations: number;
    average_confidence: number;
    high_risk_count: number;
  };
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
      ['platform_admin', 'operator', 'admin', 'manager'],
      'explainability-engine'
    );

    if (!authResult.ok) {
      return authResult.response;
    }

    const userRole = authResult.context.userRole || '';
    const isPlatformAdmin = authResult.context.isPlatformAdmin === true || userRole === 'platform_admin';

    if (req.method === 'POST') {
      if (!isPlatformAdmin) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Only platform administrators can generate explanations' 
          }),
          { 
            status: 403, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      const body: ExplainabilityRequest = await req.json();
      
      if (!body.event_id || !body.subsystem) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'event_id and subsystem are required' 
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      const metrics = body.metrics || {};
      
      const { data, error } = await supabase.rpc('generate_explanation', {
        p_event_id: body.event_id,
        p_subsystem: body.subsystem,
        p_metrics: metrics
      });

      if (error) {
        console.error('Explainability engine error:', error);
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

      const response: ExplainabilityResult = {
        success: true,
        timestamp: new Date().toISOString(),
        explanation: data ? {
          event_id: data.event_id,
          subsystem: data.subsystem,
          explanation: data.explanation,
          confidence: data.confidence,
          context: data.context
        } : undefined,
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
      const { data: explanations, error: explanationsError } = await supabase
        .from('fusion_explainability_log')
        .select('*')
        .gte('created_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false });

      if (explanationsError) {
        console.error('Error fetching explanations:', explanationsError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: explanationsError.message 
          }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      const totalExplanations = explanations?.length || 0;
      const avgConfidence = explanations && explanations.length > 0
        ? explanations.reduce((sum, e) => sum + (e.confidence || 0), 0) / explanations.length
        : 0;
      const highRiskCount = explanations?.filter(e => 
        e.reasoning_vector?.risk_level === 'critical' || e.reasoning_vector?.risk_level === 'high'
      ).length || 0;

      const response: ExplainabilityResult = {
        success: true,
        timestamp: new Date().toISOString(),
        summary: {
          total_explanations: totalExplanations,
          average_confidence: parseFloat(avgConfidence.toFixed(4)),
          high_risk_count: highRiskCount,
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
}), { name: "explainability-engine" }));