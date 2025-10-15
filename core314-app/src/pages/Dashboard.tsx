import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useSubscription } from '../hooks/useSubscription';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Switch } from '../components/ui/switch';
import { Label } from '../components/ui/label';
import { Users, Layers, Bot, TrendingUp, RefreshCw } from 'lucide-react';
import { FusionGauge } from '../components/dashboard/FusionGauge';
import { IntegrationCard } from '../components/dashboard/IntegrationCard';
import { AIInsightsPanel } from '../components/dashboard/AIInsightsPanel';
import { IntegrationWithScore, FusionScore, ActionLog } from '../types';
import { syncIntegrationMetrics } from '../services/integrationDataSync';
import { updateFusionScore } from '../services/fusionEngine';
import { format } from 'date-fns';

export function Dashboard() {
  const { profile, isAdmin } = useAuth();
  const { subscription } = useSubscription(profile?.id);
  const [integrations, setIntegrations] = useState<IntegrationWithScore[]>([]);
  const [globalScore, setGlobalScore] = useState<number>(0);
  const [globalTrend, setGlobalTrend] = useState<'up' | 'down' | 'stable'>('stable');
  const [syncing, setSyncing] = useState(false);
  const [activeIntegrationCount, setActiveIntegrationCount] = useState(0);
  const [autoOptimize, setAutoOptimize] = useState(false);
  const [automationActivity, setAutomationActivity] = useState<{
    total_actions_24h: number;
    success_rate: number;
    recent_actions: ActionLog[];
  }>({
    total_actions_24h: 0,
    success_rate: 0,
    recent_actions: []
  });

  useEffect(() => {
    if (profile?.id) {
      fetchDashboardData();
    }
  }, [profile?.id]);

  const fetchDashboardData = async () => {
    if (!profile?.id) return;

    const { data: userInts } = await supabase
      .from('user_integrations')
      .select(`
        id,
        integration_id,
        integrations_master (*)
      `)
      .eq('user_id', profile.id)
      .eq('status', 'active');

    if (!userInts) return;

    setActiveIntegrationCount(userInts.length);

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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <FusionGauge score={globalScore} trend={globalTrend} />
        </div>
        <div className="lg:col-span-2">
          <AIInsightsPanel hasAccess={subscription.hasAIInsights || false} />
        </div>
      </div>

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

      <div>
        <h2 className="text-2xl font-bold mb-4">Integration Performance</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {integrations.map(integration => (
            <IntegrationCard key={integration.id} integration={integration} />
          ))}
        </div>
        {integrations.length === 0 && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-gray-600 py-8">
                No active integrations. Visit the Integration Hub to connect your first service.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
