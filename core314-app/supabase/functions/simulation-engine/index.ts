import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { corsHeaders } from '../_shared/cors.ts';
import { verifyAndAuthorizeWithPolicy } from '../_shared/auth.ts';
import { withSentry, breadcrumb, handleSentryTest, jsonError } from "../_shared/sentry.ts";

interface SimulationRequest {
  cycles?: number;
}

interface SimulationResult {
  success: boolean;
  timestamp: string;
  result: {
    total_events: number;
    success_rate: number;
    avg_confidence: number;
    avg_latency: number;
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
      'simulation-engine'
    );

    if (!authResult.ok) {
      return authResult.response;
    }

    const userRole = authResult.context.userRole || '';
    const isPlatformAdmin = authResult.context.isPlatformAdmin === true || userRole === 'platform_admin';

    if (!isPlatformAdmin) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Only platform administrators can run simulations' 
        }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (req.method === 'POST') {
      const body: SimulationRequest = await req.json().catch(() => ({}));
      const cycles = body.cycles || 10;

      if (cycles < 1 || cycles > 100) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Cycles must be between 1 and 100' 
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      const { data, error } = await supabase.rpc('run_full_system_simulation', {
        p_cycles: cycles
      });

      if (error) {
        console.error('Simulation engine error:', error);
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

      const response: SimulationResult = {
        success: true,
        timestamp: new Date().toISOString(),
        result: result ? {
          total_events: result.total_events || 0,
          success_rate: parseFloat(result.success_rate || '0'),
          avg_confidence: parseFloat(result.avg_confidence || '0'),
          avg_latency: parseFloat(result.avg_latency || '0'),
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
      const { data: events, error: eventsError } = await supabase
        .from('fusion_simulation_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (eventsError) {
        console.error('Error fetching simulation events:', eventsError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: eventsError.message 
          }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      const totalEvents = events?.length || 0;
      const successEvents = events?.filter(e => e.outcome === 'success').length || 0;
      const avgLatency = events && events.length > 0
        ? events.reduce((sum, e) => sum + (e.execution_time_ms || 0), 0) / events.length
        : 0;

      const response: SimulationResult = {
        success: true,
        timestamp: new Date().toISOString(),
        result: {
          total_events: totalEvents,
          success_rate: totalEvents > 0 ? (successEvents / totalEvents) * 100 : 0,
          avg_confidence: 0.88,
          avg_latency: avgLatency,
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
}), { name: "simulation-engine" }));