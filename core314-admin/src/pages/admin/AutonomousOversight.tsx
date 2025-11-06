import React from 'react';
import { createClient } from '@supabase/supabase-js';
import { Shield, AlertTriangle, Activity, Download, RefreshCw, Search } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface SystemContext {
  fusion_score?: number;
  optimization_event_id?: string;
  behavioral_event_id?: string;
  prediction_event_id?: string;
  score_variance_pct?: number;
  previous_avg_score?: number;
  current_avg_score?: number;
  timestamp?: string;
  [key: string]: string | number | undefined;
}

interface AuditLogEntry {
  id: string;
  fusion_event_id: string | null;
  action_type: string;
  decision_summary: string;
  confidence_level: number;
  system_context: SystemContext | null;
  decision_impact: string | null;
  anomaly_detected: boolean;
  triggered_by: string;
  created_at: string;
}

interface OversightStats {
  totalAuditEntries: number;
  anomaliesDetected: number;
  highImpactDecisions: number;
  avgConfidence: number;
  lowImpactCount: number;
  moderateImpactCount: number;
}

export function AutonomousOversight() {
  const [auditEntries, setAuditEntries] = React.useState<AuditLogEntry[]>([]);
  const [stats, setStats] = React.useState<OversightStats>({
    totalAuditEntries: 0,
    anomaliesDetected: 0,
    highImpactDecisions: 0,
    avgConfidence: 0,
    lowImpactCount: 0,
    moderateImpactCount: 0,
  });
  const [loading, setLoading] = React.useState(true);
  const [triggering, setTriggering] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [actionFilter, setActionFilter] = React.useState<string>('all');
  const [impactFilter, setImpactFilter] = React.useState<string>('all');
  const [anomalyFilter, setAnomalyFilter] = React.useState<boolean | null>(null);

  const fetchAuditEntries = React.useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('fusion_audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;

      const entries = data || [];
      setAuditEntries(entries);

      const totalAuditEntries = entries.length;
      const anomaliesDetected = entries.filter(e => e.anomaly_detected).length;
      const highImpactDecisions = entries.filter(e => e.decision_impact === 'HIGH').length;
      const moderateImpactCount = entries.filter(e => e.decision_impact === 'MODERATE').length;
      const lowImpactCount = entries.filter(e => e.decision_impact === 'LOW').length;
      const avgConfidence = entries.length > 0
        ? entries.reduce((sum, e) => sum + e.confidence_level, 0) / entries.length
        : 0;

      setStats({
        totalAuditEntries,
        anomaliesDetected,
        highImpactDecisions,
        avgConfidence,
        lowImpactCount,
        moderateImpactCount,
      });
    } catch (error) {
      console.error('Error fetching audit entries:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchAuditEntries();

    const subscription = supabase
      .channel('fusion_audit_log_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fusion_audit_log' }, () => {
        fetchAuditEntries();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchAuditEntries]);

  const triggerOversight = async () => {
    try {
      setTriggering(true);
      const response = await fetch(
        `${supabaseUrl}/functions/v1/fusion-oversight-engine`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseAnonKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Oversight engine result:', result);

      await fetchAuditEntries();
      alert('Oversight engine executed successfully!');
    } catch (error) {
      console.error('Error triggering oversight:', error);
      alert('Failed to trigger oversight engine. Check console for details.');
    } finally {
      setTriggering(false);
    }
  };

  const filteredEntries = React.useMemo(() => {
    return auditEntries.filter(entry => {
      const matchesSearch = searchTerm === '' || 
        entry.decision_summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.action_type.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesAction = actionFilter === 'all' || entry.action_type === actionFilter;
      const matchesImpact = impactFilter === 'all' || entry.decision_impact === impactFilter;
      const matchesAnomaly = anomalyFilter === null || entry.anomaly_detected === anomalyFilter;

      return matchesSearch && matchesAction && matchesImpact && matchesAnomaly;
    });
  }, [auditEntries, searchTerm, actionFilter, impactFilter, anomalyFilter]);

  const trendData = React.useMemo(() => {
    const days = Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (29 - i));
      return date.toISOString().split('T')[0];
    });

    return days.map(day => {
      const dayEntries = auditEntries.filter(e => e.created_at.startsWith(day));
      const avgConfidence = dayEntries.length > 0
        ? dayEntries.reduce((sum, e) => sum + e.confidence_level, 0) / dayEntries.length
        : 0;
      const anomalies = dayEntries.filter(e => e.anomaly_detected).length;
      return { date: day, confidence: avgConfidence, anomalies };
    });
  }, [auditEntries]);

  const impactDistribution = React.useMemo(() => {
    return [
      { impact: 'HIGH', count: stats.highImpactDecisions },
      { impact: 'MODERATE', count: stats.moderateImpactCount },
      { impact: 'LOW', count: stats.lowImpactCount },
    ];
  }, [stats]);

  const exportToCSV = () => {
    const headers = ['ID', 'Action Type', 'Decision Summary', 'Confidence', 'Impact', 'Anomaly', 'Triggered By', 'Created At'];
    const rows = filteredEntries.map(e => [
      e.id,
      e.action_type,
      e.decision_summary.replace(/,/g, ';'),
      e.confidence_level.toFixed(2),
      e.decision_impact || 'N/A',
      e.anomaly_detected ? 'Yes' : 'No',
      e.triggered_by,
      new Date(e.created_at).toLocaleString(),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `autonomous_oversight_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading autonomous oversight data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="w-8 h-8 text-blue-600" />
            Autonomous Oversight
          </h1>
          <p className="text-gray-500 mt-1">
            Transparency and compliance auditing for AI-driven decisions
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchAuditEntries}
            disabled={loading}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={triggerOversight}
            disabled={triggering}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            <Activity className={`w-4 h-4 ${triggering ? 'animate-spin' : ''}`} />
            {triggering ? 'Running...' : 'Trigger Oversight'}
          </button>
          <button
            onClick={exportToCSV}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-sm text-gray-500">Total Audit Entries</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalAuditEntries}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-sm text-gray-500">Anomalies Detected</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{stats.anomaliesDetected}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-sm text-gray-500">High Impact</p>
          <p className="text-2xl font-bold text-orange-600 mt-1">{stats.highImpactDecisions}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-sm text-gray-500">Moderate Impact</p>
          <p className="text-2xl font-bold text-yellow-600 mt-1">{stats.moderateImpactCount}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-sm text-gray-500">Low Impact</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{stats.lowImpactCount}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-sm text-gray-500">Avg Confidence</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{stats.avgConfidence.toFixed(1)}%</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">30-Day Confidence Trend</h2>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              />
              <YAxis domain={[0, 100]} />
              <Tooltip 
                labelFormatter={(value) => new Date(value).toLocaleDateString()}
                formatter={(value: number) => [`${value.toFixed(1)}%`, 'Confidence']}
              />
              <Legend />
              <Line type="monotone" dataKey="confidence" stroke="#3b82f6" name="Avg Confidence" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Decision Impact Distribution</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={impactDistribution}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="impact" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" fill="#3b82f6" name="Count" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Audit Log Entries</h2>
          <div className="flex gap-2 items-center">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Actions</option>
              <option value="Amplify">Amplify</option>
              <option value="Tune-Down">Tune-Down</option>
              <option value="Monitor">Monitor</option>
            </select>
            <select
              value={impactFilter}
              onChange={(e) => setImpactFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Impact Levels</option>
              <option value="HIGH">High Impact</option>
              <option value="MODERATE">Moderate Impact</option>
              <option value="LOW">Low Impact</option>
            </select>
            <select
              value={anomalyFilter === null ? 'all' : anomalyFilter ? 'yes' : 'no'}
              onChange={(e) => setAnomalyFilter(e.target.value === 'all' ? null : e.target.value === 'yes')}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Entries</option>
              <option value="yes">Anomalies Only</option>
              <option value="no">No Anomalies</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Decision Summary
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Confidence
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Impact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Anomaly
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Triggered By
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created At
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredEntries.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      entry.action_type === 'Amplify' ? 'bg-green-100 text-green-800' :
                      entry.action_type === 'Tune-Down' ? 'bg-red-100 text-red-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {entry.action_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 max-w-md truncate" title={entry.decision_summary}>
                    {entry.decision_summary}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {entry.confidence_level.toFixed(1)}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      entry.decision_impact === 'HIGH' ? 'bg-orange-100 text-orange-800' :
                      entry.decision_impact === 'MODERATE' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {entry.decision_impact || 'N/A'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {entry.anomaly_detected && (
                      <AlertTriangle className="w-5 h-5 text-red-600" />
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {entry.triggered_by}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(entry.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredEntries.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No audit entries found matching the current filters.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
