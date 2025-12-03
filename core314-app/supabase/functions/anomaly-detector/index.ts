
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { withSentry, breadcrumb, handleSentryTest, jsonError } from "../_shared/sentry.ts";


interface DetectorRequest {
  user_id: string;
  organization_id?: string;
  source_type?: string; // 'system_health_event', 'execution_log', 'decision_audit_log'
  source_id?: string;
  time_window_minutes?: number;
  auto_analyze?: boolean;
  use_gpt4o?: boolean;
}

interface AnomalySignal {
  anomaly_type: string;
  anomaly_category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence_score: number;
  source_type: string;
  source_id?: string;
  source_component_type?: string;
  source_component_name?: string;
  anomaly_description: string;
  anomaly_summary?: string;
  root_cause_analysis?: string;
  recommended_actions?: string[];
  baseline_value?: number;
  observed_value?: number;
  deviation_percentage?: number;
  threshold_exceeded?: string;
  pattern_type?: string;
  pattern_duration_seconds?: number;
  affected_users_count?: number;
  affected_components?: string[];
  business_impact?: string;
  detection_method: string;
  detection_algorithm?: string;
  gpt4o_prompt?: string;
  gpt4o_response?: string;
  gpt4o_model?: string;
  gpt4o_tokens_used?: number;
  gpt4o_analysis_duration_ms?: number;
  metadata?: Record<string, any>;
  tags?: string[];
}

interface DetectorResponse {
  success: boolean;
  anomalies_detected: number;
  anomaly_ids: string[];
  critical_anomalies: number;
  high_anomalies: number;
  gpt4o_analyses_performed: number;
  error?: string;
}


/**
 * Detect latency spike anomalies
 */
function detectLatencySpikes(
  healthEvents: any[],
  baselineLatency: number
): AnomalySignal[] {
  const anomalies: AnomalySignal[] = [];
  
  for (const event of healthEvents) {
    const latency = event.latency_ms || 0;
    const deviation = baselineLatency > 0 
      ? ((latency - baselineLatency) / baselineLatency) * 100 
      : 0;
    
    if (deviation > 100 || latency > 2000) {
      let severity: 'low' | 'medium' | 'high' | 'critical' = 'medium';
      if (latency > 5000 || deviation > 300) {
        severity = 'critical';
      } else if (latency > 3000 || deviation > 200) {
        severity = 'high';
      }
      
      anomalies.push({
        anomaly_type: 'latency_spike',
        anomaly_category: 'performance',
        severity,
        confidence_score: Math.min(95, 70 + (deviation / 10)),
        source_type: 'system_health_event',
        source_id: event.id,
        source_component_type: event.component_type,
        source_component_name: event.component_name,
        anomaly_description: `Latency spike detected: ${latency}ms (baseline: ${baselineLatency}ms, +${deviation.toFixed(1)}%)`,
        baseline_value: baselineLatency,
        observed_value: latency,
        deviation_percentage: deviation,
        threshold_exceeded: 'latency_threshold',
        pattern_type: 'sudden_spike',
        detection_method: 'statistical_analysis',
        detection_algorithm: 'threshold_comparison',
        affected_components: [event.component_name],
        business_impact: severity === 'critical' ? 'high' : severity === 'high' ? 'medium' : 'low',
        recommended_actions: [
          'investigate_recent_deployments',
          'check_resource_utilization',
          'review_database_queries',
          'scale_up_resources',
        ],
        metadata: {
          latency_p95: event.latency_p95_ms,
          latency_p99: event.latency_p99_ms,
          throughput: event.throughput_per_minute,
        },
        tags: ['latency', 'performance', 'automated_detection'],
      });
    }
  }
  
  return anomalies;
}

/**
 * Detect error rate increase anomalies
 */
