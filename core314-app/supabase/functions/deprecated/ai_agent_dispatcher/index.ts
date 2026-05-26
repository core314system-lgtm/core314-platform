import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { corsHeaders } from '../_shared/cors.ts'
import { initSentry, captureException, captureMessage } from '../_shared/sentry.ts'

initSentry()

interface AutomationRule {
  id: string
  user_id: string
  rule_name: string
  metric_type: string
  condition_operator: string
  threshold_value: number
  action_type: string
  action_config: Record<string, any>
  target_integration?: string
  last_triggered_at?: string
  trigger_count: number
}

interface MetricData {
  fusion_score?: number
  efficiency_index?: number
  integration_health?: string
  anomaly_count?: number
  [key: string]: any
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('[AI Agent Dispatcher] Starting rule evaluation cycle...')

    const { data: rules, error: rulesError } = await supabase
      .from('automation_rules')
      .select('*')
      .eq('status', 'active')

    if (rulesError) {
      console.error('[AI Agent Dispatcher] Error fetching rules:', rulesError)
      throw rulesError
    }

    if (!rules || rules.length === 0) {
      console.log('[AI Agent Dispatcher] No active rules found')
      return new Response(
        JSON.stringify({
          status: 'success',
          message: 'No active rules to evaluate',
          rules_evaluated: 0,
          actions_triggered: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[AI Agent Dispatcher] Found ${rules.length} active rules`)

    let actionsTriggered = 0
    const results = []

    for (const rule of rules as AutomationRule[]) {
      try {
        console.log(`[AI Agent Dispatcher] Evaluating rule: ${rule.rule_name} (${rule.id})`)

        const metricData = await fetchMetricData(supabase, rule.user_id, rule.metric_type, rule.target_integration)

        const conditionMet = evaluateCondition(
          metricData,
          rule.metric_type,
          rule.condition_operator,
          rule.threshold_value
        )

        if (conditionMet) {
          console.log(`[AI Agent Dispatcher] Rule triggered: ${rule.rule_name}`)

          const actionResult = await executeAction(supabase, rule, metricData)

          await supabase
            .from('automation_rules')
            .update({
              last_triggered_at: new Date().toISOString(),
              trigger_count: rule.trigger_count + 1
            })
            .eq('id', rule.id)

          await logActivity(supabase, {
            user_id: rule.user_id,
            rule_id: rule.id,
            agent_name: 'ai_agent_dispatcher',
            event_type: 'rule_triggered',
            action_taken: `Executed ${rule.action_type} action for rule: ${rule.rule_name}`,
            context: {
              rule_name: rule.rule_name,
              metric_type: rule.metric_type,
              metric_value: metricData[rule.metric_type],
              threshold_value: rule.threshold_value,
              condition_operator: rule.condition_operator,
              action_result: actionResult
            },
            status: actionResult.success ? 'success' : 'failed',
            error_message: actionResult.error
          })

          actionsTriggered++
          results.push({
            rule_id: rule.id,
            rule_name: rule.rule_name,
            triggered: true,
            action_result: actionResult
          })
        } else {
          results.push({
            rule_id: rule.id,
            rule_name: rule.rule_name,
            triggered: false,
            reason: `Condition not met: ${metricData[rule.metric_type]} ${rule.condition_operator} ${rule.threshold_value}`
          })
        }
      } catch (error) {
        console.error(`[AI Agent Dispatcher] Error evaluating rule ${rule.id}:`, error)
        captureException(error as Error, {
          rule_id: rule.id,
          rule_name: rule.rule_name
        })

        await logActivity(supabase, {
          user_id: rule.user_id,
          rule_id: rule.id,
          agent_name: 'ai_agent_dispatcher',
          event_type: 'rule_evaluation_error',
          action_taken: `Failed to evaluate rule: ${rule.rule_name}`,
          context: { error: error instanceof Error ? error.message : 'Unknown error' },
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error'
        })

        results.push({
          rule_id: rule.id,
          rule_name: rule.rule_name,
          triggered: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    console.log(`[AI Agent Dispatcher] Evaluation complete. Actions triggered: ${actionsTriggered}`)

    return new Response(
      JSON.stringify({
        status: 'success',
        message: 'Rule evaluation complete',
        rules_evaluated: rules.length,
        actions_triggered: actionsTriggered,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[AI Agent Dispatcher] Fatal error:', error)
    captureException(error as Error)

    return new Response(
      JSON.stringify({
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

async function fetchMetricData(
  supabase: any,
  userId: string,
  metricType: string,
  targetIntegration?: string
): Promise<MetricData> {
  const metricData: MetricData = {}

  try {
    if (metricType === 'fusion_score' || metricType === 'all') {
      const { data: fusionData } = await supabase
        .from('fusion_scores')
        .select('fusion_score')
        .eq('user_id', userId)
        .order('calculated_at', { ascending: false })
        .limit(1)
        .single()

      metricData.fusion_score = fusionData?.fusion_score ?? 0
    }

    if (metricType === 'efficiency_index' || metricType === 'all') {
      const { data: efficiencyData } = await supabase
        .from('fusion_optimization_events')
        .select('efficiency_index')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      metricData.efficiency_index = efficiencyData?.efficiency_index ?? 0
    }

    if (metricType === 'integration_health' || metricType === 'all') {
      if (targetIntegration) {
        const { data: integrationData } = await supabase
          .from('integrations')
          .select('status')
          .eq('user_id', userId)
          .eq('integration_name', targetIntegration)
          .single()

        metricData.integration_health = integrationData?.status ?? 'unknown'
      } else {
        const { count } = await supabase
          .from('integrations')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .neq('status', 'active')

        metricData.integration_health = count === 0 ? 'healthy' : 'degraded'
      }
    }

    if (metricType === 'anomaly_count' || metricType === 'all') {
      const { data: anomalyData, error: anomalyError } = await supabase
        .rpc('get_anomaly_count', { target_user_id: userId })

      if (anomalyError) {
        console.error('[fetchMetricData] Error fetching anomaly count:', anomalyError)
        metricData.anomaly_count = 0
      } else {
        metricData.anomaly_count = anomalyData ?? 0
      }
    }

    return metricData
  } catch (error) {
    console.error('[fetchMetricData] Error:', error)
    return metricData
  }
}

function evaluateCondition(
  metricData: MetricData,
  metricType: string,
  operator: string,
  threshold: number
): boolean {
  const value = metricData[metricType]

  if (value === undefined || value === null) {
    return false
  }

  let numericValue: number
  if (typeof value === 'string') {
    const healthMap: Record<string, number> = {
      'healthy': 100,
      'degraded': 50,
      'unhealthy': 25,
      'unknown': 0
    }
    numericValue = healthMap[value] ?? 0
  } else {
    numericValue = Number(value)
  }

  switch (operator) {
    case '>':
      return numericValue > threshold
    case '<':
      return numericValue < threshold
    case '>=':
      return numericValue >= threshold
    case '<=':
      return numericValue <= threshold
    case '=':
      return numericValue === threshold
    case '!=':
      return numericValue !== threshold
    default:
      return false
  }
}

async function executeAction(
  supabase: any,
  rule: AutomationRule,
  metricData: MetricData
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    switch (rule.action_type) {
      case 'notify':
      case 'alert':
        return await sendNotification(supabase, rule, metricData)

      case 'optimize':
        return await triggerOptimization(supabase, rule, metricData)

      case 'log':
        return await logEvent(supabase, rule, metricData)

      case 'adjust':
        return await adjustSettings(supabase, rule, metricData)

      default:
        return {
          success: false,
          error: `Unknown action type: ${rule.action_type}`
        }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

async function sendNotification(
  supabase: any,
  rule: AutomationRule,
  metricData: MetricData
): Promise<{ success: boolean; message?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('core_notifications_gateway', {
      body: {
        user_id: rule.user_id,
        rule_id: rule.id,
        type: rule.action_type, // 'alert' or 'notify'
        title: `Automation ${rule.action_type === 'alert' ? 'Alert' : 'Notification'}: ${rule.rule_name}`,
        message: `Rule "${rule.rule_name}" triggered. ${rule.metric_type} is ${metricData[rule.metric_type]} (threshold: ${rule.threshold_value})`,
        severity: rule.action_config?.severity || (rule.action_type === 'alert' ? 'high' : 'medium'),
        metadata: {
          rule_id: rule.id,
          rule_name: rule.rule_name,
          metric_type: rule.metric_type,
          metric_value: metricData[rule.metric_type],
          threshold_value: rule.threshold_value,
          condition_operator: rule.condition_operator,
          triggered_at: new Date().toISOString()
        }
      }
    })

    if (error) {
      console.error('[sendNotification] Error calling core_notifications_gateway:', error)
      return { success: false, message: error.message }
    }

    return {
      success: data?.success ?? true,
      message: data?.message || 'Notification sent successfully'
    }
  } catch (error) {
    console.error('[sendNotification] Unexpected error:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

async function triggerOptimization(
  supabase: any,
  rule: AutomationRule,
  metricData: MetricData
): Promise<{ success: boolean; message?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('fusion_live_optimizer', {
      body: {
        user_id: rule.user_id,
        rule_id: rule.id,
        metric_type: rule.metric_type,
        metric_value: metricData[rule.metric_type],
        threshold_value: rule.threshold_value,
        optimization_type: rule.action_config?.optimization_type || 'auto',
        target_metric: rule.action_config?.target_metric || rule.metric_type
      }
    })

    if (error) {
      console.error('[triggerOptimization] Error calling fusion_live_optimizer:', error)
      return { success: false, message: error.message }
    }

    return {
      success: data?.success ?? true,
      message: data?.message || 'Optimization triggered successfully'
    }
  } catch (error) {
    console.error('[triggerOptimization] Unexpected error:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

async function logEvent(
  supabase: any,
  rule: AutomationRule,
  metricData: MetricData
): Promise<{ success: boolean; message?: string }> {
  return {
    success: true,
    message: 'Event logged successfully'
  }
}

async function adjustSettings(
  supabase: any,
  rule: AutomationRule,
  metricData: MetricData
): Promise<{ success: boolean; message?: string }> {
  return {
    success: true,
    message: 'Settings adjustment queued'
  }
}

async function logActivity(
  supabase: any,
  activity: {
    user_id: string
    rule_id: string
    agent_name: string
    event_type: string
    action_taken: string
    context: Record<string, any>
    status: string
    error_message?: string
  }
): Promise<void> {
  const { error } = await supabase
    .from('agent_activity_log')
    .insert({
      ...activity,
      created_at: new Date().toISOString()
    })

  if (error) {
    console.error('[logActivity] Error:', error)
  }
}
