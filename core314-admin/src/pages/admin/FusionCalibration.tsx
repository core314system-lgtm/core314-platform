import React, { useState, useEffect } from 'react';
import { useSupabaseClient } from '../../contexts/SupabaseClientContext';
import { getSupabaseFunctionUrl, getSupabaseAnonKeySync } from '../../lib/supabaseRuntimeConfig';
import { Activity, TrendingUp, TrendingDown, Eye, RefreshCw, Download, Play } from 'lucide-react';

interface CalibrationEvent {
  id: string;
  fusion_score: number;
  calibration_action: 'Amplify' | 'Tune-Down' | 'Monitor';
  confidence_level: number;
  notes: string;
  created_at: string;
  optimization_event_id: string | null;
  behavioral_event_id: string | null;
  prediction_event_id: string | null;
}

interface CalibrationStats {
  avgFusionScore: number;
  amplifyCount: number;
  tuneDownCount: number;
  monitorCount: number;
  totalEvents: number;
}

export function FusionCalibration() {
  const supabase = useSupabaseClient();
  const [events, setEvents] = useState<CalibrationEvent[]>([]);
  const [stats, setStats] = useState<CalibrationStats>({
    avgFusionScore: 0,
    amplifyCount: 0,
    tuneDownCount: 0,
    monitorCount: 0,
    totalEvents: 0,
  });
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState(30);

  useEffect(() => {
    fetchCalibrationData();
    
    const subscription = supabase
      .channel('fusion_calibration_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'fusion_calibration_events',
        },
        () => {
          fetchCalibrationData();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [dateRange, supabase]);

  const fetchCalibrationData = async () => {
    try {
      setLoading(true);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - dateRange);

      const { data, error } = await supabase
        .from('fusion_calibration_events')
        .select('*')
        .gte('created_at', cutoffDate.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      setEvents(data || []);
      calculateStats(data || []);
    } catch (error) {
      console.error('Error fetching calibration data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (data: CalibrationEvent[]) => {
    const totalEvents = data.length;
    const avgFusionScore = totalEvents > 0
      ? data.reduce((sum, e) => sum + e.fusion_score, 0) / totalEvents
      : 0;
    const amplifyCount = data.filter(e => e.calibration_action === 'Amplify').length;
    const tuneDownCount = data.filter(e => e.calibration_action === 'Tune-Down').length;
    const monitorCount = data.filter(e => e.calibration_action === 'Monitor').length;

    setStats({
      avgFusionScore,
      amplifyCount,
      tuneDownCount,
      monitorCount,
      totalEvents,
    });
  };

  const triggerCalibration = async () => {
    try {
      setTriggering(true);
      const url = await getSupabaseFunctionUrl('fusion-calibration-engine');
      const anonKey = getSupabaseAnonKeySync();

      const response = await fetch(
        url,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${anonKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to trigger calibration');
      }

      const result = await response.json();
      console.log('Calibration result:', result);
      
      await fetchCalibrationData();
      
      alert(`Calibration complete!\nProcessed: ${result.result?.events_processed || 0} events\nAvg Score: ${result.result?.avg_fusion_score?.toFixed(2) || 0}`);
    } catch (error) {
      console.error('Error triggering calibration:', error);
      alert('Failed to trigger calibration. Please try again.');
    } finally {
      setTriggering(false);
    }
  };

  const exportToCSV = () => {
    const headers = ['ID', 'Fusion Score', 'Action', 'Confidence', 'Notes', 'Created At'];
    const rows = filteredEvents.map(e => [
      e.id,
      e.fusion_score.toFixed(2),
      e.calibration_action,
      e.confidence_level.toFixed(2),
      e.notes || '',
      new Date(e.created_at).toLocaleString(),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fusion-calibration-${new Date().toISOString()}.csv`;
    a.click();
  };

  const filteredEvents = events.filter(event => {
    const matchesSearch = searchTerm === '' || 
      event.notes?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.calibration_action.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesAction = actionFilter === 'all' || event.calibration_action === actionFilter;
    return matchesSearch && matchesAction;
  });

  const getActionColor = (action: string) => {
    switch (action) {
      case 'Amplify': return 'text-green-600 bg-green-50';
      case 'Tune-Down': return 'text-red-600 bg-red-50';
      case 'Monitor': return 'text-blue-600 bg-blue-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'Amplify': return <TrendingUp className="w-4 h-4" />;
      case 'Tune-Down': return <TrendingDown className="w-4 h-4" />;
      case 'Monitor': return <Eye className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  const trendData = React.useMemo(() => {
    const days = Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (29 - i));
      return date.toISOString().split('T')[0];
    });

    return days.map(day => {
      const dayEvents = events.filter(e => e.created_at.startsWith(day));
      const avgScore = dayEvents.length > 0
        ? dayEvents.reduce((sum, e) => sum + e.fusion_score, 0) / dayEvents.length
        : 0;
      return { date: day, score: avgScore };
    });
  }, [events]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading fusion calibration data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fusion Calibration</h1>
          <p className="text-sm text-gray-500 mt-1">
            AI Fusion Calibration Engine (FACE) - Self-calibrating intelligence system
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={triggerCalibration}
            disabled={triggering}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            <Play className="w-4 h-4" />
            {triggering ? 'Running...' : 'Trigger Calibration'}
          </button>
          <button
            onClick={fetchCalibrationData}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Avg Fusion Score</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {stats.avgFusionScore.toFixed(2)}
              </p>
            </div>
            <Activity className="w-8 h-8 text-indigo-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Amplify Count</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                {stats.amplifyCount}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Tune-Down Count</p>
              <p className="text-2xl font-bold text-red-600 mt-1">
                {stats.tuneDownCount}
              </p>
            </div>
            <TrendingDown className="w-8 h-8 text-red-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Monitor Count</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">
                {stats.monitorCount}
              </p>
            </div>
            <Eye className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Events</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {stats.totalEvents}
              </p>
            </div>
            <Activity className="w-8 h-8 text-gray-600" />
          </div>
        </div>
      </div>

      {/* 30-Day Trend Chart */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">30-Day Fusion Score Trend</h2>
        <div className="h-64 flex items-end justify-between gap-1">
          {trendData.map((point, index) => {
            const maxScore = Math.max(...trendData.map(p => p.score), 1);
            const height = (point.score / maxScore) * 100;
            return (
              <div key={index} className="flex-1 flex flex-col items-center">
                <div
                  className="w-full bg-indigo-500 rounded-t hover:bg-indigo-600 transition-colors"
                  style={{ height: `${height}%` }}
                  title={`${point.date}: ${point.score.toFixed(2)}`}
                />
                {index % 5 === 0 && (
                  <span className="text-xs text-gray-500 mt-2 transform -rotate-45 origin-top-left">
                    {new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="Search by notes or action..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="all">All Actions</option>
            <option value="Amplify">Amplify</option>
            <option value="Tune-Down">Tune-Down</option>
            <option value="Monitor">Monitor</option>
          </select>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(Number(e.target.value))}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>
      </div>

      {/* Events Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fusion Score
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Confidence
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Notes
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Linked Events
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created At
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredEvents.map((event) => (
                <tr key={event.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-semibold text-gray-900">
                      {event.fusion_score.toFixed(2)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getActionColor(event.calibration_action)}`}>
                      {getActionIcon(event.calibration_action)}
                      {event.calibration_action}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {event.confidence_level.toFixed(2)}%
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 max-w-md truncate">
                    {event.notes || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex flex-col gap-1">
                      {event.optimization_event_id && (
                        <span className="text-xs text-blue-600">Opt: {event.optimization_event_id.slice(0, 8)}</span>
                      )}
                      {event.behavioral_event_id && (
                        <span className="text-xs text-green-600">Beh: {event.behavioral_event_id.slice(0, 8)}</span>
                      )}
                      {event.prediction_event_id && (
                        <span className="text-xs text-purple-600">Pre: {event.prediction_event_id.slice(0, 8)}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(event.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredEvents.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No calibration events found matching your filters.
          </div>
        )}
      </div>
    </div>
  );
}
