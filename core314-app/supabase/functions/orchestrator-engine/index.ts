
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { withSentry, breadcrumb, handleSentryTest, jsonError } from "../_shared/sentry.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OrchestrationRequest {
  user_id?: string;
  trigger_type: string;
  trigger_source: 'decision_approved' | 'recommendation_created' | 'threshold_exceeded' | 'manual';
  trigger_context: Record<string, any>;
  decision_event_id?: string;
  recommendation_id?: string;
  flow_id?: string; // Optional: specify exact flow to execute
}

interface OrchestrationResponse {
  success: boolean;
  orchestration_id?: string;
  flow_id?: string;
  flow_name?: string;
  execution_mode?: string;
  steps_created?: number;
  execution_queue_ids?: string[];
  estimated_duration_ms?: number;
  error?: string;
}

serve(withSentry(async (req) => {
  const testResponse = await handleSentryTest(req);
  if (testResponse) return testResponse;

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;
    let supabase = createClient(supabaseUrl, supabaseKey);

    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      
      const userSupabase = createClient(supabaseUrl, token);
      const { data: { user }, error: userError } = await userSupabase.auth.getUser();
      
      if (user && !userError) {
        userId = user.id;
        supabase = userSupabase;
      } else {
        const body = await req.json();
        if (body.user_id) {
          userId = body.user_id;
        }
      }
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: OrchestrationRequest = await req.json();
    const {
      trigger_type,
      trigger_source,
      trigger_context,
      decision_event_id,
      recommendation_id,
      flow_id,
    } = body;

    console.log('Orchestrator Engine - Processing request:', {
      userId,
      trigger_type,
      trigger_source,
      flow_id,
    });

    let matchedFlow: any = null;

    if (flow_id) {
      const { data: flow, error: flowError } = await supabase
        .from('orchestration_flows')
        .select('*')
        .eq('id', flow_id)
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      if (flowError || !flow) {
        return new Response(
          JSON.stringify({ success: false, error: 'Flow not found or inactive' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      matchedFlow = flow;
    } else {
      const { data: flows, error: flowsError } = await supabase
        .from('orchestration_flows')
        .select('*')
        .eq('user_id', userId)
        .eq('trigger_type', trigger_type)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (flowsError) {
        throw new Error(`Failed to fetch flows: ${flowsError.message}`);
      }

      for (const flow of flows || []) {
        if (evaluateFlowConditions(flow.conditions, trigger_context)) {
          matchedFlow = flow;
          break;
        }
      }

      if (!matchedFlow) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'No matching orchestration flow found',
          }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log('Matched flow:', matchedFlow.flow_name);

    const flowSteps = matchedFlow.flow_steps as any[];
    
    const executionQueueIds: string[] = [];
    let estimatedDuration = 0;

    if (matchedFlow.execution_mode === 'sequential') {
      let previousStepId: string | null = null;

      for (const step of flowSteps) {
        if (step.type === 'action') {
          const queueEntry = await createExecutionQueueEntry(
            supabase,
            userId,
            matchedFlow.id,
            step,
            decision_event_id,
            recommendation_id,
            trigger_context,
            previousStepId ? [previousStepId] : []
          );

          if (queueEntry) {
            executionQueueIds.push(queueEntry.id);
            previousStepId = queueEntry.id;
            estimatedDuration += step.config?.estimated_duration_ms || 1000;
          }
        }
      }
    } else if (matchedFlow.execution_mode === 'parallel') {
      for (const step of flowSteps) {
        if (step.type === 'action') {
          const queueEntry = await createExecutionQueueEntry(
            supabase,
            userId,
            matchedFlow.id,
            step,
            decision_event_id,
            recommendation_id,
            trigger_context,
            []
          );

          if (queueEntry) {
            executionQueueIds.push(queueEntry.id);
            estimatedDuration = Math.max(
              estimatedDuration,
              step.config?.estimated_duration_ms || 1000
            );
          }
        }
      }
    } else {
      const stepIdMap = new Map<string, string>(); // step.id -> queue_entry.id

      for (const step of flowSteps) {
        if (step.type === 'action') {
          const dependencies: string[] = [];

          if (step.connections?.inputs) {
            for (const inputConnection of step.connections.inputs) {
              const depQueueId = stepIdMap.get(inputConnection.sourceStepId);
              if (depQueueId) {
                dependencies.push(depQueueId);
              }
            }
          }

          const queueEntry = await createExecutionQueueEntry(
            supabase,
            userId,
            matchedFlow.id,
            step,
            decision_event_id,
            recommendation_id,
            trigger_context,
            dependencies
          );

          if (queueEntry) {
            executionQueueIds.push(queueEntry.id);
            stepIdMap.set(step.id, queueEntry.id);
          }
        }
      }

      estimatedDuration = flowSteps.reduce(
        (sum, step) => sum + (step.config?.estimated_duration_ms || 1000),
        0
      );
    }

    if (decision_event_id) {
      await supabase.from('decision_audit_log').insert({
        user_id: userId,
        decision_event_id,
        event_type: 'orchestration_started',
        event_category: 'execution',
        event_description: `Orchestration flow "${matchedFlow.flow_name}" started with ${executionQueueIds.length} steps`,
        actor_type: 'system',
        execution_success: true,
        metadata: {
          flow_id: matchedFlow.id,
          execution_queue_ids: executionQueueIds,
          execution_mode: matchedFlow.execution_mode,
        },
      });
    }

    const response: OrchestrationResponse = {
      success: true,
      orchestration_id: matchedFlow.id,
      flow_id: matchedFlow.id,
      flow_name: matchedFlow.flow_name,
      execution_mode: matchedFlow.execution_mode,
      steps_created: executionQueueIds.length,
      execution_queue_ids: executionQueueIds,
      estimated_duration_ms: estimatedDuration,
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Orchestrator Engine error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function evaluateFlowConditions(
  conditions: any[],
  context: Record<string, any>
): boolean {
  if (!conditions || conditions.length === 0) {
    return true; // No conditions = always match
  }

  for (const condition of conditions) {
    const { field, operator, value } = condition;
    const contextValue = context[field];

    switch (operator) {
      case 'equals':
        if (contextValue !== value) return false;
        break;
      case 'not_equals':
        if (contextValue === value) return false;
        break;
      case 'greater_than':
        if (!(contextValue > value)) return false;
        break;
      case 'less_than':
        if (!(contextValue < value)) return false;
        break;
      case 'contains':
        if (!String(contextValue).includes(value)) return false;
        break;
      case 'in':
        if (!Array.isArray(value) || !value.includes(contextValue)) return false;
        break;
      default:
        return false;
    }
  }

  return true;
}

async function createExecutionQueueEntry(
  supabase: any,
  userId: string,
  flowId: string,
  step: any,
  decisionEventId?: string,
  recommendationId?: string,
  triggerContext?: Record<string, any>,
  dependencies: string[] = []
): Promise<any> {
  const { data, error } = await supabase
    .from('execution_queue')
    .insert({
      user_id: userId,
      orchestration_flow_id: flowId,
      decision_event_id: decisionEventId,
      recommendation_id: recommendationId,
      action_type: step.config?.action_type || 'custom',
      action_target: step.config?.action_target || 'unknown',
      action_payload: step.config?.action_payload || {},
      action_config: step.config?.action_config || {},
      priority: step.config?.priority || 5,
      urgency: step.config?.urgency || 'medium',
      requires_approval: step.config?.requires_approval || false,
      depends_on: dependencies.length > 0 ? dependencies : null,
      context_data: triggerContext || {},
      tags: step.config?.tags || [],
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create execution queue entry:', error);
    return null;
  }

  return data;
}
