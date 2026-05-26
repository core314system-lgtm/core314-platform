import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { RefreshCw, Download, AlertTriangle, FileText } from 'lucide-react';
import {
  BarChart,
  Bar,
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

interface AuditLogEntry {
  id: string;
  user_id: string | null;
  event_type: string;
  event_source: string;
  event_payload: Record<string, unknown>;
  stability_score: number | null;
  reinforcement_delta: number | null;
  anomaly_flag: boolean;
  anomaly_reason: string | null;
  created_at: string;
}

interface AnomalyFrequency {
  date: string;
  count: number;
}

interface AnomalyReasonCount {
  reason: string;
  count: number;
}

export function AuditAnomalies() {
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('all');
  const [anomalyFilter, setAnomalyFilter] = useState<string>('all');
  const [anomalyFrequency, setAnomalyFrequency] = useState<AnomalyFrequency[]>([]);
  const [topAnomalyReasons, setTopAnomalyReasons] = useState<AnomalyReasonCount[]>([]);

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('fusion_audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;

      const logs = data || [];
      setAuditLogs(logs);
      setFilteredLogs(logs);
      calculateAnomalyMetrics(logs);
    } catch (error) {
      console.error('[Audit & Anomalies] Error fetching audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateAnomalyMetrics = (logs: AuditLogEntry[]) => {
    const anomalies = logs.filter((log) => log.anomaly_flag);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentAnomalies = anomalies.filter(
      (log) => new Date(log.created_at) >= thirtyDaysAgo
    );

    const frequencyMap = new Map<string, number>();
    recentAnomalies.forEach((log) => {
      const date = new Date(log.created_at).toLocaleDateString();
      frequencyMap.set(date, (frequencyMap.get(date) || 0) + 1);
    });

    const frequency: AnomalyFrequency[] = Array.from(frequencyMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-30);

    setAnomalyFrequency(frequency);

    const reasonMap = new Map<string, number>();
    anomalies.forEach((log) => {
      if (log.anomaly_reason) {
        const reason = log.anomaly_reason.split('(')[0].trim();
        reasonMap.set(reason, (reasonMap.get(reason) || 0) + 1);
      }
    });

    const reasons: AnomalyReasonCount[] = Array.from(reasonMap.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    setTopAnomalyReasons(reasons);
  };

  useEffect(() => {
    fetchAuditLogs();

    const channel = supabase
      .channel('fusion-audit-log-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'fusion_audit_log',
        },
        (payload) => {
          console.log('[Audit & Anomalies] New audit log:', payload.new);
          setAuditLogs((prev) => [payload.new as AuditLogEntry, ...prev.slice(0, 499)]);
          fetchAuditLogs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    let filtered = auditLogs;

    if (searchTerm) {
      filtered = filtered.filter((log) =>
        JSON.stringify(log.event_payload).toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.event_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.event_source.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (eventTypeFilter !== 'all') {
      filtered = filtered.filter((log) => log.event_type === eventTypeFilter);
    }

    if (anomalyFilter === 'anomalies') {
      filtered = filtered.filter((log) => log.anomaly_flag);
    } else if (anomalyFilter === 'normal') {
      filtered = filtered.filter((log) => !log.anomaly_flag);
    }

    setFilteredLogs(filtered);
  }, [searchTerm, eventTypeFilter, anomalyFilter, auditLogs]);

  const exportToCSV = () => {
    const headers = [
      'ID',
      'Event Type',
      'Event Source',
      'Stability Score',
      'Reinforcement Delta',
      'Anomaly Flag',
      'Anomaly Reason',
      'Created At',
    ];

    const rows = filteredLogs.map((log) => [
      log.id,
      log.event_type,
      log.event_source,
      log.stability_score?.toString() || '',
      log.reinforcement_delta?.toString() || '',
      log.anomaly_flag ? 'TRUE' : 'FALSE',
      log.anomaly_reason || '',
      log.created_at,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `audit_logs_${new Date().toISOString()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getEventTypeBadgeColor = (eventType: string): string => {
    switch (eventType) {
      case 'baseline_analysis':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'reinforcement_calibration':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'cffe_sync':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'stability_forecast':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'risk_response':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const eventTypes = Array.from(new Set(auditLogs.map((log) => log.event_type)));

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <div className="p-6 space-y-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Audit & Anomalies
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Phase 32: Complete audit trail and anomaly detection for Fusion Engine
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportToCSV} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button onClick={fetchAuditLogs} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Total Audit Logs
            </CardTitle>
            <FileText className="h-4 w-4 text-gray-600 dark:text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {auditLogs.length}
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Last 500 entries
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Anomalies Detected
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-gray-600 dark:text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {auditLogs.filter((log) => log.anomaly_flag).length}
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              {((auditLogs.filter((log) => log.anomaly_flag).length / auditLogs.length) * 100).toFixed(1)}% of total
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Event Types
            </CardTitle>
            <FileText className="h-4 w-4 text-gray-600 dark:text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {eventTypes.length}
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Unique event types
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Avg Stability Score
            </CardTitle>
            <FileText className="h-4 w-4 text-gray-600 dark:text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {auditLogs.filter((log) => log.stability_score !== null).length > 0
                ? (
                    auditLogs
                      .filter((log) => log.stability_score !== null)
                      .reduce((sum, log) => sum + (log.stability_score || 0), 0) /
                    auditLogs.filter((log) => log.stability_score !== null).length
                  ).toFixed(1)
                : 'N/A'}
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Across all events
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Anomaly Frequency Chart */}
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-white">
              Anomaly Frequency (Last 30 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {anomalyFrequency.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
                No anomalies detected in the last 30 days
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={anomalyFrequency}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis
                    dataKey="date"
                    stroke="#9ca3af"
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1f2937',
                      border: '1px solid #374151',
                      borderRadius: '6px',
                      color: '#fff',
                    }}
                  />
                  <Legend />
                  <Bar dataKey="count" fill="#ef4444" name="Anomalies" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Top Anomaly Reasons Chart */}
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-white">
              Top Anomaly Reasons
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topAnomalyReasons.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
                No anomaly reasons available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={topAnomalyReasons}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ reason, percent }) =>
                      `${reason}: ${(percent * 100).toFixed(0)}%`
                    }
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {topAnomalyReasons.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1f2937',
                      border: '1px solid #374151',
                      borderRadius: '6px',
                      color: '#fff',
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="text-gray-900 dark:text-white">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                Search
              </label>
              <Input
                placeholder="Search event payload, type, or source..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                Event Type
              </label>
              <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
                <SelectTrigger className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                  <SelectValue placeholder="All event types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All event types</SelectItem>
                  {eventTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                Anomaly Status
              </label>
              <Select value={anomalyFilter} onValueChange={setAnomalyFilter}>
                <SelectTrigger className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                  <SelectValue placeholder="All logs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All logs</SelectItem>
                  <SelectItem value="anomalies">Anomalies only</SelectItem>
                  <SelectItem value="normal">Normal only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audit Log Table */}
      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="text-gray-900 dark:text-white">
            Audit Log ({filteredLogs.length} entries)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-gray-600 dark:text-gray-400">
              Loading audit logs...
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-8 text-gray-600 dark:text-gray-400">
              No audit logs found matching your filters
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-200 dark:border-gray-700">
                    <TableHead className="text-gray-700 dark:text-gray-300">Event Type</TableHead>
                    <TableHead className="text-gray-700 dark:text-gray-300">Event Source</TableHead>
                    <TableHead className="text-gray-700 dark:text-gray-300">Stability Score</TableHead>
                    <TableHead className="text-gray-700 dark:text-gray-300">Anomaly</TableHead>
                    <TableHead className="text-gray-700 dark:text-gray-300">Anomaly Reason</TableHead>
                    <TableHead className="text-gray-700 dark:text-gray-300">Timestamp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => (
                    <TableRow
                      key={log.id}
                      className={`border-gray-200 dark:border-gray-700 ${
                        log.anomaly_flag ? 'bg-red-50 dark:bg-red-900/20' : ''
                      }`}
                    >
                      <TableCell>
                        <Badge className={getEventTypeBadgeColor(log.event_type)}>
                          {log.event_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-gray-700 dark:text-gray-300">
                        {log.event_source}
                      </TableCell>
                      <TableCell className="text-gray-700 dark:text-gray-300">
                        {log.stability_score !== null
                          ? log.stability_score.toFixed(2)
                          : 'N/A'}
                      </TableCell>
                      <TableCell>
                        {log.anomaly_flag ? (
                          <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Anomaly
                          </Badge>
                        ) : (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                            Normal
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                        {log.anomaly_reason || '-'}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                        {formatTimestamp(log.created_at)}
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
