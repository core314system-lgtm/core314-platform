import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Users, Activity, AlertTriangle, TrendingUp } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';

interface MonitoringStats {
  activeSessions: number;
  errorRate: number;
  avgLatency: number;
  fusionHealthTrend: Array<{
    hour_bucket: string;
    avg_fusion_score: number;
    avg_deviation: number;
    sample_count: number;
  }>;
}

export function BetaMonitoringCards() {
  const [stats, setStats] = useState<MonitoringStats>({
    activeSessions: 0,
    errorRate: 0,
    avgLatency: 0,
    fusionHealthTrend: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMonitoringStats();
    
    const channel = supabase
      .channel('beta-monitoring-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'beta_monitoring_log'
        },
        () => {
          fetchMonitoringStats();
        }
      )
      .subscribe();

    const interval = setInterval(fetchMonitoringStats, 30000);

    return () => {
      channel.unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const fetchMonitoringStats = async () => {
    try {
      const { data: sessionsData, error: sessionsError } = await supabase
        .rpc('get_active_sessions_count');

      const { data: errorRateData, error: errorRateError } = await supabase
        .rpc('get_error_rate_1h');

      const { data: latencyData, error: latencyError } = await supabase
        .rpc('get_avg_api_latency_1h');

      const { data: trendData, error: trendError } = await supabase
        .rpc('get_fusion_health_trend_24h');

      if (!sessionsError && !errorRateError && !latencyError && !trendError) {
        setStats({
          activeSessions: sessionsData || 0,
          errorRate: errorRateData || 0,
          avgLatency: latencyData || 0,
          fusionHealthTrend: trendData || []
        });
      }
    } catch (error) {
      console.error('Error fetching monitoring stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTrendData = () => {
    return stats.fusionHealthTrend.map(item => ({
      time: new Date(item.hour_bucket).toLocaleTimeString('en-US', { 
        hour: 'numeric',
        hour12: true 
      }),
      score: parseFloat(item.avg_fusion_score?.toString() || '0'),
      deviation: parseFloat(item.avg_deviation?.toString() || '0')
    })).reverse();
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map(i => (
          <Card key={i}>
            <CardContent className="pt-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                <div className="h-8 bg-gray-200 rounded w-3/4"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeSessions}</div>
            <p className="text-xs text-gray-500">Last 30 minutes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
            <AlertTriangle className={`h-4 w-4 ${stats.errorRate > 5 ? 'text-red-600' : 'text-green-600'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.errorRate > 5 ? 'text-red-600' : 'text-green-600'}`}>
              {stats.errorRate.toFixed(2)}%
            </div>
            <p className="text-xs text-gray-500">Last hour</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg API Latency</CardTitle>
            <Activity className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgLatency}ms</div>
            <p className="text-xs text-gray-500">Last hour</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">System Health</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats.errorRate < 1 ? 'Excellent' : stats.errorRate < 5 ? 'Good' : 'Degraded'}
            </div>
            <p className="text-xs text-gray-500">
              {stats.activeSessions} active users
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Fusion Health Trend Chart */}
      {stats.fusionHealthTrend.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Fusion Health Trend (24 Hours)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={formatTrendData()}>
                <XAxis 
                  dataKey="time" 
                  tick={{ fontSize: 12 }}
                  interval="preserveStartEnd"
                />
                <YAxis 
                  domain={[0, 100]}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey="score" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  name="Fusion Score"
                  dot={false}
                />
                <Line 
                  type="monotone" 
                  dataKey="deviation" 
                  stroke="#ef4444" 
                  strokeWidth={2}
                  name="Deviation"
                  dot={false}
                  strokeDasharray="5 5"
                />
              </LineChart>
            </ResponsiveContainer>
            <div className="flex items-center justify-center gap-6 mt-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-0.5 bg-blue-600"></div>
                <span className="text-gray-600">Fusion Score</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-0.5 bg-red-600 border-dashed"></div>
                <span className="text-gray-600">Deviation</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
