import React from 'react';
import { useSupabaseClient } from '@/contexts/SupabaseClientContext';
import { getSupabaseFunctionUrl, getSupabaseAnonKeySync } from '@/lib/supabaseRuntimeConfig';
import { Cpu, Download, RefreshCw, Play, Settings } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, BarChart, Bar } from 'recharts';

interface SystemState {
  optimization_count?: number;
  behavioral_count?: number;
  prediction_count?: number;
  calibration_count?: number;
  audit_count?: number;
  threshold?: number;
  total_events?: number;
  system_health?: string;
  anomaly_count?: number;
  [key: string]: string | number | undefined;
}

interface OrchestratorEvent {
  id: string;
  trigger_source: string;
  action_taken: string;
  priority_level: number;
  system_state: SystemState | null;
  policy_profile: string;
  status: string;
  execution_time_ms: number | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

interface OrchestratorStats {
  activeSubsystems: number;
  pendingTasks: number;
  avgPriority: number;
  currentPolicy: string;
  totalEvents: number;
  completedTasks: number;
  failedTasks: number;
}

export function CoreOrchestrator() {
  const supabase = useSupabaseClient();
  const [events, setEvents] = React.useState<OrchestratorEvent[]>([]);
  const [stats, setStats] = React.useState<OrchestratorStats>({
    activeSubsystems: 0,
    pendingTasks: 0,
    avgPriority: 0,
    currentPolicy: 'Standard',
    totalEvents: 0,
    completedTasks: 0,
    failedTasks: 0,
  });
  const [loading, setLoading] = React.useState(true);
  const [triggering, setTriggering] = React.useState(false);
  const [policyProfile, setPolicyProfile] = React.useState('Standard');
  const [filterStatus, setFilterStatus] = React.useState<string>('all');
  const [filterPriority, setFilterPriority] = React.useState<string>('all');
  const [filterSource, setFilterSource] = React.useState<string>('all');

  const fetchOrchestratorData = React.useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('fusion_orchestrator_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;

      const orchestratorEvents = data || [];
      setEvents(orchestratorEvents);

      const recentEvents = orchestratorEvents.filter(
        e => new Date(e.created_at) >= new Date(Date.now() - 3600000) // Last hour
      );
      
      const uniqueSubsystems = new Set(recentEvents.map(e => e.trigger_source));
      const pendingTasks = orchestratorEvents.filter(e => e.status === 'Pending' || e.status === 'Running').length;
      const completedTasks = orchestratorEvents.filter(e => e.status === 'Completed').length;
      const failedTasks = orchestratorEvents.filter(e => e.status === 'Failed').length;
      const avgPriority = orchestratorEvents.length > 0
        ? orchestratorEvents.reduce((sum, e) => sum + e.priority_level, 0) / orchestratorEvents.length
        : 0;
      
      const latestPolicy = orchestratorEvents.length > 0 ? orchestratorEvents[0].policy_profile : 'Standard';

      setStats({
        activeSubsystems: uniqueSubsystems.size,
        pendingTasks,
        avgPriority,
        currentPolicy: latestPolicy,
        totalEvents: orchestratorEvents.length,
        completedTasks,
        failedTasks,
      });
    } catch (error) {
      console.error('Error fetching orchestrator data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchOrchestratorData();

    const subscription = supabase
      .channel('fusion_orchestrator_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fusion_orchestrator_events' }, () => {
        fetchOrchestratorData();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchOrchestratorData]);

  const triggerOrchestration = async () => {
    try {
      setTriggering(true);
      const baseUrl = await getSupabaseFunctionUrl('fusion-orchestrator-engine');
      const anonKey = getSupabaseAnonKeySync();
      const response = await fetch(
        `${baseUrl}?policy=${policyProfile}&priority=4`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${anonKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Orchestration result:', result);

      await fetchOrchestratorData();
      alert(`Orchestration complete!\nTasks created: ${result.result?.tasks_created || 0}\nSystem health: ${result.result?.system_health || 'Unknown'}`);
    } catch (error) {
      console.error('Error triggering orchestration:', error);
      alert('Failed to trigger orchestration. Check console for details.');
    } finally {
      setTriggering(false);
    }
  };

  const filteredEvents = React.useMemo(() => {
    return events.filter(event => {
      const matchesStatus = filterStatus === 'all' || event.status === filterStatus;
      const matchesPriority = filterPriority === 'all' || event.priority_level.toString() === filterPriority;
      const matchesSource = filterSource === 'all' || event.trigger_source === filterSource;
      return matchesStatus && matchesPriority && matchesSource;
    });
  }, [events, filterStatus, filterPriority, filterSource]);

  const subsystemHealthData = React.useMemo(() => {
    const recentEvents = events.filter(
      e => new Date(e.created_at) >= new Date(Date.now() - 3600000)
    );

    const subsystems = ['Optimization', 'Calibration', 'Prediction', 'Oversight', 'System Monitor'];
    return subsystems.map(subsystem => {
      const subsystemEvents = recentEvents.filter(e => e.trigger_source === subsystem);
      const avgPriority = subsystemEvents.length > 0
        ? subsystemEvents.reduce((sum, e) => sum + e.priority_level, 0) / subsystemEvents.length
        : 0;
      
      const healthScore = subsystemEvents.length > 0 ? (5 - avgPriority) * 25 : 50;
      
      return {
        subsystem,
        health: healthScore,
        events: subsystemEvents.length,
      };
    });
  }, [events]);

  const priorityDistribution = React.useMemo(() => {
    return [
      { priority: 'Critical (1)', count: events.filter(e => e.priority_level === 1).length },
      { priority: 'High (2)', count: events.filter(e => e.priority_level === 2).length },
      { priority: 'Normal (3)', count: events.filter(e => e.priority_level === 3).length },
      { priority: 'Low (4)', count: events.filter(e => e.priority_level === 4).length },
    ];
  }, [events]);

  const trendData = React.useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => {
      const date = new Date();
      date.setHours(date.getHours() - (23 - i));
      return date.toISOString().split('T')[0] + ' ' + date.getHours().toString().padStart(2, '0') + ':00';
    });

    return hours.map(hour => {
      const hourEvents = events.filter(e => {
        const eventHour = new Date(e.created_at).toISOString().split('T')[0] + ' ' + 
                          new Date(e.created_at).getHours().toString().padStart(2, '0') + ':00';
        return eventHour === hour;
      });
      return {
        time: hour.split(' ')[1],
        tasks: hourEvents.length,
        avgPriority: hourEvents.length > 0
          ? hourEvents.reduce((sum, e) => sum + e.priority_level, 0) / hourEvents.length
          : 0,
      };
    });
  }, [events]);

  const exportToCSV = () => {
    const headers = ['ID', 'Trigger Source', 'Action Taken', 'Priority', 'Policy', 'Status', 'Execution Time (ms)', 'Created At'];
    const rows = filteredEvents.map(e => [
      e.id,
      e.trigger_source,
      e.action_taken.replace(/,/g, ';'),
      e.priority_level,
      e.policy_profile,
      e.status,
      e.execution_time_ms || 'N/A',
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
    a.download = `core_orchestrator_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getPriorityColor = (priority: number) => {
    switch (priority) {
      case 1: return 'text-red-600 bg-red-50';
      case 2: return 'text-orange-600 bg-orange-50';
      case 3: return 'text-blue-600 bg-blue-50';
      case 4: return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed': return 'text-green-600 bg-green-50';
      case 'Running': return 'text-blue-600 bg-blue-50';
      case 'Pending': return 'text-yellow-600 bg-yellow-50';
      case 'Failed': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading orchestrator data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Cpu className="w-8 h-8 text-purple-600" />
            Core Intelligence Orchestrator
          </h1>
          <p className="text-gray-500 mt-1">
            Central AI control layer managing all autonomous subsystems
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchOrchestratorData}
            disabled={loading}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-sm text-gray-500">Active Subsystems</p>
          <p className="text-2xl font-bold text-purple-600 mt-1">{stats.activeSubsystems}/5</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-sm text-gray-500">Pending Tasks</p>
          <p className="text-2xl font-bold text-yellow-600 mt-1">{stats.pendingTasks}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-sm text-gray-500">Avg Priority</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{stats.avgPriority.toFixed(1)}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-sm text-gray-500">Current Policy</p>
          <p className="text-2xl font-bold text-indigo-600 mt-1">{stats.currentPolicy}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-sm text-gray-500">Total Events</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalEvents}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-sm text-gray-500">Completed</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{stats.completedTasks}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-sm text-gray-500">Failed</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{stats.failedTasks}</p>
        </div>
      </div>

      {/* Policy Controls */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Settings className="w-5 h-5 text-gray-600" />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Policy Profile
              </label>
              <select
                value={policyProfile}
                onChange={(e) => setPolicyProfile(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="Conservative">Conservative (Stability)</option>
                <option value="Standard">Standard (Balanced)</option>
                <option value="Aggressive">Aggressive (Proactive)</option>
              </select>
            </div>
          </div>
          <button
            onClick={triggerOrchestration}
            disabled={triggering}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
          >
            <Play className={`w-5 h-5 ${triggering ? 'animate-spin' : ''}`} />
            {triggering ? 'Running...' : 'Run Orchestration Cycle'}
          </button>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Subsystem Health</h2>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={subsystemHealthData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="subsystem" />
              <PolarRadiusAxis domain={[0, 100]} />
              <Radar name="Health Score" dataKey="health" stroke="#9333ea" fill="#9333ea" fillOpacity={0.6} />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Priority Distribution</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={priorityDistribution}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="priority" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" fill="#9333ea" name="Task Count" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 24-Hour Activity Trend */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">24-Hour Activity Trend</h2>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" domain={[0, 4]} />
            <Tooltip />
            <Legend />
            <Line yAxisId="left" type="monotone" dataKey="tasks" stroke="#9333ea" name="Tasks" strokeWidth={2} />
            <Line yAxisId="right" type="monotone" dataKey="avgPriority" stroke="#f59e0b" name="Avg Priority" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Task Queue Table */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Task Queue</h2>
          <div className="flex gap-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="Pending">Pending</option>
              <option value="Running">Running</option>
              <option value="Completed">Completed</option>
              <option value="Failed">Failed</option>
            </select>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="all">All Priorities</option>
              <option value="1">Critical (1)</option>
              <option value="2">High (2)</option>
              <option value="3">Normal (3)</option>
              <option value="4">Low (4)</option>
            </select>
            <select
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="all">All Sources</option>
              <option value="Optimization">Optimization</option>
              <option value="Calibration">Calibration</option>
              <option value="Prediction">Prediction</option>
              <option value="Oversight">Oversight</option>
              <option value="System Monitor">System Monitor</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Trigger Source
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action Taken
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Priority
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Policy
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Exec Time
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
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                      {event.trigger_source}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 max-w-md truncate" title={event.action_taken}>
                    {event.action_taken}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(event.priority_level)}`}>
                      {event.priority_level}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {event.policy_profile}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(event.status)}`}>
                      {event.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {event.execution_time_ms ? `${event.execution_time_ms}ms` : 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(event.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredEvents.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No orchestrator events found matching the current filters.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
