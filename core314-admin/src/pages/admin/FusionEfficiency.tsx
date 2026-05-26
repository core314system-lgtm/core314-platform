import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Gauge, 
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Zap
} from 'lucide-react';

interface FusionEfficiencyMetric {
  id: string;
  user_id: string;
  integration_name: string;
  fusion_score: number;
  efficiency_index: number;
  trend_7d: number;
  stability_confidence: number;
  last_anomaly_at: string | null;
  updated_at: string;
  created_at: string;
}

interface ConfidenceLogEntry {
  id: string;
  source_event: string;
  metric_type: string;
  old_value: number | null;
  new_value: number;
  delta: number;
  created_at: string;
}

export function FusionEfficiency() {
  const [metrics, setMetrics] = useState<FusionEfficiencyMetric[]>([]);
  const [confidenceLogs, setConfidenceLogs] = useState<ConfidenceLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedIntegration, setSelectedIntegration] = useState<string>('all');

  useEffect(() => {
    fetchData();
    
    if (autoRefresh) {
      const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const fetchData = async () => {
    try {
      const { data: metricsData, error: metricsError } = await supabase
        .from('fusion_efficiency_metrics')
        .select('*')
        .order('updated_at', { ascending: false });

      if (metricsError) throw metricsError;
      setMetrics(metricsData || []);

      const { data: logsData, error: logsError } = await supabase
        .from('fusion_confidence_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (logsError) throw logsError;
      setConfidenceLogs(logsData || []);
    } catch (error) {
      console.error('Error fetching fusion efficiency data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBgColor = (score: number): string => {
    if (score >= 80) return 'bg-green-100';
    if (score >= 60) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  const getTrendIcon = (trend: number) => {
    if (trend > 0) return <TrendingUp className="w-4 h-4 text-green-600" />;
    if (trend < 0) return <TrendingDown className="w-4 h-4 text-red-600" />;
    return <Activity className="w-4 h-4 text-gray-600" />;
  };

  const filteredMetrics = selectedIntegration === 'all' 
    ? metrics 
    : metrics.filter(m => m.integration_name === selectedIntegration);

  const integrationNames = Array.from(new Set(metrics.map(m => m.integration_name)));

  const avgFusionScore = metrics.length > 0
    ? metrics.reduce((sum, m) => sum + m.fusion_score, 0) / metrics.length
    : 0;

  const avgEfficiencyIndex = metrics.length > 0
    ? metrics.reduce((sum, m) => sum + m.efficiency_index, 0) / metrics.length
    : 0;

  const avgStabilityConfidence = metrics.length > 0
    ? metrics.reduce((sum, m) => sum + m.stability_confidence, 0) / metrics.length
    : 0;

  const recentAnomalies = metrics.filter(m => 
    m.last_anomaly_at && 
    new Date(m.last_anomaly_at) > new Date(Date.now() - 24 * 60 * 60 * 1000)
  ).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1>Fusion Efficiency & Confidence Index</h1>
          <p className="text-gray-600 mt-1">
            Real-time subsystem performance metrics and confidence trends
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            Auto-refresh (30s)
          </label>
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Aggregate Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Avg Fusion Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className={`text-3xl font-bold ${getScoreColor(avgFusionScore)}`}>
                {avgFusionScore.toFixed(1)}
              </div>
              <Gauge className={`w-8 h-8 ${getScoreColor(avgFusionScore)}`} />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Weighted average across all integrations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Avg Efficiency Index
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className={`text-3xl font-bold ${getScoreColor(avgEfficiencyIndex)}`}>
                {avgEfficiencyIndex.toFixed(1)}
              </div>
              <Zap className={`w-8 h-8 ${getScoreColor(avgEfficiencyIndex)}`} />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Throughput efficiency ratio
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Avg Stability Confidence
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className={`text-3xl font-bold ${getScoreColor(avgStabilityConfidence)}`}>
                {avgStabilityConfidence.toFixed(1)}%
              </div>
              <CheckCircle className={`w-8 h-8 ${getScoreColor(avgStabilityConfidence)}`} />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Performance consistency score
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Recent Anomalies (24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className={`text-3xl font-bold ${recentAnomalies > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {recentAnomalies}
              </div>
              <AlertTriangle className={`w-8 h-8 ${recentAnomalies > 0 ? 'text-red-600' : 'text-green-600'}`} />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Performance degradation events
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-600">Filter by Integration:</label>
        <select
          value={selectedIntegration}
          onChange={(e) => setSelectedIntegration(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="all">All Integrations</option>
          {integrationNames.map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredMetrics.length === 0 ? (
          <Card className="col-span-2">
            <CardContent className="p-8 text-center text-gray-500">
              No fusion efficiency metrics available yet. Metrics will appear once integrations are monitored.
            </CardContent>
          </Card>
        ) : (
          filteredMetrics.map((metric) => (
            <Card key={metric.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{metric.integration_name}</CardTitle>
                  <div className="flex items-center gap-2">
                    {getTrendIcon(metric.trend_7d)}
                    <span className={`text-sm ${metric.trend_7d > 0 ? 'text-green-600' : metric.trend_7d < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                      {metric.trend_7d > 0 ? '+' : ''}{metric.trend_7d.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <CardDescription>
                  Last updated: {new Date(metric.updated_at).toLocaleString()}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Fusion Score */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Fusion Score</span>
                    <span className={`text-lg font-bold ${getScoreColor(metric.fusion_score)}`}>
                      {metric.fusion_score.toFixed(1)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${getScoreBgColor(metric.fusion_score)}`}
                      style={{ width: `${metric.fusion_score}%` }}
                    />
                  </div>
                </div>

                {/* Efficiency Index */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Efficiency Index</span>
                    <span className={`text-lg font-bold ${getScoreColor(metric.efficiency_index)}`}>
                      {metric.efficiency_index.toFixed(1)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${getScoreBgColor(metric.efficiency_index)}`}
                      style={{ width: `${Math.min(metric.efficiency_index, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Stability Confidence */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Stability Confidence</span>
                    <span className={`text-lg font-bold ${getScoreColor(metric.stability_confidence)}`}>
                      {metric.stability_confidence.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${getScoreBgColor(metric.stability_confidence)}`}
                      style={{ width: `${metric.stability_confidence}%` }}
                    />
                  </div>
                </div>

                {/* Anomaly Alert */}
                {metric.last_anomaly_at && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
                    <div className="text-sm">
                      <span className="font-medium text-red-900">Anomaly detected:</span>
                      <span className="text-red-700 ml-1">
                        {new Date(metric.last_anomaly_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Confidence Log */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Confidence Changes</CardTitle>
          <CardDescription>
            Audit log of metric changes across all integrations
          </CardDescription>
        </CardHeader>
        <CardContent>
          {confidenceLogs.length === 0 ? (
            <p className="text-center text-gray-500 py-4">
              No confidence log entries yet.
            </p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {confidenceLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">
                        {log.metric_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </span>
                      <span className="text-xs text-gray-500">
                        {log.source_event}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-600">
                        {log.old_value !== null ? log.old_value.toFixed(2) : 'N/A'} → {log.new_value.toFixed(2)}
                      </span>
                      <span className={`text-xs font-medium ${log.delta > 0 ? 'text-green-600' : log.delta < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                        ({log.delta > 0 ? '+' : ''}{log.delta.toFixed(2)})
                      </span>
                    </div>
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(log.created_at).toLocaleString()}
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
