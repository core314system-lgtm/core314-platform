import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Activity, AlertCircle, CheckCircle, Clock, RefreshCw } from 'lucide-react';

interface ReliabilityMetrics {
  success_rate_24h: number;
  success_rate_7d: number;
  avg_latency_24h: number;
  avg_latency_7d: number;
  total_tests_24h: number;
  total_tests_7d: number;
  failed_tests_24h: number;
  failed_tests_7d: number;
}

interface ChannelMetrics {
  channel: string;
  success_rate: number;
  avg_latency: number;
  total_tests: number;
  failed_tests: number;
}

interface RecentFailure {
  id: string;
  created_at: string;
  action_type: string;
  channel: string;
  latency_ms: number;
  error_message: string;
  test_run_id: string;
}

interface AdaptiveReliability {
  channel: string;
  recommended_retry_ms: number;
  confidence_score: number;
  failure_rate: number;
  avg_latency_ms: number;
  last_updated: string;
}

interface AutomationLog {
  id: string;
  created_at: string;
  action_type: string;
  channel: string;
  status: string;
  latency_ms: number;
  error_message: string | null;
  test_run_id: string;
}

export function ReliabilityDashboard() {
  const [metrics, setMetrics] = useState<ReliabilityMetrics | null>(null);
  const [channelMetrics, setChannelMetrics] = useState<ChannelMetrics[]>([]);
  const [recentFailures, setRecentFailures] = useState<RecentFailure[]>([]);
  const [adaptiveReliability, setAdaptiveReliability] = useState<AdaptiveReliability[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'24h' | '7d'>('24h');

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [timeRange]);

  const fetchMetrics = async () => {
    try {
      const hoursAgo = timeRange === '24h' ? 24 : 168;
      const since = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();

      const { data: logs, error } = await supabase
        .from('automation_reliability_log')
        .select('*')
        .gte('created_at', since)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!logs || logs.length === 0) {
        setMetrics({
          success_rate_24h: 0,
          success_rate_7d: 0,
          avg_latency_24h: 0,
          avg_latency_7d: 0,
          total_tests_24h: 0,
          total_tests_7d: 0,
          failed_tests_24h: 0,
          failed_tests_7d: 0
        });
        setChannelMetrics([]);
        setRecentFailures([]);
        setLoading(false);
        return;
      }

      const skippedTests = logs.filter(l => l.status === 'skipped').length;
      const consideredTests = logs.length - skippedTests;
      const failedTests = logs.filter(l => l.status === 'failed').length;
      const successRate = consideredTests > 0 ? ((consideredTests - failedTests) / consideredTests) * 100 : 0;
      const avgLatency = consideredTests > 0 ? logs.filter(l => l.status !== 'skipped').reduce((sum, l) => sum + l.latency_ms, 0) / consideredTests : 0;

      const channelGroups = logs.reduce((acc, log) => {
        if (!acc[log.channel]) {
          acc[log.channel] = [];
        }
        acc[log.channel].push(log);
        return acc;
      }, {} as Record<string, AutomationLog[]>);

      const channelStats = (Object.entries(channelGroups) as [string, AutomationLog[]][]).map(([channel, channelLogs]) => {
        const skipped = channelLogs.filter((l: AutomationLog) => l.status === 'skipped').length;
        const considered = channelLogs.length - skipped;
        const failed = channelLogs.filter((l: AutomationLog) => l.status === 'failed').length;
        const avgLat = considered > 0 ? channelLogs.filter((l: AutomationLog) => l.status !== 'skipped').reduce((sum: number, l: AutomationLog) => sum + l.latency_ms, 0) / considered : 0;
        return {
          channel,
          success_rate: considered > 0 ? ((considered - failed) / considered) * 100 : 0,
          avg_latency: Math.round(avgLat),
          total_tests: considered,
          failed_tests: failed
        };
      });

      const failures = logs
        .filter(l => l.status === 'failed')
        .slice(0, 20)
        .map(l => ({
          id: l.id,
          created_at: l.created_at,
          action_type: l.action_type,
          channel: l.channel,
          latency_ms: l.latency_ms,
          error_message: l.error_message || 'Unknown error',
          test_run_id: l.test_run_id
        }));

      setMetrics({
        success_rate_24h: timeRange === '24h' ? successRate : 0,
        success_rate_7d: timeRange === '7d' ? successRate : 0,
        avg_latency_24h: timeRange === '24h' ? Math.round(avgLatency) : 0,
        avg_latency_7d: timeRange === '7d' ? Math.round(avgLatency) : 0,
        total_tests_24h: timeRange === '24h' ? consideredTests : 0,
        total_tests_7d: timeRange === '7d' ? consideredTests : 0,
        failed_tests_24h: timeRange === '24h' ? failedTests : 0,
        failed_tests_7d: timeRange === '7d' ? failedTests : 0
      });
      setChannelMetrics(channelStats);
      setRecentFailures(failures);

      const { data: adaptiveData, error: adaptiveError } = await supabase
        .from('fusion_adaptive_reliability')
        .select('*')
        .in('channel', ['slack', 'email'])
        .order('channel');

      if (!adaptiveError && adaptiveData) {
        setAdaptiveReliability(adaptiveData);
      }
    } catch (error) {
      console.error('Error fetching reliability metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const currentSuccessRate = timeRange === '24h' ? metrics?.success_rate_24h : metrics?.success_rate_7d;
  const currentAvgLatency = timeRange === '24h' ? metrics?.avg_latency_24h : metrics?.avg_latency_7d;
  const currentTotalTests = timeRange === '24h' ? metrics?.total_tests_24h : metrics?.total_tests_7d;
  const currentFailedTests = timeRange === '24h' ? metrics?.failed_tests_24h : metrics?.failed_tests_7d;

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reliability Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Monitor Smart Agent automation reliability and performance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as '24h' | '7d')}
            className="px-3 py-2 border border-gray-300 rounded text-sm"
          >
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
          </select>
          <button
            onClick={fetchMetrics}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Overall Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Success Rate</p>
              <p className={`text-2xl font-bold ${
                (currentSuccessRate || 0) >= 90 ? 'text-green-600' : 
                (currentSuccessRate || 0) >= 75 ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {(currentSuccessRate || 0).toFixed(2)}%
              </p>
            </div>
            {(currentSuccessRate || 0) >= 90 ? (
              <CheckCircle className="w-8 h-8 text-green-500" />
            ) : (
              <AlertCircle className="w-8 h-8 text-yellow-500" />
            )}
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Avg Latency</p>
              <p className="text-2xl font-bold text-gray-900">{currentAvgLatency || 0}ms</p>
            </div>
            <Clock className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Tests</p>
              <p className="text-2xl font-bold text-gray-900">{currentTotalTests || 0}</p>
            </div>
            <Activity className="w-8 h-8 text-purple-500" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Failed Tests</p>
              <p className="text-2xl font-bold text-red-600">{currentFailedTests || 0}</p>
            </div>
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
        </div>
      </div>

      {/* Adaptive Optimization */}
      {adaptiveReliability.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Adaptive Optimization</h2>
              <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded">
                Phase 62: Self-Healing Reliability
              </span>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              Real-time adaptive retry delays based on 24h performance metrics
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6">
            {adaptiveReliability.map((adaptive) => (
              <div key={adaptive.channel} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="px-2 py-1 text-sm font-medium bg-blue-100 text-blue-700 rounded capitalize">
                    {adaptive.channel}
                  </span>
                  <span className="text-xs text-gray-500">
                    Updated {new Date(adaptive.last_updated).toLocaleTimeString()}
                  </span>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Retry Delay</span>
                    <span className="text-lg font-bold text-blue-600">
                      {adaptive.recommended_retry_ms}ms
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Confidence</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-green-500 rounded-full"
                          style={{ width: `${adaptive.confidence_score * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-gray-900">
                        {(adaptive.confidence_score * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100">
                    <div>
                      <p className="text-xs text-gray-500">Failure Rate (24h)</p>
                      <p className={`text-sm font-medium ${
                        adaptive.failure_rate < 0.05 ? 'text-green-600' : 
                        adaptive.failure_rate < 0.2 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {(adaptive.failure_rate * 100).toFixed(2)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Avg Latency (24h)</p>
                      <p className="text-sm font-medium text-gray-900">
                        {Math.round(adaptive.avg_latency_ms)}ms
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Channel Metrics */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Metrics by Channel</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Channel
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Success Rate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Avg Latency
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Tests
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Failed Tests
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {channelMetrics.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                    No test data available for the selected time range
                  </td>
                </tr>
              ) : (
                channelMetrics.map((channel) => (
                  <tr key={channel.channel}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded">
                        {channel.channel}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`font-medium ${
                        channel.success_rate >= 90 ? 'text-green-600' : 
                        channel.success_rate >= 75 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {channel.success_rate.toFixed(2)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                      {channel.avg_latency}ms
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                      {channel.total_tests}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`font-medium ${channel.failed_tests > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                        {channel.failed_tests}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Failures */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Recent Failures</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {recentFailures.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
              <p>No failures in the selected time range. All systems operational!</p>
            </div>
          ) : (
            recentFailures.map((failure) => (
              <div key={failure.id} className="p-6 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded">
                        {failure.action_type}
                      </span>
                      <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded">
                        {failure.channel}
                      </span>
                      <span className="text-sm text-gray-500">
                        {new Date(failure.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-900 mt-2">
                      <strong>Error:</strong> {failure.error_message}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <span>Latency: {failure.latency_ms}ms</span>
                      <span>Test Run: {failure.test_run_id.substring(0, 8)}...</span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
