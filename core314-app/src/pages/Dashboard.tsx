import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useSubscription } from '../hooks/useSubscription';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Users, Layers, Bot, TrendingUp, RefreshCw } from 'lucide-react';
import { FusionGauge } from '../components/dashboard/FusionGauge';
import { IntegrationCard } from '../components/dashboard/IntegrationCard';
import { AIInsightsPanel } from '../components/dashboard/AIInsightsPanel';
import { IntegrationWithScore, FusionScore } from '../types';
import { syncIntegrationMetrics } from '../services/integrationDataSync';
import { updateFusionScore } from '../services/fusionEngine';

export function Dashboard() {
  const { profile } = useAuth();
  const { subscription } = useSubscription(profile?.id);
  const [integrations, setIntegrations] = useState<IntegrationWithScore[]>([]);
  const [globalScore, setGlobalScore] = useState<number>(0);
  const [globalTrend, setGlobalTrend] = useState<'up' | 'down' | 'stable'>('stable');
  const [aiInsights, setAiInsights] = useState<Array<{ integrationName: string; summary: string; cachedAt?: string }>>([]);
  const [syncing, setSyncing] = useState(false);
  const [activeIntegrationCount, setActiveIntegrationCount] = useState(0);

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
      const master = ui.integrations_master as any;
      const score = scoreMap.get(ui.integration_id);
      return {
        ...master,
        fusion_score: score?.fusion_score,
        trend_direction: score?.trend_direction,
        ai_summary: score?.ai_summary,
        metrics_count: metricCountMap.get(ui.integration_id) || 0,
      };
    });

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

    if (subscription.hasAIInsights) {
      const insights = validScores
        .filter(i => i.ai_summary)
        .map(i => ({
          integrationName: i.integration_name,
          summary: i.ai_summary!,
          cachedAt: scoreMap.get(i.id)?.ai_cached_at,
        }));
      setAiInsights(insights);
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
        <Button onClick={handleSync} disabled={syncing} variant="outline">
          <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
          Sync Data
        </Button>
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
          <AIInsightsPanel insights={aiInsights} hasAccess={subscription.hasAIInsights || false} />
        </div>
      </div>

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
