import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { RefreshCw, CheckCircle, XCircle, Clock, Play, Pause, RotateCcw, AlertTriangle } from 'lucide-react';

interface RecoveryAction {
  id: string;
  action_type: string;
  action_name: string;
  target_component_name: string;
  trigger_reason: string;
  execution_status: string;
  execution_started_at: string | null;
  execution_completed_at: string | null;
  execution_duration_ms: number | null;
  success: boolean | null;
  execution_error: string | null;
  recovery_effectiveness_score: number | null;
  created_at: string;
}

export function RecoveryManager() {
  const [recoveryActions, setRecoveryActions] = useState<RecoveryAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedAction, setSelectedAction] = useState<RecoveryAction | null>(null);

  useEffect(() => {
    fetchRecoveryActions();

    const channel = supabase
      .channel('recovery_actions_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'recovery_actions',
        },
        () => {
          fetchRecoveryActions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [statusFilter]);

  const fetchRecoveryActions = async () => {
    try {
      let query = supabase
        .from('recovery_actions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (statusFilter !== 'all') {
        query = query.eq('execution_status', statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setRecoveryActions(data || []);
    } catch (error) {
      console.error('Error fetching recovery actions:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'in_progress':
        return <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'timeout':
        return <AlertTriangle className="w-5 h-5 text-orange-500" />;
      case 'cancelled':
        return <Pause className="w-5 h-5 text-gray-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const baseClasses = 'px-2 py-1 rounded-full text-xs font-medium';
    switch (status) {
      case 'completed':
        return <span className={`${baseClasses} bg-green-100 text-green-800`}>Completed</span>;
      case 'failed':
        return <span className={`${baseClasses} bg-red-100 text-red-800`}>Failed</span>;
      case 'in_progress':
        return <span className={`${baseClasses} bg-blue-100 text-blue-800`}>In Progress</span>;
      case 'pending':
        return <span className={`${baseClasses} bg-yellow-100 text-yellow-800`}>Pending</span>;
      case 'timeout':
        return <span className={`${baseClasses} bg-orange-100 text-orange-800`}>Timeout</span>;
      case 'cancelled':
        return <span className={`${baseClasses} bg-gray-100 text-gray-800`}>Cancelled</span>;
      default:
        return <span className={`${baseClasses} bg-gray-100 text-gray-800`}>{status}</span>;
    }
  };

  const getActionTypeIcon = (actionType: string) => {
    if (actionType.includes('restart')) return <RefreshCw className="w-4 h-4" />;
    if (actionType.includes('scale')) return <Play className="w-4 h-4" />;
    if (actionType.includes('rollback')) return <RotateCcw className="w-4 h-4" />;
    return <Play className="w-4 h-4" />;
  };

  const formatDuration = (durationMs: number | null) => {
    if (!durationMs) return 'N/A';
    if (durationMs < 1000) return `${durationMs}ms`;
    if (durationMs < 60000) return `${(durationMs / 1000).toFixed(1)}s`;
    return `${(durationMs / 60000).toFixed(1)}m`;
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

  const calculateStats = () => {
    const total = recoveryActions.length;
    const completed = recoveryActions.filter((a) => a.execution_status === 'completed').length;
    const failed = recoveryActions.filter((a) => a.execution_status === 'failed').length;
    const pending = recoveryActions.filter((a) => a.execution_status === 'pending').length;
    const inProgress = recoveryActions.filter((a) => a.execution_status === 'in_progress').length;
    const successRate = total > 0 ? ((completed / total) * 100).toFixed(1) : '0.0';
    const avgDuration = recoveryActions
      .filter((a) => a.execution_duration_ms)
      .reduce((sum, a) => sum + (a.execution_duration_ms || 0), 0) / Math.max(1, recoveryActions.filter((a) => a.execution_duration_ms).length);

    return { total, completed, failed, pending, inProgress, successRate, avgDuration };
  };

  const stats = calculateStats();

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
          <h2 className="text-2xl font-bold text-gray-900">Recovery Manager</h2>
          <p className="text-sm text-gray-600 mt-1">Automated recovery actions and self-healing operations</p>
        </div>
        <button
          onClick={fetchRecoveryActions}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Actions</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
            </div>
            <RefreshCw className="w-8 h-8 text-blue-500" />
          </div>
          <div className="mt-4 flex items-center space-x-4 text-xs">
            <span className="text-green-600">✓ {stats.completed}</span>
            <span className="text-red-600">✗ {stats.failed}</span>
            <span className="text-yellow-600">⏳ {stats.pending}</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Success Rate</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.successRate}%</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
          <div className="mt-4 text-xs">
            {parseFloat(stats.successRate) >= 95 ? (
              <span className="text-green-600">✓ Excellent</span>
            ) : parseFloat(stats.successRate) >= 80 ? (
              <span className="text-yellow-600">⚠ Good</span>
            ) : (
              <span className="text-red-600">✗ Needs Attention</span>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Avg Duration</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatDuration(stats.avgDuration)}</p>
            </div>
            <Clock className="w-8 h-8 text-purple-500" />
          </div>
          <div className="mt-4 text-xs">
            {stats.avgDuration < 5000 ? (
              <span className="text-green-600">✓ Fast</span>
            ) : stats.avgDuration < 10000 ? (
              <span className="text-yellow-600">⚠ Moderate</span>
            ) : (
              <span className="text-red-600">✗ Slow</span>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">In Progress</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.inProgress}</p>
            </div>
            <RefreshCw className={`w-8 h-8 text-blue-500 ${stats.inProgress > 0 ? 'animate-spin' : ''}`} />
          </div>
          <div className="mt-4 text-xs text-gray-600">
            {stats.pending} pending
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="timeout">Timeout</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Recovery Actions List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Recovery Actions</h3>
          <p className="text-sm text-gray-600 mt-1">{recoveryActions.length} actions found</p>
        </div>

        <div className="divide-y divide-gray-200">
          {recoveryActions.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-500">
              <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-3" />
              <p className="text-lg font-medium">No recovery actions</p>
              <p className="text-sm mt-1">System is stable</p>
            </div>
          ) : (
            recoveryActions.map((action) => (
              <div
                key={action.id}
                className="px-6 py-4 hover:bg-gray-50 cursor-pointer"
                onClick={() => setSelectedAction(action)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1">
                    {getStatusIcon(action.execution_status)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        {getStatusBadge(action.execution_status)}
                        <span className="text-xs text-gray-500">{formatTimestamp(action.created_at)}</span>
                      </div>
                      <p className="text-sm font-medium text-gray-900">{action.action_name}</p>
                      <div className="flex items-center space-x-4 mt-2 text-xs text-gray-600">
                        <span className="flex items-center">
                          {getActionTypeIcon(action.action_type)}
                          <span className="ml-1">{action.action_type.replace(/_/g, ' ')}</span>
                        </span>
                        <span>→ {action.target_component_name}</span>
                        {action.execution_duration_ms && (
                          <span className="flex items-center">
                            <Clock className="w-3 h-3 mr-1" />
                            {formatDuration(action.execution_duration_ms)}
                          </span>
                        )}
                        {action.recovery_effectiveness_score && (
                          <span className="text-green-600">
                            {action.recovery_effectiveness_score.toFixed(0)}% effective
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{action.trigger_reason}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Action Detail Modal */}
      {selectedAction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Recovery Action Details</h3>
              <button
                onClick={() => setSelectedAction(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              {/* Status */}
              <div className="flex items-center space-x-2">
                {getStatusIcon(selectedAction.execution_status)}
                {getStatusBadge(selectedAction.execution_status)}
                {selectedAction.success !== null && (
                  selectedAction.success ? (
                    <span className="text-sm text-green-600">✓ Success</span>
                  ) : (
                    <span className="text-sm text-red-600">✗ Failed</span>
                  )
                )}
              </div>

              {/* Action Info */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-1">Action</h4>
                <p className="text-sm text-gray-900">{selectedAction.action_name}</p>
              </div>

              {/* Trigger Reason */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-1">Trigger Reason</h4>
                <p className="text-sm text-gray-900">{selectedAction.trigger_reason}</p>
              </div>

              {/* Error Message */}
              {selectedAction.execution_error && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-1">Error Message</h4>
                  <p className="text-sm text-red-600 bg-red-50 p-3 rounded">{selectedAction.execution_error}</p>
                </div>
              )}

              {/* Metadata */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                <div>
                  <p className="text-xs text-gray-500">Action Type</p>
                  <p className="text-sm font-medium text-gray-900">{selectedAction.action_type.replace(/_/g, ' ')}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Target Component</p>
                  <p className="text-sm font-medium text-gray-900">{selectedAction.target_component_name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Duration</p>
                  <p className="text-sm font-medium text-gray-900">{formatDuration(selectedAction.execution_duration_ms)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Effectiveness</p>
                  <p className="text-sm font-medium text-gray-900">
                    {selectedAction.recovery_effectiveness_score 
                      ? `${selectedAction.recovery_effectiveness_score.toFixed(0)}%` 
                      : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Started</p>
                  <p className="text-sm font-medium text-gray-900">
                    {selectedAction.execution_started_at 
                      ? new Date(selectedAction.execution_started_at).toLocaleString() 
                      : 'Not started'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Completed</p>
                  <p className="text-sm font-medium text-gray-900">
                    {selectedAction.execution_completed_at 
                      ? new Date(selectedAction.execution_completed_at).toLocaleString() 
                      : 'Not completed'}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setSelectedAction(null)}
                  className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
