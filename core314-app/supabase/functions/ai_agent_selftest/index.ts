import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { corsHeaders } from '../_shared/cors.ts'
import { initSentry, captureException, captureMessage } from '../_shared/sentry.ts'

initSentry()

interface TestResult {
  action_type: 'alert' | 'notify' | 'optimize'
  channel: 'slack' | 'teams' | 'email'
  latency_ms: number
  status: 'success' | 'failed' | 'skipped'
  error_message?: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const testRunId = crypto.randomUUID()
  const correlationId = `selftest-${Date.now()}`
  const testUserId = 'da419d36-d362-439a-a7c0-c77928eeeea5' // Test user from previous phases

  console.log(`[AI Agent Selftest] Starting test run: ${testRunId}`)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const results: TestResult[] = []

    console.log('[AI Agent Selftest] Testing Alert → Slack...')
    const alertResult = await testAlert(supabaseUrl, supabaseServiceKey, testUserId, testRunId, correlationId)
    results.push(alertResult)

    console.log('[AI Agent Selftest] Testing Notify → Teams...')
    const SKIP_TEAMS_TEST = (Deno.env.get('SKIP_TEAMS_TEST') || 'true').toLowerCase() === 'true'
    if (SKIP_TEAMS_TEST) {
      console.log('[AI Agent Selftest] Teams test skipped by configuration')
      results.push({
        action_type: 'notify',
        channel: 'teams',
        latency_ms: 0,
        status: 'skipped',
        error_message: 'Skipped by configuration (SKIP_TEAMS_TEST=true)'
      })
    } else {
      const notifyResult = await testNotify(supabaseUrl, supabaseServiceKey, testUserId, testRunId, correlationId)
      results.push(notifyResult)
    }

    console.log('[AI Agent Selftest] Testing Optimize → Email...')
    const optimizeResult = await testOptimize(supabaseUrl, supabaseServiceKey, testUserId, testRunId, correlationId)
    results.push(optimizeResult)

    for (const result of results) {
      await supabase
        .from('automation_reliability_log')
        .insert({
          test_run_id: testRunId,
          action_type: result.action_type,
          channel: result.channel,
          latency_ms: result.latency_ms,
          status: result.status,
          error_message: result.error_message,
          user_id: testUserId,
          correlation_id: correlationId,
          is_test: true,
          metadata: {
            test_run_id: testRunId,
            correlation_id: correlationId,
            timestamp: new Date().toISOString()
          }
        })
    }

    const skippedCount = results.filter(r => r.status === 'skipped').length
    const consideredCount = results.length - skippedCount
    const failedCount = results.filter(r => r.status === 'failed').length
    const failureRate = consideredCount > 0 ? (failedCount / consideredCount) * 100 : 0

    console.log(`[AI Agent Selftest] Test run complete. Failure rate: ${failureRate.toFixed(2)}%`)

    if (failureRate > 33) {
      console.warn(`[AI Agent Selftest] High failure rate detected: ${failureRate.toFixed(2)}%`)
      await sendImmediateAlert(supabaseUrl, supabaseServiceKey, testUserId, testRunId, failureRate, results)
    }

    const { data: last24hLogs } = await supabase
      .from('automation_reliability_log')
      .select('status, channel, action_type')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

    if (last24hLogs && last24hLogs.length > 0) {
      const last24hSkipped = last24hLogs.filter(log => log.status === 'skipped').length
      const last24hConsidered = last24hLogs.length - last24hSkipped
      const last24hFailures = last24hLogs.filter(log => log.status === 'failed').length
      const last24hFailureRate = last24hConsidered > 0 ? (last24hFailures / last24hConsidered) * 100 : 0

      if (last24hFailureRate > 10) {
        console.warn(`[AI Agent Selftest] 24h failure rate above threshold: ${last24hFailureRate.toFixed(2)}%`)
        
        const { data: recentAlerts } = await supabase
          .from('automation_reliability_log')
          .select('metadata')
          .eq('action_type', 'alert')
          .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
          .limit(1)

        const hasRecentAlert = recentAlerts?.some(alert => 
          alert.metadata?.alert_type === '24h_failure_rate'
        )

        if (!hasRecentAlert) {
          await send24hFailureAlert(supabaseUrl, supabaseServiceKey, testUserId, last24hFailureRate, last24hLogs)
        }
      }
    }

