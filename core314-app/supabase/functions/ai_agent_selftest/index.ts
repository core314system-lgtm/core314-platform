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

    const ADAPTIVE_OPTIMIZATION_ENABLED = (Deno.env.get('ADAPTIVE_OPTIMIZATION_ENABLED') || 'false').toLowerCase() === 'true'
    if (ADAPTIVE_OPTIMIZATION_ENABLED) {
      console.log('[AI Agent Selftest] Computing adaptive reliability metrics...')
      await computeAdaptiveReliability(supabase, supabaseUrl, supabaseServiceKey, testUserId)
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

/**
 * Phase 62: Compute adaptive reliability metrics for Slack and Email channels
 * Analyzes last 24h performance data and updates fusion_adaptive_reliability table
 */
async function computeAdaptiveReliability(
  supabase: any,
  supabaseUrl: string,
  serviceKey: string,
  userId: string
): Promise<void> {
  const BASE_RETRY_SLACK_MS = parseInt(Deno.env.get('BASE_RETRY_SLACK_MS') || '2000', 10)
  const BASE_RETRY_EMAIL_MS = parseInt(Deno.env.get('BASE_RETRY_EMAIL_MS') || '3000', 10)
  
  const channels: Array<{channel: 'slack' | 'email', baseRetryMs: number}> = [
    { channel: 'slack', baseRetryMs: BASE_RETRY_SLACK_MS },
    { channel: 'email', baseRetryMs: BASE_RETRY_EMAIL_MS }
  ]

  for (const { channel, baseRetryMs } of channels) {
    try {
      const { data: metrics, error: metricsError } = await supabase
        .rpc('get_channel_metrics_24h', { p_channel: channel })
        .single()

      if (metricsError) {
        const { data: logs, error: logsError } = await supabase
          .from('automation_reliability_log')
          .select('latency_ms, status')
          .eq('channel', channel)
          .in('status', ['success', 'failed'])
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

        if (logsError) {
          console.error(`[Adaptive Reliability] Error fetching logs for ${channel}:`, logsError)
          continue
        }

        if (!logs || logs.length === 0) {
          console.log(`[Adaptive Reliability] No data for ${channel} in last 24h, skipping`)
          continue
        }

        const consideredCount = logs.length
        const failedCount = logs.filter(l => l.status === 'failed').length
        const failureRate = consideredCount > 0 ? failedCount / consideredCount : 0
        const avgLatencyMs = logs.reduce((sum, l) => sum + l.latency_ms, 0) / consideredCount
        
        const mean = avgLatencyMs
        const squaredDiffs = logs.map(l => Math.pow(l.latency_ms - mean, 2))
        const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / (consideredCount - 1)
        const stddev = consideredCount > 1 ? Math.sqrt(variance) : null

        await processChannelMetrics(
          supabase,
          channel,
          baseRetryMs,
          consideredCount,
          failureRate,
          avgLatencyMs,
          stddev,
          userId
        )
      } else {
        await processChannelMetrics(
          supabase,
          channel,
          baseRetryMs,
          metrics.considered_count,
          metrics.failure_rate,
          metrics.avg_latency_ms,
          metrics.stddev,
          userId
        )
      }
    } catch (error) {
      console.error(`[Adaptive Reliability] Error processing ${channel}:`, error)
      captureException(error as Error, {
        context: 'adaptive_reliability',
        channel
      })
    }
  }
}

/**
 * Process metrics for a single channel and update fusion_adaptive_reliability
 */
async function processChannelMetrics(
  supabase: any,
  channel: string,
  baseRetryMs: number,
  consideredCount: number,
  failureRate: number,
  avgLatencyMs: number,
  stddev: number | null,
  userId: string
): Promise<void> {
  console.log(`[Adaptive Reliability] ${channel}: N=${consideredCount}, FR=${(failureRate * 100).toFixed(2)}%, Latency=${avgLatencyMs.toFixed(0)}ms`)

  const confidenceScore = calculateConfidenceScore(consideredCount, failureRate, avgLatencyMs, stddev)

  let computedRetryMs = baseRetryMs
  if (failureRate > 0.2) {
    computedRetryMs = baseRetryMs * 1.5
  } else if (avgLatencyMs > 2500) {
    computedRetryMs = baseRetryMs * 1.25
  } else if (failureRate < 0.05 && avgLatencyMs < 2000) {
    computedRetryMs = baseRetryMs * 0.9
  }

  const { data: previous } = await supabase
    .from('fusion_adaptive_reliability')
    .select('recommended_retry_ms')
    .eq('channel', channel)
    .single()

  let recommendedRetryMs = Math.round(computedRetryMs)
  
  if (previous && previous.recommended_retry_ms) {
    const alpha = 0.3
    recommendedRetryMs = Math.round(alpha * computedRetryMs + (1 - alpha) * previous.recommended_retry_ms)
  }

  recommendedRetryMs = Math.max(500, Math.min(10000, recommendedRetryMs))

  const { error: upsertError } = await supabase
    .from('fusion_adaptive_reliability')
    .upsert({
      channel,
      avg_latency_ms: avgLatencyMs,
      failure_rate: failureRate,
      recommended_retry_ms: recommendedRetryMs,
      confidence_score: confidenceScore,
      last_updated: new Date().toISOString()
    }, {
      onConflict: 'channel'
    })

  if (upsertError) {
    console.error(`[Adaptive Reliability] Error upserting ${channel}:`, upsertError)
    return
  }

  console.log(`[Adaptive Reliability] ${channel}: recommended_retry_ms=${recommendedRetryMs}ms, confidence=${confidenceScore.toFixed(2)}`)

  if (previous && previous.recommended_retry_ms) {
    const percentChange = Math.abs((recommendedRetryMs - previous.recommended_retry_ms) / previous.recommended_retry_ms)
    if (percentChange > 0.05) {
      await logAdaptiveOptimizationEvent(
        supabase,
        channel,
        previous.recommended_retry_ms,
        recommendedRetryMs,
        failureRate,
        avgLatencyMs,
        confidenceScore
      )
    }
  } else {
    await logAdaptiveOptimizationEvent(
      supabase,
      channel,
      baseRetryMs,
      recommendedRetryMs,
      failureRate,
      avgLatencyMs,
      confidenceScore
    )
  }
}

/**
 * Calculate confidence score based on sample size and variance
 */
function calculateConfidenceScore(
  consideredCount: number,
  failureRate: number,
  avgLatencyMs: number,
  stddev: number | null
): number {
  if (consideredCount < 10) {
    let baseConfidence = 0.4
    if (failureRate < 0.05) baseConfidence += 0.1
    if (failureRate > 0.2) baseConfidence -= 0.1
    return Math.max(0, Math.min(1, baseConfidence))
  }

  if (consideredCount < 30) {
    let baseConfidence = 0.6
    if (failureRate < 0.05) baseConfidence += 0.1
    if (failureRate > 0.2) baseConfidence -= 0.1
    return Math.max(0, Math.min(1, baseConfidence))
  }

  const N = consideredCount
  const FR = failureRate
  const SE = N > 0 ? Math.sqrt(FR * (1 - FR) / N) : 0.5
  const CV = stddev !== null && avgLatencyMs > 0 ? stddev / (avgLatencyMs + 1) : 0.2
  
  const sizeFactor = Math.min(1, N / 30)
  const varPenalty = Math.max(0, Math.min(1, 1 - (CV + 2 * SE)))
  const confidence = 0.2 + 0.8 * sizeFactor * varPenalty

  return Math.max(0, Math.min(1, confidence))
}

/**
 * Log adaptive optimization event to fusion_optimization_events
 */
async function logAdaptiveOptimizationEvent(
  supabase: any,
  channel: string,
  previousRetryMs: number,
  newRetryMs: number,
  failureRate: number,
  avgLatencyMs: number,
  confidenceScore: number
): Promise<void> {
  const { error } = await supabase
    .from('fusion_optimization_events')
    .insert({
      source_event_type: 'adaptive_reliability',
      optimization_action: 'stabilize', // Required by CHECK constraint
      parameter_delta: {
        channel,
        previous_retry_ms: previousRetryMs,
        new_retry_ms: newRetryMs,
        failure_rate: failureRate,
        avg_latency_ms: avgLatencyMs,
        confidence_score: confidenceScore,
        percent_change: ((newRetryMs - previousRetryMs) / previousRetryMs * 100).toFixed(2)
      },
      efficiency_index: (1 - failureRate) * 100, // Higher is better
      predicted_stability: confidenceScore,
      predicted_variance: failureRate,
      applied: false
    })

  if (error) {
    console.error(`[Adaptive Reliability] Error logging event for ${channel}:`, error)
  } else {
    console.log(`[Adaptive Reliability] Logged optimization event for ${channel}: ${previousRetryMs}ms → ${newRetryMs}ms`)
  }
}
