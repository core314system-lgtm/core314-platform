import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useSubscription } from '../hooks/useSubscription';
import { useAddons } from '../hooks/useAddons';
import { useIntelligenceDashboard } from '../hooks/useIntelligenceDashboard';
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
import { AddOnCTA } from '../components/AddOnCTA';
import { ExportDataButton } from '../components/ExportDataButton';
import { IntegrationWithScore, FusionScore, ActionLog } from '../types';
import { syncIntegrationMetrics } from '../services/integrationDataSync';
import { updateFusionScore } from '../services/fusionEngine';
import { format } from 'date-fns';
import { betaTrackingService } from '../services/betaTracking';
import { CoreInsightsSection } from '../components/dashboard/CoreInsightsSection';

export function Dashboard() {
  const { profile, isAdmin } = useAuth();
  const { subscription } = useSubscription(profile?.id);
  const { hasAddon, loading: addonsLoading } = useAddons();
  const { isIntelligenceDashboardEnabled } = useIntelligenceDashboard();
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

  return (
    <div className="p-6 space-y-6">
      {/* Billing Success Banner */}
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

      {/* Contextual Micro CTA - Prompt 4: Conditional Top-of-Page Micro CTA */}
      {/* Trigger: active_integrations >= 1 AND user_has_logged_in_before === true */}
      {/* Disappears when user owns all relevant add-ons */}
      {!addonsLoading && 
       hasConnectedIntegrations && 
       sessionData?.last_login && 
       sessionData.last_login !== 'Never' &&
       (!hasAddon('premium_analytics') || !hasAddon('advanced_fusion_ai')) && (
        <div className="text-sm text-gray-600 dark:text-gray-400">
          <Link 
            to="/account/plan" 
            className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            <span className="flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              Advanced features available for your setup
            </span>
          </Link>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Welcome, {profile?.full_name || 'User'}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Current Plan: <span className="font-semibold capitalize">{subscription.tier}</span>
          </p>
        </div>
        <div className="flex items-center gap-4">
          {isAdmin() && (
            <div className="flex items-center space-x-2">
              <Switch
                id="auto-optimize"
                checked={autoOptimize}
                onCheckedChange={setAutoOptimize}
                disabled
              />
              <Label htmlFor="auto-optimize" className="text-sm font-medium cursor-pointer">
                Auto-Optimize Weights
              </Label>
            </div>
          )}
          <Button onClick={handleSync} disabled={syncing} variant="outline">
            <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            Sync Data
          </Button>
          <Button onClick={() => navigate('/feedback')} variant="outline">
            <MessageSquare className="h-4 w-4 mr-2" />
            Submit Feedback
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Integrations</CardTitle>
            <Layers className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeIntegrationCount}</div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Max: {subscription.maxIntegrations === -1 ? 'Unlimited' : subscription.maxIntegrations}
            </p>
            {/* Prompt 2a: Integration Limit Reached */}
            {!addonsLoading &&
             subscription.maxIntegrations !== -1 &&
             activeIntegrationCount >= subscription.maxIntegrations &&
             !hasAddon('additional_integration_pro') &&
             !hasAddon('additional_integration_starter') && (
              <div className="mt-2 pt-2 border-t border-amber-200 dark:border-amber-800">
                <div className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-3 w-3" />
                  <span>You've reached your plan limit.</span>
                </div>
                <Link 
                  to="/account/plan" 
                  className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                >
                  Expand with Add-Ons
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Team Members</CardTitle>
            <Users className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1</div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Max: {subscription.maxUsers === -1 ? 'Unlimited' : subscription.maxUsers}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Metrics Tracked</CardTitle>
            <Bot className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {integrations.reduce((sum, i) => sum + i.metrics_count, 0)}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Max per integration: {subscription.maxMetricsPerIntegration === -1 ? 'Unlimited' : subscription.maxMetricsPerIntegration}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">System Health</CardTitle>
            <TrendingUp className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">Healthy</div>
            <p className="text-xs text-gray-500 dark:text-gray-400">All systems operational</p>
          </CardContent>
        </Card>
      </div>

      {/* Prompt 1: First Integration - Unlock deeper insights */}
      {/* Trigger: activeIntegrationCount === 1 */}
      {/* Disappears when user owns premium_analytics add-on */}
      {!addonsLoading &&
       activeIntegrationCount === 1 &&
       hasConnectedIntegrations &&
       !hasAddon('premium_analytics') && (
        <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    Unlock deeper insights
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Advanced Analytics can unlock deeper performance insights from your integration.
                  </p>
                </div>
              </div>
              <Link to="/account/plan">
                <Button variant="outline" size="sm">
                  View Advanced Analytics Add-On
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fusion Efficiency Overview Widget - only show when user has connected integrations */}
      {hasConnectedIntegrations && <FusionOverviewWidget />}

            {/* Intelligence Dashboard Modules - only show when feature flag is enabled */}
            {isIntelligenceDashboardEnabled && <IntelligenceDashboard />}

            {/* Core Beta Insights - Phase 9.1 */}
            {/* Shows "What Core314 is noticing" section when insights meet confidence threshold */}
            {hasConnectedIntegrations && <CoreInsightsSection />}

            {/* Analytics sections - only show when user has connected integrations */}
      {hasConnectedIntegrations ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <FusionGauge score={globalScore} trend={globalTrend} showIntelligenceLabel={isIntelligenceDashboardEnabled} />
          </div>
          <div className="lg:col-span-2 space-y-6">
            <AIInsightsPanel hasAccess={subscription.hasAIInsights || false} />
            
            {['professional', 'enterprise'].includes(subscription.tier) && (
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
            <h2 className="text-2xl font-bold">Integration Performance</h2>
            <ExportDataButton
              data={integrations.map(i => ({
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
            {integrations.map(integration => (
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
