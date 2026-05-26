import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { corsHeaders } from '../_shared/cors.ts';
import { verifyAndAuthorizeWithPolicy } from '../_shared/auth.ts';
import { withSentry, breadcrumb, handleSentryTest, jsonError } from "../_shared/sentry.ts";

// Intelligence Contract v1.1 - Data Status (legacy alias: data_status)
// active: Has recent metrics (within 14 days)
// emerging/stabilizing: Connected recently (<7 days) OR has some data but still stabilizing
// dormant: Connected but no recent activity (>30 days)
type DataStatus = 'active' | 'emerging' | 'dormant';

// Intelligence Contract v1.1 - Metrics State (v1.1 preferred name)
// Maps to DataStatus but uses v1.1 terminology
type MetricsState = 'active' | 'stabilizing' | 'dormant';

// Intelligence Contract v1.1 - Confidence Level
// high: Has fusion_score AND 2+ metrics AND recent data
// medium: Has fusion_score OR has metrics
// low: Connected but minimal data
type ConfidenceLevel = 'high' | 'medium' | 'low';

// Intelligence Contract v1.1 - Scoring Confidence (snapshot-level)
// Aggregated from per-integration confidence levels
type ScoringConfidence = 'high' | 'medium' | 'low';

interface ConnectedIntegration {
  id: string;
  name: string;
  fusion_score: number | null;
  trend: string;
  metrics_tracked: string[];
  data_status: DataStatus;
  confidence_level: ConfidenceLevel;
  last_data_at: string | null;
  connected_at: string | null;
  contribution_to_global: number; // Percentage contribution to global fusion score
  // Intelligence Contract v1.1 - Additional fields
  integration_key: string; // Unique identifier for the integration
  display_name: string; // Human-readable name
  connection_status: 'connected' | 'disconnected'; // Connection state (always 'connected' for active integrations)
  metrics_state: MetricsState; // v1.1 preferred name for data_status
  contributes_to_global_score: boolean; // Whether this integration has a score that contributes to global
  last_activity_timestamp: string | null; // Most recent activity timestamp
}

// Intelligence Contract v1.1 - System Intelligence Snapshot
// This is the authoritative data structure used by:
// - Global dashboard AI
// - Integration dashboard AI (filtered)
// - Fusion score computation
// RULE: Integration EXISTENCE is a FACT. Metric AVAILABILITY is a STATE. Never conflate.
interface SystemIntelligenceSnapshot {
  user_id: string;
  connected_integrations: ConnectedIntegration[];
  global_fusion_score: number;
  global_fusion_score_trend: string;
  total_integrations: number;
  active_integrations: number;
  emerging_integrations: number;
  dormant_integrations: number;
  last_analysis_timestamp: string | null;
  // Intelligence Contract v1.1 - Additional fields
  scoring_confidence: ScoringConfidence; // Aggregated confidence level for the snapshot
  system_reasoning: string; // Machine-readable explanation of current state (not AI prose)
}

