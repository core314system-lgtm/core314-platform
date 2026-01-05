import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { corsHeaders } from '../_shared/cors.ts';
import { verifyAndAuthorizeWithPolicy } from '../_shared/auth.ts';
import { withSentry, breadcrumb, handleSentryTest, jsonError } from "../_shared/sentry.ts";

interface ConnectedIntegration {
  id: string;
  name: string;
  fusion_score: number | null;
  trend: string;
  metrics_tracked: string[];
  data_status: 'active' | 'no_data';
}

interface DataContext {
  global_fusion_score: number;
  connected_integrations: ConnectedIntegration[];
  top_deficiencies: Array<{
    integration: string;
    score: number;
    issue: string;
  }>;
  system_health: string;
  anomalies_today: number;
  recent_alerts: Array<{
    type: string;
    message: string;
    timestamp: string;
  }>;
  integration_performance: Array<{
    name: string;
    status: string;
    efficiency: number;
  }>;
  recent_optimizations: number;
  last_analysis_timestamp: string | null;
}

interface DataContextResponse {
  success: boolean;
  data?: DataContext;
  error?: string;
}

Deno.serve(withSentry(async (req) => {
  const testResponse = await handleSentryTest(req);
  if (testResponse) return testResponse;

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authResult = await verifyAndAuthorizeWithPolicy(
      req,
      supabase,
      ['platform_admin', 'operator', 'admin', 'manager'],
      'ai_data_context'
    );

    if (!authResult.ok) {
      return authResult.response;
    }

    const userId = authResult.context.userId;
    const orgId = authResult.context.orgId;

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', userId)
      .single();

    const userOrgId = profile?.organization_id || orgId;

    // Fetch user's ACTUAL connected integrations (same source as Dashboard)
    const { data: userIntegrations } = await supabase
      .from('user_integrations')
      .select(`
        id,
        integration_id,
        integrations_master (id, integration_name)
      `)
      .eq('user_id', userId)
      .eq('status', 'active')
      .eq('added_by_user', true);

    // Fetch fusion scores for user's integrations
    const { data: fusionScores } = await supabase
      .from('fusion_scores')
      .select('integration_id, fusion_score, trend_direction, updated_at')
      .eq('user_id', userId);

    const scoreMap = new Map<string, { fusion_score: number; trend_direction: string; updated_at: string }>();
    fusionScores?.forEach(s => scoreMap.set(s.integration_id, {
      fusion_score: s.fusion_score,
      trend_direction: s.trend_direction || 'stable',
      updated_at: s.updated_at,
    }));

    // Fetch distinct metric names per integration for the user
    const { data: userMetrics } = await supabase
      .from('fusion_metrics')
      .select('integration_id, metric_name')
      .eq('user_id', userId);

    const metricsMap = new Map<string, Set<string>>();
    userMetrics?.forEach(m => {
      if (!metricsMap.has(m.integration_id)) {
        metricsMap.set(m.integration_id, new Set());
      }
      metricsMap.get(m.integration_id)!.add(m.metric_name);
    });

    // Build connected integrations array
    const connectedIntegrations: ConnectedIntegration[] = (userIntegrations || []).map(ui => {
      const master = ui.integrations_master as { id: string; integration_name: string } | null;
      if (!master) return null;
      const scoreData = scoreMap.get(ui.integration_id);
      const metricNames = metricsMap.get(ui.integration_id);
      return {
        id: ui.integration_id,
        name: master.integration_name,
        fusion_score: scoreData?.fusion_score ?? null,
        trend: scoreData?.trend_direction || 'stable',
        metrics_tracked: metricNames ? Array.from(metricNames) : [],
        data_status: (metricNames && metricNames.size > 0) ? 'active' as const : 'no_data' as const,
      };
    }).filter((i): i is ConnectedIntegration => i !== null);

    // Calculate global fusion score from user's integrations (same as Dashboard)
    const validScores = connectedIntegrations.filter(i => i.fusion_score !== null);
    const globalFusionScore = validScores.length > 0
      ? validScores.reduce((sum, i) => sum + (i.fusion_score || 0), 0) / validScores.length
      : 0;

    // Get last analysis timestamp from most recent fusion_scores update
    const lastAnalysisTimestamp = fusionScores && fusionScores.length > 0
      ? fusionScores.reduce((latest, s) => s.updated_at > latest ? s.updated_at : latest, fusionScores[0].updated_at)
      : null;

    const { data: integrations } = await supabase
      .from('integration_performance')
      .select('integration_name, performance_score, status, error_count')
      .eq('organization_id', userOrgId)
      .order('performance_score', { ascending: true })
      .limit(5);

    const topDeficiencies = (integrations || []).map((int) => ({
      integration: int.integration_name,
      score: int.performance_score,
      issue: int.error_count > 0 ? `${int.error_count} errors detected` : 'Low performance',
    }));

    let systemHealth = 'Healthy';
    if (globalFusionScore < 50) {
      systemHealth = 'Critical';
    } else if (globalFusionScore < 70) {
      systemHealth = 'Degraded';
    } else if (globalFusionScore < 85) {
      systemHealth = 'Fair';
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { count: anomalyCount } = await supabase
      .from('audit_logs')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', userOrgId)
      .eq('event_type', 'anomaly_detected')
      .gte('created_at', today.toISOString());

    const { data: alerts } = await supabase
      .from('audit_logs')
      .select('event_type, details, created_at')
      .eq('organization_id', userOrgId)
      .in('event_type', ['alert', 'warning', 'critical_event'])
      .order('created_at', { ascending: false })
      .limit(5);

    const recentAlerts = (alerts || []).map((alert) => ({
      type: alert.event_type,
      message: typeof alert.details === 'string' ? alert.details : JSON.stringify(alert.details),
      timestamp: alert.created_at,
    }));

    const { data: allIntegrations } = await supabase
      .from('integration_performance')
      .select('integration_name, status, performance_score')
      .eq('organization_id', userOrgId)
      .order('performance_score', { ascending: false })
      .limit(10);

    const integrationPerformance = (allIntegrations || []).map((int) => ({
      name: int.integration_name,
      status: int.status,
      efficiency: int.performance_score,
    }));

    const { count: optimizationCount } = await supabase
      .from('fusion_optimization_events')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', userOrgId)
      .gte('created_at', today.toISOString());

    const dataContext: DataContext = {
      global_fusion_score: globalFusionScore,
      connected_integrations: connectedIntegrations,
      top_deficiencies: topDeficiencies,
      system_health: systemHealth,
      anomalies_today: anomalyCount || 0,
      recent_alerts: recentAlerts,
      integration_performance: integrationPerformance,
      recent_optimizations: optimizationCount || 0,
      last_analysis_timestamp: lastAnalysisTimestamp,
    };

    const response: DataContextResponse = {
      success: true,
      data: dataContext,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Unexpected error in ai_data_context:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}, { name: "ai_data_context" }));
