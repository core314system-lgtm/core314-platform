
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { verifyAuth, checkRole, createUnauthorizedResponse, createForbiddenResponse, logAuditEvent } from '../_shared/auth.ts';
import { withSentry, breadcrumb, handleSentryTest } from "../_shared/sentry.ts";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface WorkflowMetric {
  stability_index: number;
  variance: number;
  created_at: string;
}

interface AlertRecord {
  severity: string;
  created_at: string;
}

interface OptimizationAction {
  source_event_type: string;
  predicted_variance: number;
  predicted_stability: number;
  optimization_action: 'pre_tune' | 'stabilize' | 'recalibrate';
  parameter_delta: Record<string, number>;
  efficiency_index: number;
}

const DEFAULT_PARAMS = {
  confidence_weight: 0.50,
  feedback_weight: 0.50,
  stability_threshold: 0.85,
};

/**
 * Compute 7-day rolling averages and trends
 */
async function compute7DayTrends() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  
  const { data: metrics, error: metricsError } = await supabase
    .from('adaptive_workflow_metrics')
    .select('stability_index, variance, created_at')
    .gte('created_at', sevenDaysAgo)
    .order('created_at', { ascending: false })
    .limit(1000);
  
  if (metricsError) {
    console.error('[POE] Error fetching workflow metrics:', metricsError);
    throw new Error(`Failed to fetch workflow metrics: ${metricsError.message}`);
  }
  
  const { data: alerts, error: alertsError } = await supabase
    .from('fusion_alerts')
    .select('severity, created_at')
    .gte('created_at', sevenDaysAgo)
    .order('created_at', { ascending: false });
  
  if (alertsError) {
    console.error('[POE] Error fetching alerts:', alertsError);
    throw new Error(`Failed to fetch alerts: ${alertsError.message}`);
  }
  
  const workflowMetrics = (metrics || []) as WorkflowMetric[];
  const alertRecords = (alerts || []) as AlertRecord[];
  
  const stabilityScores = workflowMetrics
    .filter(m => m.stability_index !== null)
    .map(m => m.stability_index);
  
  const variances = workflowMetrics
    .filter(m => m.variance !== null)
    .map(m => m.variance);
  
  const rolling_stability_avg = stabilityScores.length > 0
    ? stabilityScores.reduce((sum, val) => sum + val, 0) / stabilityScores.length
    : 0.85;
  
  const rolling_variance_avg = variances.length > 0
    ? variances.reduce((sum, val) => sum + val, 0) / variances.length
    : 0.05;
  
  const stability_min = stabilityScores.length > 0 ? Math.min(...stabilityScores) : 0.85;
  const stability_max = stabilityScores.length > 0 ? Math.max(...stabilityScores) : 0.85;
  const stability_oscillation = stability_max - stability_min;
  
  const hoursInPeriod = 7 * 24; // 7 days = 168 hours
  const alert_density = alertRecords.length / hoursInPeriod;
  
  const high_severity_alerts = alertRecords.filter(
    a => a.severity === 'high' || a.severity === 'critical'
  ).length;
  
  console.log('[POE] 7-Day Trends:', {
    rolling_stability_avg: rolling_stability_avg.toFixed(4),
    rolling_variance_avg: rolling_variance_avg.toFixed(4),
    stability_oscillation: stability_oscillation.toFixed(4),
    alert_density: alert_density.toFixed(2),
    high_severity_alerts,
    total_alerts: alertRecords.length,
    metrics_analyzed: workflowMetrics.length,
  });
  
  return {
    rolling_stability_avg,
    rolling_variance_avg,
    stability_oscillation,
    alert_density,
    high_severity_alerts,
    metrics_count: workflowMetrics.length,
    alerts_count: alertRecords.length,
  };
}

/**
 * Determine optimization action based on predictive triggers
 */
function determineOptimizationAction(trends: {
  rolling_stability_avg: number;
  rolling_variance_avg: number;
  stability_oscillation: number;
  alert_density: number;
  high_severity_alerts: number;
}): OptimizationAction | null {
  const {
    rolling_stability_avg,
    rolling_variance_avg,
    stability_oscillation,
    alert_density,
    high_severity_alerts,
  } = trends;
  
  let action: OptimizationAction | null = null;
  
  if (rolling_variance_avg > 0.10 && alert_density > 3) {
    console.log('[POE] Trigger: PRE_TUNE - High variance and alert density detected');
    action = {
      source_event_type: 'variance_trend',
      predicted_variance: rolling_variance_avg,
      predicted_stability: rolling_stability_avg,
      optimization_action: 'pre_tune',
      parameter_delta: {
        confidence_weight: +0.03,
        feedback_weight: -0.03,
      },
      efficiency_index: 0, // Will be calculated
    };
  }
  else if (rolling_stability_avg < 0.85 && alert_density < 3) {
    console.log('[POE] Trigger: STABILIZE - Low stability detected');
    action = {
      source_event_type: 'stability_decline',
      predicted_variance: rolling_variance_avg,
      predicted_stability: rolling_stability_avg,
      optimization_action: 'stabilize',
      parameter_delta: {
        feedback_weight: +0.02,
      },
      efficiency_index: 0, // Will be calculated
    };
  }
  else if (stability_oscillation > 0.15) {
    console.log('[POE] Trigger: RECALIBRATE - High stability oscillation detected');
    action = {
      source_event_type: 'oscillation_detected',
      predicted_variance: rolling_variance_avg,
      predicted_stability: rolling_stability_avg,
      optimization_action: 'recalibrate',
      parameter_delta: {
        confidence_weight: DEFAULT_PARAMS.confidence_weight,
        feedback_weight: DEFAULT_PARAMS.feedback_weight,
        stability_threshold: DEFAULT_PARAMS.stability_threshold,
      },
      efficiency_index: 0, // Will be calculated
    };
  }
  else if (high_severity_alerts > 5) {
    console.log('[POE] Trigger: PRE_TUNE - Multiple high-severity alerts detected');
    action = {
      source_event_type: 'high_severity_alerts',
      predicted_variance: rolling_variance_avg,
      predicted_stability: rolling_stability_avg,
      optimization_action: 'pre_tune',
      parameter_delta: {
        confidence_weight: +0.03,
        feedback_weight: -0.03,
      },
      efficiency_index: 0, // Will be calculated
    };
  }
  
  return action;
}

