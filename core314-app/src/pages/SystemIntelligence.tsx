import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useSystemStatus } from '../hooks/useSystemStatus';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Brain, Layers, Activity, Sparkles } from 'lucide-react';
import { FusionGauge } from '../components/dashboard/FusionGauge';
import { SystemExplainabilityPanel } from '../components/dashboard/SystemExplainabilityPanel';
import { SystemTrajectoryPanel } from '../components/dashboard/SystemTrajectoryPanel';
import { IntelligenceReadinessPanel } from '../components/dashboard/IntelligenceReadinessPanel';
import { IntegrationWithScore, FusionScore } from '../types';

/**
 * Tier Detection Types
 * 
 * Observe: score_origin === "baseline"
 * Analyze: score_origin === "computed" AND IntelligenceReadiness !== "Prediction Ready"
 * Predict: score_origin === "computed" AND IntelligenceReadiness === "Prediction Ready"
 */
type SystemTier = 'observe' | 'analyze' | 'predict';

/**
 * System Intelligence Overview Page
 * 
 * A READ-ONLY, NON-AI, NON-ACTIONABLE aggregation view that explains
 * what Core314 currently knows about the user's system.
 * 
 * Route: /system-intelligence
 * Visible: ONLY to logged-in users
 * 
 * HARD CONSTRAINTS:
 * - No new API calls beyond existing dashboard data
 * - No AI calls
 * - No recommendations, actions, or automation
 * - No backend schema changes
 * - Reuses existing dashboard components
 */

// Signal domain mapping (reused from IntegrationIntelligenceSection)
const SIGNAL_DOMAIN_MAP: Record<string, string> = {
  slack: 'communication flow and response timing',
  microsoft_teams: 'collaboration patterns and meeting cadence',
  microsoft_365: 'productivity patterns and document activity',
  outlook: 'email communication and scheduling patterns',
  gmail: 'email flow and response timing',
  trello: 'task management and workflow patterns',
  google_drive: 'document collaboration and file activity',
  hubspot: 'customer engagement and pipeline activity',
  salesforce: 'sales activity and customer relationship patterns',
  jira: 'project tracking and development workflow',
  asana: 'task coordination and team workload',
  notion: 'knowledge management and documentation patterns',
  zoom: 'meeting frequency and engagement patterns',
  default: 'operational activity and system behavior',
};

function getSignalDomain(integrationName: string): string {
  const normalizedName = integrationName.toLowerCase().replace(/\s+/g, '_');
  return SIGNAL_DOMAIN_MAP[normalizedName] || SIGNAL_DOMAIN_MAP.default;
}

function deriveVarianceLevel(integration: IntegrationWithScore): 'high' | 'moderate' | 'low' {
  if (integration.trend_direction === 'down') return 'high';
  if (integration.trend_direction === 'stable' || !integration.trend_direction) return 'moderate';
  return 'low';
}

