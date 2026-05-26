import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { TrendingUp, Activity, Zap, CheckCircle, XCircle, RefreshCw, Download } from 'lucide-react';
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface OptimizationEvent {
  id: string;
  source_event_type: string;
  predicted_variance: number | null;
  predicted_stability: number | null;
  optimization_action: 'pre_tune' | 'stabilize' | 'recalibrate';
  parameter_delta: Record<string, number>;
  efficiency_index: number | null;
  applied: boolean;
  created_at: string;
}

const ACTION_COLORS = {
  pre_tune: '#3b82f6',      // Blue
  stabilize: '#10b981',     // Green
  recalibrate: '#f59e0b',   // Orange
};

const ACTION_LABELS = {
  pre_tune: 'Pre-Tune',
  stabilize: 'Stabilize',
  recalibrate: 'Recalibrate',
};

export function EfficiencyIndex() {
  const [events, setEvents] = useState<OptimizationEvent[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<OptimizationEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [appliedFilter, setAppliedFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchOptimizationEvents = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('fusion_optimization_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;

      const eventData = data || [];
      setEvents(eventData);
      setFilteredEvents(eventData);
    } catch (error) {
      console.error('[Efficiency Index] Error fetching optimization events:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOptimizationEvents();

    const subscription = supabase
      .channel('fusion_optimization_events_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fusion_optimization_events' }, () => {
        fetchOptimizationEvents();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let filtered = [...events];

    if (actionFilter !== 'all') {
      filtered = filtered.filter((event) => event.optimization_action === actionFilter);
    }

    if (appliedFilter !== 'all') {
      const isApplied = appliedFilter === 'applied';
      filtered = filtered.filter((event) => event.applied === isApplied);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (event) =>
          event.source_event_type.toLowerCase().includes(query) ||
          event.optimization_action.toLowerCase().includes(query)
      );
    }

    setFilteredEvents(filtered);
  }, [events, actionFilter, appliedFilter, searchQuery]);

  const getActionStats = () => {
    return {
      pre_tune: events.filter((e) => e.optimization_action === 'pre_tune').length,
      stabilize: events.filter((e) => e.optimization_action === 'stabilize').length,
      recalibrate: events.filter((e) => e.optimization_action === 'recalibrate').length,
    };
  };

  const getEfficiencyTrendData = () => {
    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (29 - i));
      return date.toISOString().split('T')[0];
    });

    return last30Days.map((date) => {
      const dayEvents = events.filter((e) => e.created_at.startsWith(date));
      const avgEfficiency = dayEvents.length > 0
        ? dayEvents.reduce((sum, e) => sum + (e.efficiency_index || 0), 0) / dayEvents.length
        : null;
      
      return {
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        efficiency: avgEfficiency ? parseFloat(avgEfficiency.toFixed(2)) : null,
        count: dayEvents.length,
      };
    });
  };

  const getActionDistribution = () => {
    const stats = getActionStats();
    return [
      { name: 'Pre-Tune', value: stats.pre_tune, color: ACTION_COLORS.pre_tune },
      { name: 'Stabilize', value: stats.stabilize, color: ACTION_COLORS.stabilize },
      { name: 'Recalibrate', value: stats.recalibrate, color: ACTION_COLORS.recalibrate },
    ];
  };

  const exportToCSV = () => {
    const headers = [
      'ID',
      'Source Event Type',
      'Optimization Action',
      'Predicted Variance',
      'Predicted Stability',
      'Efficiency Index',
      'Applied',
      'Parameter Delta',
      'Created At',
    ];

    const rows = filteredEvents.map((event) => [
      event.id,
      event.source_event_type,
      event.optimization_action,
      event.predicted_variance?.toString() || '',
      event.predicted_stability?.toString() || '',
      event.efficiency_index?.toString() || '',
      event.applied ? 'Yes' : 'No',
      JSON.stringify(event.parameter_delta),
      event.created_at,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `optimization_events_${new Date().toISOString()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const trendData = getEfficiencyTrendData();
  const actionDistribution = getActionDistribution();
  const appliedCount = events.filter((e) => e.applied).length;
  const avgEfficiency = events.length > 0
    ? events.reduce((sum, e) => sum + (e.efficiency_index || 0), 0) / events.length
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Efficiency Index Dashboard</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Monitor Proactive Optimization Engine (POE) performance and parameter adjustments
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchOptimizationEvents}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Optimizations</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{events.length}</p>
            </div>
            <Activity className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg Efficiency Index</p>
              <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-2">
                {avgEfficiency.toFixed(1)}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Applied</p>
              <p className="text-3xl font-bold text-purple-600 dark:text-purple-400 mt-2">{appliedCount}</p>
            </div>
            <Zap className="w-8 h-8 text-purple-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Pending</p>
              <p className="text-3xl font-bold text-orange-600 dark:text-orange-400 mt-2">
                {events.length - appliedCount}
              </p>
            </div>
            <Activity className="w-8 h-8 text-orange-500" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Efficiency Index Trend (30 Days)
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" domain={[0, 100]} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                labelStyle={{ color: '#f3f4f6' }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="efficiency"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ fill: '#10b981', r: 4 }}
                name="Efficiency Index"
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Optimization Action Distribution
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={actionDistribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {actionDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by source event type or action..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="all">All Actions</option>
                <option value="pre_tune">Pre-Tune</option>
                <option value="stabilize">Stabilize</option>
                <option value="recalibrate">Recalibrate</option>
              </select>
              <select
                value={appliedFilter}
                onChange={(e) => setAppliedFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="all">All Status</option>
                <option value="applied">Applied</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400">
              <Activity className="w-12 h-12 mb-4" />
              <p>No optimization events found</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Source Event
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Action
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Efficiency Index
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Predicted Stability
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Predicted Variance
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Created At
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredEvents.map((event) => (
                  <tr key={event.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {event.source_event_type}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white"
                        style={{ backgroundColor: ACTION_COLORS[event.optimization_action] }}
                      >
                        {ACTION_LABELS[event.optimization_action]}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-600 dark:text-green-400">
                      {event.efficiency_index !== null ? event.efficiency_index.toFixed(2) : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                      {event.predicted_stability !== null ? event.predicted_stability.toFixed(4) : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                      {event.predicted_variance !== null ? event.predicted_variance.toFixed(4) : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {event.applied ? (
                        <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                          <CheckCircle className="w-4 h-4" />
                          Applied
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
                          <XCircle className="w-4 h-4" />
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {new Date(event.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
