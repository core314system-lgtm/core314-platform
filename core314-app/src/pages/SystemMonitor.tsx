import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Activity, AlertTriangle, CheckCircle, XCircle, TrendingUp, TrendingDown, Clock, Zap } from 'lucide-react';

interface HealthEvent {
  id: string;
  component_type: string;
  component_name: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'critical' | 'unknown';
  latency_ms: number;
  error_rate: number;
  availability_percentage: number;
  cpu_usage_percent: number;
  memory_usage_percent: number;
  created_at: string;
}

interface SystemStats {
  total_components: number;
  healthy_components: number;
  degraded_components: number;
  unhealthy_components: number;
  critical_components: number;
  avg_latency: number;
  avg_error_rate: number;
  overall_availability: number;
}

export function SystemMonitor() {
  const [healthEvents, setHealthEvents] = useState<HealthEvent[]>([]);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [componentTypeFilter, setComponentTypeFilter] = useState<string>('all');

  useEffect(() => {
    fetchHealthEvents();
    calculateStats();

    const channel = supabase
      .channel('system_health_events_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'system_health_events',
        },
        () => {
          fetchHealthEvents();
          calculateStats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [filter, componentTypeFilter]);

  const fetchHealthEvents = async () => {
    try {
      let query = supabase
        .from('system_health_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      if (componentTypeFilter !== 'all') {
        query = query.eq('component_type', componentTypeFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setHealthEvents(data || []);
    } catch (error) {
      console.error('Error fetching health events:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = async () => {
    try {
      const { data, error } = await supabase
        .from('system_health_events')
        .select('*')
        .gte('created_at', new Date(Date.now() - 3600000).toISOString()); // Last hour

      if (error) throw error;

      if (!data || data.length === 0) {
        setStats({
          total_components: 0,
          healthy_components: 0,
          degraded_components: 0,
          unhealthy_components: 0,
          critical_components: 0,
          avg_latency: 0,
          avg_error_rate: 0,
          overall_availability: 100,
        });
        return;
      }

      const componentMap = new Map<string, HealthEvent>();
      data.forEach((event: HealthEvent) => {
        const key = `${event.component_type}:${event.component_name}`;
        if (!componentMap.has(key) || new Date(event.created_at) > new Date(componentMap.get(key)!.created_at)) {
          componentMap.set(key, event);
        }
      });

      const uniqueComponents = Array.from(componentMap.values());

      const stats: SystemStats = {
        total_components: uniqueComponents.length,
        healthy_components: uniqueComponents.filter((e) => e.status === 'healthy').length,
        degraded_components: uniqueComponents.filter((e) => e.status === 'degraded').length,
        unhealthy_components: uniqueComponents.filter((e) => e.status === 'unhealthy').length,
        critical_components: uniqueComponents.filter((e) => e.status === 'critical').length,
        avg_latency: uniqueComponents.reduce((sum, e) => sum + (e.latency_ms || 0), 0) / uniqueComponents.length,
        avg_error_rate: uniqueComponents.reduce((sum, e) => sum + (e.error_rate || 0), 0) / uniqueComponents.length,
        overall_availability: uniqueComponents.reduce((sum, e) => sum + (e.availability_percentage || 100), 0) / uniqueComponents.length,
      };

      setStats(stats);
    } catch (error) {
      console.error('Error calculating stats:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'unhealthy':
        return <XCircle className="w-5 h-5 text-orange-500" />;
      case 'critical':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Activity className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const baseClasses = 'px-2 py-1 rounded-full text-xs font-medium';
    switch (status) {
      case 'healthy':
        return <span className={`${baseClasses} bg-green-100 text-green-800`}>Healthy</span>;
      case 'degraded':
        return <span className={`${baseClasses} bg-yellow-100 text-yellow-800`}>Degraded</span>;
      case 'unhealthy':
        return <span className={`${baseClasses} bg-orange-100 text-orange-800`}>Unhealthy</span>;
      case 'critical':
        return <span className={`${baseClasses} bg-red-100 text-red-800`}>Critical</span>;
      default:
        return <span className={`${baseClasses} bg-gray-100 text-gray-800`}>Unknown</span>;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Monitor</h1>
          <p className="text-sm text-gray-600 mt-1">Real-time system health and performance monitoring</p>
        </div>
        <button
          onClick={() => {
            fetchHealthEvents();
            calculateStats();
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Components</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total_components}</p>
              </div>
              <Activity className="w-8 h-8 text-blue-500" />
            </div>
            <div className="mt-4 flex items-center space-x-4 text-xs">
              <span className="text-green-600">✓ {stats.healthy_components}</span>
              <span className="text-yellow-600">⚠ {stats.degraded_components}</span>
              <span className="text-red-600">✗ {stats.critical_components}</span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg Latency</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{Math.round(stats.avg_latency)}ms</p>
              </div>
              <Clock className="w-8 h-8 text-purple-500" />
            </div>
            <div className="mt-4 flex items-center text-xs">
              {stats.avg_latency < 200 ? (
                <span className="text-green-600 flex items-center">
                  <TrendingDown className="w-3 h-3 mr-1" /> Excellent
                </span>
              ) : stats.avg_latency < 500 ? (
                <span className="text-yellow-600 flex items-center">
                  <TrendingUp className="w-3 h-3 mr-1" /> Good
                </span>
              ) : (
                <span className="text-red-600 flex items-center">
                  <TrendingUp className="w-3 h-3 mr-1" /> High
                </span>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Error Rate</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.avg_error_rate.toFixed(2)}%</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-orange-500" />
            </div>
            <div className="mt-4 flex items-center text-xs">
              {stats.avg_error_rate < 1 ? (
                <span className="text-green-600">✓ Low</span>
              ) : stats.avg_error_rate < 5 ? (
                <span className="text-yellow-600">⚠ Moderate</span>
              ) : (
                <span className="text-red-600">✗ High</span>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Availability</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.overall_availability.toFixed(2)}%</p>
              </div>
              <Zap className="w-8 h-8 text-green-500" />
            </div>
            <div className="mt-4 flex items-center text-xs">
              {stats.overall_availability >= 99.9 ? (
                <span className="text-green-600">✓ Excellent</span>
              ) : stats.overall_availability >= 99 ? (
                <span className="text-yellow-600">⚠ Good</span>
              ) : (
                <span className="text-red-600">✗ Poor</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Statuses</option>
              <option value="healthy">Healthy</option>
              <option value="degraded">Degraded</option>
              <option value="unhealthy">Unhealthy</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Component Type</label>
            <select
              value={componentTypeFilter}
              onChange={(e) => setComponentTypeFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Types</option>
              <option value="edge_function">Edge Functions</option>
              <option value="api_endpoint">API Endpoints</option>
              <option value="database_query">Database</option>
              <option value="integration">Integrations</option>
              <option value="frontend">Frontend</option>
            </select>
          </div>
        </div>
      </div>

      {/* Health Events Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Recent Health Events</h2>
          <p className="text-sm text-gray-600 mt-1">Last 50 health check results</p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Component
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Latency
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Error Rate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Availability
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  CPU
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Memory
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Time
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {healthEvents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    No health events found
                  </td>
                </tr>
              ) : (
                healthEvents.map((event) => (
                  <tr key={event.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(event.status)}
                        {getStatusBadge(event.status)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{event.component_name}</div>
                      <div className="text-xs text-gray-500">{event.component_type}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm ${event.latency_ms > 1000 ? 'text-red-600 font-semibold' : event.latency_ms > 500 ? 'text-yellow-600' : 'text-gray-900'}`}>
                        {event.latency_ms ? `${event.latency_ms}ms` : 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm ${event.error_rate > 5 ? 'text-red-600 font-semibold' : event.error_rate > 1 ? 'text-yellow-600' : 'text-gray-900'}`}>
                        {event.error_rate !== null ? `${event.error_rate.toFixed(2)}%` : 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm ${event.availability_percentage < 95 ? 'text-red-600 font-semibold' : event.availability_percentage < 99 ? 'text-yellow-600' : 'text-gray-900'}`}>
                        {event.availability_percentage !== null ? `${event.availability_percentage.toFixed(1)}%` : 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm ${event.cpu_usage_percent > 80 ? 'text-red-600 font-semibold' : event.cpu_usage_percent > 60 ? 'text-yellow-600' : 'text-gray-900'}`}>
                        {event.cpu_usage_percent !== null ? `${event.cpu_usage_percent.toFixed(1)}%` : 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm ${event.memory_usage_percent > 85 ? 'text-red-600 font-semibold' : event.memory_usage_percent > 70 ? 'text-yellow-600' : 'text-gray-900'}`}>
                        {event.memory_usage_percent !== null ? `${event.memory_usage_percent.toFixed(1)}%` : 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatTimestamp(event.created_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
