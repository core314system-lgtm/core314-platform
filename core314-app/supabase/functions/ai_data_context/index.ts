import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { corsHeaders } from '../_shared/cors.ts';
import { verifyAndAuthorizeWithPolicy } from '../_shared/auth.ts';
import { withSentry, breadcrumb, handleSentryTest, jsonError } from "../_shared/sentry.ts";

interface DataContext {
  global_fusion_score: number;
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

    const { data: fusionMetrics } = await supabase
      .from('fusion_metrics')
      .select('fusion_score, efficiency_index')
      .eq('organization_id', userOrgId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const globalFusionScore = fusionMetrics?.fusion_score || 0;

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
      top_deficiencies: topDeficiencies,
      system_health: systemHealth,
      anomalies_today: anomalyCount || 0,
      recent_alerts: recentAlerts,
      integration_performance: integrationPerformance,
      recent_optimizations: optimizationCount || 0,
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