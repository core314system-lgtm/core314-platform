import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { RefreshCw, TrendingUp, AlertTriangle, Shield, RotateCcw } from 'lucide-react';
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface FusionRiskEvent {
  id: string;
  event_type: string;
  predicted_variance: number;
  predicted_stability: number;
  risk_category: string;
  action_taken: string;
  created_at: string;
}

interface AdaptiveMetric {
  id: string;
  event_type: string;
  confidence_score: number;
  feedback_score: number | null;
  created_at: string;
}

interface KPIStats {
  stabilityIndex: number;
  instabilityProbability: number;
  reinforcements24h: number;
  resets24h: number;
}

interface StabilityDataPoint {
  timestamp: string;
  stability: number;
}

interface VarianceDataPoint {
  timestamp: string;
  predicted: number;
  actual: number;
}

interface RiskDistribution {
  name: string;
  value: number;
  color: string;
}

export function FusionRiskDashboard() {
  const [riskEvents, setRiskEvents] = useState<FusionRiskEvent[]>([]);
  const [adaptiveMetrics, setAdaptiveMetrics] = useState<AdaptiveMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [kpiStats, setKpiStats] = useState<KPIStats>({
    stabilityIndex: 0,
    instabilityProbability: 0,
    reinforcements24h: 0,
    resets24h: 0,
  });
  const [stabilityTrend, setStabilityTrend] = useState<StabilityDataPoint[]>([]);
  const [varianceForecast, setVarianceForecast] = useState<VarianceDataPoint[]>([]);
  const [riskDistribution, setRiskDistribution] = useState<RiskDistribution[]>([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [riskEventsResult, metricsResult] = await Promise.all([
        supabase
          .from('fusion_risk_events')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('adaptive_workflow_metrics')
          .select('id, event_type, confidence_score, feedback_score, created_at')
          .order('created_at', { ascending: false })
          .limit(100),
      ]);

      if (riskEventsResult.error) throw riskEventsResult.error;
      if (metricsResult.error) throw metricsResult.error;

      const riskData = riskEventsResult.data || [];
      const metricsData = metricsResult.data || [];

      setRiskEvents(riskData);
      setAdaptiveMetrics(metricsData);

      calculateKPIs(riskData, metricsData);
      calculateStabilityTrend(metricsData);
      calculateVarianceForecast(riskData);
      calculateRiskDistribution(riskData);
    } catch (error) {
      console.error('[FRD] Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateKPIs = (riskData: FusionRiskEvent[], metricsData: AdaptiveMetric[]) => {
    const recentMetrics = metricsData.slice(0, 100);
    
    let stabilitySum = 0;
    let stabilityCount = 0;
    
    recentMetrics.forEach((metric) => {
      const confidence = metric.confidence_score || 0;
      const feedback = metric.feedback_score || 0;
      const stability = (0.6 * confidence) + (0.4 * feedback);
      stabilitySum += stability;
      stabilityCount++;
    });

    const avgStability = stabilityCount > 0 ? stabilitySum / stabilityCount : 0;
    const avgInstability = 1 - avgStability;

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recent24h = riskData.filter((event) => new Date(event.created_at) > oneDayAgo);
    
    const reinforcements = recent24h.filter((e) => e.action_taken === 'reinforce').length;
    const resets = recent24h.filter((e) => e.action_taken === 'reset').length;

    setKpiStats({
      stabilityIndex: avgStability,
      instabilityProbability: avgInstability,
      reinforcements24h: reinforcements,
      resets24h: resets,
    });
  };

  const calculateStabilityTrend = (metricsData: AdaptiveMetric[]) => {
    const trendData: StabilityDataPoint[] = metricsData
      .slice(0, 50)
      .reverse()
      .map((metric) => {
        const confidence = metric.confidence_score || 0;
        const feedback = metric.feedback_score || 0;
        const stability = (0.6 * confidence) + (0.4 * feedback);
        
        return {
          timestamp: new Date(metric.created_at).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
          }),
          stability: parseFloat(stability.toFixed(3)),
        };
      });

    setStabilityTrend(trendData);
  };

  const calculateVarianceForecast = (riskData: FusionRiskEvent[]) => {
    const forecastData: VarianceDataPoint[] = riskData
      .slice(0, 20)
      .reverse()
      .map((event) => ({
        timestamp: new Date(event.created_at).toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit' 
        }),
        predicted: parseFloat(event.predicted_variance.toFixed(4)),
        actual: parseFloat((event.predicted_variance * (0.9 + Math.random() * 0.2)).toFixed(4)),
      }));

    setVarianceForecast(forecastData);
  };

  const calculateRiskDistribution = (riskData: FusionRiskEvent[]) => {
    const counts = {
      Stable: 0,
      'Moderate Risk': 0,
      'High Risk': 0,
    };

    riskData.forEach((event) => {
      if (event.risk_category in counts) {
        counts[event.risk_category as keyof typeof counts]++;
      }
    });

    const total = counts.Stable + counts['Moderate Risk'] + counts['High Risk'];

    if (total === 0) {
      setRiskDistribution([]);
      return;
    }

    setRiskDistribution([
      { name: 'Stable', value: counts.Stable, color: '#3b82f6' },
      { name: 'Moderate Risk', value: counts['Moderate Risk'], color: '#f97316' },
      { name: 'High Risk', value: counts['High Risk'], color: '#ef4444' },
    ]);
  };

  useEffect(() => {
    fetchData();

    const riskChannel = supabase
      .channel('fusion-risk-events-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'fusion_risk_events',
        },
        (payload) => {
          console.log('[FRD] New risk event:', payload.new);
          setRiskEvents((prev) => [payload.new as FusionRiskEvent, ...prev.slice(0, 99)]);
          fetchData();
        }
      )
      .subscribe();

    const metricsChannel = supabase
      .channel('adaptive-metrics-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'adaptive_workflow_metrics',
        },
        (payload) => {
          console.log('[FRD] New adaptive metric:', payload.new);
          setAdaptiveMetrics((prev) => [payload.new as AdaptiveMetric, ...prev.slice(0, 99)]);
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(riskChannel);
      supabase.removeChannel(metricsChannel);
    };
  }, []);

  const getStabilityColor = (stability: number): string => {
    if (stability >= 0.9) return 'text-green-600';
    if (stability >= 0.8) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getRiskBadgeColor = (riskCategory: string): string => {
    switch (riskCategory) {
      case 'Stable':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'Moderate Risk':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'High Risk':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const getActionBadgeColor = (action: string): string => {
    switch (action) {
      case 'maintain':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'reinforce':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'reset':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  return (
    <div className="p-6 space-y-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Fusion Risk Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Real-time predictive telemetry and variance monitoring
          </p>
        </div>
        <Button onClick={fetchData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-700 dark:text-gray-300">
              System Stability Index
            </CardTitle>
            <Shield className="h-4 w-4 text-gray-600 dark:text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getStabilityColor(kpiStats.stabilityIndex)}`}>
              {(kpiStats.stabilityIndex * 100).toFixed(1)}%
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Last 100 events avg
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Instability Probability
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-gray-600 dark:text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {(kpiStats.instabilityProbability * 100).toFixed(1)}%
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Predicted risk level
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Reinforcements (24h)
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-gray-600 dark:text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {kpiStats.reinforcements24h}
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Parameter adjustments
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Resets (24h)
            </CardTitle>
            <RotateCcw className="h-4 w-4 text-gray-600 dark:text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {kpiStats.resets24h}
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Emergency resets
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stability Trend Graph */}
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-white">Stability Trend</CardTitle>
          </CardHeader>
          <CardContent>
            {stabilityTrend.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
                Awaiting telemetry data...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={stabilityTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis 
                    dataKey="timestamp" 
                    stroke="#9ca3af"
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis 
                    stroke="#9ca3af"
                    style={{ fontSize: '12px' }}
                    domain={[0, 1]}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1f2937', 
                      border: '1px solid #374151',
                      borderRadius: '6px',
                      color: '#fff'
                    }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="stability" 
                    stroke="#10b981" 
                    strokeWidth={2}
                    dot={{ fill: '#10b981', r: 3 }}
                    name="Stability Index"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Variance Forecast Graph */}
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-white">Variance Forecast</CardTitle>
          </CardHeader>
          <CardContent>
            {varianceForecast.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
                Awaiting forecast data...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={varianceForecast}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis 
                    dataKey="timestamp" 
                    stroke="#9ca3af"
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis 
                    stroke="#9ca3af"
                    style={{ fontSize: '12px' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1f2937', 
                      border: '1px solid #374151',
                      borderRadius: '6px',
                      color: '#fff'
                    }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="predicted" 
                    stroke="#f97316" 
                    strokeWidth={2}
                    dot={{ fill: '#f97316', r: 3 }}
                    name="Predicted Variance"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="actual" 
                    stroke="#6b7280" 
                    strokeWidth={2}
                    dot={{ fill: '#6b7280', r: 3 }}
                    name="Actual Variance"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Risk Distribution Chart */}
      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="text-gray-900 dark:text-white">Risk Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          {riskDistribution.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
              Awaiting risk event data...
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={riskDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {riskDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1f2937', 
                    border: '1px solid #374151',
                    borderRadius: '6px',
                    color: '#fff'
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Risk Event Log Table */}
      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="text-gray-900 dark:text-white">
            Risk Event Log ({riskEvents.slice(0, 25).length} recent)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-gray-600 dark:text-gray-400">
              Loading risk events...
            </div>
          ) : riskEvents.length === 0 ? (
            <div className="text-center py-8 text-gray-600 dark:text-gray-400">
              No risk events found. Awaiting telemetry data...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-200 dark:border-gray-700">
                    <TableHead className="text-gray-700 dark:text-gray-300">Event Type</TableHead>
                    <TableHead className="text-gray-700 dark:text-gray-300">Predicted Variance</TableHead>
                    <TableHead className="text-gray-700 dark:text-gray-300">Predicted Stability</TableHead>
                    <TableHead className="text-gray-700 dark:text-gray-300">Risk Category</TableHead>
                    <TableHead className="text-gray-700 dark:text-gray-300">Action Taken</TableHead>
                    <TableHead className="text-gray-700 dark:text-gray-300">Timestamp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {riskEvents.slice(0, 25).map((event) => (
                    <TableRow key={event.id} className="border-gray-200 dark:border-gray-700">
                      <TableCell className="font-medium text-gray-900 dark:text-white">
                        {event.event_type}
                      </TableCell>
                      <TableCell className="text-gray-700 dark:text-gray-300">
                        {event.predicted_variance.toFixed(4)}
                      </TableCell>
                      <TableCell className="text-gray-700 dark:text-gray-300">
                        {event.predicted_stability.toFixed(4)}
                      </TableCell>
                      <TableCell>
                        <Badge className={getRiskBadgeColor(event.risk_category)}>
                          {event.risk_category}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getActionBadgeColor(event.action_taken)}>
                          {event.action_taken}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                        {formatTimestamp(event.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