    captureMessage('AI Agent Selftest completed', {
      level: failureRate > 0 ? 'warning' : 'info',
      extra: {
        test_run_id: testRunId,
        correlation_id: correlationId,
        failure_rate: failureRate,
        results: results
      }
    })

    return new Response(
      JSON.stringify({
        success: true,
        test_run_id: testRunId,
        correlation_id: correlationId,
        failure_rate: failureRate,
        results: results,
        message: `Selftest completed. ${failedCount}/${consideredCount} tests failed (${failureRate.toFixed(2)}%)${skippedCount > 0 ? ` [${skippedCount} skipped]` : ''}`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[AI Agent Selftest] Fatal error:', error)
    captureException(error as Error, {
      test_run_id: testRunId,
      correlation_id: correlationId
    })

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        test_run_id: testRunId
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

async function testAlert(
  supabaseUrl: string,
  serviceKey: string,
  userId: string,
  testRunId: string,
  correlationId: string
): Promise<TestResult> {
  const startTime = performance.now()
  
  try {
    const response = await fetch(
      `${supabaseUrl}/functions/v1/core_notifications_gateway`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
          'x-core314-test-mode': 'real' // Force real delivery even if NOTIFICATIONS_TEST_MODE=true
        },
        body: JSON.stringify({
          user_id: userId,
          type: 'alert',
          title: 'Selftest Alert',
          message: `Automated selftest alert. Test run: ${testRunId}`,
          delivery: 'slack',
          metadata: {
            is_test: true,
            test_run_id: testRunId,
            correlation_id: correlationId,
            selftest: true
          }
        })
      }
    )

    const latencyMs = Math.round(performance.now() - startTime)
    const data = await response.json()

    if (!response.ok) {
      return {
        action_type: 'alert',
        channel: 'slack',
        latency_ms: latencyMs,
        status: 'failed',
        error_message: `HTTP ${response.status}: ${data.error || data.message || 'Unknown error'}`
      }
    }

    const externalDelivery = data.external_delivery?.[0]
    if (externalDelivery && !externalDelivery.success) {
      return {
        action_type: 'alert',
        channel: 'slack',
        latency_ms: latencyMs,
        status: 'failed',
        error_message: externalDelivery.error || 'External delivery failed'
      }
    }

    return {
      action_type: 'alert',
      channel: 'slack',
      latency_ms: latencyMs,
      status: 'success'
    }
  } catch (error) {
    const latencyMs = Math.round(performance.now() - startTime)
    return {
      action_type: 'alert',
      channel: 'slack',
      latency_ms: latencyMs,
      status: 'failed',
      error_message: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

async function testNotify(
  supabaseUrl: string,
  serviceKey: string,
  userId: string,
  testRunId: string,
  correlationId: string
): Promise<TestResult> {
  const startTime = performance.now()
  
  try {
    const response = await fetch(
      `${supabaseUrl}/functions/v1/core_notifications_gateway`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
          'x-core314-test-mode': 'real'
        },
        body: JSON.stringify({
          user_id: userId,
          type: 'notify',
          title: 'Selftest Notification',
          message: `Automated selftest notification. Test run: ${testRunId}`,
          delivery: 'teams',
          metadata: {
            is_test: true,
            test_run_id: testRunId,
            correlation_id: correlationId,
            selftest: true
          }
        })
      }
    )

    const latencyMs = Math.round(performance.now() - startTime)
    const data = await response.json()

    if (!response.ok) {
      return {
        action_type: 'notify',
        channel: 'teams',
        latency_ms: latencyMs,
        status: 'failed',
        error_message: `HTTP ${response.status}: ${data.error || data.message || 'Unknown error'}`
      }
    }

    const externalDelivery = data.external_delivery?.[0]
    if (externalDelivery && !externalDelivery.success) {
      return {
        action_type: 'notify',
        channel: 'teams',
        latency_ms: latencyMs,
        status: 'failed',
        error_message: externalDelivery.error || 'External delivery failed'
      }
    }

    return {
      action_type: 'notify',
      channel: 'teams',
      latency_ms: latencyMs,
      status: 'success'
    }
  } catch (error) {
    const latencyMs = Math.round(performance.now() - startTime)
    return {
      action_type: 'notify',
      channel: 'teams',
      latency_ms: latencyMs,
      status: 'failed',
      error_message: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

async function testOptimize(
  supabaseUrl: string,
  serviceKey: string,
  userId: string,
  testRunId: string,
  correlationId: string
): Promise<TestResult> {
  const startTime = performance.now()
  
  try {
    const response = await fetch(
      `${supabaseUrl}/functions/v1/fusion_live_optimizer`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: userId,
          metric_type: 'efficiency_index',
          metric_value: 75,
          threshold_value: 80,
          optimization_type: 'auto',
          email_to: Deno.env.get('ADMIN_EMAIL') || 'admin@core314.com',
          metadata: {
            is_test: true,
            test_run_id: testRunId,
            correlation_id: correlationId,
            selftest: true
          }
        })
      }
    )

    const latencyMs = Math.round(performance.now() - startTime)
    const data = await response.json()

    if (!response.ok) {
      return {
        action_type: 'optimize',
        channel: 'email',
        latency_ms: latencyMs,
        status: 'failed',
        error_message: `HTTP ${response.status}: ${data.error || data.message || 'Unknown error'}`
      }
    }

    if (data.email_delivery_status === 'failed') {
      return {
        action_type: 'optimize',
        channel: 'email',
        latency_ms: latencyMs,
        status: 'failed',
        error_message: 'Email delivery failed'
      }
    }

    return {
      action_type: 'optimize',
      channel: 'email',
      latency_ms: latencyMs,
      status: 'success'
    }
  } catch (error) {
    const latencyMs = Math.round(performance.now() - startTime)
    return {
      action_type: 'optimize',
      channel: 'email',
      latency_ms: latencyMs,
      status: 'failed',
      error_message: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

async function sendImmediateAlert(
  supabaseUrl: string,
  serviceKey: string,
  userId: string,
  testRunId: string,
  failureRate: number,
  results: TestResult[]
): Promise<void> {
  const failedTests = results.filter(r => r.status === 'failed')
  const failureDetails = failedTests.map(t => 
    `- ${t.action_type} → ${t.channel}: ${t.error_message}`
  ).join('\n')

  try {
    await fetch(
      `${supabaseUrl}/functions/v1/core_notifications_gateway`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: userId,
          type: 'alert',
          title: '🚨 Core314 Selftest High Failure Rate',
          message: `Selftest run ${testRunId} failed ${failureRate.toFixed(2)}% of tests.\n\nFailed tests:\n${failureDetails}`,
          delivery: 'slack',
          severity: 'critical',
          metadata: {
            alert_type: 'immediate_failure',
            test_run_id: testRunId,
            failure_rate: failureRate,
            failed_count: failedTests.length,
            total_count: results.length
          }
        })
      }
    )
  } catch (error) {
    console.error('[sendImmediateAlert] Failed to send alert:', error)
  }
}

async function send24hFailureAlert(
  supabaseUrl: string,
  serviceKey: string,
  userId: string,
  failureRate: number,
  logs: any[]
): Promise<void> {
  const failuresByChannel = logs
    .filter(log => log.status === 'failed')
    .reduce((acc, log) => {
      acc[log.channel] = (acc[log.channel] || 0) + 1
      return acc
    }, {} as Record<string, number>)

  const channelDetails = Object.entries(failuresByChannel)
    .map(([channel, count]) => `- ${channel}: ${count} failures`)
    .join('\n')

  try {
    await fetch(
      `${supabaseUrl}/functions/v1/core_notifications_gateway`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: userId,
          type: 'alert',
          title: '⚠️ Core314 24h Failure Rate Above Threshold',
          message: `24-hour failure rate is ${failureRate.toFixed(2)}% (threshold: 10%).\n\nFailures by channel:\n${channelDetails}`,
          delivery: 'slack',
          severity: 'high',
          metadata: {
            alert_type: '24h_failure_rate',
            failure_rate: failureRate,
            total_tests: logs.length,
            failed_tests: logs.filter(l => l.status === 'failed').length,
            timestamp: new Date().toISOString()
          }
        })
      }
    )
  } catch (error) {
    console.error('[send24hFailureAlert] Failed to send alert:', error)
  }
}
