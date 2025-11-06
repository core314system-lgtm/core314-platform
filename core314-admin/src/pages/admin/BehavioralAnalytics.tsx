
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Activity, Users, TrendingUp, Link2, RefreshCw, Download } from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface BehavioralMetric {
  id: string;
  user_id: string | null;
  event_type: string;
  event_source: string;
  event_context: Record<string, unknown>;
  outcome_reference: string | null;
  behavior_score: number;
  created_at: string;
}

interface KPIData {
  totalEvents: number;
  uniqueUsers: number;
  avgBehaviorScore: number;
  correlatedOutcomes: number;
}

export function BehavioralAnalytics() {
  const [metrics, setMetrics] = useState<BehavioralMetric[]>([]);
  const [kpis, setKPIs] = useState<KPIData>({
    totalEvents: 0,
    uniqueUsers: 0,
    avgBehaviorScore: 0,
    correlatedOutcomes: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('fusion_behavioral_metrics')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      const metricsData = data || [];
      setMetrics(metricsData);

      const uniqueUserIds = new Set(metricsData.filter(m => m.user_id).map(m => m.user_id));
      const avgScore = metricsData.length > 0
        ? metricsData.reduce((sum, m) => sum + (m.behavior_score || 0), 0) / metricsData.length
        : 0;
      const correlated = metricsData.filter(m => m.outcome_reference !== null).length;

      setKPIs({
        totalEvents: metricsData.length,
        uniqueUsers: uniqueUserIds.size,
        avgBehaviorScore: parseFloat(avgScore.toFixed(2)),
        correlatedOutcomes: correlated,
      });
    } catch (error) {
      console.error('Error fetching behavioral metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();

    const subscription = supabase
      .channel('behavioral_metrics_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'fusion_behavioral_metrics',
        },
        () => {
          fetchMetrics();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const filteredMetrics = metrics.filter((metric) => {
    const matchesSearch =
      searchTerm === '' ||
      metric.event_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      metric.event_source.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesEventType =
      eventTypeFilter === 'all' || metric.event_type === eventTypeFilter;

    const matchesSource =
      sourceFilter === 'all' || metric.event_source === sourceFilter;

    return matchesSearch && matchesEventType && matchesSource;
  });

  const eventTypes = Array.from(new Set(metrics.map(m => m.event_type)));
  const sources = Array.from(new Set(metrics.map(m => m.event_source)));

  const trendData = (() => {
    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (29 - i));
      return date.toISOString().split('T')[0];
    });

    return last30Days.map(date => {
      const dayMetrics = metrics.filter(m => m.created_at.startsWith(date));
      const avgScore = dayMetrics.length > 0
        ? dayMetrics.reduce((sum, m) => sum + (m.behavior_score || 0), 0) / dayMetrics.length
        : 0;

      return {
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        score: parseFloat(avgScore.toFixed(2)),
      };
    });
  })();

  const eventTypeData = (() => {
    const typeCounts = new Map<string, number>();
    metrics.forEach(m => {
      typeCounts.set(m.event_type, (typeCounts.get(m.event_type) || 0) + 1);
    });

    return Array.from(typeCounts.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  })();

  const exportToCSV = () => {
    const headers = ['ID', 'Event Type', 'Event Source', 'Behavior Score', 'Outcome Reference', 'Created At'];
    const rows = filteredMetrics.map(m => [
      m.id,
      m.event_type,
      m.event_source,
      m.behavior_score?.toString() || '0',
      m.outcome_reference || 'N/A',
      new Date(m.created_at).toLocaleString(),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `behavioral-analytics-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Behavioral Analytics Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Track user interactions and correlate with optimization outcomes
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchMetrics}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Events</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{kpis.totalEvents}</p>
            </div>
            <Activity className="w-12 h-12 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Unique Users</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{kpis.uniqueUsers}</p>
            </div>
            <Users className="w-12 h-12 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Avg Behavior Score</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {kpis.avgBehaviorScore.toFixed(1)}
              </p>
            </div>
            <TrendingUp className="w-12 h-12 text-purple-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Correlated Outcomes</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{kpis.correlatedOutcomes}</p>
            </div>
            <Link2 className="w-12 h-12 text-orange-500" />
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Behavior Impact Score Trend */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Behavior Impact Score Trend (30 Days)
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#8b5cf6"
                strokeWidth={2}
                name="Behavior Score"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Event Type Distribution */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Event Type Distribution (Top 10)
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={eventTypeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="type" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" fill="#3b82f6" name="Event Count" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Filters and Table */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col md:flex-row gap-4">
            <input
              type="text"
              placeholder="Search by event type or source..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <select
              value={eventTypeFilter}
              onChange={(e) => setEventTypeFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Event Types</option>
              {eventTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Sources</option>
              {sources.map(source => (
                <option key={source} value={source}>{source}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Event Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Event Source
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Behavior Score
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Outcome Reference
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created At
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                    Loading behavioral metrics...
                  </td>
                </tr>
              ) : filteredMetrics.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                    No behavioral events found
                  </td>
                </tr>
              ) : (
                filteredMetrics.map((metric) => (
                  <tr key={metric.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {metric.event_type}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {metric.event_source}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          (metric.behavior_score || 0) >= 70
                            ? 'bg-green-100 text-green-800'
                            : (metric.behavior_score || 0) >= 50
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {metric.behavior_score?.toFixed(2) || '0.00'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {metric.outcome_reference ? (
                        <span className="flex items-center gap-1 text-blue-600">
                          <Link2 className="w-3 h-3" />
                          Linked
                        </span>
                      ) : (
                        <span className="text-gray-400">N/A</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {new Date(metric.created_at).toLocaleString()}
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
