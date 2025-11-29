import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Activity, AlertTriangle } from 'lucide-react';
import { supabase } from '../../../lib/supabase';

interface ReliabilityEvent {
  id: number;
  event_type: string;
  module: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  http_status: number | null;
  latency_ms: number | null;
  message: string | null;
  created_at: string;
}

interface KPIs {
  criticalEvents: number;
  errors: number;
  warnings: number;
  avgLatency: number;
}

interface HeatmapCell {
  day: number;
  hour: number;
  severity: 'info' | 'warning' | 'error' | 'critical' | null;
  count: number;
}

export default function ReliabilityPanel() {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<ReliabilityEvent[]>([]);
  const [kpis, setKPIs] = useState<KPIs>({
    criticalEvents: 0,
    errors: 0,
    warnings: 0,
    avgLatency: 0,
  });
  const [heatmapData, setHeatmapData] = useState<HeatmapCell[]>([]);

  useEffect(() => {
    fetchReliabilityData();
  }, []);

  const fetchReliabilityData = async () => {
    try {
      setLoading(true);

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: reliabilityEvents, error } = await supabase
        .from('system_reliability_events')
        .select('*')
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching reliability events:', error);
        toast.error('Failed to load reliability data');
        return;
      }

      setEvents(reliabilityEvents || []);

      const twentyFourHoursAgo = new Date();
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

      const last24hEvents = (reliabilityEvents || []).filter(
        (e) => new Date(e.created_at) >= twentyFourHoursAgo
      );

      const criticalCount = last24hEvents.filter((e) => e.severity === 'critical').length;
      const errorCount = last24hEvents.filter((e) => e.severity === 'error').length;
      const warningCount = last24hEvents.filter((e) => e.severity === 'warning').length;

      const latencyEvents = last24hEvents.filter((e) => e.latency_ms !== null);
      const avgLatency =
        latencyEvents.length > 0
          ? latencyEvents.reduce((sum, e) => sum + (e.latency_ms || 0), 0) / latencyEvents.length
          : 0;

      setKPIs({
        criticalEvents: criticalCount,
        errors: errorCount,
        warnings: warningCount,
        avgLatency: Math.round(avgLatency),
      });

      const heatmap: HeatmapCell[] = [];
      for (let day = 0; day < 7; day++) {
        for (let hour = 0; hour < 24; hour++) {
          const cellDate = new Date();
          cellDate.setDate(cellDate.getDate() - (6 - day));
          cellDate.setHours(hour, 0, 0, 0);

          const cellEndDate = new Date(cellDate);
          cellEndDate.setHours(hour + 1);

          const cellEvents = (reliabilityEvents || []).filter((e) => {
            const eventDate = new Date(e.created_at);
            return eventDate >= cellDate && eventDate < cellEndDate;
          });

          let highestSeverity: 'info' | 'warning' | 'error' | 'critical' | null = null;
          if (cellEvents.length > 0) {
            if (cellEvents.some((e) => e.severity === 'critical')) {
              highestSeverity = 'critical';
            } else if (cellEvents.some((e) => e.severity === 'error')) {
              highestSeverity = 'error';
            } else if (cellEvents.some((e) => e.severity === 'warning')) {
              highestSeverity = 'warning';
            } else {
              highestSeverity = 'info';
            }
          }

          heatmap.push({
            day,
            hour,
            severity: highestSeverity,
            count: cellEvents.length,
          });
        }
      }

      setHeatmapData(heatmap);
    } catch (error) {
      console.error('Error in fetchReliabilityData:', error);
      toast.error('Failed to load reliability data');
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: 'info' | 'warning' | 'error' | 'critical' | null): string => {
    if (!severity) return 'bg-gray-100';
    switch (severity) {
      case 'critical':
        return 'bg-red-600';
      case 'error':
        return 'bg-orange-500';
      case 'warning':
        return 'bg-yellow-400';
      case 'info':
        return 'bg-green-500';
      default:
        return 'bg-gray-100';
    }
  };

  const getSeverityBadgeColor = (severity: string): string => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-700';
      case 'error':
        return 'bg-orange-100 text-orange-700';
      case 'warning':
        return 'bg-yellow-100 text-yellow-700';
      case 'info':
        return 'bg-green-100 text-green-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getDayLabel = (dayIndex: number): string => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - dayIndex));
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertTriangle className="w-16 h-16 text-gray-400 mb-4" />
        <p className="text-gray-600 text-lg">No reliability data available yet.</p>
        <p className="text-gray-500 text-sm mt-2">
          Reliability events will appear here once the system starts logging.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-500">Critical Events (24h)</h3>
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <p className="text-3xl font-bold text-red-600">{kpis.criticalEvents}</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-500">Errors (24h)</h3>
            <AlertTriangle className="w-5 h-5 text-orange-500" />
          </div>
          <p className="text-3xl font-bold text-orange-500">{kpis.errors}</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-500">Warnings (24h)</h3>
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
          </div>
          <p className="text-3xl font-bold text-yellow-500">{kpis.warnings}</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-500">Avg Latency (24h)</h3>
            <Activity className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-3xl font-bold text-blue-600">{kpis.avgLatency}ms</p>
        </div>
      </div>

      {/* Reliability Heatmap */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Reliability Heatmap (7 Days)</h2>
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            {/* Hour labels */}
            <div className="flex mb-2">
              <div className="w-32 flex-shrink-0"></div>
              <div className="flex gap-1">
                {Array.from({ length: 24 }, (_, i) => (
                  <div key={i} className="w-6 text-xs text-gray-500 text-center">
                    {i % 3 === 0 ? i : ''}
                  </div>
                ))}
              </div>
            </div>

            {/* Heatmap rows */}
            {Array.from({ length: 7 }, (_, day) => (
              <div key={day} className="flex items-center mb-1">
                <div className="w-32 flex-shrink-0 text-xs text-gray-600 pr-2">
                  {getDayLabel(day)}
                </div>
                <div className="flex gap-1">
                  {Array.from({ length: 24 }, (_, hour) => {
                    const cell = heatmapData.find((c) => c.day === day && c.hour === hour);
                    return (
                      <div
                        key={hour}
                        className={`w-6 h-6 rounded ${getSeverityColor(cell?.severity || null)} ${
                          cell?.count ? 'cursor-pointer hover:opacity-80' : ''
                        }`}
                        title={
                          cell?.count
                            ? `${cell.count} event(s) - ${cell.severity}`
                            : 'No events'
                        }
                      />
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Legend */}
            <div className="flex items-center gap-4 mt-4 text-xs text-gray-600">
              <span className="font-medium">Severity:</span>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 rounded bg-green-500"></div>
                <span>Info</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 rounded bg-yellow-400"></div>
                <span>Warning</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 rounded bg-orange-500"></div>
                <span>Error</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 rounded bg-red-600"></div>
                <span>Critical</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Events Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">Recent Events (Last 100)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Timestamp
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Module
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Event Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Severity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  HTTP Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Latency
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Message
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {events.slice(0, 100).map((event) => (
                <tr key={event.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(event.created_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {event.module}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {event.event_type}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded ${getSeverityBadgeColor(
                        event.severity
                      )}`}
                    >
                      {event.severity}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {event.http_status || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {event.latency_ms ? `${event.latency_ms}ms` : '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 max-w-md truncate">
                    {event.message || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
