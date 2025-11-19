import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { CheckCircle, XCircle, Clock, AlertCircle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

interface OptimizationResult {
  id: string;
  user_id: string;
  rule_id: string | null;
  optimization_event_id: string | null;
  strategy: string;
  recommended_actions: string[];
  result: {
    metric_type?: string;
    metric_value?: number;
    threshold_value?: number;
    optimization_type?: string;
    triggered_at?: string;
  };
  status: 'pending' | 'applied' | 'dismissed' | 'failed';
  applied_at: string | null;
  created_at: string;
  updated_at: string;
  rule_name?: string;
}

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  confirmColor?: string;
}

function ConfirmDialog({ isOpen, title, message, onConfirm, onCancel, confirmText = 'Confirm', confirmColor = 'blue' }: ConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
        <p className="text-gray-600 mb-6">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 bg-${confirmColor}-600 text-white rounded hover:bg-${confirmColor}-700`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Optimizations() {
  const [optimizations, setOptimizations] = useState<OptimizationResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    type: 'apply' | 'dismiss' | null;
    optimization: OptimizationResult | null;
  }>({ isOpen: false, type: null, optimization: null });
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    fetchOptimizations();
    
    if (autoRefresh) {
      const interval = setInterval(fetchOptimizations, 30000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const fetchOptimizations = async () => {
    try {
      const { data, error } = await supabase
        .from('fusion_optimization_results')
        .select(`
          *,
          automation_rules!rule_id (
            rule_name
          )
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      
      const enriched = (data || []).map(opt => ({
        ...opt,
        rule_name: opt.automation_rules?.rule_name || 'Unknown Rule',
        recommended_actions: Array.isArray(opt.recommended_actions) 
          ? opt.recommended_actions 
          : []
      }));
      
      setOptimizations(enriched);
    } catch (error) {
      console.error('Error fetching optimizations:', error);
    } finally {
      setLoading(false);
    }
  };

  const getResultSummary = (opt: OptimizationResult): string => {
    const { result } = opt;
    if (result?.metric_type && result?.metric_value !== undefined && result?.threshold_value !== undefined) {
      return `${result.metric_type}: ${result.metric_value} (threshold: ${result.threshold_value})`;
    }
    return opt.strategy || 'No summary available';
  };

  const handleApply = async (optimization: OptimizationResult) => {
    try {
      const { error: updateError } = await supabase
        .from('fusion_optimization_results')
        .update({
          status: 'applied',
          applied_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', optimization.id);

      if (updateError) throw updateError;

      const { error: logError } = await supabase
        .from('fusion_action_log')
        .insert({
          user_id: optimization.user_id,
          action_type: 'optimization_applied',
          action_details: {
            optimization_result_id: optimization.id,
            strategy: optimization.strategy,
            applied_by: 'admin',
            applied_at: new Date().toISOString()
          },
          status: 'completed'
        });

      if (logError) console.warn('Failed to log action:', logError);

      await fetchOptimizations();
      setConfirmDialog({ isOpen: false, type: null, optimization: null });
    } catch (error) {
      console.error('Error applying optimization:', error);
      alert('Failed to apply optimization. Please try again.');
    }
  };

  const handleDismiss = async (optimization: OptimizationResult) => {
    try {
      const { error: updateError } = await supabase
        .from('fusion_optimization_results')
        .update({
          status: 'dismissed',
          updated_at: new Date().toISOString()
        })
        .eq('id', optimization.id);

      if (updateError) throw updateError;

      const { error: logError } = await supabase
        .from('fusion_action_log')
        .insert({
          user_id: optimization.user_id,
          action_type: 'optimization_dismissed',
          action_details: {
            optimization_result_id: optimization.id,
            strategy: optimization.strategy,
            dismissed_by: 'admin',
            dismissed_at: new Date().toISOString()
          },
          status: 'completed'
        });

      if (logError) console.warn('Failed to log action:', logError);

      await fetchOptimizations();
      setConfirmDialog({ isOpen: false, type: null, optimization: null });
    } catch (error) {
      console.error('Error dismissing optimization:', error);
      alert('Failed to dismiss optimization. Please try again.');
    }
  };

  const filteredOptimizations = optimizations.filter(opt => {
    if (statusFilter === 'all') return true;
    return opt.status === statusFilter;
  });

  const stats = {
    total: optimizations.length,
    pending: optimizations.filter(o => o.status === 'pending').length,
    applied: optimizations.filter(o => o.status === 'applied').length,
    dismissed: optimizations.filter(o => o.status === 'dismissed').length,
    failed: optimizations.filter(o => o.status === 'failed').length
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Optimization Results</h1>
          <p className="text-gray-600 mt-1">
            Review and manage Smart Agent optimization recommendations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            Auto-refresh (30s)
          </label>
          <button
            onClick={fetchOptimizations}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <AlertCircle className="w-8 h-8 text-gray-500" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
            </div>
            <Clock className="w-8 h-8 text-yellow-500" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Applied</p>
              <p className="text-2xl font-bold text-green-600">{stats.applied}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Dismissed</p>
              <p className="text-2xl font-bold text-gray-600">{stats.dismissed}</p>
            </div>
            <XCircle className="w-8 h-8 text-gray-500" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Failed</p>
              <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
            </div>
            <XCircle className="w-8 h-8 text-red-500" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Optimization Results</h2>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Filter:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded text-sm"
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="applied">Applied</option>
              <option value="dismissed">Dismissed</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>

        <div className="divide-y divide-gray-200">
          {filteredOptimizations.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {statusFilter === 'all' 
                ? 'No optimization results yet. Smart Agent will create recommendations when rules trigger.'
                : `No ${statusFilter} optimization results.`
              }
            </div>
          ) : (
            filteredOptimizations.map((opt) => (
              <div key={opt.id} className={`p-6 ${opt.status === 'dismissed' ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-medium text-gray-900">{opt.rule_name}</h3>
                      <span
                        className={`px-2 py-1 text-xs rounded ${
                          opt.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-700'
                            : opt.status === 'applied'
                            ? 'bg-green-100 text-green-700'
                            : opt.status === 'dismissed'
                            ? 'bg-gray-100 text-gray-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {opt.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      Strategy: <strong>{opt.strategy}</strong>
                    </p>
                    <p className="text-sm text-gray-600">
                      {getResultSummary(opt)}
                    </p>
                    
                    {opt.recommended_actions.length > 0 && (
                      <div className="mt-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-700">
                            Recommended Actions ({opt.recommended_actions.length}):
                          </span>
                          {opt.recommended_actions.length > 2 && (
                            <button
                              onClick={() => setExpandedId(expandedId === opt.id ? null : opt.id)}
                              className="text-blue-600 hover:text-blue-700 text-sm flex items-center gap-1"
                            >
                              {expandedId === opt.id ? (
                                <>
                                  <ChevronUp className="w-4 h-4" /> Hide
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="w-4 h-4" /> View all
                                </>
                              )}
                            </button>
                          )}
                        </div>
                        <ul className="mt-2 space-y-1">
                          {(expandedId === opt.id 
                            ? opt.recommended_actions 
                            : opt.recommended_actions.slice(0, 2)
                          ).map((action, idx) => (
                            <li key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                              <span className="text-blue-500 mt-1">•</span>
                              <span>{action}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                      <span>Created: {new Date(opt.created_at).toLocaleString()}</span>
                      {opt.applied_at && (
                        <span>Applied: {new Date(opt.applied_at).toLocaleString()}</span>
                      )}
                    </div>
                  </div>

                  {opt.status === 'pending' && (
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => setConfirmDialog({ isOpen: true, type: 'apply', optimization: opt })}
                        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                      >
                        Apply
                      </button>
                      <button
                        onClick={() => setConfirmDialog({ isOpen: true, type: 'dismiss', optimization: opt })}
                        className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.type === 'apply' ? 'Apply Optimization' : 'Dismiss Optimization'}
        message={
          confirmDialog.type === 'apply'
            ? `Are you sure you want to apply this optimization? This will mark it as applied and log the action.`
            : `Are you sure you want to dismiss this optimization? This will mark it as dismissed and it won't be shown in pending results.`
        }
        onConfirm={() => {
          if (confirmDialog.optimization) {
            if (confirmDialog.type === 'apply') {
              handleApply(confirmDialog.optimization);
            } else {
              handleDismiss(confirmDialog.optimization);
            }
          }
        }}
        onCancel={() => setConfirmDialog({ isOpen: false, type: null, optimization: null })}
        confirmText={confirmDialog.type === 'apply' ? 'Apply' : 'Dismiss'}
        confirmColor={confirmDialog.type === 'apply' ? 'green' : 'gray'}
      />
    </div>
  );
}
