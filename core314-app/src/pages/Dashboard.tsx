import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useSubscription } from '../hooks/useSubscription';
import { useAddons } from '../hooks/useAddons';
import { useIntelligenceDashboard } from '../hooks/useIntelligenceDashboard';
import { useSystemStatus } from '../hooks/useSystemStatus';
import { useLearningState } from '../hooks/useLearningState';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Switch } from '../components/ui/switch';
import { Label } from '../components/ui/label';
import { Users, Layers, Bot, TrendingUp, RefreshCw, MessageSquare, CheckCircle, Sparkles, AlertTriangle } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';
import { FusionGauge } from '../components/dashboard/FusionGauge';
import { IntegrationCard } from '../components/dashboard/IntegrationCard';
import { AIInsightsPanel } from '../components/dashboard/AIInsightsPanel';
import { AIQuickQuery } from '../components/dashboard/AIQuickQuery';
import { FusionOverviewWidget } from '../components/dashboard/FusionOverviewWidget';
import { IntelligenceDashboard } from '../components/intelligence/IntelligenceDashboard';
import { IntegrationContextSelector } from '../components/dashboard/IntegrationContextSelector';
import { IntegrationScopedAIQuery } from '../components/dashboard/IntegrationScopedAIQuery';
import { IntelligencePreviewPanels } from '../components/dashboard/IntelligencePreviewPanels';
import { CalibrationCompletionBanner } from '../components/dashboard/CalibrationCompletionBanner';
import { LockedInsightTeaser } from '../components/dashboard/LockedInsightTeaser';
import { AnalyzeUnlockBanner } from '../components/dashboard/AnalyzeUnlockBanner';
import { SystemSignalSummary } from '../components/dashboard/SystemSignalSummary';
import { SystemExplainabilityPanel } from '../components/dashboard/SystemExplainabilityPanel';
import { SystemTrajectoryPanel } from '../components/dashboard/SystemTrajectoryPanel';
import { IntelligenceReadinessPanel } from '../components/dashboard/IntelligenceReadinessPanel';
import { BetaOnboardingPanel } from '../components/dashboard/BetaOnboardingPanel';
import { SystemLearningPanel } from '../components/dashboard/SystemLearningPanel';
import { LearningTimeline } from '../components/dashboard/LearningTimeline';
import { AddOnCTA } from '../components/AddOnCTA';
import { ExportDataButton } from '../components/ExportDataButton';
import { IntegrationWithScore, FusionScore, ActionLog, FusionMetric, FusionInsight } from '../types';
import { syncIntegrationMetrics } from '../services/integrationDataSync';
import { updateFusionScore } from '../services/fusionEngine';
import { format } from 'date-fns';
import { betaTrackingService } from '../services/betaTracking';

