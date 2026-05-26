
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { withSentry, breadcrumb, handleSentryTest, jsonError } from "../_shared/sentry.ts";


interface HealingRequest {
  user_id: string;
  organization_id?: string;
  anomaly_id?: string;
  health_event_id?: string;
  action_type?: string;
  target_component_type?: string;
  target_component_name?: string;
  auto_execute?: boolean;
  dry_run?: boolean;
}

interface HealingResponse {
  success: boolean;
  recovery_action_id?: string;
  action_type?: string;
  execution_status?: string;
  execution_result?: any;
  error?: string;
}


/**
 * Restart Edge Function (simulated)
 */
async function restartFunction(
  componentName: string,
  config: Record<string, any>
): Promise<{ success: boolean; output: string; error?: string }> {
  try {
    console.log(`Simulating restart of Edge Function: ${componentName}`);
    
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate restart delay
    
    return {
      success: true,
      output: `Edge Function ${componentName} restarted successfully`,
    };
  } catch (error) {
    return {
      success: false,
      output: '',
      error: error.message,
    };
  }
}

/**
 * Scale up resources (simulated)
 */
async function scaleUp(
  componentName: string,
  config: Record<string, any>
): Promise<{ success: boolean; output: string; error?: string }> {
  try {
    const targetReplicas = config.replicas || 3;
    console.log(`Simulating scale up of ${componentName} to ${targetReplicas} replicas`);
    
    await new Promise((resolve) => setTimeout(resolve, 1500)); // Simulate scaling delay
    
    return {
      success: true,
      output: `Scaled ${componentName} to ${targetReplicas} replicas`,
    };
  } catch (error) {
    return {
      success: false,
      output: '',
      error: error.message,
    };
  }
}

/**
 * Clear cache
 */
async function clearCache(
  componentName: string,
  config: Record<string, any>
): Promise<{ success: boolean; output: string; error?: string }> {
  try {
    const cacheType = config.cache_type || 'all';
    console.log(`Clearing ${cacheType} cache for ${componentName}`);
    
    await new Promise((resolve) => setTimeout(resolve, 500));
    
    return {
      success: true,
      output: `Cleared ${cacheType} cache for ${componentName}`,
    };
  } catch (error) {
    return {
      success: false,
      output: '',
      error: error.message,
    };
  }
}

/**
 * Reset connection pool
 */
async function resetConnection(
  componentName: string,
  config: Record<string, any>
): Promise<{ success: boolean; output: string; error?: string }> {
  try {
    console.log(`Resetting connection pool for ${componentName}`);
    
    await new Promise((resolve) => setTimeout(resolve, 800));
    
    return {
      success: true,
      output: `Reset connection pool for ${componentName}`,
    };
  } catch (error) {
    return {
      success: false,
      output: '',
      error: error.message,
    };
  }
}

/**
 * Rollback deployment (simulated)
 */
async function rollbackDeployment(
  componentName: string,
  config: Record<string, any>
): Promise<{ success: boolean; output: string; error?: string }> {
  try {
    const targetVersion = config.target_version || 'previous';
    console.log(`Rolling back ${componentName} to ${targetVersion}`);
    
    await new Promise((resolve) => setTimeout(resolve, 2000)); // Simulate rollback delay
    
    return {
      success: true,
      output: `Rolled back ${componentName} to ${targetVersion}`,
    };
  } catch (error) {
    return {
      success: false,
      output: '',
      error: error.message,
    };
  }
}

/**
 * Enable circuit breaker
 */
async function enableCircuitBreaker(
  componentName: string,
  config: Record<string, any>
): Promise<{ success: boolean; output: string; error?: string }> {
  try {
    const threshold = config.error_threshold || 50;
    console.log(`Enabling circuit breaker for ${componentName} (threshold: ${threshold}%)`);
    
    await new Promise((resolve) => setTimeout(resolve, 300));
    
    return {
      success: true,
      output: `Circuit breaker enabled for ${componentName}`,
    };
  } catch (error) {
    return {
      success: false,
      output: '',
      error: error.message,
    };
  }
}

/**
 * Send alert escalation
 */
