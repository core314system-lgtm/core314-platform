import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { AlertTriangle, Bell, CheckCircle, XCircle, Download, RefreshCw, Filter } from 'lucide-react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface AlertRecord {
  id: string;
  anomaly_id: string;
  event_type: string;
  severity: 'low' | 'moderate' | 'high' | 'critical';
  message: string;
  channel: 'slack' | 'email' | 'system';
  dispatched: boolean;
  created_at: string;
}

const SEVERITY_COLORS = {
  low: '#10b981',      // Green
  moderate: '#f59e0b', // Orange
  high: '#f97316',     // Dark Orange
  critical: '#ef4444', // Red
};

const SEVERITY_BG_COLORS = {
  low: 'bg-green-100 dark:bg-green-900/20',
  moderate: 'bg-orange-100 dark:bg-orange-900/20',
  high: 'bg-orange-200 dark:bg-orange-800/20',
  critical: 'bg-red-100 dark:bg-red-900/20',
};

const SEVERITY_TEXT_COLORS = {
  low: 'text-green-800 dark:text-green-200',
  moderate: 'text-orange-800 dark:text-orange-200',
  high: 'text-orange-900 dark:text-orange-100',
  critical: 'text-red-800 dark:text-red-200',
};

export function AlertCenter() {
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [filteredAlerts, setFilteredAlerts] = useState<AlertRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [dispatchedFilter, setDispatchedFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('fusion_alerts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;

      const alertData = data || [];
      setAlerts(alertData);
      setFilteredAlerts(alertData);
    } catch (error) {
      console.error('[Alert Center] Error fetching alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();

    const subscription = supabase
      .channel('fusion_alerts_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fusion_alerts' }, () => {
        fetchAlerts();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let filtered = [...alerts];

    if (severityFilter !== 'all') {
      filtered = filtered.filter((alert) => alert.severity === severityFilter);
    }

    if (channelFilter !== 'all') {
      filtered = filtered.filter((alert) => alert.channel === channelFilter);
    }

    if (dispatchedFilter !== 'all') {
      const isDispatched = dispatchedFilter === 'dispatched';
      filtered = filtered.filter((alert) => alert.dispatched === isDispatched);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (alert) =>
          alert.event_type.toLowerCase().includes(query) ||
          alert.message.toLowerCase().includes(query) ||
          alert.severity.toLowerCase().includes(query)
      );
    }

    setFilteredAlerts(filtered);
  }, [alerts, severityFilter, channelFilter, dispatchedFilter, searchQuery]);

  const getSeverityStats = () => {
    const stats = {
      low: alerts.filter((a) => a.severity === 'low').length,
      moderate: alerts.filter((a) => a.severity === 'moderate').length,
      high: alerts.filter((a) => a.severity === 'high').length,
      critical: alerts.filter((a) => a.severity === 'critical').length,
    };
    return stats;
  };

  const getChannelStats = () => {
    return [
      { name: 'Slack', value: alerts.filter((a) => a.channel === 'slack').length },
      { name: 'Email', value: alerts.filter((a) => a.channel === 'email').length },
      { name: 'System', value: alerts.filter((a) => a.channel === 'system').length },
    ];
  };

  const getSeverityTrendData = () => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      return date.toISOString().split('T')[0];
    });

    return last7Days.map((date) => {
      const dayAlerts = alerts.filter((a) => a.created_at.startsWith(date));
      return {
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        critical: dayAlerts.filter((a) => a.severity === 'critical').length,
        high: dayAlerts.filter((a) => a.severity === 'high').length,
        moderate: dayAlerts.filter((a) => a.severity === 'moderate').length,
        low: dayAlerts.filter((a) => a.severity === 'low').length,
      };
    });
  };

  const exportToCSV = () => {
    const headers = ['ID', 'Event Type', 'Severity', 'Message', 'Channel', 'Dispatched', 'Created At'];
    const rows = filteredAlerts.map((alert) => [
      alert.id,
      alert.event_type,
      alert.severity,
      alert.message,
      alert.channel,
      alert.dispatched ? 'Yes' : 'No',
      alert.created_at,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `fusion_alerts_${new Date().toISOString()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const severityStats = getSeverityStats();
  const channelStats = getChannelStats();
  const trendData = getSeverityTrendData();
  const dispatchedCount = alerts.filter((a) => a.dispatched).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Alert Center</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Monitor and manage fusion anomaly alerts with severity-based visualization
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchAlerts}
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
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Alerts</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{alerts.length}</p>
            </div>
            <Bell className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Critical Alerts</p>
              <p className="text-3xl font-bold text-red-600 dark:text-red-400 mt-2">{severityStats.critical}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">High Priority</p>
              <p className="text-3xl font-bold text-orange-600 dark:text-orange-400 mt-2">{severityStats.high}</p>
            </div>
            <XCircle className="w-8 h-8 text-orange-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Dispatched</p>
              <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-2">{dispatchedCount}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Alert Severity Trend (7 Days)</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                labelStyle={{ color: '#f3f4f6' }}
              />
              <Legend />
              <Bar dataKey="critical" stackId="a" fill={SEVERITY_COLORS.critical} name="Critical" />
              <Bar dataKey="high" stackId="a" fill={SEVERITY_COLORS.high} name="High" />
              <Bar dataKey="moderate" stackId="a" fill={SEVERITY_COLORS.moderate} name="Moderate" />
              <Bar dataKey="low" stackId="a" fill={SEVERITY_COLORS.low} name="Low" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Alert Channels Distribution</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={channelStats}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {channelStats.map((_entry, index) => (
                  <Cell key={`cell-${index}`} fill={['#3b82f6', '#10b981', '#6366f1'][index % 3]} />
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
                placeholder="Search alerts by event type, message, or severity..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="all">All Severities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="moderate">Moderate</option>
                <option value="low">Low</option>
              </select>
              <select
                value={channelFilter}
                onChange={(e) => setChannelFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="all">All Channels</option>
                <option value="slack">Slack</option>
                <option value="email">Email</option>
                <option value="system">System</option>
              </select>
              <select
                value={dispatchedFilter}
                onChange={(e) => setDispatchedFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="all">All Status</option>
                <option value="dispatched">Dispatched</option>
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
          ) : filteredAlerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400">
              <Filter className="w-12 h-12 mb-4" />
              <p>No alerts found matching your filters</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Event Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Severity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Message
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Channel
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
                {filteredAlerts.map((alert) => (
                  <tr key={alert.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {alert.event_type}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          SEVERITY_BG_COLORS[alert.severity]
                        } ${SEVERITY_TEXT_COLORS[alert.severity]}`}
                      >
                        {alert.severity.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300 max-w-md truncate">
                      {alert.message}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300 capitalize">
                      {alert.channel}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {alert.dispatched ? (
                        <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                          <CheckCircle className="w-4 h-4" />
                          Dispatched
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
                          <XCircle className="w-4 h-4" />
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {new Date(alert.created_at).toLocaleString()}
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
