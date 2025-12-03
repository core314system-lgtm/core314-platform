
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { withSentry, breadcrumb, handleSentryTest, jsonError } from "../_shared/sentry.ts";


interface HealthMetrics {
  component_type: string;
  component_name: string;
  component_version?: string;
  environment?: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'critical' | 'unknown';
  uptime_percentage?: number;
  availability_percentage?: number;
  latency_ms?: number;
  latency_p50_ms?: number;
  latency_p95_ms?: number;
  latency_p99_ms?: number;
  throughput_per_minute?: number;
  error_count?: number;
  error_rate?: number;
  error_types?: Record<string, number>;
  last_error_message?: string;
  last_error_timestamp?: string;
  cpu_usage_percent?: number;
  memory_usage_mb?: number;
  memory_usage_percent?: number;
  disk_usage_mb?: number;
  disk_usage_percent?: number;
  network_in_mbps?: number;
  network_out_mbps?: number;
  db_connection_count?: number;
  db_query_count?: number;
  db_slow_query_count?: number;
  db_deadlock_count?: number;
  db_cache_hit_rate?: number;
  integration_name?: string;
  integration_success_rate?: number;
  integration_retry_count?: number;
  integration_timeout_count?: number;
  measurement_window_start: string;
  measurement_window_end: string;
  measurement_window_seconds: number;
  metadata?: Record<string, any>;
  tags?: string[];
}

interface MonitorRequest {
  user_id: string;
  organization_id?: string;
  metrics?: HealthMetrics[];
  component_type?: string;
  component_name?: string;
  auto_collect?: boolean;
}

interface MonitorResponse {
  success: boolean;
  metrics_collected: number;
  health_events_created: string[];
  overall_status: string;
  unhealthy_components: string[];
  error?: string;
}


/**
 * Collect metrics from Edge Functions
 */
async function collectEdgeFunctionMetrics(
  supabase: any,
  userId: string,
  windowSeconds: number = 300
): Promise<HealthMetrics[]> {
  const metrics: HealthMetrics[] = [];
  const windowStart = new Date(Date.now() - windowSeconds * 1000).toISOString();
  const windowEnd = new Date().toISOString();

  const { data: execLogs, error } = await supabase
    .from('execution_log')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', windowStart)
    .lte('created_at', windowEnd);

  if (error) {
    console.error('Failed to fetch execution logs:', error);
    return metrics;
  }

  const functionGroups = new Map<string, any[]>();
  for (const log of execLogs || []) {
    const funcName = log.action_type || 'unknown';
    if (!functionGroups.has(funcName)) {
      functionGroups.set(funcName, []);
    }
    functionGroups.get(funcName)!.push(log);
  }

  for (const [funcName, logs] of functionGroups) {
    const totalLogs = logs.length;
    const successLogs = logs.filter((l) => l.success === true);
    const failedLogs = logs.filter((l) => l.success === false);
    const latencies = logs.map((l) => l.execution_duration_ms || 0).filter((l) => l > 0);
    
    const avgLatency = latencies.length > 0 
      ? latencies.reduce((a, b) => a + b, 0) / latencies.length 
      : 0;
    
    const sortedLatencies = [...latencies].sort((a, b) => a - b);
    const p50 = sortedLatencies[Math.floor(sortedLatencies.length * 0.5)] || 0;
    const p95 = sortedLatencies[Math.floor(sortedLatencies.length * 0.95)] || 0;
    const p99 = sortedLatencies[Math.floor(sortedLatencies.length * 0.99)] || 0;
    
    const errorRate = totalLogs > 0 ? (failedLogs.length / totalLogs) * 100 : 0;
    const availability = totalLogs > 0 ? (successLogs.length / totalLogs) * 100 : 100;
    
    let status: 'healthy' | 'degraded' | 'unhealthy' | 'critical' = 'healthy';
    if (errorRate > 20 || availability < 80) {
      status = 'critical';
    } else if (errorRate > 10 || availability < 90) {
      status = 'unhealthy';
    } else if (errorRate > 5 || availability < 95) {
      status = 'degraded';
    }

    metrics.push({
      component_type: 'edge_function',
      component_name: funcName,
      environment: 'production',
      status,
      availability_percentage: availability,
      latency_ms: Math.round(avgLatency),
      latency_p50_ms: Math.round(p50),
      latency_p95_ms: Math.round(p95),
      latency_p99_ms: Math.round(p99),
      throughput_per_minute: Math.round((totalLogs / windowSeconds) * 60),
      error_count: failedLogs.length,
      error_rate: errorRate,
      error_types: failedLogs.reduce((acc: Record<string, number>, log) => {
        const errorCode = log.execution_error_code || 'unknown';
        acc[errorCode] = (acc[errorCode] || 0) + 1;
        return acc;
      }, {}),
      last_error_message: failedLogs[failedLogs.length - 1]?.execution_error,
      last_error_timestamp: failedLogs[failedLogs.length - 1]?.created_at,
      measurement_window_start: windowStart,
      measurement_window_end: windowEnd,
      measurement_window_seconds: windowSeconds,
      metadata: {
        total_executions: totalLogs,
        successful_executions: successLogs.length,
        failed_executions: failedLogs.length,
      },
      tags: ['edge_function', 'automated_collection'],
    });
  }

  return metrics;
}

