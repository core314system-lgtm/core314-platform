import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';

interface E2ECampaignRequest {
  test_mode?: 'functional' | 'performance' | 'resilience';
  cycles?: number;
}

interface E2ECampaignResult {
  session_id: string;
  total_iterations: number;
  avg_confidence: number;
  avg_latency: number;
  avg_stability: number;
  errors_detected: number;
}

interface E2EBenchmark {
  id: string;
  session_id: string;
  phase_name: string;
  iteration: number;
  confidence: number;
  latency_ms: number;
  stability: number;
  error_flag: boolean;
  created_at: string;
}

interface E2EAnomaly {
  id: string;
  session_id: string;
  iteration: number;
  anomaly_type: string;
  impact: string;
  confidence_level: number;
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
 * Handle POST request - Run E2E campaign
 */
async function handlePost(req: Request, supabase: any, userId: string): Promise<Response> {
  try {
    const body: E2ECampaignRequest = await req.json();
    const testMode = body.test_mode || 'functional';
    const cycles = body.cycles || 10;

    if (!['functional', 'performance', 'resilience'].includes(testMode)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid test_mode. Must be: functional, performance, or resilience',
          timestamp: new Date().toISOString()
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (cycles < 1 || cycles > 100) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid cycles. Must be between 1 and 100',
          timestamp: new Date().toISOString()
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const { data, error } = await supabase.rpc('run_structured_e2e_campaign', {
      p_test_mode: testMode,
      p_cycles: cycles
    });

    if (error) {
      console.error('Error running E2E campaign:', error);
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
          error: 'No result returned from campaign',
          timestamp: new Date().toISOString()
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const campaignResult: E2ECampaignResult = {
      session_id: result.session_id,
      total_iterations: result.total_iterations,
      avg_confidence: parseFloat(result.avg_confidence),
      avg_latency: parseFloat(result.avg_latency),
      avg_stability: parseFloat(result.avg_stability),
      errors_detected: result.errors_detected
    };

    return new Response(
      JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        result: campaignResult
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
 * Handle GET request - Retrieve campaign sessions and benchmarks
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

      const { data: benchmarks, error: benchmarksError } = await supabase
        .from('fusion_e2e_benchmarks')
        .select('*')
        .eq('session_id', sessionId)
        .order('iteration', { ascending: true })
        .order('created_at', { ascending: true });

      if (benchmarksError) {
        return new Response(
          JSON.stringify({
            success: false,
            error: benchmarksError.message,
            timestamp: new Date().toISOString()
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      const { data: anomalies, error: anomaliesError } = await supabase
        .from('fusion_e2e_anomalies')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (anomaliesError) {
        return new Response(
          JSON.stringify({
            success: false,
            error: anomaliesError.message,
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
          benchmarks,
          anomalies
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
        .not('test_mode', 'is', null)
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
      const avgConfidence = totalSessions > 0
        ? sessions.reduce((sum, s) => sum + (s.avg_confidence || 0), 0) / totalSessions
        : 0;
      const avgLatency = totalSessions > 0
        ? sessions.reduce((sum, s) => sum + (s.avg_latency_ms || 0), 0) / totalSessions
        : 0;
      const avgStability = totalSessions > 0
        ? sessions.reduce((sum, s) => sum + (s.avg_stability || 0), 0) / totalSessions
        : 0;
      const totalErrors = totalSessions > 0
        ? sessions.reduce((sum, s) => sum + (s.errors_detected || 0), 0)
        : 0;

      return new Response(
        JSON.stringify({
          success: true,
          timestamp: new Date().toISOString(),
          summary: {
            total_sessions: totalSessions,
            avg_confidence: avgConfidence,
            avg_latency_ms: avgLatency,
            avg_stability: avgStability,
            total_errors: totalErrors
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
Deno.serve(async (req) => {
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
});
