import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Card, CardContent } from '../components/ui/card';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/button';
import { DashboardLayout, AutoMetric } from '../types';
import WidgetRenderer from '../components/dashboard/WidgetRenderer';

export default function DashboardView() {
  const { id } = useParams<{ id: string }>();
  const [dashboard, setDashboard] = useState<DashboardLayout | null>(null);
  const [metrics, setMetrics] = useState<AutoMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (id) {
      fetchDashboard();
    }
  }, [id]);

  const fetchDashboard = async () => {
    try {
      const { data, error } = await supabase
        .from('dashboard_layouts')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setDashboard(data);

      if (data?.integration_id) {
        fetchMetrics(data.integration_id);
      }
    } catch (error) {
      console.error('Error fetching dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMetrics = async (integrationId: string) => {
    try {
      const { data, error } = await supabase
        .from('auto_metrics')
        .select('*')
        .eq('integration_id', integrationId)
        .eq('is_enabled', true);

      if (error) throw error;
      setMetrics(data || []);
    } catch (error) {
      console.error('Error fetching metrics:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDashboard();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-gray-600">Dashboard not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">{dashboard.dashboard_name}</h1>
          <p className="text-gray-600 dark:text-gray-400">
            {dashboard.layout_config.widgets.length} widgets • Refreshes every{' '}
            {dashboard.layout_config.refresh_interval / 60} minutes
          </p>
        </div>
        <Button onClick={handleRefresh} disabled={refreshing} variant="outline">
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {dashboard.layout_config.widgets.map((widget) => {
          const metric = metrics.find((m) => m.id === widget.metric_id);
          return (
            <div
              key={widget.id}
              className={`col-span-12 md:col-span-${widget.layout.w}`}
              style={{
                gridColumn: `span ${widget.layout.w}`,
              }}
            >
              <WidgetRenderer widget={widget} metric={metric} />
            </div>
          );
        })}
      </div>

      {dashboard.layout_config.widgets.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-gray-600 py-8">
              No widgets configured for this dashboard
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