/**
 * Calculate Efficiency Index
 * Formula: EI = (stability_score * 100) - (variance * 100) - (alert_density * 10)
 * Higher is better. Range typically 0-100.
 */
function calculateEfficiencyIndex(
  stability: number,
  variance: number,
  alert_density: number
): number {
  const ei = (stability * 100) - (variance * 100) - (alert_density * 10);
  return Math.max(0, Math.min(100, ei)); // Clamp to 0-100 range
}

/**
 * Main optimization engine handler
 */
serve(withSentry(async (req) => {
  const testResponse = await handleSentryTest(req);
  if (testResponse) return testResponse;

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  try {
    const authHeader = req.headers.get('authorization');
    const authResult = await verifyAuth(authHeader, supabase);

    if (!authResult.success) {
      return createUnauthorizedResponse(authResult.error);
    }

    if (!checkRole(authResult.context, 'operator')) {
      return createForbiddenResponse('operator or platform_admin');
    }

    const { context } = authResult;
    
    console.log('[POE] Starting Proactive Optimization Engine analysis');
    
    const trends = await compute7DayTrends();
    
    const optimizationAction = determineOptimizationAction(trends);
    
    if (!optimizationAction) {
      console.log('[POE] No optimization needed - system is stable');
      
      const { data: adaptiveReliability } = await supabase
        .from('fusion_adaptive_reliability')
        .select('channel, recommended_retry_ms, confidence_score, failure_rate, avg_latency_ms')
        .order('channel');
      
      return new Response(
        JSON.stringify({
          status: 'success',
          message: 'No optimization needed',
          trends,
          optimization_recommended: false,
          adaptive_reliability: adaptiveReliability || [],
        }),
        { 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          } 
        }
      );
    }
    
    const efficiency_index = calculateEfficiencyIndex(
      trends.rolling_stability_avg,
      trends.rolling_variance_avg,
      trends.alert_density
    );
    
    optimizationAction.efficiency_index = efficiency_index;
    
    console.log('[POE] Optimization recommended:', {
      action: optimizationAction.optimization_action,
      efficiency_index: efficiency_index.toFixed(2),
      parameter_delta: optimizationAction.parameter_delta,
    });
    
    const { data: insertedEvent, error: insertError } = await supabase
      .from('fusion_optimization_events')
      .insert({
        source_event_type: optimizationAction.source_event_type,
        predicted_variance: optimizationAction.predicted_variance,
        predicted_stability: optimizationAction.predicted_stability,
        optimization_action: optimizationAction.optimization_action,
        parameter_delta: optimizationAction.parameter_delta,
        efficiency_index: optimizationAction.efficiency_index,
        applied: false,
      })
      .select()
      .single();
    
    if (insertError) {
      console.error('[POE] Error inserting optimization event:', insertError);
      throw new Error(`Failed to insert optimization event: ${insertError.message}`);
    }
    
    console.log('[POE] Optimization event created:', insertedEvent.id);
    
    await logAuditEvent(
      supabase,
      context,
      'Optimization Engine Triggered',
      `User ${context.userRole} triggered optimization engine. Action: ${optimizationAction.optimization_action}, Efficiency Index: ${efficiency_index.toFixed(1)}`,
      {
        optimization_id: insertedEvent.id,
        action: optimizationAction.optimization_action,
        efficiency_index,
        predicted_stability: optimizationAction.predicted_stability,
        predicted_variance: optimizationAction.predicted_variance,
      }
    );
    
    const { data: adaptiveReliability } = await supabase
      .from('fusion_adaptive_reliability')
      .select('channel, recommended_retry_ms, confidence_score, failure_rate, avg_latency_ms')
      .order('channel');
    
    return new Response(
      JSON.stringify({
        status: 'success',
        message: 'Optimization recommended',
        trends,
        optimization_recommended: true,
        optimization: {
          id: insertedEvent.id,
          action: optimizationAction.optimization_action,
          source_event_type: optimizationAction.source_event_type,
          parameter_delta: optimizationAction.parameter_delta,
          efficiency_index: optimizationAction.efficiency_index,
          predicted_stability: optimizationAction.predicted_stability,
          predicted_variance: optimizationAction.predicted_variance,
        },
        adaptive_reliability: adaptiveReliability || [],
      }),
      { 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        } 
      }
    );
    
  } catch (error) {
    console.error('[POE] Error:', error);
    return new Response(
      JSON.stringify({ 
        status: 'error', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        } 
      }
    );
  }
}), { name: "fusion-optimization-engine" }));