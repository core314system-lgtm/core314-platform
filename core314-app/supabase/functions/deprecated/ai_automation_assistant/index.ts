import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { corsHeaders } from '../_shared/cors.ts'
import { initSentry, captureException } from '../_shared/sentry.ts'

initSentry()

interface AutomationQuery {
  query: string
  user_id: string
  action?: 'list' | 'create' | 'update' | 'delete'
  rule_data?: any
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
    const { query, user_id, action, rule_data }: AutomationQuery = await req.json()

    console.log('[AI Automation Assistant] Processing query:', query)

    switch (action) {
      case 'list':
        return await listAutomations(supabase, user_id)
      
      case 'create':
        return await createAutomation(supabase, user_id, rule_data, query)
      
      case 'update':
        return await updateAutomation(supabase, user_id, rule_data)
      
      case 'delete':
        return await deleteAutomation(supabase, user_id, rule_data)
      
      default:
        return await interpretQuery(supabase, user_id, query)
    }
  } catch (error) {
    console.error('[AI Automation Assistant] Error:', error)
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

async function listAutomations(supabase: any, userId: string) {
  const { data: rules, error } = await supabase
    .from('automation_rules')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  const activeCount = rules?.filter((r: any) => r.status === 'active').length || 0
  const totalTriggers = rules?.reduce((sum: number, r: any) => sum + r.trigger_count, 0) || 0

  return new Response(
    JSON.stringify({
      status: 'success',
      message: `You have ${rules?.length || 0} automation rules configured. ${activeCount} are currently active.`,
      data: {
        rules,
        summary: {
          total: rules?.length || 0,
          active: activeCount,
          paused: rules?.filter((r: any) => r.status === 'paused').length || 0,
          total_triggers: totalTriggers
        }
      }
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function createAutomation(supabase: any, userId: string, ruleData: any, query: string) {
  const parsedRule = parseAutomationQuery(query, ruleData)

  const newRule = {
    user_id: userId,
    rule_name: parsedRule.rule_name || ruleData?.rule_name || 'New Automation Rule',
    description: parsedRule.description || ruleData?.description,
    metric_type: parsedRule.metric_type || ruleData?.metric_type,
    condition_operator: parsedRule.condition_operator || ruleData?.condition_operator,
    threshold_value: parsedRule.threshold_value || ruleData?.threshold_value,
    action_type: parsedRule.action_type || ruleData?.action_type || 'notify',
    action_config: ruleData?.action_config || {},
    target_integration: ruleData?.target_integration,
    status: 'active'
  }

  const { data, error } = await supabase
    .from('automation_rules')
    .insert(newRule)
    .select()
    .single()

  if (error) {
    throw error
  }

  return new Response(
    JSON.stringify({
      status: 'success',
      message: `Successfully created automation rule: "${newRule.rule_name}". The rule will start monitoring immediately.`,
      data: {
        rule: data
      }
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function updateAutomation(supabase: any, userId: string, ruleData: any) {
  const { id, ...updates } = ruleData

  const { data, error } = await supabase
    .from('automation_rules')
    .update(updates)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    throw error
  }

  return new Response(
    JSON.stringify({
      status: 'success',
      message: `Successfully updated automation rule.`,
      data: {
        rule: data
      }
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function deleteAutomation(supabase: any, userId: string, ruleData: any) {
  const { error } = await supabase
    .from('automation_rules')
    .delete()
    .eq('id', ruleData.id)
    .eq('user_id', userId)

  if (error) {
    throw error
  }

  return new Response(
    JSON.stringify({
      status: 'success',
      message: `Successfully deleted automation rule.`
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function interpretQuery(supabase: any, userId: string, query: string) {
  const lowerQuery = query.toLowerCase()

  if (lowerQuery.includes('what automation') || lowerQuery.includes('which automation') || 
      lowerQuery.includes('active rule') || lowerQuery.includes('current rule')) {
    return await listAutomations(supabase, userId)
  }

  if (lowerQuery.includes('create') || lowerQuery.includes('add') || 
      lowerQuery.includes('set up') || lowerQuery.includes('alert me')) {
    
    const parsedRule = parseAutomationQuery(query)
    
    if (!parsedRule.metric_type || !parsedRule.threshold_value) {
      return new Response(
        JSON.stringify({
          status: 'needs_clarification',
          message: 'I can help you create an automation rule. Please specify:\n' +
                   '1. What metric to monitor (fusion score, efficiency index, integration health, anomaly count)\n' +
                   '2. The threshold value\n' +
                   '3. What action to take (notify, alert, optimize)\n\n' +
                   'Example: "Create a rule to alert me if fusion score drops below 70"',
          suggestions: [
            'Alert if Fusion Score < 70',
            'Notify if Integration Error > 3 in 24h',
            'Trigger Optimization if Efficiency Index < 80'
          ]
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return await createAutomation(supabase, userId, parsedRule, query)
  }

  if (lowerQuery.includes('recent') || lowerQuery.includes('activity') || 
      lowerQuery.includes('trigger') || lowerQuery.includes('fired')) {
    
    const { data: activities, error } = await supabase
      .from('agent_activity_log')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) {
      throw error
    }

    return new Response(
      JSON.stringify({
        status: 'success',
        message: `Found ${activities?.length || 0} recent automation activities.`,
        data: {
          activities,
          summary: {
            total: activities?.length || 0,
            successful: activities?.filter((a: any) => a.status === 'success').length || 0,
            failed: activities?.filter((a: any) => a.status === 'failed').length || 0
          }
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  return new Response(
    JSON.stringify({
      status: 'success',
      message: 'I can help you manage automation rules. You can:\n\n' +
               '• Ask "What automations are currently active?"\n' +
               '• Request "Create a rule to alert me if system health drops below fair"\n' +
               '• Check "Show me recent automation activity"\n' +
               '• Inquire "What rules have triggered today?"\n\n' +
               'What would you like to do?',
      capabilities: [
        'List active automation rules',
        'Create new automation rules',
        'View automation activity history',
        'Check rule trigger statistics'
      ]
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

function parseAutomationQuery(query: string, existingData?: any): any {
  const lowerQuery = query.toLowerCase()
  const result: any = existingData || {}

  if (lowerQuery.includes('fusion score')) {
    result.metric_type = 'fusion_score'
  } else if (lowerQuery.includes('efficiency') || lowerQuery.includes('efficiency index')) {
    result.metric_type = 'efficiency_index'
  } else if (lowerQuery.includes('integration health') || lowerQuery.includes('system health')) {
    result.metric_type = 'integration_health'
  } else if (lowerQuery.includes('error') || lowerQuery.includes('anomaly')) {
    result.metric_type = 'anomaly_count'
  }

  const lessThanMatch = query.match(/(?:below|less than|<)\s*(\d+)/i)
  const greaterThanMatch = query.match(/(?:above|greater than|more than|>)\s*(\d+)/i)
  const equalsMatch = query.match(/(?:equals|=)\s*(\d+)/i)

  if (lessThanMatch) {
    result.condition_operator = '<'
    result.threshold_value = parseFloat(lessThanMatch[1])
  } else if (greaterThanMatch) {
    result.condition_operator = '>'
    result.threshold_value = parseFloat(greaterThanMatch[1])
  } else if (equalsMatch) {
    result.condition_operator = '='
    result.threshold_value = parseFloat(equalsMatch[1])
  }

  if (lowerQuery.includes('alert') || lowerQuery.includes('notify')) {
    result.action_type = 'notify'
  } else if (lowerQuery.includes('optimize')) {
    result.action_type = 'optimize'
  } else if (lowerQuery.includes('log')) {
    result.action_type = 'log'
  }

  if (!result.rule_name && result.metric_type && result.threshold_value) {
    result.rule_name = `${result.action_type || 'Alert'} if ${result.metric_type} ${result.condition_operator} ${result.threshold_value}`
    result.description = `Automatically ${result.action_type || 'notify'} when ${result.metric_type} ${result.condition_operator} ${result.threshold_value}`
  }

  return result
}