export function SystemIntelligence() {
  const { profile } = useAuth();
  const { systemStatus, isObserveTier } = useSystemStatus();
  const [integrations, setIntegrations] = useState<IntegrationWithScore[]>([]);
  const [globalScore, setGlobalScore] = useState<number>(0);
  const [globalTrend, setGlobalTrend] = useState<'up' | 'down' | 'stable'>('stable');
  const [trendSnapshot, setTrendSnapshot] = useState<{ date: string; score: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.id) {
      fetchSystemData();
    }
  }, [profile?.id]);

  const fetchSystemData = async () => {
    if (!profile?.id) return;

    setLoading(true);

    // Fetch connected integrations (same query as Dashboard)
    const { data: userInts } = await supabase
      .from('user_integrations')
      .select(`
        id,
        integration_id,
        integrations_master (*)
      `)
      .eq('user_id', profile.id)
      .eq('status', 'active')
      .eq('added_by_user', true);

    if (!userInts || userInts.length === 0) {
      setIntegrations([]);
      setGlobalScore(0);
      setGlobalTrend('stable');
      setTrendSnapshot([]);
      setLoading(false);
      return;
    }

    // Fetch fusion scores
    const { data: scores } = await supabase
      .from('fusion_scores')
      .select('*')
      .eq('user_id', profile.id);

    const scoreMap = new Map<string, FusionScore>();
    scores?.forEach(s => scoreMap.set(s.integration_id, s));

    // Fetch metrics count
    const { data: metricsCount } = await supabase
      .from('fusion_metrics')
      .select('integration_id')
      .eq('user_id', profile.id);

    const metricCountMap = new Map<string, number>();
    metricsCount?.forEach(m => {
      metricCountMap.set(m.integration_id, (metricCountMap.get(m.integration_id) || 0) + 1);
    });

    // Build integrations with scores
    const integrationsWithScores: IntegrationWithScore[] = userInts.map(ui => {
      const master = ui.integrations_master;
      const score = scoreMap.get(ui.integration_id);
      if (!master || typeof master !== 'object') return null;
      return {
        ...(master as unknown as Record<string, unknown>),
        fusion_score: score?.fusion_score,
        trend_direction: score?.trend_direction,
        ai_summary: score?.ai_summary,
        metrics_count: metricCountMap.get(ui.integration_id) || 0,
      } as IntegrationWithScore;
    }).filter((i): i is IntegrationWithScore => i !== null);

    setIntegrations(integrationsWithScores);

    // Calculate global score and trend
    const validScores = integrationsWithScores.filter(i => i.fusion_score !== undefined);
    if (validScores.length > 0) {
      const avgScore = validScores.reduce((sum, i) => sum + (i.fusion_score || 0), 0) / validScores.length;
      setGlobalScore(avgScore);
      
      const upCount = validScores.filter(i => i.trend_direction === 'up').length;
      const downCount = validScores.filter(i => i.trend_direction === 'down').length;
      if (upCount > downCount) setGlobalTrend('up');
      else if (downCount > upCount) setGlobalTrend('down');
      else setGlobalTrend('stable');
    }

    // Fetch trend snapshot
    const { data: visualCache } = await supabase
      .from('fusion_visual_cache')
      .select('data')
      .eq('integration_name', 'all')
      .eq('data_type', 'complete_visualization')
      .single();

    if (visualCache?.data?.timeline) {
      const recentTimeline = visualCache.data.timeline.slice(-7);
      setTrendSnapshot(recentTimeline.map((t: { date: string; fusion_score: number }) => ({
        date: t.date,
        score: t.fusion_score
      })));
    }

    setLoading(false);
  };

  const isComputed = systemStatus?.score_origin === 'computed';
  const hasEfficiencyMetrics = systemStatus?.has_efficiency_metrics || false;

  /**
   * Tier Detection Logic (read-only, uses existing signals)
   * 
   * Observe: score_origin === "baseline"
   * Analyze: score_origin === "computed" AND IntelligenceReadiness !== "Prediction Ready"
   * Predict: score_origin === "computed" AND IntelligenceReadiness === "Prediction Ready"
   */
  const currentTier = useMemo((): SystemTier => {
    // Observe tier: baseline mode
    if (systemStatus?.score_origin !== 'computed') {
      return 'observe';
    }

    // For computed users, check if they meet Prediction Ready criteria
    // (same logic as IntelligenceReadinessPanel)
    if (!hasEfficiencyMetrics) {
      return 'analyze';
    }

    // Calculate variance level
    let varianceLevel: 'high' | 'medium' | 'low' = 'low';
    if (trendSnapshot.length >= 2) {
      const scores = trendSnapshot.map(t => t.score);
      const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
      const variance = scores.reduce((sum, s) => sum + Math.pow(s - avgScore, 2), 0) / scores.length;
      const stdDev = Math.sqrt(variance);

      const integrationScores = integrations
        .filter(i => i.fusion_score !== undefined)
        .map(i => i.fusion_score || 0);
      
      let integrationStdDev = 0;
      if (integrationScores.length >= 2) {
        const avgIntScore = integrationScores.reduce((sum, s) => sum + s, 0) / integrationScores.length;
        const intVariance = integrationScores.reduce((sum, s) => sum + Math.pow(s - avgIntScore, 2), 0) / integrationScores.length;
        integrationStdDev = Math.sqrt(intVariance);
      }

      const combinedStdDev = (stdDev + integrationStdDev) / 2;

      if (combinedStdDev >= 15 || stdDev >= 15) {
        varianceLevel = 'high';
      } else if (combinedStdDev >= 5 || stdDev >= 5) {
        varianceLevel = 'medium';
      }
    }

    // Calculate confidence level
    const totalMetrics = integrations.reduce((sum, i) => sum + (i.metrics_count || 0), 0);
    const integrationsWithScores = integrations.filter(i => i.fusion_score !== undefined).length;
    
    let confidenceScore = 0;
    if (integrations.length >= 3) confidenceScore += 3;
    else if (integrations.length >= 2) confidenceScore += 2;
    else if (integrations.length >= 1) confidenceScore += 1;
    
    if (totalMetrics >= 50) confidenceScore += 3;
    else if (totalMetrics >= 20) confidenceScore += 2;
    else if (totalMetrics >= 5) confidenceScore += 1;
    
    if (trendSnapshot.length >= 7) confidenceScore += 2;
    else if (trendSnapshot.length >= 3) confidenceScore += 1;
    
    if (integrationsWithScores === integrations.length && integrations.length > 0) confidenceScore += 2;
    else if (integrationsWithScores > 0) confidenceScore += 1;

    const confidenceLevel = confidenceScore >= 8 ? 'high' : confidenceScore >= 4 ? 'medium' : 'low';

    // Prediction Ready: variance low + confidence high + sufficient trend data
    if (varianceLevel === 'low' && confidenceLevel === 'high' && trendSnapshot.length >= 7) {
      return 'predict';
    }

    return 'analyze';
  }, [systemStatus?.score_origin, hasEfficiencyMetrics, trendSnapshot, integrations]);

  const isPredictTier = currentTier === 'predict';
  const isAnalyzeTier = currentTier === 'analyze';
  const isObserveTier_derived = currentTier === 'observe';

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/50">
            <Brain className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              System Intelligence Overview
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              A consolidated view of what Core314 understands about your system
            </p>
          </div>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-4 max-w-3xl">
          Core314 continuously observes, analyzes, and evaluates signals across your connected integrations.
          This page summarizes the intelligence currently accumulated about your system — without recommendations or automation.
        </p>
      </div>

      {/* Section A: Global System State */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-slate-600 dark:text-slate-400" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Global System State
          </h2>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          This reflects the current health, consistency, and maturity of your system intelligence.
        </p>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Global Fusion Score */}
          <FusionGauge 
            score={globalScore} 
            trend={globalTrend}
          />
          
          {/* System Explainability + Intelligence Readiness */}
          <div className="space-y-4">
            <SystemExplainabilityPanel
              scoreOrigin={systemStatus?.score_origin}
              integrations={integrations}
              globalScore={globalScore}
            />
            
            <IntelligenceReadinessPanel
              scoreOrigin={systemStatus?.score_origin}
              hasEfficiencyMetrics={hasEfficiencyMetrics}
              integrations={integrations}
              trendSnapshot={trendSnapshot}
              globalTrend={globalTrend}
            />
          </div>
        </div>
      </section>

      {/* Section B: System Trajectory Summary */}
      {isComputed && (
        <section className="space-y-4">
          {/* Predictive Context Enabled label for Predict tier only */}
          {isPredictTier && (
            <div className="flex items-center gap-2 mb-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100/80 dark:bg-emerald-900/30 border border-emerald-200/50 dark:border-emerald-800/50">
                <Sparkles className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                  Predictive Context Enabled
                </span>
              </div>
            </div>
          )}
          <SystemTrajectoryPanel
            isComputed={isComputed}
            integrations={integrations}
            trendSnapshot={trendSnapshot}
            globalTrend={globalTrend}
            isPredictTier={isPredictTier}
          />
        </section>
      )}

      {/* Section C: Integration Intelligence Summary */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-slate-600 dark:text-slate-400" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Integration Intelligence Summary
          </h2>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          What Core314 is learning from each connected integration.
        </p>

        {integrations.length === 0 ? (
          <Card className="bg-slate-50 dark:bg-slate-900/50">
            <CardContent className="py-8 text-center">
              <Layers className="h-8 w-8 text-slate-400 mx-auto mb-3" />
              <p className="text-sm text-slate-600 dark:text-slate-400">
                No integrations connected yet.
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                Connect integrations from the Integration Hub to begin system intelligence.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {integrations.map((integration) => {
              const signalDomain = getSignalDomain(integration.integration_name);
              const varianceLevel = deriveVarianceLevel(integration);
              const isObserving = isObserveTier || integration.metrics_count === 0;
              
              return (
                <Card key={integration.id} className="overflow-hidden">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-3">
                      {integration.logo_url && (
                        <img 
                          src={integration.logo_url} 
                          alt={integration.integration_name}
                          className="h-8 w-8 object-contain"
                        />
                      )}
                      <div>
                        <span className="text-base font-semibold">
                          {integration.integration_name}
                        </span>
                        <p className="text-xs font-normal text-gray-500 dark:text-gray-400">
                          {integration.metrics_count} signals observed
                        </p>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      {/* Signal Domain */}
                      <div className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full flex-shrink-0 mt-1.5" />
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          Contributes <span className="font-medium">{signalDomain}</span> signals
                        </p>
                      </div>
                      
                      {/* Signal Stability */}
                      <div className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full flex-shrink-0 mt-1.5" />
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          {isObserving 
                            ? "Signals are still being observed to establish stable patterns"
                            : "Stable activity patterns are contributing to system confidence"
                          }
                        </p>
                      </div>
                      
                      {/* Fusion Score (if computed) */}
                      {integration.fusion_score !== undefined && (
                        <div className="flex items-start gap-2">
                          <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full flex-shrink-0 mt-1.5" />
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            Current efficiency score: <span className="font-medium">{Math.round(integration.fusion_score)}</span>
                            {integration.trend_direction && (
                              <span className={`ml-1 ${
                                integration.trend_direction === 'up' ? 'text-emerald-600' :
                                integration.trend_direction === 'down' ? 'text-amber-600' :
                                'text-slate-500'
                              }`}>
                                ({integration.trend_direction === 'up' ? 'improving' : 
                                  integration.trend_direction === 'down' ? 'declining' : 'stable'})
                              </span>
                            )}
                          </p>
                        </div>
                      )}
                      
                      {/* Variance Influence (if not observing) */}
                      {!isObserving && (
                        <div className="flex items-start gap-2">
                          <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full flex-shrink-0 mt-1.5" />
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            {varianceLevel === 'low' 
                              ? "Consistency strengthens overall system confidence"
                              : varianceLevel === 'high'
                              ? "Higher variance increases system uncertainty"
                              : "Moderate variance in signal patterns"
                            }
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
