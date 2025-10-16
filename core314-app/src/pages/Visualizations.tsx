import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
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
  ResponsiveContainer,
  Area,
  AreaChart,
  Legend
} from 'recharts';
import { RefreshCw, Download, TrendingUp, AlertTriangle, Activity, BarChart3 } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import { VisualizationData } from '../types';
import { format } from 'date-fns';
import { FeatureGuard } from '../components/FeatureGuard';

export function Visualizations() {
  const { profile } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<string>('all');
  const [integrations, setIntegrations] = useState<string[]>([]);
  const [visualData, setVisualData] = useState<VisualizationData>({
    timeline: [],
    forecasts: [],
    anomalies: [],
    actions: []
  });

  useEffect(() => {
    if (profile?.id) {
      fetchIntegrations();
      fetchVisualizationData();
    }
  }, [profile?.id]);

  useEffect(() => {
    if (selectedIntegration) {
      fetchVisualizationData();
    }
  }, [selectedIntegration]);

  const fetchIntegrations = async () => {
    try {
      const { data } = await supabase
        .from('integrations_master')
        .select('integration_name')
        .order('integration_name');

      setIntegrations(data?.map(i => i.integration_name) || []);
    } catch (error) {
      console.error('Error fetching integrations:', error);
    }
  };

  const fetchVisualizationData = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fusion-visualize${
        selectedIntegration && selectedIntegration !== 'all' ? `?integration=${selectedIntegration}` : ''
      }`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const result = await response.json();

      if (result.success && result.data) {
        setVisualData(result.data);
      }
    } catch (error) {
      console.error('Error fetching visualization data:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch visualization data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fusion-refresh-visual-cache`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const result = await response.json();

      if (result.success) {
        toast({
          title: '✅ Data refreshed',
          description: `Updated ${result.refreshCount} cache entries`,
        });
        await fetchVisualizationData();
      }
    } catch (error) {
      console.error('Refresh error:', error);
      toast({
        title: 'Error',
        description: 'Failed to refresh data',
        variant: 'destructive',
      });
    } finally {
      setRefreshing(false);
    }
  };

  const handleExport = async (format: 'csv' | 'pdf') => {
    setExporting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fusion-export-report`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            format,
            integration: selectedIntegration,
          }),
        }
      );

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `core314_intelligence_report_${new Date().toISOString().split('T')[0]}.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        toast({
          title: '✅ Report exported',
          description: `Downloaded ${format.toUpperCase()} report`,
        });
      } else {
        throw new Error('Export failed');
      }
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: 'Error',
        description: 'Failed to export report',
        variant: 'destructive',
      });
    } finally {
      setExporting(false);
    }
  };

  const automationPieData = [
    { name: 'Success', value: visualData.actions.filter(a => a.result === 'success').length, color: '#10b981' },
    { name: 'Failed', value: visualData.actions.filter(a => a.result === 'failed').length, color: '#ef4444' },
  ].filter(item => item.value > 0);

  return (
    <FeatureGuard feature="ai_insights">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="h-8 w-8" />
              Predictive Visualization Suite
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Real-time visual analytics and predictive intelligence
            </p>
          </div>
          <div className="flex items-center gap-3">
          <Select value={selectedIntegration} onValueChange={setSelectedIntegration}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Integrations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Integrations</SelectItem>
              {integrations.map((int) => (
                <SelectItem key={int} value={int}>
                  {int}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleRefresh} disabled={refreshing} variant="outline">
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh Data
          </Button>
          <Button onClick={() => handleExport('csv')} disabled={exporting}>
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
          </div>
        </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Fusion Score Timeline (30 Days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {visualData.timeline.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={visualData.timeline}>
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
                      dot={{ fill: '#3b82f6' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="variance"
                      stroke="#f59e0b"
                      strokeWidth={1}
                      name="Variance"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-gray-600 py-8">No timeline data available</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                7-Day Predictive Forecast
              </CardTitle>
            </CardHeader>
            <CardContent>
              {visualData.forecasts.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={visualData.forecasts}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="confidence_high"
                      stroke="#93c5fd"
                      fill="#dbeafe"
                      fillOpacity={0.3}
                      name="Confidence High"
                    />
                    <Area
                      type="monotone"
                      dataKey="confidence_low"
                      stroke="#93c5fd"
                      fill="#ffffff"
                      fillOpacity={0.3}
                      name="Confidence Low"
                    />
                    <Line
                      type="monotone"
                      dataKey="predicted_score"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      name="Predicted Score"
                      dot={{ fill: '#3b82f6' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-gray-600 py-8">No forecast data available</p>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Anomaly Detection (30 Days)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {visualData.anomalies.length > 0 ? (
                  <div className="space-y-3">
                    {visualData.anomalies.slice(0, 10).map((anomaly, index) => (
                      <div
                        key={index}
                        className={`flex items-center justify-between p-3 rounded-md ${
                          anomaly.severity === 'high'
                            ? 'bg-red-100 dark:bg-red-900/20 border border-red-300'
                            : anomaly.severity === 'medium'
                            ? 'bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-300'
                            : 'bg-blue-100 dark:bg-blue-900/20 border border-blue-300'
                        }`}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium">
                              {anomaly.severity === 'high' && '🔴 High'}
                              {anomaly.severity === 'medium' && '🟡 Medium'}
                              {anomaly.severity === 'low' && '🔵 Low'}
                            </span>
                            <span className="text-xs text-gray-600 dark:text-gray-400">
                              {anomaly.date}
                            </span>
                          </div>
                          <p className="text-sm mt-1">{anomaly.message || anomaly.type}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-600 py-8">No anomalies detected</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Automation Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {automationPieData.length > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie
                            data={automationPieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {automationPieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Recent Actions</p>
                        {visualData.actions.slice(0, 10).map((action, index) => (
                          <div key={index} className="flex items-center justify-between text-xs border-b pb-2">
                            <span className="flex items-center gap-2">
                              {action.result === 'success' ? '✅' : '❌'}
                              <span className="font-medium">{action.integration}</span>
                              <span className="text-gray-500">{action.rule}</span>
                            </span>
                            <span className="text-gray-500">
                              {format(new Date(action.timestamp), 'MMM dd, h:mm a')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-center text-gray-600 py-8">No automation activity</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
      </div>
    </FeatureGuard>
  );
}
