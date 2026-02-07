import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Skeleton } from '../components/ui/skeleton';
import { RefreshCw, TrendingUp, TrendingDown, Minus, ArrowLeft, BarChart3, Activity } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import { format } from 'date-fns';

interface MetricDefinition {
  id: string;
  integration_type: string;
  metric_name: string;
  metric_label: string;
  description: string | null;
  metric_unit: string | null;
  aggregation_type: string;
  source_field_path: string;
  is_primary: boolean;
  display_order: number;
  chart_type: string;
  chart_config: Record<string, unknown>;
}

interface MetricValue {
  id: string;
  metric_name: string;
  metric_value: number;
  metric_unit: string | null;
  calculated_at: string;
  period_start: string | null;
  period_end: string | null;
}

interface DashboardConfig {
  id: string;
  integration_type: string;
  visible_metrics: string[];
  refresh_interval_seconds: number;
  layout: unknown[];
  is_auto_generated: boolean;
}

interface IntegrationEvent {
  id: string;
  event_type: string;
  metadata: Record<string, unknown>;
  created_at: string;
  occurred_at: string;
}

interface ConnectedIntegration {
  id: string;
  integration_type: string;
  integration_name: string;
  status: string;
}

export function IntegrationDashboard(){
  const { integration } = useParams<{ integration: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [metricDefinitions, setMetricDefinitions] = useState<MetricDefinition[]>([]);
  const [metricValues, setMetricValues] = useState<MetricValue[]>([]);
  const [dashboardConfig, setDashboardConfig] = useState<DashboardConfig | null>(null);
  const [recentEvents, setRecentEvents] = useState<IntegrationEvent[]>([]);
  const [connectedIntegrations, setConnectedIntegrations] = useState<ConnectedIntegration[]>([]);
  const [historicalData, setHistoricalData] = useState<Record<string, { date: string; value: number }[]>>({});
  const [error, setError] = useState<string | null>(null);

  const fetchConnectedIntegrations = useCallback(async () => {
    if (!profile?.id) return;
    
    const { data } = await supabase
      .from('user_integrations')
      .select(`
        id,
        status,
        integrations_master (
          id,
          integration_type,
          integration_name
        )
      `)
      .eq('user_id', profile.id)
      .eq('status', 'active')
      .eq('added_by_user', true);
    
    if (data) {
      const integrations = data
        .filter(d => d.integrations_master)
        .map(d => {
          const master = d.integrations_master as unknown as { id: string; integration_type: string; integration_name: string } | null;
          return {
            id: d.id,
            integration_type: master?.integration_type || '',
            integration_name: master?.integration_name || '',
            status: d.status
          };
        });
      setConnectedIntegrations(integrations);
    }
  }, [profile?.id]);

  const fetchDashboardData = useCallback(async () => {
    if (!profile?.id || !integration) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Fetch metric definitions for this integration type
      const { data: definitions, error: defError } = await supabase
        .from('integration_metric_definitions')
        .select('*')
        .eq('integration_type', integration)
        .order('display_order');
      
      if (defError) throw defError;
      setMetricDefinitions(definitions || []);
      
      // Fetch dashboard config
      const { data: config } = await supabase
        .from('dashboard_configs')
        .select('*')
        .eq('user_id', profile.id)
        .eq('integration_type', integration)
        .single();
      
      setDashboardConfig(config);
      
      // Fetch latest metric values
      const { data: metrics } = await supabase
        .from('integration_metrics')
        .select('*')
        .eq('user_id', profile.id)
        .eq('integration_type', integration)
        .order('calculated_at', { ascending: false });
      
      // Get only the latest value for each metric
      const latestMetrics = new Map<string, MetricValue>();
      metrics?.forEach(m => {
        if (!latestMetrics.has(m.metric_name)) {
          latestMetrics.set(m.metric_name, m);
        }
      });
      setMetricValues(Array.from(latestMetrics.values()));
      
      // Fetch recent integration events for raw data display
      const { data: events } = await supabase
        .from('integration_events')
        .select('*')
        .eq('user_id', profile.id)
        .eq('service_name', integration)
        .order('created_at', { ascending: false })
        .limit(10);
      
      setRecentEvents(events || []);
      
      // Build historical data from events for trend charts
      const historical: Record<string, { date: string; value: number }[]> = {};
      events?.forEach(event => {
        const date = format(new Date(event.created_at), 'MMM dd');
        const metadata = event.metadata as Record<string, unknown>;
        
        definitions?.forEach(def => {
          if (def.source_field_path && metadata[def.source_field_path] !== undefined) {
            if (!historical[def.metric_name]) {
              historical[def.metric_name] = [];
            }
            historical[def.metric_name].push({
              date,
              value: Number(metadata[def.source_field_path]) || 0
            });
          }
        });
      });
      
      // Reverse to show oldest first
      Object.keys(historical).forEach(key => {
        historical[key] = historical[key].reverse();
      });
      setHistoricalData(historical);
      
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [profile?.id, integration]);

  const handleRefresh = async () => {
    if (!profile?.id || !integration) return;
    
    setRefreshing(true);
    try {
      // Call the calculate_integration_metrics function
      await supabase.rpc('calculate_integration_metrics', {
        p_user_id: profile.id,
        p_integration_type: integration
      });
      
      // Refetch data
      await fetchDashboardData();
    } catch (err) {
      console.error('Error refreshing metrics:', err);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchConnectedIntegrations();
  }, [fetchConnectedIntegrations]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Get metric value by name
  const getMetricValue = (metricName: string): number | null => {
    const metric = metricValues.find(m => m.metric_name === metricName);
    return metric ? metric.metric_value : null;
  };

  // Get metric from latest event metadata (fallback)
  const getMetricFromEvent = (fieldPath: string): number | null => {
    if (recentEvents.length === 0) return null;
    const latestEvent = recentEvents[0];
    const value = (latestEvent.metadata as Record<string, unknown>)[fieldPath];
    return typeof value === 'number' ? value : null;
  };

  // Format metric value for display
  const formatMetricValue = (value: number | null, unit: string | null): string => {
    if (value === null) return '-';
    
    if (unit === 'USD' || unit === '$') {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
    }
    if (unit === '%') {
      return `${value.toFixed(1)}%`;
    }
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toLocaleString();
  };

  // Render a stat card
  const renderStatCard = (def: MetricDefinition) => {
    let value = getMetricValue(def.metric_name);
    
    // Fallback to event metadata if no calculated metric
    if (value === null && def.source_field_path) {
      value = getMetricFromEvent(def.source_field_path);
    }
    
    const history = historicalData[def.metric_name] || [];
    const trend = history.length >= 2 
      ? history[history.length - 1].value - history[history.length - 2].value 
      : 0;
    
    return (
      <Card key={def.id} className={def.is_primary ? 'border-blue-200 dark:border-blue-800' : ''}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
            {def.metric_label}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end justify-between">
            <div className="text-2xl font-bold">
              {formatMetricValue(value, def.metric_unit)}
            </div>
            {trend !== 0 && (
              <div className={`flex items-center text-sm ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {trend > 0 ? <TrendingUp className="h-4 w-4 mr-1" /> : <TrendingDown className="h-4 w-4 mr-1" />}
                {Math.abs(trend).toLocaleString()}
              </div>
            )}
            {trend === 0 && history.length > 0 && (
              <div className="flex items-center text-sm text-gray-500">
                <Minus className="h-4 w-4 mr-1" />
                No change
              </div>
            )}
          </div>
          {def.description && (
            <p className="text-xs text-gray-500 mt-1">{def.description}</p>
          )}
          {history.length > 1 && (
            <div className="h-12 mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={history}>
                  <Area 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#3b82f6" 
                    fill="#3b82f6" 
                    fillOpacity={0.1}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // Render chart based on type
  const renderChart = (def: MetricDefinition) => {
    const data = historicalData[def.metric_name] || [];
    if (data.length === 0) return null;
    
    switch (def.chart_type) {
      case 'line':
        return (
          <Card key={def.id} className="col-span-2">
            <CardHeader>
              <CardTitle>{def.metric_label} Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data}>
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        );
      
      case 'bar':
        return (
          <Card key={def.id} className="col-span-2">
            <CardHeader>
              <CardTitle>{def.metric_label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data}>
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        );
      
      case 'area':
        return (
          <Card key={def.id} className="col-span-2">
            <CardHeader>
              <CardTitle>{def.metric_label} Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data}>
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Area type="monotone" dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        );
      
      default:
        return null;
    }
  };

  // Get integration display name
  const getIntegrationDisplayName = (type: string): string => {
    const names: Record<string, string> = {
      salesforce: 'Salesforce',
      slack: 'Slack',
      microsoft_teams: 'Microsoft Teams',
      google_calendar: 'Google Calendar',
      zoom: 'Zoom',
      quickbooks: 'QuickBooks',
      xero: 'Xero'
    };
    return names[type] || type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ');
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-red-200 dark:border-red-800">
          <CardContent className="p-6 text-center">
            <p className="text-red-600">{error}</p>
            <Button onClick={fetchDashboardData} className="mt-4">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const primaryMetrics = metricDefinitions.filter(d => d.is_primary);
  const secondaryMetrics = metricDefinitions.filter(d => !d.is_primary);
  const hasData = recentEvents.length > 0 || metricValues.length > 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {getIntegrationDisplayName(integration || '')} Dashboard
            </h1>
            <p className="text-sm text-gray-500">
              {hasData ? 'Real-time metrics from your connected integration' : 'Waiting for data ingestion'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Integration Selector */}
          <Select value={integration} onValueChange={(value) => navigate(`/dashboard/${value}`)}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select integration" />
            </SelectTrigger>
            <SelectContent>
              {connectedIntegrations.map(int => (
                <SelectItem key={int.id} value={int.integration_type}>
                  {getIntegrationDisplayName(int.integration_type)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleRefresh} disabled={refreshing} variant="outline" size="sm">
            <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* No Data State */}
      {!hasData && (
        <Card className="border-yellow-200 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-900/10">
          <CardContent className="p-6 text-center">
            <Activity className="h-12 w-12 mx-auto text-yellow-600 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Waiting for Data</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Your {getIntegrationDisplayName(integration || '')} integration is connected but hasn't ingested data yet.
              Data will appear here automatically after the next poll cycle.
            </p>
            <Button onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Check for Data
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Primary Metrics Grid */}
      {hasData && primaryMetrics.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {primaryMetrics.map(def => renderStatCard(def))}
        </div>
      )}

      {/* Secondary Metrics */}
      {hasData && secondaryMetrics.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-300">Additional Metrics</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {secondaryMetrics.map(def => renderStatCard(def))}
          </div>
        </div>
      )}

      {/* Charts Section */}
      {hasData && Object.keys(historicalData).length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-300">Trends</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {metricDefinitions
              .filter(d => d.chart_type !== 'stat' && historicalData[d.metric_name]?.length > 1)
              .map(def => renderChart(def))}
          </div>
        </div>
      )}

      {/* Recent Events / Raw Data */}
      {hasData && recentEvents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Recent Data Points
            </CardTitle>
            <CardDescription>
              Raw data from the last {recentEvents.length} poll cycles
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentEvents.slice(0, 5).map(event => (
                <div key={event.id} className="flex items-start justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div>
                    <p className="text-sm font-medium">{event.event_type}</p>
                    <p className="text-xs text-gray-500">
                      {format(new Date(event.created_at), 'MMM dd, yyyy HH:mm')}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    {Object.entries(event.metadata as Record<string, unknown>)
                      .filter(([key]) => !key.includes('timestamp') && !key.includes('poll'))
                      .slice(0, 3)
                      .map(([key, value]) => (
                        <div key={key} className="text-gray-600 dark:text-gray-400">
                          <span className="font-medium">{key.replace(/_/g, ' ')}:</span> {String(value)}
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dashboard Config Info */}
      {dashboardConfig && (
        <div className="text-xs text-gray-400 text-center">
          Dashboard {dashboardConfig.is_auto_generated ? 'auto-generated' : 'customized'} | 
          Refresh interval: {dashboardConfig.refresh_interval_seconds}s
        </div>
      )}
    </div>
  );
}

export default IntegrationDashboard;