export function Dashboard() {
  const { profile, isAdmin } = useAuth();
  const { subscription } = useSubscription(profile?.id);
  const { hasAddon, loading: addonsLoading } = useAddons();
  const { isIntelligenceDashboardEnabled } = useIntelligenceDashboard();
  const { isObserveTier, systemStatus } = useSystemStatus();
  const { learningStates, learningEvents, globalSummary, loading: learningLoading } = useLearningState();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [integrations, setIntegrations] = useState<IntegrationWithScore[]>([]);
  const [globalScore, setGlobalScore] = useState<number>(0);
  const [globalTrend, setGlobalTrend] = useState<'up' | 'down' | 'stable'>('stable');
  const [syncing, setSyncing] = useState(false);
  const [activeIntegrationCount, setActiveIntegrationCount] = useState(0);
  const [hasConnectedIntegrations, setHasConnectedIntegrations] = useState(false);
  const [autoOptimize, setAutoOptimize] = useState(false);
  const [showBillingSuccess, setShowBillingSuccess] = useState(false);
  const [successAddonName, setSuccessAddonName] = useState<string | null>(null);
  const [automationActivity, setAutomationActivity] = useState<{
    total_actions_24h: number;
    success_rate: number;
    recent_actions: ActionLog[];
  }>({
    total_actions_24h: 0,
    success_rate: 0,
    recent_actions: []
  });
  const [trendSnapshot, setTrendSnapshot] = useState<{
    date: string;
    score: number;
  }[]>([]);
  const [sessionData, setSessionData] = useState<{ last_login: string; active_sessions: number } | null>(null);
  
  // Integration Context Selector state
  const [selectedIntegrationId, setSelectedIntegrationId] = useState<string>('all');
  const [integrationMetrics, setIntegrationMetrics] = useState<FusionMetric[]>([]);
  const [integrationInsights, setIntegrationInsights] = useState<FusionInsight[]>([]);

  // Handle billing success redirect
  useEffect(() => {
    const billingSuccess = searchParams.get('billing_success');
    const addonName = searchParams.get('addon');
    
    if (billingSuccess === '1') {
      setShowBillingSuccess(true);
      if (addonName) {
        setSuccessAddonName(addonName);
      }
      // Clear query params after showing success
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('billing_success');
      newParams.delete('addon');
      setSearchParams(newParams, { replace: true });
      
      // Auto-hide after 10 seconds
      setTimeout(() => {
        setShowBillingSuccess(false);
        setSuccessAddonName(null);
      }, 10000);
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (profile?.id) {
      fetchDashboardData();
      fetchSessionData();
      
      const trackDashboard = async () => {
        try {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token || null;
          betaTrackingService.setAccessToken(token);
          
          betaTrackingService.trackEvent({
            event_type: 'navigation',
            event_name: 'dashboard_open',
            metadata: { timestamp: new Date().toISOString() },
          });
        } catch (error) {
          console.error('Error tracking dashboard open:', error);
        }
      };
      trackDashboard();
    }
  }, [profile?.id]);

  const fetchDashboardData = async () => {
    if (!profile?.id) return;

    // Query only integrations that the user has explicitly connected via Integration Hub
    // added_by_user=true distinguishes real connections from seeded/demo integrations
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

    // Early return if no connected integrations - prevents querying global caches
    // that may contain seeded/demo data
    if (!userInts || userInts.length === 0) {
      setActiveIntegrationCount(0);
      setHasConnectedIntegrations(false);
      setIntegrations([]);
      setGlobalScore(0);
      setGlobalTrend('stable');
      setTrendSnapshot([]);
      setAutomationActivity({
        total_actions_24h: 0,
        success_rate: 0,
        recent_actions: []
      });
      return;
    }

    setActiveIntegrationCount(userInts.length);
    setHasConnectedIntegrations(true);

    const { data: scores } = await supabase
      .from('fusion_scores')
      .select('*')
      .eq('user_id', profile.id);

    const scoreMap = new Map<string, FusionScore>();
    scores?.forEach(s => scoreMap.set(s.integration_id, s));

    const { data: metricsCount } = await supabase
      .from('fusion_metrics')
      .select('integration_id')
      .eq('user_id', profile.id);

    const metricCountMap = new Map<string, number>();
    metricsCount?.forEach(m => {
      metricCountMap.set(m.integration_id, (metricCountMap.get(m.integration_id) || 0) + 1);
    });

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

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: actionLogs } = await supabase
      .from('fusion_action_log')
      .select('*')
      .gte('created_at', twentyFourHoursAgo)
      .order('created_at', { ascending: false })
      .limit(3);

    if (actionLogs && actionLogs.length > 0) {
      const totalActions = actionLogs.length;
      const successfulActions = actionLogs.filter(a => a.status === 'success').length;
      const successRate = (successfulActions / totalActions) * 100;

      setAutomationActivity({
        total_actions_24h: totalActions,
        success_rate: successRate,
        recent_actions: actionLogs
      });
    } else {
      setAutomationActivity({
        total_actions_24h: 0,
        success_rate: 0,
        recent_actions: []
      });
    }

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
  };

  const fetchSessionData = async () => {
    if (!profile?.id) return;
    
    const { data: sessions } = await supabase
      .from('user_sessions')
      .select('*')
      .eq('user_id', profile.id)
      .eq('status', 'active');
    
    const { data: profileData } = await supabase
      .from('profiles')
      .select('last_login')
      .eq('id', profile.id)
      .single();
    
    setSessionData({
      last_login: profileData?.last_login || 'Never',
      active_sessions: sessions?.length || 0,
    });
  };

  const handleSync = async () => {
    if (!profile?.id) return;
    
    setSyncing(true);
    try {
      for (const integration of integrations) {
        await syncIntegrationMetrics(profile.id, integration.id, integration.integration_name);
        await updateFusionScore(profile.id, integration.id, subscription.hasAIInsights || false);
      }
      
      await fetchDashboardData();
    } catch (error) {
      console.error('Sync error:', error);
    } finally {
      setSyncing(false);
    }
  };

  // Fetch integration-specific data when an integration is selected
  useEffect(() => {
    const fetchIntegrationData = async () => {
      if (!profile?.id || selectedIntegrationId === 'all') {
        setIntegrationMetrics([]);
        setIntegrationInsights([]);
        return;
      }

      // Fetch recent metrics for the selected integration
      const { data: metrics } = await supabase
        .from('fusion_metrics')
        .select('*')
        .eq('user_id', profile.id)
        .eq('integration_id', selectedIntegrationId)
        .order('created_at', { ascending: false })
        .limit(10);

      setIntegrationMetrics(metrics || []);

      // Fetch recent insights for the selected integration
      const { data: insights } = await supabase
        .from('fusion_insights')
        .select('*')
        .eq('user_id', profile.id)
        .eq('integration_id', selectedIntegrationId)
        .order('created_at', { ascending: false })
        .limit(5);

      setIntegrationInsights(insights || []);
    };

    fetchIntegrationData();
  }, [profile?.id, selectedIntegrationId]);

  // Get the selected integration object
  const selectedIntegration = selectedIntegrationId !== 'all' 
    ? integrations.find(i => i.id === selectedIntegrationId) 
    : null;

  // Calculate fusion contribution percentage for selected integration
  const calculateFusionContribution = () => {
    if (!selectedIntegration || !selectedIntegration.fusion_score || integrations.length === 0) {
      return undefined;
    }
    const totalScore = integrations.reduce((sum, i) => sum + (i.fusion_score || 0), 0);
    if (totalScore === 0) return 0;
    return (selectedIntegration.fusion_score / totalScore) * 100;
  };

  // Derive isComputed from systemStatus - true when score_origin is 'computed'
  const isComputed = systemStatus?.score_origin === 'computed';

  return (
    <div className="min-h-full flex flex-col p-6 space-y-6">
      {/* Beta Onboarding Panel - first-time users only (no connected integrations) */}
      {/* Auto-dismisses once system is active */}
      {!hasConnectedIntegrations && <BetaOnboardingPanel hasConnectedIntegrations={hasConnectedIntegrations} />}

      {/* Billing Success Banner - temporary notification */}
      {showBillingSuccess && (
        <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <div>
              <p className="font-medium text-green-800 dark:text-green-200">
                Add-on activated successfully
              </p>
              <p className="text-sm text-green-700 dark:text-green-300">
                {successAddonName ? `${successAddonName.replace(/_/g, ' ')} is now active for your organization.` : 'Your add-on is now active and ready to use.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* ABOVE THE FOLD: Primary Dashboard Content   */}
      {/* ============================================ */}
      
      {/* Compact Header - reduced visual weight */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            {profile?.full_name || 'Dashboard'}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {hasConnectedIntegrations 
              ? `${activeIntegrationCount} integration${activeIntegrationCount !== 1 ? 's' : ''} connected`
              : 'Connect integrations to begin analysis'
            }
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleSync} disabled={syncing} variant="ghost" size="sm">
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* PRIMARY FOCAL ELEMENT: Fusion Score + System Health */}
      {hasConnectedIntegrations ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Fusion Score - Primary focal element */}
          <div className="lg:col-span-2">
            {selectedIntegration ? (
              <FusionGauge 
                score={selectedIntegration.fusion_score || 0} 
                trend={selectedIntegration.trend_direction || 'stable'} 
                integrationName={selectedIntegration.integration_name}
                globalScore={globalScore}
                fusionContribution={calculateFusionContribution()}
              />
            ) : (
              <FusionGauge score={globalScore} trend={globalTrend} showIntelligenceLabel={isIntelligenceDashboardEnabled} />
            )}
          </div>
          
          {/* System Health Status - Secondary focal element */}
          <div className="lg:col-span-1">
            <Card className="h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-gray-500" />
                  System Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className={`text-xl font-semibold ${
                    systemStatus?.system_health === 'active' ? 'text-green-600' : 'text-amber-600'
                  }`}>
                    {systemStatus?.system_health === 'active' ? 'Healthy' : 'Observing'}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {systemStatus?.system_health === 'active' 
                      ? 'All systems operational' 
                      : 'Building intelligence from your data'
                    }
                  </p>
                </div>
                <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <div className="text-lg font-semibold">{activeIntegrationCount}</div>
                      <div className="text-xs text-gray-500">Integrations</div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold">{integrations.reduce((sum, i) => sum + i.metrics_count, 0)}</div>
                      <div className="text-xs text-gray-500">Metrics</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        /* Empty state for no integrations */
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Layers className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Connect your first integration to begin analysis
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
                Integration performance data, fusion scores, and AI insights will appear here once you connect your first service.
              </p>
              <Link to="/integration-hub">
                <Button>
                  <Layers className="h-4 w-4 mr-2" />
                  Open Integration Hub
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Integration Context Selector - compact, below primary content */}
      {hasConnectedIntegrations && integrations.length > 1 && (
        <IntegrationContextSelector
          integrations={integrations}
          selectedIntegrationId={selectedIntegrationId}
          onSelectionChange={setSelectedIntegrationId}
        />
      )}

      {/* ============================================ */}
      {/* BELOW THE FOLD: Secondary Dashboard Content */}
      {/* De-emphasized sections - still accessible     */}
      {/* ============================================ */}

      {/* Analyze Unlock Orientation Banner - computed users only */}
      {hasConnectedIntegrations && <AnalyzeUnlockBanner isComputed={isComputed} />}

      {/* Intelligence Preview Panels - Observe tier only */}
      {hasConnectedIntegrations && isObserveTier && (
        <IntelligencePreviewPanels />
      )}

      {/* Calibration Completion Banner - Observe tier only */}
      {hasConnectedIntegrations && isObserveTier && (
        <CalibrationCompletionBanner
          firstIntegrationDate={systemStatus?.connected_integrations?.[0] ? new Date().toISOString() : null}
          integrationCount={systemStatus?.connected_integrations?.length || 0}
        />
      )}

      {/* Intelligence Dashboard Modules - only show when feature flag is enabled */}
      {isIntelligenceDashboardEnabled && <IntelligenceDashboard />}

      {/* Analytics sections - only show when user has connected integrations */}
      {/* Flattened grid: each panel is a direct grid child to eliminate blank space from unequal column heights */}
      {hasConnectedIntegrations ? (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Row 1: Fusion Gauge (1 col) + System Signal Summary (2 cols) */}
          <div className="lg:col-span-1">
            {selectedIntegration ? (
              <FusionGauge 
                score={selectedIntegration.fusion_score || 0} 
                trend={selectedIntegration.trend_direction || 'stable'} 
                integrationName={selectedIntegration.integration_name}
                globalScore={globalScore}
                fusionContribution={calculateFusionContribution()}
              />
            ) : (
              <FusionGauge score={globalScore} trend={globalTrend} showIntelligenceLabel={isIntelligenceDashboardEnabled} />
            )}
          </div>
          <div className="lg:col-span-2">
            <SystemSignalSummary
              isComputed={isComputed}
              integrations={integrations}
              globalScore={globalScore}
              trendSnapshot={trendSnapshot}
            />
          </div>

          {/* Row 2: System Explainability (1 col) + AI Insights Panel (2 cols) */}
          <div className="lg:col-span-1">
            <SystemExplainabilityPanel
              scoreOrigin={systemStatus?.score_origin}
              integrations={integrations}
              globalScore={globalScore}
            />
          </div>
          <div className="lg:col-span-2">
            {selectedIntegration ? (
              <AIInsightsPanel 
                hasAccess={subscription.hasAIInsights || false} 
                integrationId={selectedIntegration.id}
                integrationName={selectedIntegration.integration_name}
              />
            ) : (
              <AIInsightsPanel hasAccess={subscription.hasAIInsights || false} />
            )}
          </div>

          {/* Row 3: System Trajectory (1 col) + AI Query (2 cols) */}
          <div className="lg:col-span-1">
            <SystemTrajectoryPanel
              isComputed={isComputed}
              integrations={integrations}
              trendSnapshot={trendSnapshot}
              globalTrend={globalTrend}
            />
          </div>
          <div className="lg:col-span-2">
            {selectedIntegration && ['professional', 'enterprise'].includes(subscription.tier) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bot className="h-5 w-5 text-purple-600" />
                    Ask AI about {selectedIntegration.integration_name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <IntegrationScopedAIQuery 
                    integration={selectedIntegration}
                    recentMetrics={integrationMetrics}
                    recentInsights={integrationInsights}
                  />
                </CardContent>
              </Card>
            )}
            {!selectedIntegration && ['professional', 'enterprise'].includes(subscription.tier) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bot className="h-5 w-5 text-purple-600" />
                    Ask Core314 AI
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <AIQuickQuery />
                </CardContent>
              </Card>
            )}
          </div>

          {/* Row 4: Intelligence Readiness (1 col) + empty/spacer (2 cols - will auto-collapse) */}
          <div className="lg:col-span-1">
            <IntelligenceReadinessPanel
              scoreOrigin={systemStatus?.score_origin}
              hasEfficiencyMetrics={integrations.reduce((sum, i) => sum + (i.metrics_count || 0), 0) > 0}
              integrations={integrations}
              trendSnapshot={trendSnapshot}
              globalTrend={globalTrend}
            />
          </div>

          {/* Row 5: System Learning (1 col) */}
          <div className="lg:col-span-1">
            <SystemLearningPanel
              learningStates={learningStates}
              globalSummary={globalSummary}
              loading={learningLoading}
            />
          </div>

          {/* Row 6: Learning Timeline (1 col) */}
          <div className="lg:col-span-1">
            <LearningTimeline
              events={learningEvents}
              loading={learningLoading}
            />
          </div>

          {/* Link to System Intelligence Overview */}
          <div className="lg:col-span-1 pt-2">
            <Link 
              to="/system-intelligence" 
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors"
            >
              View full System Intelligence Overview
            </Link>
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Layers className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Connect your first integration to begin analysis
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
                Integration performance data, fusion scores, and AI insights will appear here once you connect your first service.
              </p>
              <Link to="/integration-hub">
                <Button>
                  <Layers className="h-4 w-4 mr-2" />
                  Open Integration Hub
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {isAdmin() && (
        <Card>
          <CardHeader>
            <CardTitle>Automation Activity (24h)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Actions</p>
                  <p className="text-2xl font-bold">{automationActivity.total_actions_24h}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Success Rate</p>
                  <p className="text-2xl font-bold text-green-600">
                    {automationActivity.success_rate.toFixed(0)}%
                  </p>
                </div>
              </div>

              {automationActivity.recent_actions.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Recent Actions</p>
                  <div className="space-y-2">
                    {automationActivity.recent_actions.map((action) => (
                      <div key={action.id} className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2">
                          {action.status === 'success' ? '✅' : '❌'}
                          <span className="font-medium">{action.integration_name}</span>
                          <span className="text-gray-500">{action.action_type}</span>
                        </span>
                        <span className="text-gray-500">
                          {format(new Date(action.created_at), 'h:mm a')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {automationActivity.total_actions_24h === 0 && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  No automated actions in the last 24 hours
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fusion Trend Snapshot - only show when user has connected integrations */}
      {hasConnectedIntegrations && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Fusion Trend Snapshot (7 Days)</CardTitle>
              <div className="flex items-center gap-2">
                <ExportDataButton
                  data={trendSnapshot}
                  filename="fusion-trend"
                  headers={['date', 'score']}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.location.href = '/visualizations'}
                >
                  View Full Visualization
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {trendSnapshot.length > 0 ? (
              <ResponsiveContainer width="100%" height={120}>
                <LineChart data={trendSnapshot}>
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Tooltip />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-gray-600 py-4 text-sm">
                No trend data available. Visit Visualizations to generate analytics.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Integration Performance - only show when user has connected integrations */}
      {hasConnectedIntegrations && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">
              {selectedIntegration ? `${selectedIntegration.integration_name} Performance` : 'Integration Performance'}
            </h2>
            <ExportDataButton
              data={(selectedIntegration ? [selectedIntegration] : integrations).map(i => ({
                integration_name: i.integration_name,
                fusion_score: i.fusion_score || 0,
                trend_direction: i.trend_direction || 'stable',
                metrics_count: i.metrics_count,
              }))}
              filename="integration-performance"
              headers={['integration_name', 'fusion_score', 'trend_direction', 'metrics_count']}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(selectedIntegration ? [selectedIntegration] : integrations).map(integration => (
              <IntegrationCard key={integration.id} integration={integration} />
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Session Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Last Login</p>
                <p className="font-medium">
                  {sessionData?.last_login && sessionData.last_login !== 'Never' 
                    ? new Date(sessionData.last_login).toLocaleString() 
                    : 'Never'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Active Sessions</p>
                <p className="font-medium">{sessionData?.active_sessions || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add-On CTA Footer */}
      <AddOnCTA type="dashboard_footer" />
    </div>
  );
}