function detectErrorRateIncrease(
  healthEvents: any[],
  baselineErrorRate: number
): AnomalySignal[] {
  const anomalies: AnomalySignal[] = [];
  
  for (const event of healthEvents) {
    const errorRate = event.error_rate || 0;
    const deviation = baselineErrorRate > 0 
      ? ((errorRate - baselineErrorRate) / baselineErrorRate) * 100 
      : errorRate > 0 ? 1000 : 0;
    
    if (deviation > 100 || errorRate > 5) {
      let severity: 'low' | 'medium' | 'high' | 'critical' = 'medium';
      if (errorRate > 20 || deviation > 500) {
        severity = 'critical';
      } else if (errorRate > 10 || deviation > 300) {
        severity = 'high';
      }
      
      anomalies.push({
        anomaly_type: 'error_rate_increase',
        anomaly_category: 'reliability',
        severity,
        confidence_score: Math.min(95, 75 + (deviation / 20)),
        source_type: 'system_health_event',
        source_id: event.id,
        source_component_type: event.component_type,
        source_component_name: event.component_name,
        anomaly_description: `Error rate increase detected: ${errorRate.toFixed(2)}% (baseline: ${baselineErrorRate.toFixed(2)}%, +${deviation.toFixed(1)}%)`,
        baseline_value: baselineErrorRate,
        observed_value: errorRate,
        deviation_percentage: deviation,
        threshold_exceeded: 'error_rate_threshold',
        pattern_type: 'gradual_increase',
        detection_method: 'statistical_analysis',
        detection_algorithm: 'threshold_comparison',
        affected_components: [event.component_name],
        business_impact: severity === 'critical' ? 'critical' : severity === 'high' ? 'high' : 'medium',
        recommended_actions: [
          'review_error_logs',
          'check_integration_health',
          'restart_affected_services',
          'rollback_recent_changes',
        ],
        metadata: {
          error_count: event.error_count,
          error_types: event.error_types,
          last_error: event.last_error_message,
        },
        tags: ['error_rate', 'reliability', 'automated_detection'],
      });
    }
  }
  
  return anomalies;
}

/**
 * Detect resource exhaustion anomalies
 */
function detectResourceExhaustion(healthEvents: any[]): AnomalySignal[] {
  const anomalies: AnomalySignal[] = [];
  
  for (const event of healthEvents) {
    const cpuUsage = event.cpu_usage_percent || 0;
    const memoryUsage = event.memory_usage_percent || 0;
    const diskUsage = event.disk_usage_percent || 0;
    
    if (cpuUsage > 80) {
      let severity: 'low' | 'medium' | 'high' | 'critical' = 'medium';
      if (cpuUsage > 95) severity = 'critical';
      else if (cpuUsage > 90) severity = 'high';
      
      anomalies.push({
        anomaly_type: 'resource_exhaustion',
        anomaly_category: 'capacity',
        severity,
        confidence_score: 90,
        source_type: 'system_health_event',
        source_id: event.id,
        source_component_type: event.component_type,
        source_component_name: event.component_name,
        anomaly_description: `CPU usage critical: ${cpuUsage.toFixed(1)}%`,
        observed_value: cpuUsage,
        threshold_exceeded: 'cpu_threshold_80',
        pattern_type: 'sustained_high',
        detection_method: 'rule_based',
        detection_algorithm: 'threshold_check',
        affected_components: [event.component_name],
        business_impact: severity === 'critical' ? 'critical' : 'high',
        recommended_actions: [
          'scale_up_resources',
          'optimize_cpu_intensive_operations',
          'investigate_runaway_processes',
        ],
        metadata: {
          cpu_usage_percent: cpuUsage,
          memory_usage_percent: memoryUsage,
          disk_usage_percent: diskUsage,
        },
        tags: ['cpu', 'resource_exhaustion', 'automated_detection'],
      });
    }
    
    if (memoryUsage > 85) {
      let severity: 'low' | 'medium' | 'high' | 'critical' = 'medium';
      if (memoryUsage > 95) severity = 'critical';
      else if (memoryUsage > 90) severity = 'high';
      
      anomalies.push({
        anomaly_type: 'resource_exhaustion',
        anomaly_category: 'capacity',
        severity,
        confidence_score: 90,
        source_type: 'system_health_event',
        source_id: event.id,
        source_component_type: event.component_type,
        source_component_name: event.component_name,
        anomaly_description: `Memory usage critical: ${memoryUsage.toFixed(1)}%`,
        observed_value: memoryUsage,
        threshold_exceeded: 'memory_threshold_85',
        pattern_type: 'sustained_high',
        detection_method: 'rule_based',
        detection_algorithm: 'threshold_check',
        affected_components: [event.component_name],
        business_impact: severity === 'critical' ? 'critical' : 'high',
        recommended_actions: [
          'scale_up_memory',
          'investigate_memory_leaks',
          'clear_caches',
          'restart_services',
        ],
        metadata: {
          memory_usage_mb: event.memory_usage_mb,
          memory_usage_percent: memoryUsage,
        },
        tags: ['memory', 'resource_exhaustion', 'automated_detection'],
      });
    }
  }
  
  return anomalies;
}

