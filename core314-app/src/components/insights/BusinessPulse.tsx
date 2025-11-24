
import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { TrendingUp, TrendingDown, Minus, Activity, AlertCircle } from 'lucide-react';

interface MetricTrend {
  current_value: number;
  previous_value: number;
  trend_percentage: number;
  trend_direction: 'up' | 'down' | 'stable';
}

interface KPICard {
  metric_name: string;
  metric_value: number;
  metric_unit?: string;
  trend?: MetricTrend;
  health: 'healthy' | 'warning' | 'critical';
  source_app?: string;
}

export const BusinessPulse: React.FC = () => {
  const [kpis, setKpis] = useState<KPICard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadKPIs();
    
    const subscription = supabase
      .channel('telemetry_metrics_changes')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'telemetry_metrics',
      }, () => {
        loadKPIs();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const loadKPIs = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Not authenticated');
      }

      const { data: latestMetrics, error: metricsError } = await supabase
        .rpc('get_latest_metrics', {
          p_user_id: user.id,
          p_limit: 8,
        });

      if (metricsError) throw metricsError;

      if (!latestMetrics || latestMetrics.length === 0) {
        setKpis([]);
        setLoading(false);
        return;
      }

      const kpiPromises = latestMetrics.map(async (metric: any) => {
        try {
          const { data: trend, error: trendError } = await supabase
            .rpc('calculate_metric_trend', {
              p_user_id: user.id,
              p_metric_name: metric.metric_name,
              p_time_window: '7 days',
            });

          if (trendError) throw trendError;

          const trendData = trend && trend.length > 0 ? trend[0] : null;

          let health: 'healthy' | 'warning' | 'critical' = 'healthy';
          if (trendData) {
            if (trendData.trend_direction === 'down' && Math.abs(trendData.trend_percentage) > 20) {
              health = 'critical';
            } else if (Math.abs(trendData.trend_percentage) > 10) {
              health = 'warning';
            }
          }

          return {
            metric_name: metric.metric_name,
            metric_value: metric.metric_value,
            metric_unit: metric.metric_unit,
            trend: trendData,
            health,
            source_app: metric.source_app,
          };
        } catch (error) {
          console.error(`Error calculating trend for ${metric.metric_name}:`, error);
          return {
            metric_name: metric.metric_name,
            metric_value: metric.metric_value,
            metric_unit: metric.metric_unit,
            health: 'healthy' as const,
            source_app: metric.source_app,
          };
        }
      });

      const kpiData = await Promise.all(kpiPromises);
      setKpis(kpiData);
    } catch (err) {
      console.error('Error loading KPIs:', err);
      setError(err instanceof Error ? err.message : 'Failed to load KPIs');
    } finally {
      setLoading(false);
    }
  };

  const formatMetricName = (name: string) => {
    return name
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const formatValue = (value: number, unit?: string) => {
    const formatted = value.toLocaleString(undefined, {
      maximumFractionDigits: 2,
    });
    return unit ? `${formatted} ${unit}` : formatted;
  };

  const getTrendIcon = (direction?: string) => {
    switch (direction) {
      case 'up':
        return <TrendingUp className="w-4 h-4" />;
      case 'down':
        return <TrendingDown className="w-4 h-4" />;
      default:
        return <Minus className="w-4 h-4" />;
    }
  };

  const getTrendColor = (direction?: string) => {
    switch (direction) {
      case 'up':
        return 'text-green-600';
      case 'down':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'healthy':
        return 'border-green-500';
      case 'warning':
        return 'border-yellow-500';
      case 'critical':
        return 'border-red-500';
      default:
        return 'border-gray-300';
    }
  };

  const getHealthBadge = (health: string) => {
    switch (health) {
      case 'healthy':
        return <span className="px-2 py-1 text-xs font-medium text-green-700 bg-green-100 rounded-full">Healthy</span>;
      case 'warning':
        return <span className="px-2 py-1 text-xs font-medium text-yellow-700 bg-yellow-100 rounded-full">Warning</span>;
      case 'critical':
        return <span className="px-2 py-1 text-xs font-medium text-red-700 bg-red-100 rounded-full">Critical</span>;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Activity className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Loading Business Pulse...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center">
          <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
          <span className="text-red-800">{error}</span>
        </div>
      </div>
    );
  }

  if (kpis.length === 0) {
    return (
      <div className="p-8 text-center bg-gray-50 rounded-lg border border-gray-200">
        <Activity className="w-12 h-12 mx-auto text-gray-400 mb-3" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Metrics Available</h3>
        <p className="text-gray-600">Start sending metrics to see your Business Pulse dashboard.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Business Pulse</h2>
        <button
          onClick={loadKPIs}
          className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
        >
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, index) => (
          <div
            key={index}
            className={`bg-white rounded-lg shadow-sm border-l-4 ${getHealthColor(kpi.health)} p-6 hover:shadow-md transition-shadow`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="text-sm font-medium text-gray-600 mb-1">
                  {formatMetricName(kpi.metric_name)}
                </h3>
                {kpi.source_app && (
                  <span className="text-xs text-gray-500">{kpi.source_app}</span>
                )}
              </div>
              {getHealthBadge(kpi.health)}
            </div>

            <div className="mb-3">
              <div className="text-3xl font-bold text-gray-900">
                {formatValue(kpi.metric_value, kpi.metric_unit)}
              </div>
            </div>

            {kpi.trend && (
              <div className={`flex items-center text-sm ${getTrendColor(kpi.trend.trend_direction)}`}>
                {getTrendIcon(kpi.trend.trend_direction)}
                <span className="ml-1 font-medium">
                  {Math.abs(kpi.trend.trend_percentage).toFixed(1)}%
                </span>
                <span className="ml-1 text-gray-600">vs last period</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
