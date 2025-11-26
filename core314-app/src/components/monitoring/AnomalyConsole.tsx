import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { AlertTriangle, CheckCircle, XCircle, TrendingUp, Clock, Target, Zap } from 'lucide-react';

interface AnomalySignal {
  id: string;
  anomaly_type: string;
  anomaly_category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence_score: number;
  source_component_name: string;
  anomaly_description: string;
  anomaly_summary: string | null;
  root_cause_analysis: string | null;
  recommended_actions: string[] | null;
  status: string;
  detection_timestamp: string;
  business_impact: string | null;
  created_at: string;
}

export function AnomalyConsole() {
  const [anomalies, setAnomalies] = useState<AnomalySignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('detected');
  const [selectedAnomaly, setSelectedAnomaly] = useState<AnomalySignal | null>(null);

  useEffect(() => {
    fetchAnomalies();

    const channel = supabase
      .channel('anomaly_signals_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'anomaly_signals',
        },
        () => {
          fetchAnomalies();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [severityFilter, statusFilter]);

  const fetchAnomalies = async () => {
    try {
      let query = supabase
        .from('anomaly_signals')
        .select('*')
        .order('detection_timestamp', { ascending: false })
        .limit(100);

      if (severityFilter !== 'all') {
        query = query.eq('severity', severityFilter);
      }

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setAnomalies(data || []);
    } catch (error) {
      console.error('Error fetching anomalies:', error);
    } finally {
      setLoading(false);
    }
  };

  const acknowledgeAnomaly = async (anomalyId: string) => {
    try {
      const { error } = await supabase
        .from('anomaly_signals')
        .update({
          status: 'investigating',
          acknowledged_at: new Date().toISOString(),
        })
        .eq('id', anomalyId);

      if (error) throw error;
      fetchAnomalies();
    } catch (error) {
      console.error('Error acknowledging anomaly:', error);
    }
  };

  const resolveAnomaly = async (anomalyId: string) => {
    try {
      const { error } = await supabase
        .from('anomaly_signals')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
        })
        .eq('id', anomalyId);

      if (error) throw error;
      fetchAnomalies();
      setSelectedAnomaly(null);
    } catch (error) {
      console.error('Error resolving anomaly:', error);
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'high':
        return <AlertTriangle className="w-5 h-5 text-orange-500" />;
      case 'medium':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'low':
        return <AlertTriangle className="w-5 h-5 text-blue-500" />;
      default:
        return <AlertTriangle className="w-5 h-5 text-gray-500" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    const baseClasses = 'px-2 py-1 rounded-full text-xs font-medium';
    switch (severity) {
      case 'critical':
        return <span className={`${baseClasses} bg-red-100 text-red-800`}>Critical</span>;
      case 'high':
        return <span className={`${baseClasses} bg-orange-100 text-orange-800`}>High</span>;
      case 'medium':
        return <span className={`${baseClasses} bg-yellow-100 text-yellow-800`}>Medium</span>;
      case 'low':
        return <span className={`${baseClasses} bg-blue-100 text-blue-800`}>Low</span>;
      default:
        return <span className={`${baseClasses} bg-gray-100 text-gray-800`}>Unknown</span>;
    }
  };

  const getStatusBadge = (status: string) => {
    const baseClasses = 'px-2 py-1 rounded-full text-xs font-medium';
    switch (status) {
      case 'detected':
        return <span className={`${baseClasses} bg-red-100 text-red-800`}>Detected</span>;
      case 'investigating':
        return <span className={`${baseClasses} bg-yellow-100 text-yellow-800`}>Investigating</span>;
      case 'confirmed':
        return <span className={`${baseClasses} bg-orange-100 text-orange-800`}>Confirmed</span>;
      case 'resolved':
        return <span className={`${baseClasses} bg-green-100 text-green-800`}>Resolved</span>;
      case 'false_positive':
        return <span className={`${baseClasses} bg-gray-100 text-gray-800`}>False Positive</span>;
      default:
        return <span className={`${baseClasses} bg-gray-100 text-gray-800`}>{status}</span>;
    }
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
          <h2 className="text-2xl font-bold text-gray-900">Anomaly Console</h2>
          <p className="text-sm text-gray-600 mt-1">AI-powered anomaly detection and root cause analysis</p>
        </div>
        <button
          onClick={fetchAnomalies}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Severity</label>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Statuses</option>
              <option value="detected">Detected</option>
              <option value="investigating">Investigating</option>
              <option value="confirmed">Confirmed</option>
              <option value="resolved">Resolved</option>
              <option value="false_positive">False Positive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Anomalies List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Detected Anomalies</h3>
          <p className="text-sm text-gray-600 mt-1">{anomalies.length} anomalies found</p>
        </div>

        <div className="divide-y divide-gray-200">
          {anomalies.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-500">
              <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-3" />
              <p className="text-lg font-medium">No anomalies detected</p>
              <p className="text-sm mt-1">Your system is running smoothly</p>
            </div>
          ) : (
            anomalies.map((anomaly) => (
              <div
                key={anomaly.id}
                className="px-6 py-4 hover:bg-gray-50 cursor-pointer"
                onClick={() => setSelectedAnomaly(anomaly)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1">
                    {getSeverityIcon(anomaly.severity)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        {getSeverityBadge(anomaly.severity)}
                        {getStatusBadge(anomaly.status)}
                        <span className="text-xs text-gray-500">{formatTimestamp(anomaly.detection_timestamp)}</span>
                      </div>
                      <p className="text-sm font-medium text-gray-900">{anomaly.anomaly_description}</p>
                      <div className="flex items-center space-x-4 mt-2 text-xs text-gray-600">
                        <span className="flex items-center">
                          <Target className="w-3 h-3 mr-1" />
                          {anomaly.source_component_name}
                        </span>
                        <span className="flex items-center">
                          <TrendingUp className="w-3 h-3 mr-1" />
                          {anomaly.anomaly_type.replace(/_/g, ' ')}
                        </span>
                        <span className="flex items-center">
                          <Zap className="w-3 h-3 mr-1" />
                          {anomaly.confidence_score.toFixed(1)}% confidence
                        </span>
                      </div>
                      {anomaly.anomaly_summary && (
                        <p className="text-sm text-gray-600 mt-2 line-clamp-2">{anomaly.anomaly_summary}</p>
                      )}
                    </div>
                  </div>
                  {anomaly.status === 'detected' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        acknowledgeAnomaly(anomaly.id);
                      }}
                      className="ml-4 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Acknowledge
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Anomaly Detail Modal */}
      {selectedAnomaly && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Anomaly Details</h3>
              <button
                onClick={() => setSelectedAnomaly(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              {/* Status and Severity */}
              <div className="flex items-center space-x-2">
                {getSeverityIcon(selectedAnomaly.severity)}
                {getSeverityBadge(selectedAnomaly.severity)}
                {getStatusBadge(selectedAnomaly.status)}
              </div>

              {/* Description */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-1">Description</h4>
                <p className="text-sm text-gray-900">{selectedAnomaly.anomaly_description}</p>
              </div>

              {/* AI Summary */}
              {selectedAnomaly.anomaly_summary && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-1">AI Summary</h4>
                  <p className="text-sm text-gray-900">{selectedAnomaly.anomaly_summary}</p>
                </div>
              )}

              {/* Root Cause Analysis */}
              {selectedAnomaly.root_cause_analysis && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-1">Root Cause Analysis</h4>
                  <p className="text-sm text-gray-900">{selectedAnomaly.root_cause_analysis}</p>
                </div>
              )}

              {/* Recommended Actions */}
              {selectedAnomaly.recommended_actions && selectedAnomaly.recommended_actions.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-1">Recommended Actions</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {selectedAnomaly.recommended_actions.map((action, index) => (
                      <li key={index} className="text-sm text-gray-900">
                        {action.replace(/_/g, ' ')}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Metadata */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                <div>
                  <p className="text-xs text-gray-500">Component</p>
                  <p className="text-sm font-medium text-gray-900">{selectedAnomaly.source_component_name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Category</p>
                  <p className="text-sm font-medium text-gray-900">{selectedAnomaly.anomaly_category}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Confidence</p>
                  <p className="text-sm font-medium text-gray-900">{selectedAnomaly.confidence_score.toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Business Impact</p>
                  <p className="text-sm font-medium text-gray-900">{selectedAnomaly.business_impact || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Detected</p>
                  <p className="text-sm font-medium text-gray-900">{new Date(selectedAnomaly.detection_timestamp).toLocaleString()}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setSelectedAnomaly(null)}
                  className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Close
                </button>
                {selectedAnomaly.status !== 'resolved' && (
                  <button
                    onClick={() => resolveAnomaly(selectedAnomaly.id)}
                    className="px-4 py-2 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700"
                  >
                    Mark as Resolved
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
