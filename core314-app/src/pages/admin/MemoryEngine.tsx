import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Switch } from '../../components/ui/switch';
import { Brain, TrendingUp, RefreshCw, Clock, Activity, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface MemorySnapshot {
  id: string;
  metric_name: string;
  data_window: string;
  window_start: string;
  window_end: string;
  avg_value: number;
  trend_slope: number;
  variance: number;
  std_dev: number;
  min_value: number;
  max_value: number;
  sample_count: number;
  seasonality_detected: boolean;
  seasonality_period: string | null;
  created_at: string;
}

interface RefinementHistory {
  id: string;
  model_id: string;
  refinement_type: string;
  prev_accuracy: number;
  new_accuracy: number;
  accuracy_delta: number;
  prev_mae: number;
  new_mae: number;
  prev_rmse: number;
  new_rmse: number;
  adjustments: any;
  deviation_detected: number;
  samples_analyzed: number;
  refinement_reason: string;
  created_at: string;
  predictive_models?: {
    model_name: string;
    target_metric: string;
  };
}

export function MemoryEngine() {
  const { profile } = useAuth();
  const [snapshots, setSnapshots] = useState<MemorySnapshot[]>([]);
  const [refinements, setRefinements] = useState<RefinementHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [adaptiveMemoryEnabled, setAdaptiveMemoryEnabled] = useState(true);
  const [training, setTraining] = useState(false);
  const [refining, setRefining] = useState(false);

  useEffect(() => {
    if (profile?.id) {
      fetchMemoryData();
      setupRealtimeSubscriptions();
    }
  }, [profile?.id]);

  const fetchMemoryData = async () => {
    try {
      setLoading(true);

      const { data: snapshotsData, error: snapshotsError } = await supabase
        .from('memory_snapshots')
        .select('*')
        .eq('user_id', profile?.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (snapshotsError) throw snapshotsError;
      setSnapshots(snapshotsData || []);

      const { data: refinementsData, error: refinementsError } = await supabase
        .from('refinement_history')
        .select(`
          *,
          predictive_models (
            model_name,
            target_metric
          )
        `)
        .eq('user_id', profile?.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (refinementsError) throw refinementsError;
      setRefinements(refinementsData || []);
    } catch (error) {
      console.error('Error fetching memory data:', error);
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscriptions = () => {
    if (!profile?.id) return;

    const snapshotsChannel = supabase
      .channel('memory_snapshots_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'memory_snapshots',
          filter: `user_id=eq.${profile.id}`,
        },
        () => {
          fetchMemoryData();
        }
      )
      .subscribe();

    const refinementsChannel = supabase
      .channel('refinement_history_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'refinement_history',
          filter: `user_id=eq.${profile.id}`,
        },
        () => {
          fetchMemoryData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(snapshotsChannel);
      supabase.removeChannel(refinementsChannel);
    };
  };

  const handleTrainMemory = async () => {
    setTraining(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/train-memory-model`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: profile?.id,
          data_windows: ['7 days', '30 days', '90 days'],
        }),
      });

      if (!response.ok) throw new Error('Failed to train memory model');

      const result = await response.json();
      console.log('Memory training result:', result);
      
      setTimeout(() => fetchMemoryData(), 2000);
    } catch (error) {
      console.error('Error training memory:', error);
    } finally {
      setTraining(false);
    }
  };

  const handleRefineModels = async () => {
    setRefining(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/refine-predictive-models`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: profile?.id,
          lookback_hours: 24,
        }),
      });

      if (!response.ok) throw new Error('Failed to refine models');

      const result = await response.json();
      console.log('Model refinement result:', result);
      
      setTimeout(() => fetchMemoryData(), 2000);
    } catch (error) {
      console.error('Error refining models:', error);
    } finally {
      setRefining(false);
    }
  };

  const getTrendIcon = (slope: number) => {
    if (slope > 0.01) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (slope < -0.01) return <TrendingUp className="h-4 w-4 text-red-500 rotate-180" />;
    return <Activity className="h-4 w-4 text-gray-500" />;
  };

  const getAccuracyColor = (delta: number) => {
    if (delta > 0.05) return 'text-green-600';
    if (delta < -0.05) return 'text-red-600';
    return 'text-gray-600';
  };

  const refinementChartData = refinements.slice(0, 10).reverse().map(r => ({
    date: format(new Date(r.created_at), 'MMM d'),
    prev_accuracy: (r.prev_accuracy * 100).toFixed(1),
    new_accuracy: (r.new_accuracy * 100).toFixed(1),
    model: r.predictive_models?.model_name || 'Unknown',
  }));

  const deviationChartData = refinements
    .filter(r => r.deviation_detected)
    .slice(0, 10)
    .reverse()
    .map(r => ({
      date: format(new Date(r.created_at), 'MMM d'),
      deviation: (r.deviation_detected * 100).toFixed(1),
      threshold: 15,
      model: r.predictive_models?.model_name || 'Unknown',
    }));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Brain className="h-8 w-8 text-purple-500" />
            Adaptive Memory Engine
          </h1>
          <p className="text-gray-600 mt-1">
            Historical pattern learning and forecast refinement
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Enable Adaptive Memory</span>
            <Switch
              checked={adaptiveMemoryEnabled}
              onCheckedChange={setAdaptiveMemoryEnabled}
            />
          </div>
          <Button
            onClick={handleTrainMemory}
            disabled={training || !adaptiveMemoryEnabled}
            variant="outline"
          >
            {training ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Training...
              </>
            ) : (
              <>
                <Brain className="mr-2 h-4 w-4" />
                Train Memory
              </>
            )}
          </Button>
          <Button
            onClick={handleRefineModels}
            disabled={refining || !adaptiveMemoryEnabled}
          >
            {refining ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Refining...
              </>
            ) : (
              <>
                <TrendingUp className="mr-2 h-4 w-4" />
                Refine Models
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Memory Snapshots
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{snapshots.length}</div>
            <p className="text-xs text-gray-500 mt-1">Historical patterns stored</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Refinements Applied
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{refinements.length}</div>
            <p className="text-xs text-gray-500 mt-1">Model improvements</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Avg Accuracy Gain
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              +{refinements.length > 0
                ? ((refinements.reduce((sum, r) => sum + r.accuracy_delta, 0) / refinements.length) * 100).toFixed(1)
                : '0.0'}%
            </div>
            <p className="text-xs text-gray-500 mt-1">Per refinement cycle</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Seasonality Detected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {snapshots.filter(s => s.seasonality_detected).length}
            </div>
            <p className="text-xs text-gray-500 mt-1">Metrics with patterns</p>
          </CardContent>
        </Card>
      </div>

      {/* Refinement History Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Model Accuracy Improvements
          </CardTitle>
        </CardHeader>
        <CardContent>
          {refinementChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={refinementChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis label={{ value: 'Accuracy (%)', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="prev_accuracy"
                  stroke="#94a3b8"
                  strokeWidth={2}
                  name="Before Refinement"
                />
                <Line
                  type="monotone"
                  dataKey="new_accuracy"
                  stroke="#10b981"
                  strokeWidth={2}
                  name="After Refinement"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-12 text-gray-500">
              No refinement history available yet
            </div>
          )}
        </CardContent>
      </Card>

      {/* Deviation Detection Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Trend Deviation Detection
          </CardTitle>
        </CardHeader>
        <CardContent>
          {deviationChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={deviationChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis label={{ value: 'Deviation (%)', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="deviation"
                  stroke="#ef4444"
                  fill="#fecaca"
                  name="Detected Deviation"
                />
                <Line
                  type="monotone"
                  dataKey="threshold"
                  stroke="#f59e0b"
                  strokeDasharray="5 5"
                  name="Threshold (15%)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-12 text-gray-500">
              No deviation data available yet
            </div>
          )}
        </CardContent>
      </Card>

      {/* Memory Snapshots Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Memory Snapshots
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Metric</th>
                  <th className="text-left p-2">Window</th>
                  <th className="text-left p-2">Trend</th>
                  <th className="text-right p-2">Avg Value</th>
                  <th className="text-right p-2">Variance</th>
                  <th className="text-center p-2">Samples</th>
                  <th className="text-center p-2">Seasonality</th>
                  <th className="text-left p-2">Created</th>
                </tr>
              </thead>
              <tbody>
                {snapshots.slice(0, 10).map((snapshot) => (
                  <tr key={snapshot.id} className="border-b hover:bg-gray-50">
                    <td className="p-2 font-medium">{snapshot.metric_name}</td>
                    <td className="p-2">
                      <Badge variant="outline">{snapshot.data_window}</Badge>
                    </td>
                    <td className="p-2">
                      <div className="flex items-center gap-1">
                        {getTrendIcon(snapshot.trend_slope)}
                        <span className="text-sm">
                          {(snapshot.trend_slope * 1000).toFixed(2)}
                        </span>
                      </div>
                    </td>
                    <td className="p-2 text-right">{snapshot.avg_value.toFixed(2)}</td>
                    <td className="p-2 text-right">{snapshot.variance.toFixed(2)}</td>
                    <td className="p-2 text-center">{snapshot.sample_count}</td>
                    <td className="p-2 text-center">
                      {snapshot.seasonality_detected ? (
                        <Badge className="bg-purple-100 text-purple-800">
                          {snapshot.seasonality_period}
                        </Badge>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="p-2 text-sm text-gray-600">
                      {format(new Date(snapshot.created_at), 'MMM d, HH:mm')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Refinement History Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Refinement History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Model</th>
                  <th className="text-left p-2">Type</th>
                  <th className="text-right p-2">Prev Accuracy</th>
                  <th className="text-right p-2">New Accuracy</th>
                  <th className="text-right p-2">Change</th>
                  <th className="text-right p-2">Deviation</th>
                  <th className="text-center p-2">Samples</th>
                  <th className="text-left p-2">Created</th>
                </tr>
              </thead>
              <tbody>
                {refinements.map((refinement) => (
                  <tr key={refinement.id} className="border-b hover:bg-gray-50">
                    <td className="p-2 font-medium">
                      {refinement.predictive_models?.model_name || 'Unknown'}
                    </td>
                    <td className="p-2">
                      <Badge variant="outline">{refinement.refinement_type}</Badge>
                    </td>
                    <td className="p-2 text-right">
                      {(refinement.prev_accuracy * 100).toFixed(1)}%
                    </td>
                    <td className="p-2 text-right">
                      {(refinement.new_accuracy * 100).toFixed(1)}%
                    </td>
                    <td className={`p-2 text-right font-semibold ${getAccuracyColor(refinement.accuracy_delta)}`}>
                      {refinement.accuracy_delta > 0 ? '+' : ''}
                      {(refinement.accuracy_delta * 100).toFixed(1)}%
                    </td>
                    <td className="p-2 text-right">
                      {refinement.deviation_detected
                        ? `${(refinement.deviation_detected * 100).toFixed(1)}%`
                        : '-'}
                    </td>
                    <td className="p-2 text-center">{refinement.samples_analyzed}</td>
                    <td className="p-2 text-sm text-gray-600">
                      {format(new Date(refinement.created_at), 'MMM d, HH:mm')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