interface DataContext {
  // Primary: System Intelligence Snapshot (AUTHORITATIVE)
  intelligence_snapshot: SystemIntelligenceSnapshot;
  // Legacy fields for backward compatibility
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
    // Include date_added for determining emerging vs dormant status
    const { data: userIntegrations } = await supabase
      .from('user_integrations')
      .select(`
        id,
        integration_id,
        date_added,
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

    // Fetch distinct metric names per integration for the user, with most recent synced_at
    const { data: userMetrics } = await supabase
      .from('fusion_metrics')
      .select('integration_id, metric_name, synced_at')
      .eq('user_id', userId);

    const metricsMap = new Map<string, { names: Set<string>; lastSyncedAt: string | null }>();
    userMetrics?.forEach(m => {
      if (!metricsMap.has(m.integration_id)) {
        metricsMap.set(m.integration_id, { names: new Set(), lastSyncedAt: null });
      }
      const entry = metricsMap.get(m.integration_id)!;
      entry.names.add(m.metric_name);
      if (m.synced_at && (!entry.lastSyncedAt || m.synced_at > entry.lastSyncedAt)) {
        entry.lastSyncedAt = m.synced_at;
      }
    });

    // Intelligence Contract v1.0 - Helper functions for data_status and confidence_level
    const now = new Date();
    const ACTIVE_THRESHOLD_DAYS = 14;
    const EMERGING_THRESHOLD_DAYS = 7;
    const DORMANT_THRESHOLD_DAYS = 30;

    function computeDataStatus(
      connectedAt: string | null,
      lastDataAt: string | null,
      hasMetrics: boolean
    ): DataStatus {
      const connectedDate = connectedAt ? new Date(connectedAt) : null;
      const lastDataDate = lastDataAt ? new Date(lastDataAt) : null;
      
      // If connected recently (< 7 days), it's emerging
      if (connectedDate) {
        const daysSinceConnected = (now.getTime() - connectedDate.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceConnected < EMERGING_THRESHOLD_DAYS) {
          return 'emerging';
        }
      }
      
      // If has recent data (< 14 days), it's active
      if (lastDataDate) {
        const daysSinceData = (now.getTime() - lastDataDate.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceData < ACTIVE_THRESHOLD_DAYS) {
          return 'active';
        }
        // If no data for > 30 days, it's dormant
        if (daysSinceData > DORMANT_THRESHOLD_DAYS) {
          return 'dormant';
        }
      }
      
      // If has metrics but not recent, it's emerging (stabilizing)
      if (hasMetrics) {
        return 'emerging';
      }
      
      // No metrics at all - dormant
      return 'dormant';
    }

    function computeConfidenceLevel(
      fusionScore: number | null,
      metricsCount: number,
      lastDataAt: string | null
    ): ConfidenceLevel {
      const hasScore = fusionScore !== null;
      const hasMultipleMetrics = metricsCount >= 2;
      const lastDataDate = lastDataAt ? new Date(lastDataAt) : null;
      const hasRecentData = lastDataDate && 
        (now.getTime() - lastDataDate.getTime()) / (1000 * 60 * 60 * 24) < ACTIVE_THRESHOLD_DAYS;
      
      // High: Has fusion_score AND 2+ metrics AND recent data
      if (hasScore && hasMultipleMetrics && hasRecentData) {
        return 'high';
      }
      
      // Medium: Has fusion_score OR has metrics
      if (hasScore || metricsCount > 0) {
        return 'medium';
      }
      
      // Low: Connected but minimal data
      return 'low';
    }

    // Helper function to convert data_status to metrics_state (v1.1 terminology)
    function dataStatusToMetricsState(dataStatus: DataStatus): MetricsState {
      // 'emerging' in v1.0 maps to 'stabilizing' in v1.1
      return dataStatus === 'emerging' ? 'stabilizing' : dataStatus;
    }

    // Build connected integrations array with Intelligence Contract v1.1 fields
    const connectedIntegrations: ConnectedIntegration[] = (userIntegrations || []).map(ui => {
      const master = ui.integrations_master as { id: string; integration_name: string } | null;
      if (!master) return null;
      
      const scoreData = scoreMap.get(ui.integration_id);
      const metricsData = metricsMap.get(ui.integration_id);
      const metricNames = metricsData?.names ? Array.from(metricsData.names) : [];
      const lastMetricSync = metricsData?.lastSyncedAt || null;
      const lastScoreUpdate = scoreData?.updated_at || null;
      const lastDataAt = lastMetricSync && lastScoreUpdate 
        ? (lastMetricSync > lastScoreUpdate ? lastMetricSync : lastScoreUpdate)
        : (lastMetricSync || lastScoreUpdate);
      const connectedAt = ui.date_added || null;
      const dataStatus = computeDataStatus(connectedAt, lastDataAt, metricNames.length > 0);
      const hasScore = scoreData?.fusion_score !== null && scoreData?.fusion_score !== undefined;
      
      return {
        id: ui.integration_id,
        name: master.integration_name,
        fusion_score: scoreData?.fusion_score ?? null,
        trend: scoreData?.trend_direction || 'stable',
        metrics_tracked: metricNames,
        data_status: dataStatus,
        confidence_level: computeConfidenceLevel(scoreData?.fusion_score ?? null, metricNames.length, lastDataAt),
        last_data_at: lastDataAt,
        connected_at: connectedAt,
        contribution_to_global: 0, // Will be calculated after global score is computed
        // Intelligence Contract v1.1 - Additional fields
        integration_key: ui.integration_id,
        display_name: master.integration_name,
        connection_status: 'connected' as const, // All rows from user_integrations with status='active' are connected
        metrics_state: dataStatusToMetricsState(dataStatus),
        contributes_to_global_score: hasScore, // Only integrations with scores contribute
        last_activity_timestamp: lastDataAt, // Most recent activity timestamp
      };
    }).filter((i): i is ConnectedIntegration => i !== null);

    // Calculate global fusion score from user's integrations (same as Dashboard)
    const validScores = connectedIntegrations.filter(i => i.fusion_score !== null);
    const globalFusionScore = validScores.length > 0
      ? validScores.reduce((sum, i) => sum + (i.fusion_score || 0), 0) / validScores.length
      : 0;

    // Calculate contribution_to_global for each integration
    if (validScores.length > 0) {
      const totalScore = validScores.reduce((sum, i) => sum + (i.fusion_score || 0), 0);
      connectedIntegrations.forEach(i => {
        if (i.fusion_score !== null && totalScore > 0) {
          i.contribution_to_global = Math.round((i.fusion_score / totalScore) * 100);
        }
      });
    }

    // Determine global trend from individual trends
    const trendCounts = { improving: 0, stable: 0, declining: 0 };
    connectedIntegrations.forEach(i => {
      const trend = i.trend === 'up' ? 'improving' : i.trend === 'down' ? 'declining' : 'stable';
      trendCounts[trend]++;
    });
    const globalTrend = trendCounts.declining > trendCounts.improving ? 'declining' 
      : trendCounts.improving > trendCounts.declining ? 'improving' : 'stable';

    // Get last analysis timestamp from most recent fusion_scores update
    const lastAnalysisTimestamp = fusionScores && fusionScores.length > 0
      ? fusionScores.reduce((latest, s) => s.updated_at > latest ? s.updated_at : latest, fusionScores[0].updated_at)
      : null;

    // Intelligence Contract v1.1 - Compute snapshot-level scoring_confidence
    // high: >=2 integrations have fusion_score AND minimum confidence among scored is high
    // medium: >=1 integration has fusion_score OR there are tracked metrics
    // low: 0 integrations have fusion_score and metrics are empty/sparse
    function computeScoringConfidence(integrations: ConnectedIntegration[]): ScoringConfidence {
      const scoredIntegrations = integrations.filter(i => i.fusion_score !== null);
      const totalMetrics = integrations.reduce((sum, i) => sum + i.metrics_tracked.length, 0);
      
      if (scoredIntegrations.length >= 2) {
        // Check if minimum confidence among scored integrations is high
        const allHigh = scoredIntegrations.every(i => i.confidence_level === 'high');
        if (allHigh) return 'high';
        return 'medium';
      }
      
      if (scoredIntegrations.length >= 1 || totalMetrics > 0) {
        return 'medium';
      }
      
      return 'low';
    }

    // Intelligence Contract v1.1 - Generate system_reasoning (machine-readable, not AI prose)
    // This is a deterministic explanation of the current state derived from snapshot fields
    function generateSystemReasoning(integrations: ConnectedIntegration[], globalScore: number, confidence: ScoringConfidence): string {
      const integrationCount = integrations.length;
      const scoredCount = integrations.filter(i => i.fusion_score !== null).length;
      const totalMetrics = integrations.reduce((sum, i) => sum + i.metrics_tracked.length, 0);
      const integrationNames = integrations.map(i => i.name).join(', ');
      const hasActivity = integrations.some(i => i.last_activity_timestamp !== null);
      
      const parts: string[] = [];
      parts.push(`${integrationCount} connected integration(s): ${integrationNames || 'none'}`);
      parts.push(`${scoredCount} scored`);
      parts.push(`${totalMetrics} metrics tracked`);
      parts.push(`last_activity: ${hasActivity ? 'present' : 'null'}`);
      parts.push(`global_fusion_score: ${globalScore.toFixed(1)}`);
      parts.push(`scoring_confidence: ${confidence}`);
      
      if (scoredCount === 0) {
        parts.push('reason: no activity observed yet; awaiting usage data');
      } else if (scoredCount < integrationCount) {
        parts.push(`reason: ${integrationCount - scoredCount} integration(s) still stabilizing`);
      }
      
      return parts.join('; ');
    }

    const scoringConfidence = computeScoringConfidence(connectedIntegrations);
    const systemReasoning = generateSystemReasoning(connectedIntegrations, globalFusionScore, scoringConfidence);

    // Build System Intelligence Snapshot (AUTHORITATIVE) - Intelligence Contract v1.1
    const intelligenceSnapshot: SystemIntelligenceSnapshot = {
      user_id: userId,
      connected_integrations: connectedIntegrations,
      global_fusion_score: globalFusionScore,
      global_fusion_score_trend: globalTrend,
      total_integrations: connectedIntegrations.length,
      active_integrations: connectedIntegrations.filter(i => i.data_status === 'active').length,
      emerging_integrations: connectedIntegrations.filter(i => i.data_status === 'emerging').length,
      dormant_integrations: connectedIntegrations.filter(i => i.data_status === 'dormant').length,
      last_analysis_timestamp: lastAnalysisTimestamp,
      // Intelligence Contract v1.1 - Additional fields
      scoring_confidence: scoringConfidence,
      system_reasoning: systemReasoning,
    };

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
      // Primary: System Intelligence Snapshot (AUTHORITATIVE)
      intelligence_snapshot: intelligenceSnapshot,
      // Legacy fields for backward compatibility
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
