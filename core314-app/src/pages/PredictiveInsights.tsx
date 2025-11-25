import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { AlertTriangle, RefreshCw, Brain, Clock } from 'lucide-react';
import { format } from 'date-fns';

interface PredictionResult {
  id: string;
  model_id: string;
  metric_name: string;
  prediction_type: string;
  predicted_value: number;
  confidence_score: number;
  lower_bound: number;
  upper_bound: number;
  forecast_target_time: string;
  forecast_horizon_hours: number;
  explanation: string;
  created_at: string;
  predictive_models?: {
    model_name: string;
    target_metric: string;
    accuracy_score: number;
  };
}

interface PredictiveAlert {
  id: string;
  metric_name: string;
  predicted_value: number;
  threshold_value: number;
  alert_level: 'info' | 'warning' | 'critical';
  alert_type: string;
  forecast_breach_time: string;
  time_to_breach_hours: number;
  alert_message: string;
  recommendation: string;
  confidence_score: number;
  created_at: string;
}

interface MemorySnapshot {
  id: string;
  metric_name: string;
  data_window: string;
  avg_value: number;
  trend_slope: number;
  variance: number;
  sample_count: number;
  seasonality_detected: boolean;
  seasonality_period: string | null;
  created_at: string;
}

interface RefinementLog {
  id: string;
  model_id: string;
  refinement_type: string;
  prev_accuracy: number;
  new_accuracy: number;
  accuracy_delta: number;
  deviation_detected: number;
  created_at: string;
  predictive_models?: {
    model_name: string;
  };
}

