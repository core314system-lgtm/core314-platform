import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useSystemStatus } from '../hooks/useSystemStatus';
import { supabase } from '../lib/supabase';
import { SystemSignalSummary } from '../components/dashboard/SystemSignalSummary';
import { Loader2, Layers, Activity } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { IntegrationWithScore, FusionScore } from '../types';

/**
 * System Signals Page
 * 
 * Dedicated page for viewing system signal summary.
 * This page renders the existing SystemSignalSummary component exactly as it
 * appeared on the Dashboard, now accessible via its own route.
 * 
 * No new logic or components - reuses existing SystemSignalSummary.
 */
export function SystemSignals() {
  const { profile } = useAuth();
  const { systemStatus } = useSystemStatus();
  const [integrations, setIntegrations] = useState<IntegrationWithScore[]>([]);
  const [globalScore, setGlobalScore] = useState<number>(0);
  const [trendSnapshot, setTrendSnapshot] = useState<{ date: string; score: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasConnectedIntegrations, setHasConnectedIntegrations] = useState(false);

  // Derive isComputed from systemStatus - true when score_origin is 'computed'
  const isComputed = systemStatus?.score_origin === 'computed';

  useEffect(() => {
    const fetchData = async () => {
      if (!profile?.id) return;

      setLoading(true);

      // Query only integrations that the user has explicitly connected
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
        setHasConnectedIntegrations(false);
        setIntegrations([]);
        setGlobalScore(0);
        setTrendSnapshot([]);
        setLoading(false);
        return;
      }

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

      // Calculate global score
      const validScores = integrationsWithScores.filter(i => i.fusion_score !== undefined);
      if (validScores.length > 0) {
        const avgScore = validScores.reduce((sum, i) => sum + (i.fusion_score || 0), 0) / validScores.length;
        setGlobalScore(avgScore);
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

    fetchData();
  }, [profile?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          System Signals
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          View aggregated system signals and operational health indicators
        </p>
      </div>

      {hasConnectedIntegrations ? (
        <SystemSignalSummary
          isComputed={isComputed}
          integrations={integrations}
          globalScore={globalScore}
          trendSnapshot={trendSnapshot}
        />
      ) : (
        <Card>
          <CardContent className="py-8">
            <div className="text-center">
              <Activity className="h-10 w-10 text-gray-400 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
                No system signals available
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 max-w-md mx-auto">
                Connect your first integration to start collecting system signals.
              </p>
              <Link to="/integration-hub">
                <Button size="sm">
                  <Layers className="h-4 w-4 mr-2" />
                  Open Integration Hub
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
