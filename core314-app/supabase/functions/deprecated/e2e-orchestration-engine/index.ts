import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';
import { withSentry, breadcrumb, handleSentryTest, jsonError } from "../_shared/sentry.ts";

interface E2EOrchestrationRequest {
  session_name?: string;
}

interface E2EOrchestrationResult {
  session_id: string;
  total_phases: number;
  success_rate: number;
  avg_confidence: number;
  avg_latency_ms: number;
}

interface E2ESession {
  id: string;
  session_name: string;
  phase_sequence: string[];
  total_steps: number;
  steps_completed: number;
  success_rate: number;
  avg_confidence: number;
  avg_latency_ms: number;
  anomalies_detected: number;
  started_at: string;
  completed_at: string | null;
}

interface E2EResult {
  id: string;
  session_id: string;
  phase_name: string;
  status: 'success' | 'warning' | 'failure';
  confidence: number;
  latency_ms: number;
  error_details: string | null;
  created_at: string;
}

/**
 * Verify user is platform admin
 */
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

/**
 * Handle POST request - Run E2E orchestration cycle
 */
async function handlePost(req: Request, supabase: any, userId: string): Promise<Response> {
  try {
    const body: E2EOrchestrationRequest = await req.json();
    const sessionName = body.session_name || `Core314 E2E Test - ${new Date().toISOString()}`;

    const { data, error } = await supabase.rpc('run_e2e_validation_cycle', {
      p_session_name: sessionName
    });

    if (error) {
      console.error('Error running E2E orchestration:', error);
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const result = data && data.length > 0 ? data[0] : null;

    if (!result) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No result returned from orchestration',
          timestamp: new Date().toISOString()
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const orchestrationResult: E2EOrchestrationResult = {
      session_id: result.session_id,
      total_phases: result.total_phases,
      success_rate: parseFloat(result.success_rate),
      avg_confidence: parseFloat(result.avg_confidence),
      avg_latency_ms: parseFloat(result.avg_latency_ms)
    };

    return new Response(
      JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        result: orchestrationResult
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (err) {
    console.error('Error in POST handler:', err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}

/**
 * Handle GET request - Retrieve E2E sessions and results
 */
async function handleGet(req: Request, supabase: any): Promise<Response> {
  try {
    const url = new URL(req.url);
    const sessionId = url.searchParams.get('session_id');
    const limit = parseInt(url.searchParams.get('limit') || '10');

    if (sessionId) {
      const { data: session, error: sessionError } = await supabase
        .from('fusion_e2e_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (sessionError) {
        return new Response(
          JSON.stringify({
            success: false,
            error: sessionError.message,
            timestamp: new Date().toISOString()
          }),
          {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      const { data: results, error: resultsError } = await supabase
        .from('fusion_e2e_results')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (resultsError) {
        return new Response(
          JSON.stringify({
            success: false,
            error: resultsError.message,
            timestamp: new Date().toISOString()
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          timestamp: new Date().toISOString(),
          session,
          results
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    } else {
      const { data: sessions, error: sessionsError } = await supabase
        .from('fusion_e2e_sessions')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(limit);

      if (sessionsError) {
        return new Response(
          JSON.stringify({
            success: false,
            error: sessionsError.message,
            timestamp: new Date().toISOString()
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      const totalSessions = sessions?.length || 0;
      const avgSuccessRate = totalSessions > 0
        ? sessions.reduce((sum, s) => sum + (s.success_rate || 0), 0) / totalSessions
        : 0;
      const avgConfidence = totalSessions > 0
        ? sessions.reduce((sum, s) => sum + (s.avg_confidence || 0), 0) / totalSessions
        : 0;
      const avgLatency = totalSessions > 0
        ? sessions.reduce((sum, s) => sum + (s.avg_latency_ms || 0), 0) / totalSessions
        : 0;

      return new Response(
        JSON.stringify({
          success: true,
          timestamp: new Date().toISOString(),
          summary: {
            total_sessions: totalSessions,
            avg_success_rate: avgSuccessRate,
            avg_confidence: avgConfidence,
            avg_latency_ms: avgLatency
          },
          sessions
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
  } catch (err) {
    console.error('Error in GET handler:', err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}

/**
 * Main handler
 */
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

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing authorization header',
          timestamp: new Date().toISOString()
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid or expired token',
          timestamp: new Date().toISOString()
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const isPlatformAdmin = await verifyPlatformAdmin(supabase, user.id);
    if (!isPlatformAdmin) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Unauthorized: Platform admin access required',
          timestamp: new Date().toISOString()
        }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (req.method === 'POST') {
      return await handlePost(req, supabase, user.id);
    } else if (req.method === 'GET') {
      return await handleGet(req, supabase);
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Method not allowed',
          timestamp: new Date().toISOString()
        }),
        {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
  } catch (err) {
    console.error('Unhandled error:', err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}, { name: "e2e-orchestration-engine" }));