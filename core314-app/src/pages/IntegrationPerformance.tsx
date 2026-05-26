import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { IntegrationCard } from '../components/dashboard/IntegrationCard';
import { ExportDataButton } from '../components/ExportDataButton';
import { Loader2, Layers } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { IntegrationWithScore, FusionScore } from '../types';

/**
 * Integration Performance Page
 * 
 * Dedicated page for viewing integration performance metrics.
 * This page renders the existing IntegrationCard components exactly as they
 * appeared on the Dashboard, now accessible via its own route.
 * 
 * No new logic or components - reuses existing IntegrationCard.
 */
export function IntegrationPerformance() {
  const { profile } = useAuth();
  const [integrations, setIntegrations] = useState<IntegrationWithScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasConnectedIntegrations, setHasConnectedIntegrations] = useState(false);

  useEffect(() => {
    const fetchIntegrations = async () => {
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
      setLoading(false);
    };

    fetchIntegrations();
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Integration Performance
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            View performance metrics for your connected integrations
          </p>
        </div>
        {hasConnectedIntegrations && (
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
        )}
      </div>

      {hasConnectedIntegrations ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {integrations.map(integration => (
            <IntegrationCard key={integration.id} integration={integration} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8">
            <div className="text-center">
              <Layers className="h-10 w-10 text-gray-400 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
                No integrations connected
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 max-w-md mx-auto">
                Connect your first integration to see performance metrics here.
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