/**
 * Analyze anomaly with GPT-4o
 */
async function analyzeWithGPT4o(
  anomaly: AnomalySignal,
  healthEvents: any[]
): Promise<Partial<AnomalySignal>> {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey) {
    console.warn('OPENAI_API_KEY not configured, skipping GPT-4o analysis');
    return {};
  }

  const startTime = Date.now();
  
  const context = {
    anomaly_type: anomaly.anomaly_type,
    component: `${anomaly.source_component_type}:${anomaly.source_component_name}`,
    severity: anomaly.severity,
    description: anomaly.anomaly_description,
    metrics: {
      baseline: anomaly.baseline_value,
      observed: anomaly.observed_value,
      deviation: anomaly.deviation_percentage,
    },
    recent_events: healthEvents.slice(0, 5).map((e) => ({
      component: e.component_name,
      status: e.status,
      latency_ms: e.latency_ms,
      error_rate: e.error_rate,
      timestamp: e.created_at,
    })),
  };

  const prompt = `You are a system reliability expert analyzing an anomaly in the Core314 platform.

Anomaly Details:
${JSON.stringify(context, null, 2)}

Please provide:
1. A concise summary (2-3 sentences) of what's happening
2. Root cause analysis (most likely causes)
3. Recommended immediate actions (prioritized list)
4. Potential business impact

Format your response as JSON with keys: summary, root_cause, actions (array), business_impact`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a system reliability expert. Provide concise, actionable analysis.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      console.error('GPT-4o API error:', await response.text());
      return {};
    }

    const data = await response.json();
    const analysisText = data.choices[0]?.message?.content || '';
    
    let analysis: any = {};
    try {
      const jsonMatch = analysisText.match(/```json\n([\s\S]*?)\n```/) || 
                       analysisText.match(/```\n([\s\S]*?)\n```/);
      const jsonText = jsonMatch ? jsonMatch[1] : analysisText;
      analysis = JSON.parse(jsonText);
    } catch (e) {
      analysis = {
        summary: analysisText.substring(0, 200),
        root_cause: 'See full analysis in GPT-4o response',
        actions: ['Review GPT-4o analysis'],
        business_impact: 'Unknown',
      };
    }

    const duration = Date.now() - startTime;

    return {
      anomaly_summary: analysis.summary,
      root_cause_analysis: analysis.root_cause,
      recommended_actions: analysis.actions || anomaly.recommended_actions,
      business_impact: analysis.business_impact?.toLowerCase() || anomaly.business_impact,
      gpt4o_prompt: prompt,
      gpt4o_response: analysisText,
      gpt4o_model: 'gpt-4o',
      gpt4o_tokens_used: data.usage?.total_tokens || 0,
      gpt4o_analysis_duration_ms: duration,
      detection_method: 'gpt4o_analysis',
    };
  } catch (error) {
    console.error('GPT-4o analysis failed:', error);
    return {};
  }
}

/**
 * Store anomaly signals in database
 */