export function PredictiveInsights() {
  const { profile } = useAuth();
  const [predictions, setPredictions] = useState<PredictionResult[]>([]);
  const [alerts, setAlerts] = useState<PredictiveAlert[]>([]);
  const [memorySnapshots, setMemorySnapshots] = useState<MemorySnapshot[]>([]);
  const [refinementLogs, setRefinementLogs] = useState<RefinementLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [metricFilter, setMetricFilter] = useState<string>('all');
  const [alertLevelFilter, setAlertLevelFilter] = useState<string>('all');
  const [confidenceFilter, setConfidenceFilter] = useState<string>('all');
  const [availableMetrics, setAvailableMetrics] = useState<string[]>([]);
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.id) {
      fetchPredictiveData();
      setupRealtimeSubscriptions();
    }
  }, [profile?.id]);

  const fetchPredictiveData = async () => {
    if (!profile?.id) return;

    setLoading(true);
    try {
      const { data: predictionData, error: predictionError } = await supabase
        .from('prediction_results')
        .select(`
          *,
          predictive_models (
            model_name,
            target_metric,
            accuracy_score
          )
        `)
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (predictionError) throw predictionError;

      const { data: alertData, error: alertError } = await supabase
        .from('predictive_alerts')
        .select('*')
        .eq('user_id', profile.id)
        .eq('is_resolved', false)
        .order('created_at', { ascending: false })
        .limit(20);

      if (alertError) throw alertError;

      setPredictions(predictionData || []);
      setAlerts(alertData || []);

      const metrics = new Set<string>();
      predictionData?.forEach(p => metrics.add(p.metric_name));
      setAvailableMetrics(Array.from(metrics));

      const { data: snapshotsData, error: snapshotsError } = await supabase
        .from('memory_snapshots')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!snapshotsError) {
        setMemorySnapshots(snapshotsData || []);
      }

      const { data: refinementsData, error: refinementsError } = await supabase
        .from('refinement_history')
        .select(`
          *,
          predictive_models (
            model_name
          )
        `)
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (!refinementsError) {
        setRefinementLogs(refinementsData || []);
      }
    } catch (error) {
      console.error('Error fetching predictive data:', error);
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscriptions = () => {
    if (!profile?.id) return;

    const predictionChannel = supabase
      .channel('prediction_results_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'prediction_results',
          filter: `user_id=eq.${profile.id}`,
        },
        (payload) => {
          console.log('New prediction received:', payload);
          fetchPredictiveData();
        }
      )
      .subscribe();

    const alertChannel = supabase
      .channel('predictive_alerts_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'predictive_alerts',
          filter: `user_id=eq.${profile.id}`,
        },
        (payload) => {
          console.log('New alert received:', payload);
          fetchPredictiveData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(predictionChannel);
      supabase.removeChannel(alertChannel);
    };
  };

  const filteredPredictions = predictions.filter(p => {
    if (metricFilter !== 'all' && p.metric_name !== metricFilter) return false;
    if (confidenceFilter === 'high' && p.confidence_score < 0.8) return false;
    if (confidenceFilter === 'medium' && (p.confidence_score < 0.6 || p.confidence_score >= 0.8)) return false;
    if (confidenceFilter === 'low' && p.confidence_score >= 0.6) return false;
    return true;
  });

  const filteredAlerts = alerts.filter(a => {
    if (metricFilter !== 'all' && a.metric_name !== metricFilter) return false;
    if (alertLevelFilter !== 'all' && a.alert_level !== alertLevelFilter) return false;
    return true;
  });

  const getAlertLevelColor = (level: string) => {
    switch (level) {
      case 'critical': return 'bg-red-500';
      case 'warning': return 'bg-yellow-500';
      case 'info': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getConfidenceBadge = (score: number) => {
    if (score >= 0.8) return <Badge className="bg-green-500">High ({(score * 100).toFixed(0)}%)</Badge>;
    if (score >= 0.6) return <Badge className="bg-yellow-500">Medium ({(score * 100).toFixed(0)}%)</Badge>;
    return <Badge className="bg-red-500">Low ({(score * 100).toFixed(0)}%)</Badge>;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Brain className="h-8 w-8 text-purple-600" />
            Predictive Insights
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            AI-powered forecasts and proactive alerts for your operations
          </p>
        </div>
        <Button onClick={fetchPredictiveData} disabled={loading} variant="outline">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Filter Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Metric Type</label>
              <Select value={metricFilter} onValueChange={setMetricFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Metrics" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Metrics</SelectItem>
                  {availableMetrics.map(metric => (
                    <SelectItem key={metric} value={metric}>{metric}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Alert Level</label>
              <Select value={alertLevelFilter} onValueChange={setAlertLevelFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Levels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Confidence Range</label>
              <Select value={confidenceFilter} onValueChange={setConfidenceFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Confidence" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Confidence</SelectItem>
                  <SelectItem value="high">High (≥80%)</SelectItem>
                  <SelectItem value="medium">Medium (60-80%)</SelectItem>
                  <SelectItem value="low">Low (&lt;60%)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active Alerts */}
      {filteredAlerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Active Predictive Alerts ({filteredAlerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {filteredAlerts.map(alert => (
                <div
                  key={alert.id}
                  className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-2 h-2 rounded-full ${getAlertLevelColor(alert.alert_level)}`} />
                        <span className="font-semibold">{alert.metric_name}</span>
                        <Badge variant="outline" className="text-xs">
                          {alert.alert_level.toUpperCase()}
                        </Badge>
                        {getConfidenceBadge(alert.confidence_score)}
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                        {alert.alert_message}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Breach in {alert.time_to_breach_hours}h
                        </span>
                        <span>
                          Predicted: {alert.predicted_value.toFixed(2)} | Threshold: {alert.threshold_value.toFixed(2)}
                        </span>
                      </div>
                      {alert.recommendation && (
                        <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-sm">
                          <span className="font-medium">Recommendation:</span> {alert.recommendation}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Forecast Data Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Forecasts ({filteredPredictions.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : filteredPredictions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No predictions available. Train a model to start generating forecasts.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 text-sm font-medium">Metric</th>
                    <th className="text-left p-3 text-sm font-medium">Model</th>
                    <th className="text-right p-3 text-sm font-medium">Predicted Value</th>
                    <th className="text-right p-3 text-sm font-medium">Confidence</th>
                    <th className="text-right p-3 text-sm font-medium">Range</th>
                    <th className="text-left p-3 text-sm font-medium">Target Time</th>
                    <th className="text-left p-3 text-sm font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPredictions.map(prediction => (
                    <tr key={prediction.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{prediction.metric_name}</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {prediction.predictive_models?.model_name || 'Unknown'}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <span className="font-semibold">{prediction.predicted_value.toFixed(2)}</span>
                      </td>
                      <td className="p-3 text-right">
                        {getConfidenceBadge(prediction.confidence_score)}
                      </td>
                      <td className="p-3 text-right text-sm text-gray-600">
                        {prediction.lower_bound.toFixed(2)} - {prediction.upper_bound.toFixed(2)}
                      </td>
                      <td className="p-3 text-sm">
                        {format(new Date(prediction.forecast_target_time), 'MMM d, h:mm a')}
                      </td>
                      <td className="p-3 text-sm text-gray-500">
                        {format(new Date(prediction.created_at), 'MMM d, h:mm a')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Explanation Section */}
      {filteredPredictions.length > 0 && filteredPredictions[0].explanation && (
        <Card>
          <CardHeader>
            <CardTitle>Latest Forecast Insight</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-semibold">{filteredPredictions[0].metric_name}</span>
                {getConfidenceBadge(filteredPredictions[0].confidence_score)}
              </div>
              <p className="text-gray-700 dark:text-gray-300">
                {filteredPredictions[0].explanation}
              </p>
              <div className="text-sm text-gray-500 mt-2">
                Forecast for: {format(new Date(filteredPredictions[0].forecast_target_time), 'MMMM d, yyyy h:mm a')}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Forecast Detail Panel with Historical Patterns */}
      {selectedMetric && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Historical Patterns: {selectedMetric}</span>
              <Button variant="ghost" size="sm" onClick={() => setSelectedMetric(null)}>
                Close
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Memory Snapshots for Selected Metric */}
              <div>
                <h3 className="font-semibold mb-2">Historical Trend Analysis</h3>
                {memorySnapshots.filter(s => s.metric_name === selectedMetric).length > 0 ? (
                  <div className="space-y-2">
                    {memorySnapshots
                      .filter(s => s.metric_name === selectedMetric)
                      .map(snapshot => (
                        <div key={snapshot.id} className="border rounded p-3 bg-gray-50 dark:bg-gray-800">
                          <div className="flex items-center justify-between mb-2">
                            <Badge variant="outline">{snapshot.data_window}</Badge>
                            <span className="text-xs text-gray-500">
                              {format(new Date(snapshot.created_at), 'MMM d, h:mm a')}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                            <div>
                              <span className="text-gray-600">Avg Value:</span>
                              <span className="font-semibold ml-1">{snapshot.avg_value.toFixed(2)}</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Trend:</span>
                              <span className={`font-semibold ml-1 ${snapshot.trend_slope > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {snapshot.trend_slope > 0 ? '↑' : '↓'} {Math.abs(snapshot.trend_slope * 1000).toFixed(2)}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-600">Variance:</span>
                              <span className="font-semibold ml-1">{snapshot.variance.toFixed(2)}</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Samples:</span>
                              <span className="font-semibold ml-1">{snapshot.sample_count}</span>
                            </div>
                          </div>
                          {snapshot.seasonality_detected && (
                            <div className="mt-2 text-xs text-purple-600">
                              ✓ Seasonality detected: {snapshot.seasonality_period}
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No historical patterns available for this metric yet.</p>
                )}
              </div>

              {/* Model Refinement Logs */}
              {refinementLogs.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Recent Model Refinements</h3>
                  <div className="space-y-2">
                    {refinementLogs.map(log => (
                      <div key={log.id} className="border rounded p-3 bg-blue-50 dark:bg-blue-900/20">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-sm">
                            {log.predictive_models?.model_name || 'Unknown Model'}
                          </span>
                          <span className="text-xs text-gray-500">
                            {format(new Date(log.created_at), 'MMM d, h:mm a')}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-gray-600">Accuracy Change:</span>
                            <span className={`font-semibold ml-1 ${log.accuracy_delta > 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {log.accuracy_delta > 0 ? '+' : ''}{(log.accuracy_delta * 100).toFixed(1)}%
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-600">Deviation:</span>
                            <span className="font-semibold ml-1">{(log.deviation_detected * 100).toFixed(1)}%</span>
                          </div>
                        </div>
                        <Badge variant="outline" className="mt-2 text-xs">
                          {log.refinement_type}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Access to Historical Patterns */}
      {memorySnapshots.length > 0 && !selectedMetric && (
        <Card>
          <CardHeader>
            <CardTitle>Historical Pattern Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {Array.from(new Set(memorySnapshots.map(s => s.metric_name))).map(metric => (
                <button
                  key={metric}
                  onClick={() => setSelectedMetric(metric)}
                  className="border rounded p-3 hover:bg-gray-50 dark:hover:bg-gray-800 text-left transition-colors"
                >
                  <div className="font-medium mb-1">{metric}</div>
                  <div className="text-xs text-gray-500">
                    {memorySnapshots.filter(s => s.metric_name === metric).length} snapshots available
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
