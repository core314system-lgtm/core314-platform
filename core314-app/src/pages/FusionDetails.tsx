import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Gauge, 
  RefreshCw,
  Zap,
  Shield,
  Info
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';

interface FusionMetric {
  id: string;
  integration_name: string;
  fusion_score: number;
  efficiency_index: number;
  stability_confidence: number;
  trend_7d: number;
  updated_at: string;
}

interface ConfidenceLogEntry {
  id: string;
  integration_name: string;
  source_event: string;
  metric_type: string;
  old_value: number | null;
  new_value: number;
  delta: number;
  created_at: string;
}

interface ChartDataPoint {
  date: string;
  fusion_score: number;
  efficiency_index: number;
}

export function FusionDetails() {
  const { profile } = useAuth();
  const [metrics, setMetrics] = useState<FusionMetric[]>([]);
  const [confidenceLogs, setConfidenceLogs] = useState<ConfidenceLogEntry[]>([]);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    if (profile?.id) {
      fetchData();
    }
  }, [profile?.id]);

  useEffect(() => {
    if (autoRefresh && profile?.id) {
      const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh, profile?.id]);

  const fetchData = async () => {
    if (!profile?.id) return;

    try {
      const { data: metricsData, error: metricsError } = await supabase
        .from('fusion_efficiency_metrics')
        .select('*')
        .eq('user_id', profile.id)
        .order('updated_at', { ascending: false });

      if (metricsError) throw metricsError;
      setMetrics(metricsData || []);

      const { data: logsData, error: logsError } = await supabase
        .from('fusion_confidence_log')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (logsError) throw logsError;
      setConfidenceLogs(logsData || []);

      if (metricsData && metricsData.length > 0) {
        const last7Days = metricsData.slice(0, 7).reverse();
        const chartPoints: ChartDataPoint[] = last7Days.map(m => ({
          date: new Date(m.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          fusion_score: m.fusion_score,
          efficiency_index: m.efficiency_index
        }));
        setChartData(chartPoints);
      }
    } catch (error) {
      console.error('Error fetching fusion details:', error);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getTrendIcon = (trend: number) => {
    if (trend > 0) return <TrendingUp className="w-4 h-4 text-green-600" />;
    if (trend < 0) return <TrendingDown className="w-4 h-4 text-red-600" />;
    return <Activity className="w-4 h-4 text-gray-600" />;
  };

  const formatTimestamp = (timestamp: string): string => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Fusion Efficiency Details
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Real-time performance metrics and confidence trends
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            Auto-refresh (30s)
          </label>
          <Button onClick={fetchData} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Metric Explanations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="w-5 h-5 text-blue-600" />
            Understanding Your Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Gauge className="w-4 h-4 text-blue-600" />
                <h3 className="font-semibold text-sm">Fusion Score</h3>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Weighted metric combining success rate (40%), data quality (30%), and uptime (30%). Higher is better.
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-yellow-600" />
                <h3 className="font-semibold text-sm">Efficiency Index</h3>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Throughput efficiency considering response time and success rate. Normalized to 0-100 scale.
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-green-600" />
                <h3 className="font-semibold text-sm">Stability Confidence</h3>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Consistency-based confidence with penalties for high latency, low uptime, and variance.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 7-Day Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle>7-Day Performance Trend</CardTitle>
          <CardDescription>
            Track your Fusion Score and Efficiency Index over the past week
          </CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="fusion_score" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  name="Fusion Score"
                  dot={{ r: 4 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="efficiency_index" 
                  stroke="#f59e0b" 
                  strokeWidth={2}
                  name="Efficiency Index"
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-8 text-gray-600 dark:text-gray-400">
              No trend data available yet. Check back after metrics are collected.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Current Metrics by Integration */}
      <Card>
        <CardHeader>
          <CardTitle>Current Metrics by Integration</CardTitle>
          <CardDescription>
            Latest performance metrics for each integration
          </CardDescription>
        </CardHeader>
        <CardContent>
          {metrics.length === 0 ? (
            <div className="text-center py-8 text-gray-600 dark:text-gray-400">
              No metrics available yet. Metrics will appear once integrations are monitored.
            </div>
          ) : (
            <div className="space-y-4">
              {metrics.map((metric) => (
                <div 
                  key={metric.id}
                  className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-lg">{metric.integration_name}</h3>
                    <div className="flex items-center gap-2">
                      {getTrendIcon(metric.trend_7d)}
                      <span className={`text-sm font-medium ${
                        metric.trend_7d > 0 ? 'text-green-600' : 
                        metric.trend_7d < 0 ? 'text-red-600' : 
                        'text-gray-600'
                      }`}>
                        {metric.trend_7d > 0 ? '+' : ''}{metric.trend_7d.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Fusion Score</p>
                      <p className={`text-xl font-bold ${getScoreColor(metric.fusion_score)}`}>
                        {metric.fusion_score.toFixed(1)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Efficiency Index</p>
                      <p className={`text-xl font-bold ${getScoreColor(metric.efficiency_index)}`}>
                        {metric.efficiency_index.toFixed(1)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Stability</p>
                      <p className={`text-xl font-bold ${getScoreColor(metric.stability_confidence)}`}>
                        {metric.stability_confidence.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                  
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                    Updated: {formatTimestamp(metric.updated_at)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confidence Change Log */}
      <Card>
        <CardHeader>
          <CardTitle>Confidence Change Log</CardTitle>
          <CardDescription>
            Recent metric changes across all integrations
          </CardDescription>
        </CardHeader>
        <CardContent>
          {confidenceLogs.length === 0 ? (
            <div className="text-center py-8 text-gray-600 dark:text-gray-400">
              No confidence log entries yet.
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {confidenceLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {log.integration_name || 'All Integrations'}
                      </span>
                      <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
                        {log.metric_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        {log.old_value !== null ? log.old_value.toFixed(2) : 'N/A'} → {log.new_value.toFixed(2)}
                      </span>
                      <span className={`text-xs font-medium ${
                        log.delta > 0 ? 'text-green-600' : 
                        log.delta < 0 ? 'text-red-600' : 
                        'text-gray-600'
                      }`}>
                        ({log.delta > 0 ? '+' : ''}{log.delta.toFixed(2)})
                      </span>
                    </div>
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {formatTimestamp(log.created_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