async function storeAnomalySignals(
  supabase: any,
  userId: string,
  organizationId: string | undefined,
  anomalies: AnomalySignal[]
): Promise<string[]> {
  const createdIds: string[] = [];

  for (const anomaly of anomalies) {
    const { data, error } = await supabase
      .from('anomaly_signals')
      .insert({
        user_id: userId,
        organization_id: organizationId,
        detection_timestamp: new Date().toISOString(),
        ...anomaly,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Failed to store anomaly signal:', error);
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
    const body: DetectorRequest = await req.json();
    const {
      user_id,
      organization_id,
      source_type,
      source_id,
      time_window_minutes = 15,
      auto_analyze = true,
      use_gpt4o = true,
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

    const windowStart = new Date(Date.now() - time_window_minutes * 60 * 1000).toISOString();
    const { data: healthEvents, error: healthError } = await supabase
      .from('system_health_events')
      .select('*')
      .eq('user_id', user_id)
      .gte('created_at', windowStart)
      .order('created_at', { ascending: false });

    if (healthError) {
      throw new Error(`Failed to fetch health events: ${healthError.message}`);
    }

    if (!healthEvents || healthEvents.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          anomalies_detected: 0,
          anomaly_ids: [],
          critical_anomalies: 0,
          high_anomalies: 0,
          gpt4o_analyses_performed: 0,
        }),
        { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    const avgLatency = healthEvents.reduce((sum, e) => sum + (e.latency_ms || 0), 0) / healthEvents.length;
    const avgErrorRate = healthEvents.reduce((sum, e) => sum + (e.error_rate || 0), 0) / healthEvents.length;

    let allAnomalies: AnomalySignal[] = [];
    
    if (auto_analyze) {
      const latencyAnomalies = detectLatencySpikes(healthEvents, avgLatency);
      const errorRateAnomalies = detectErrorRateIncrease(healthEvents, avgErrorRate);
      const resourceAnomalies = detectResourceExhaustion(healthEvents);
      
      allAnomalies = [...latencyAnomalies, ...errorRateAnomalies, ...resourceAnomalies];
    }

    let gpt4oAnalysesPerformed = 0;
    if (use_gpt4o && allAnomalies.length > 0) {
      const topAnomalies = allAnomalies
        .sort((a, b) => {
          const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
          return severityOrder[b.severity] - severityOrder[a.severity];
        })
        .slice(0, 3);

      for (const anomaly of topAnomalies) {
        const gpt4oAnalysis = await analyzeWithGPT4o(anomaly, healthEvents);
        Object.assign(anomaly, gpt4oAnalysis);
        if (gpt4oAnalysis.gpt4o_response) {
          gpt4oAnalysesPerformed++;
        }
      }
    }

    const createdIds = await storeAnomalySignals(supabase, user_id, organization_id, allAnomalies);

    const criticalCount = allAnomalies.filter((a) => a.severity === 'critical').length;
    const highCount = allAnomalies.filter((a) => a.severity === 'high').length;

    await supabase.from('decision_audit_log').insert({
      user_id,
      organization_id,
      event_type: 'anomaly_detection',
      event_category: 'monitoring',
      event_description: `Anomaly detection identified ${allAnomalies.length} anomalies`,
      event_metadata: {
        anomalies_detected: allAnomalies.length,
        critical_anomalies: criticalCount,
        high_anomalies: highCount,
        gpt4o_analyses: gpt4oAnalysesPerformed,
        time_window_minutes,
      },
      severity: criticalCount > 0 ? 'high' : highCount > 0 ? 'medium' : 'low',
    });

    const response: DetectorResponse = {
      success: true,
      anomalies_detected: allAnomalies.length,
      anomaly_ids: createdIds,
      critical_anomalies: criticalCount,
      high_anomalies: highCount,
      gpt4o_analyses_performed: gpt4oAnalysesPerformed,
    };

    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (error) {
    console.error('Error in anomaly-detector:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  }
}), { name: "anomaly-detector" }));