/**
 * Collect metrics from database queries
 */
async function collectDatabaseMetrics(
  supabase: any,
  userId: string,
  windowSeconds: number = 300
): Promise<HealthMetrics[]> {
  const metrics: HealthMetrics[] = [];
  const windowStart = new Date(Date.now() - windowSeconds * 1000).toISOString();
  const windowEnd = new Date().toISOString();

  const { data: dbLogs, error } = await supabase
    .from('execution_log')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', windowStart)
    .lte('created_at', windowEnd)
    .not('action_type', 'is', null);

  if (error) {
    console.error('Failed to fetch database logs:', error);
    return metrics;
  }

  const totalQueries = dbLogs?.length || 0;
  const slowQueries = dbLogs?.filter((l) => (l.execution_duration_ms || 0) > 1000) || [];
  const failedQueries = dbLogs?.filter((l) => l.success === false) || [];
  
  const avgQueryTime = totalQueries > 0
    ? dbLogs!.reduce((sum, l) => sum + (l.execution_duration_ms || 0), 0) / totalQueries
    : 0;

  let status: 'healthy' | 'degraded' | 'unhealthy' | 'critical' = 'healthy';
  const slowQueryRate = totalQueries > 0 ? (slowQueries.length / totalQueries) * 100 : 0;
  const errorRate = totalQueries > 0 ? (failedQueries.length / totalQueries) * 100 : 0;
  
  if (slowQueryRate > 20 || errorRate > 10) {
    status = 'critical';
  } else if (slowQueryRate > 10 || errorRate > 5) {
    status = 'unhealthy';
  } else if (slowQueryRate > 5 || errorRate > 2) {
    status = 'degraded';
  }

  metrics.push({
    component_type: 'database_query',
    component_name: 'supabase_postgres',
    environment: 'production',
    status,
    latency_ms: Math.round(avgQueryTime),
    throughput_per_minute: Math.round((totalQueries / windowSeconds) * 60),
    error_count: failedQueries.length,
    error_rate: errorRate,
    db_query_count: totalQueries,
    db_slow_query_count: slowQueries.length,
    measurement_window_start: windowStart,
    measurement_window_end: windowEnd,
    measurement_window_seconds: windowSeconds,
    metadata: {
      avg_query_time_ms: avgQueryTime,
      slow_query_threshold_ms: 1000,
      slow_query_rate: slowQueryRate,
    },
    tags: ['database', 'automated_collection'],
  });

  return metrics;
}

/**
 * Collect metrics from integrations
 */