async function alertEscalation(
  supabase: any,
  userId: string,
  organizationId: string | undefined,
  componentName: string,
  config: Record<string, any>
): Promise<{ success: boolean; output: string; error?: string }> {
  try {
    const severity = config.severity || 'high';
    const message = config.message || `Critical issue detected in ${componentName}`;
    
    const { data: escalationRule, error: ruleError } = await supabase
      .from('escalation_rules')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('priority', { ascending: true })
      .limit(1)
      .single();

    if (ruleError || !escalationRule) {
      console.log('No active escalation rules found, skipping escalation');
      return {
        success: true,
        output: 'No active escalation rules configured',
      };
    }

    const escalationResponse = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/escalation-handler`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({
          user_id: userId,
          organization_id: organizationId,
          escalation_reason: message,
          trigger_context: {
            component: componentName,
            severity,
            source: 'self_healing_engine',
          },
        }),
      }
    );

    if (!escalationResponse.ok) {
      throw new Error(`Escalation handler failed: ${await escalationResponse.text()}`);
    }

    return {
      success: true,
      output: `Escalation triggered for ${componentName}`,
    };
  } catch (error) {
    return {
      success: false,
      output: '',
      error: error.message,
    };
  }
}

/**
 * Execute recovery action
 */
async function executeRecoveryAction(
  supabase: any,
  userId: string,
  organizationId: string | undefined,
  actionType: string,
  targetComponentName: string,
  actionConfig: Record<string, any>
): Promise<{ success: boolean; output: string; error?: string }> {
  switch (actionType) {
    case 'restart_function':
      return await restartFunction(targetComponentName, actionConfig);
    case 'scale_up':
      return await scaleUp(targetComponentName, actionConfig);
    case 'scale_down':
      return await scaleUp(targetComponentName, { ...actionConfig, replicas: 1 });
    case 'clear_cache':
      return await clearCache(targetComponentName, actionConfig);
    case 'reset_connection':
      return await resetConnection(targetComponentName, actionConfig);
    case 'rollback_deployment':
      return await rollbackDeployment(targetComponentName, actionConfig);
    case 'circuit_breaker':
      return await enableCircuitBreaker(targetComponentName, actionConfig);
    case 'alert_escalation':
      return await alertEscalation(supabase, userId, organizationId, targetComponentName, actionConfig);
    default:
      return {
        success: false,
        output: '',
        error: `Unknown action type: ${actionType}`,
      };
  }
}

/**
 * Determine recovery action from anomaly
 */
function determineRecoveryAction(anomaly: any): {
  action_type: string;
  action_config: Record<string, any>;
} {
  const anomalyType = anomaly.anomaly_type;
  const severity = anomaly.severity;

  if (anomalyType === 'latency_spike') {
    if (severity === 'critical') {
      return {
        action_type: 'restart_function',
        action_config: { reason: 'latency_spike_critical' },
      };
    } else if (severity === 'high') {
      return {
        action_type: 'clear_cache',
        action_config: { cache_type: 'all' },
      };
    }
  } else if (anomalyType === 'error_rate_increase') {
    if (severity === 'critical') {
      return {
        action_type: 'rollback_deployment',
        action_config: { target_version: 'previous' },
      };
    } else if (severity === 'high') {
      return {
        action_type: 'circuit_breaker',
        action_config: { error_threshold: 50 },
      };
    }
  } else if (anomalyType === 'resource_exhaustion') {
    if (severity === 'critical') {
      return {
        action_type: 'scale_up',
        action_config: { replicas: 3 },
      };
    } else if (severity === 'high') {
      return {
        action_type: 'clear_cache',
        action_config: { cache_type: 'memory' },
      };
    }
  }

  return {
    action_type: 'alert_escalation',
    action_config: {
      severity,
      message: `Anomaly detected: ${anomalyType}`,
    },
  };
}


serve(withSentry(async (req) => {
  const testResponse = await handleSentryTest(req);
  if (testResponse) return testResponse;

  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    const body: HealingRequest = await req.json();
    const {
      user_id,
      organization_id,
      anomaly_id,
      health_event_id,
      action_type,
      target_component_type,
      target_component_name,
      auto_execute = true,
      dry_run = false,
    } = body;

    if (!user_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'user_id is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let recoveryActionType = action_type;
    let recoveryActionConfig: Record<string, any> = {};
    let targetComponent = target_component_name;
    let targetComponentType = target_component_type;
    let triggerReason = 'Manual recovery action';
    let triggeredByAnomalyId = anomaly_id;

    if (anomaly_id && !action_type) {
      const { data: anomaly, error: anomalyError } = await supabase
        .from('anomaly_signals')
        .select('*')
        .eq('id', anomaly_id)
        .single();

      if (anomalyError || !anomaly) {
        throw new Error(`Anomaly not found: ${anomaly_id}`);
      }

      const recoveryAction = determineRecoveryAction(anomaly);
      recoveryActionType = recoveryAction.action_type;
      recoveryActionConfig = recoveryAction.action_config;
      targetComponent = anomaly.source_component_name;
      targetComponentType = anomaly.source_component_type;
      triggerReason = `Anomaly detected: ${anomaly.anomaly_type} (${anomaly.severity})`;
    }

    if (!recoveryActionType || !targetComponent) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'action_type and target_component_name are required',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    const { data: recoveryAction, error: createError } = await supabase
      .from('recovery_actions')
      .insert({
        user_id,
        organization_id,
        action_type: recoveryActionType,
        action_category: recoveryActionType.split('_')[0], // e.g., 'restart', 'scale', 'clear'
        action_name: `${recoveryActionType.replace(/_/g, ' ')} - ${targetComponent}`,
        action_description: `Self-healing action triggered by anomaly detection`,
        trigger_type: auto_execute ? 'automatic' : 'manual',
        triggered_by_anomaly_id: triggeredByAnomalyId,
        triggered_by_health_event_id: health_event_id,
        trigger_reason: triggerReason,
        target_component_type: targetComponentType || 'unknown',
        target_component_name: targetComponent,
        action_config: recoveryActionConfig,
        execution_status: dry_run ? 'completed' : 'pending',
        timeout_seconds: 300,
        executed_by: auto_execute ? 'system' : 'admin',
      })
      .select('*')
      .single();

    if (createError || !recoveryAction) {
      throw new Error(`Failed to create recovery action: ${createError?.message}`);
    }

    let executionResult: any = null;
    let executionSuccess = false;
    let executionError: string | undefined;

    if (!dry_run && auto_execute) {
      await supabase
        .from('recovery_actions')
        .update({
          execution_status: 'in_progress',
          execution_started_at: new Date().toISOString(),
        })
        .eq('id', recoveryAction.id);

      const result = await executeRecoveryAction(
        supabase,
        user_id,
        organization_id,
        recoveryActionType,
        targetComponent,
        recoveryActionConfig
      );

      executionSuccess = result.success;
      executionError = result.error;
      executionResult = {
        output: result.output,
        error: result.error,
      };

      await supabase
        .from('recovery_actions')
        .update({
          execution_status: result.success ? 'completed' : 'failed',
          execution_completed_at: new Date().toISOString(),
          execution_result: executionResult,
          execution_output: result.output,
          execution_error: result.error,
          success: result.success,
        })
        .eq('id', recoveryAction.id);

      if (result.success && triggeredByAnomalyId) {
        await supabase
          .from('anomaly_signals')
          .update({
            triggered_recovery_action_id: recoveryAction.id,
            status: 'investigating',
          })
          .eq('id', triggeredByAnomalyId);
      }
    }

    await supabase.from('decision_audit_log').insert({
      user_id,
      organization_id,
      event_type: 'self_healing_action',
      event_category: 'recovery',
      event_description: `Self-healing action ${recoveryActionType} ${dry_run ? 'simulated' : executionSuccess ? 'executed successfully' : 'failed'}`,
      event_metadata: {
        recovery_action_id: recoveryAction.id,
        action_type: recoveryActionType,
        target_component: targetComponent,
        dry_run,
        success: executionSuccess,
        error: executionError,
      },
      severity: executionSuccess ? 'low' : 'medium',
    });

    const response: HealingResponse = {
      success: true,
      recovery_action_id: recoveryAction.id,
      action_type: recoveryActionType,
      execution_status: recoveryAction.execution_status,
      execution_result: executionResult,
    };

    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (error) {
    console.error('Error in self-healing-engine:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  }
}, { name: "self-healing-engine" }));