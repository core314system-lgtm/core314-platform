import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { verifyAndAuthorize } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OrchestratorResult {
  tasks_created: number;
  tasks_completed: number;
  avg_priority: number;
  system_health: string;
}

interface OrchestratorEvent {
  id: string;
  trigger_source: string;
  action_taken: string;
  priority_level: number;
  system_state: Record<string, any> | null;
  policy_profile: string;
  status: string;
  execution_time_ms: number | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

interface OrchestratorSummary {
  success: boolean;
  timestamp: string;
  result: OrchestratorResult | null;
  active_tasks: OrchestratorEvent[];
  recent_events: OrchestratorEvent[];
  system_status: {
    total_subsystems: number;
    active_subsystems: number;
    pending_tasks: number;
    system_health: string;
  };
  error?: string;
}

serve(async (req) => {
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

  const authResult = await verifyAndAuthorize(
    req,
    supabase,
    ['platform_admin'],
    'fusion-orchestrator-engine'
  );

  if (!authResult.ok) {
    return authResult.response;
  }

  const { context } = authResult;

  try {
    console.log(`[Core Intelligence Orchestrator] User ${context.userRole} (${context.userId}) starting orchestration...`);

    const url = new URL(req.url);
    const policyProfile = url.searchParams.get('policy') || 'Standard';
    const maxPriority = parseInt(url.searchParams.get('priority') || '4', 10);

    const validPolicies = ['Conservative', 'Standard', 'Aggressive'];
    if (!validPolicies.includes(policyProfile)) {
      throw new Error(`Invalid policy profile. Must be one of: ${validPolicies.join(', ')}`);
    }

    if (maxPriority < 1 || maxPriority > 4) {
      throw new Error('Invalid priority level. Must be between 1 and 4');
    }

    console.log(`Executing fusion_orchestrator_engine(policy=${policyProfile}, priority=${maxPriority})...`);

    const { data: orchestratorData, error: orchestratorError } = await supabase
      .rpc('fusion_orchestrator_engine', {
        p_policy_profile: policyProfile,
        p_max_priority: maxPriority,
      });

    if (orchestratorError) {
      console.error('Error executing orchestrator engine:', orchestratorError);
      
      await supabase.from('fusion_audit_log').insert({
        action_type: 'Orchestration Error',
        decision_summary: `Orchestrator engine failed: ${orchestratorError.message}`,
        confidence_level: 0,
        system_context: {
          error: orchestratorError.message,
          policy_profile: policyProfile,
          max_priority: maxPriority,
          timestamp: new Date().toISOString(),
        },
        decision_impact: 'HIGH',
        anomaly_detected: true,
        triggered_by: 'fusion-orchestrator-engine',
      });

      throw orchestratorError;
    }

    console.log('Orchestrator engine result:', orchestratorData);

    const result: OrchestratorResult = orchestratorData && orchestratorData.length > 0
      ? {
          tasks_created: orchestratorData[0].tasks_created || 0,
          tasks_completed: orchestratorData[0].tasks_completed || 0,
          avg_priority: orchestratorData[0].avg_priority || 0,
          system_health: orchestratorData[0].system_health || 'Unknown',
        }
      : {
          tasks_created: 0,
          tasks_completed: 0,
          avg_priority: 0,
          system_health: 'Unknown',
        };

    const { data: activeTasks, error: activeTasksError } = await supabase
      .from('fusion_orchestrator_events')
      .select('*')
      .in('status', ['Pending', 'Running'])
      .order('priority_level', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(20);

    if (activeTasksError) {
      console.error('Error fetching active tasks:', activeTasksError);
      throw activeTasksError;
    }

    const { data: recentEvents, error: recentEventsError } = await supabase
      .from('fusion_orchestrator_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (recentEventsError) {
      console.error('Error fetching recent events:', recentEventsError);
      throw recentEventsError;
    }

    const pendingTasks = (activeTasks || []).filter(t => t.status === 'Pending').length;
    const uniqueSubsystems = new Set(
      (recentEvents || [])
        .filter(e => e.created_at >= new Date(Date.now() - 3600000).toISOString()) // Last hour
        .map(e => e.trigger_source)
    );

    const summary: OrchestratorSummary = {
      success: true,
      timestamp: new Date().toISOString(),
      result,
      active_tasks: activeTasks || [],
      recent_events: recentEvents || [],
      system_status: {
        total_subsystems: 5, // Optimization, Behavioral, Prediction, Calibration, Oversight
        active_subsystems: uniqueSubsystems.size,
        pending_tasks: pendingTasks,
        system_health: result.system_health,
      },
    };

    console.log('Orchestrator summary:', summary);

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Fusion Orchestrator Engine error:', error);

    const errorSummary: OrchestratorSummary = {
      success: false,
      timestamp: new Date().toISOString(),
      result: null,
      active_tasks: [],
      recent_events: [],
      system_status: {
        total_subsystems: 5,
        active_subsystems: 0,
        pending_tasks: 0,
        system_health: 'Error',
      },
      error: error instanceof Error ? error.message : 'Unknown error',
    };

    return new Response(JSON.stringify(errorSummary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