async function collectIntegrationMetrics(
  supabase: any,
  userId: string,
  windowSeconds: number = 300
): Promise<HealthMetrics[]> {
  const metrics: HealthMetrics[] = [];
  const windowStart = new Date(Date.now() - windowSeconds * 1000).toISOString();
  const windowEnd = new Date().toISOString();

  const { data: integrationLogs, error } = await supabase
    .from('execution_log')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', windowStart)
    .lte('created_at', windowEnd)
    .not('integration_name', 'is', null);

  if (error) {
    console.error('Failed to fetch integration logs:', error);
    return metrics;
  }

  const integrationGroups = new Map<string, any[]>();
  for (const log of integrationLogs || []) {
    const intName = log.integration_name || 'unknown';
    if (!integrationGroups.has(intName)) {
      integrationGroups.set(intName, []);
    }
    integrationGroups.get(intName)!.push(log);
  }

  for (const [intName, logs] of integrationGroups) {
    const totalCalls = logs.length;
    const successCalls = logs.filter((l) => l.success === true);
    const failedCalls = logs.filter((l) => l.success === false);
    const timeouts = logs.filter((l) => l.execution_error_code === 'timeout');
    
    const successRate = totalCalls > 0 ? (successCalls.length / totalCalls) * 100 : 100;
    const errorRate = totalCalls > 0 ? (failedCalls.length / totalCalls) * 100 : 0;
    
    let status: 'healthy' | 'degraded' | 'unhealthy' | 'critical' = 'healthy';
    if (successRate < 80) {
      status = 'critical';
    } else if (successRate < 90) {
      status = 'unhealthy';
    } else if (successRate < 95) {
      status = 'degraded';
    }

    metrics.push({
      component_type: 'integration',
      component_name: intName,
      environment: 'production',
      status,
      availability_percentage: successRate,
      error_count: failedCalls.length,
      error_rate: errorRate,
      integration_name: intName,
      integration_success_rate: successRate,
      integration_retry_count: 0, // TODO: Track retries
      integration_timeout_count: timeouts.length,
      measurement_window_start: windowStart,
      measurement_window_end: windowEnd,
      measurement_window_seconds: windowSeconds,
      metadata: {
        total_calls: totalCalls,
        successful_calls: successCalls.length,
        failed_calls: failedCalls.length,
        timeout_calls: timeouts.length,
      },
      tags: ['integration', 'automated_collection'],
    });
  }

  return metrics;
}

/**
 * Store health metrics in database
 */
async function storeHealthMetrics(
  supabase: any,
  userId: string,
  organizationId: string | undefined,
  metrics: HealthMetrics[]
): Promise<string[]> {
  const createdIds: string[] = [];

  for (const metric of metrics) {
    const { data, error } = await supabase
      .from('system_health_events')
      .insert({
        user_id: userId,
        organization_id: organizationId,
        ...metric,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Failed to store health metric:', error);
      continue;
    }

    if (data) {
      createdIds.push(data.id);
    }
  }

  return createdIds;
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
    const body: MonitorRequest = await req.json();
    const { user_id, organization_id, metrics, component_type, component_name, auto_collect = true } = body;

    if (!user_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'user_id is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let allMetrics: HealthMetrics[] = [];

    if (metrics && metrics.length > 0) {
      allMetrics = metrics;
    } else if (auto_collect) {
      const edgeFunctionMetrics = await collectEdgeFunctionMetrics(supabase, user_id);
      const databaseMetrics = await collectDatabaseMetrics(supabase, user_id);
      const integrationMetrics = await collectIntegrationMetrics(supabase, user_id);
      
      allMetrics = [...edgeFunctionMetrics, ...databaseMetrics, ...integrationMetrics];
    }

    if (component_type) {
      allMetrics = allMetrics.filter((m) => m.component_type === component_type);
    }
    if (component_name) {
      allMetrics = allMetrics.filter((m) => m.component_name === component_name);
    }

    const createdIds = await storeHealthMetrics(supabase, user_id, organization_id, allMetrics);

    const unhealthyComponents = allMetrics
      .filter((m) => m.status !== 'healthy')
      .map((m) => `${m.component_type}:${m.component_name}`);
    
    const criticalCount = allMetrics.filter((m) => m.status === 'critical').length;
    const unhealthyCount = allMetrics.filter((m) => m.status === 'unhealthy').length;
    const degradedCount = allMetrics.filter((m) => m.status === 'degraded').length;
    
    let overallStatus = 'healthy';
    if (criticalCount > 0) {
      overallStatus = 'critical';
    } else if (unhealthyCount > 0) {
      overallStatus = 'unhealthy';
    } else if (degradedCount > 0) {
      overallStatus = 'degraded';
    }

    await supabase.from('decision_audit_log').insert({
      user_id,
      organization_id,
      event_type: 'system_health_check',
      event_category: 'monitoring',
      event_description: `System health monitoring collected ${allMetrics.length} metrics`,
      event_metadata: {
        metrics_collected: allMetrics.length,
        overall_status: overallStatus,
        unhealthy_components: unhealthyComponents,
        critical_count: criticalCount,
        unhealthy_count: unhealthyCount,
        degraded_count: degradedCount,
      },
      severity: overallStatus === 'critical' ? 'high' : overallStatus === 'unhealthy' ? 'medium' : 'low',
    });

    const response: MonitorResponse = {
      success: true,
      metrics_collected: allMetrics.length,
      health_events_created: createdIds,
      overall_status: overallStatus,
      unhealthy_components,
    };

    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (error) {
    console.error('Error in monitor-system-health:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  }
}), { name: "monitor-system-health" }));