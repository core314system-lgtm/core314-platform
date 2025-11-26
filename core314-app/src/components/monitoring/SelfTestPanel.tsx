import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { CheckCircle, XCircle, AlertTriangle, Activity, TrendingUp, TrendingDown, Clock } from 'lucide-react';

interface SelfTestResult {
  id: string;
  test_name: string;
  test_category: string;
  test_result: 'pass' | 'fail' | 'warning' | 'error' | 'skipped';
  health_score: number | null;
  reliability_score: number | null;
  performance_score: number | null;
  pass_count: number;
  fail_count: number;
  warning_count: number;
  total_assertions: number;
  execution_duration_ms: number | null;
  test_summary: string | null;
  failure_reason: string | null;
  regression_detected: boolean;
  improvement_detected: boolean;
  completed_at: string | null;
  created_at: string;
}

export function SelfTestPanel() {
  const [testResults, setTestResults] = useState<SelfTestResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [resultFilter, setResultFilter] = useState<string>('all');
  const [selectedTest, setSelectedTest] = useState<SelfTestResult | null>(null);

  useEffect(() => {
    fetchTestResults();

    const channel = supabase
      .channel('selftest_results_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'selftest_results',
        },
        () => {
          fetchTestResults();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [categoryFilter, resultFilter]);

  const fetchTestResults = async () => {
    try {
      let query = supabase
        .from('selftest_results')
        .select('*')
        .order('completed_at', { ascending: false })
        .limit(100);

      if (categoryFilter !== 'all') {
        query = query.eq('test_category', categoryFilter);
      }

      if (resultFilter !== 'all') {
        query = query.eq('test_result', resultFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setTestResults(data || []);
    } catch (error) {
      console.error('Error fetching test results:', error);
    } finally {
      setLoading(false);
    }
  };

  const getResultIcon = (result: string) => {
    switch (result) {
      case 'pass':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'fail':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'skipped':
        return <Activity className="w-5 h-5 text-gray-500" />;
      default:
        return <Activity className="w-5 h-5 text-gray-500" />;
    }
  };

  const getResultBadge = (result: string) => {
    const baseClasses = 'px-2 py-1 rounded-full text-xs font-medium';
    switch (result) {
      case 'pass':
        return <span className={`${baseClasses} bg-green-100 text-green-800`}>Pass</span>;
      case 'fail':
        return <span className={`${baseClasses} bg-red-100 text-red-800`}>Fail</span>;
      case 'warning':
        return <span className={`${baseClasses} bg-yellow-100 text-yellow-800`}>Warning</span>;
      case 'error':
        return <span className={`${baseClasses} bg-red-100 text-red-800`}>Error</span>;
      case 'skipped':
        return <span className={`${baseClasses} bg-gray-100 text-gray-800`}>Skipped</span>;
      default:
        return <span className={`${baseClasses} bg-gray-100 text-gray-800`}>{result}</span>;
    }
  };

  const formatDuration = (durationMs: number | null) => {
    if (!durationMs) return 'N/A';
    if (durationMs < 1000) return `${durationMs}ms`;
    if (durationMs < 60000) return `${(durationMs / 1000).toFixed(1)}s`;
    return `${(durationMs / 60000).toFixed(1)}m`;
  };

  const formatTimestamp = (timestamp: string | null) => {
    if (!timestamp) return 'N/A';
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
    const total = testResults.length;
    const passed = testResults.filter((t) => t.test_result === 'pass').length;
    const failed = testResults.filter((t) => t.test_result === 'fail' || t.test_result === 'error').length;
    const warnings = testResults.filter((t) => t.test_result === 'warning').length;
    const passRate = total > 0 ? ((passed / total) * 100).toFixed(1) : '0.0';
    const avgHealthScore = testResults
      .filter((t) => t.health_score !== null)
      .reduce((sum, t) => sum + (t.health_score || 0), 0) / Math.max(1, testResults.filter((t) => t.health_score !== null).length);
    const regressions = testResults.filter((t) => t.regression_detected).length;
    const improvements = testResults.filter((t) => t.improvement_detected).length;

    return { total, passed, failed, warnings, passRate, avgHealthScore, regressions, improvements };
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
          <h2 className="text-2xl font-bold text-gray-900">Self-Test Panel</h2>
          <p className="text-sm text-gray-600 mt-1">Automated system diagnostics and health checks</p>
        </div>
        <button
          onClick={fetchTestResults}
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
              <p className="text-sm text-gray-600">Total Tests</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
            </div>
            <Activity className="w-8 h-8 text-blue-500" />
          </div>
          <div className="mt-4 flex items-center space-x-4 text-xs">
            <span className="text-green-600">✓ {stats.passed}</span>
            <span className="text-red-600">✗ {stats.failed}</span>
            <span className="text-yellow-600">⚠ {stats.warnings}</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pass Rate</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.passRate}%</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
          <div className="mt-4 text-xs">
            {parseFloat(stats.passRate) >= 95 ? (
              <span className="text-green-600">✓ Excellent</span>
            ) : parseFloat(stats.passRate) >= 80 ? (
              <span className="text-yellow-600">⚠ Good</span>
            ) : (
              <span className="text-red-600">✗ Needs Attention</span>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Avg Health Score</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.avgHealthScore.toFixed(1)}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-purple-500" />
          </div>
          <div className="mt-4 text-xs">
            {stats.avgHealthScore >= 90 ? (
              <span className="text-green-600">✓ Excellent</span>
            ) : stats.avgHealthScore >= 70 ? (
              <span className="text-yellow-600">⚠ Good</span>
            ) : (
              <span className="text-red-600">✗ Poor</span>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Regressions</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.regressions}</p>
            </div>
            <TrendingDown className="w-8 h-8 text-red-500" />
          </div>
          <div className="mt-4 text-xs text-gray-600">
            {stats.improvements} improvements
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Categories</option>
              <option value="connectivity">Connectivity</option>
              <option value="performance">Performance</option>
              <option value="security">Security</option>
              <option value="data_integrity">Data Integrity</option>
              <option value="integration">Integration</option>
              <option value="functionality">Functionality</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Result</label>
            <select
              value={resultFilter}
              onChange={(e) => setResultFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Results</option>
              <option value="pass">Pass</option>
              <option value="fail">Fail</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
            </select>
          </div>
        </div>
      </div>

      {/* Test Results List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Test Results</h3>
          <p className="text-sm text-gray-600 mt-1">{testResults.length} tests found</p>
        </div>

        <div className="divide-y divide-gray-200">
          {testResults.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-500">
              <Activity className="w-12 h-12 mx-auto text-gray-400 mb-3" />
              <p className="text-lg font-medium">No test results</p>
              <p className="text-sm mt-1">Run tests to see results here</p>
            </div>
          ) : (
            testResults.map((test) => (
              <div
                key={test.id}
                className="px-6 py-4 hover:bg-gray-50 cursor-pointer"
                onClick={() => setSelectedTest(test)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1">
                    {getResultIcon(test.test_result)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        {getResultBadge(test.test_result)}
                        <span className="text-xs text-gray-500">{formatTimestamp(test.completed_at)}</span>
                        {test.regression_detected && (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            Regression
                          </span>
                        )}
                        {test.improvement_detected && (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Improvement
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-gray-900">{test.test_name}</p>
                      <div className="flex items-center space-x-4 mt-2 text-xs text-gray-600">
                        <span>{test.test_category.replace(/_/g, ' ')}</span>
                        <span className="flex items-center">
                          <CheckCircle className="w-3 h-3 mr-1 text-green-500" />
                          {test.pass_count}/{test.total_assertions}
                        </span>
                        {test.health_score !== null && (
                          <span className="text-purple-600">
                            Health: {test.health_score.toFixed(0)}
                          </span>
                        )}
                        {test.execution_duration_ms && (
                          <span className="flex items-center">
                            <Clock className="w-3 h-3 mr-1" />
                            {formatDuration(test.execution_duration_ms)}
                          </span>
                        )}
                      </div>
                      {test.test_summary && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-1">{test.test_summary}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Test Detail Modal */}
      {selectedTest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Test Details</h3>
              <button
                onClick={() => setSelectedTest(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              {/* Result */}
              <div className="flex items-center space-x-2">
                {getResultIcon(selectedTest.test_result)}
                {getResultBadge(selectedTest.test_result)}
                {selectedTest.regression_detected && (
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    Regression Detected
                  </span>
                )}
                {selectedTest.improvement_detected && (
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Improvement Detected
                  </span>
                )}
              </div>

              {/* Test Name */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-1">Test Name</h4>
                <p className="text-sm text-gray-900">{selectedTest.test_name}</p>
              </div>

              {/* Summary */}
              {selectedTest.test_summary && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-1">Summary</h4>
                  <p className="text-sm text-gray-900">{selectedTest.test_summary}</p>
                </div>
              )}

              {/* Failure Reason */}
              {selectedTest.failure_reason && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-1">Failure Reason</h4>
                  <p className="text-sm text-red-600 bg-red-50 p-3 rounded">{selectedTest.failure_reason}</p>
                </div>
              )}

              {/* Assertions */}
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center p-3 bg-gray-50 rounded">
                  <p className="text-2xl font-bold text-gray-900">{selectedTest.total_assertions}</p>
                  <p className="text-xs text-gray-600 mt-1">Total</p>
                </div>
                <div className="text-center p-3 bg-green-50 rounded">
                  <p className="text-2xl font-bold text-green-600">{selectedTest.pass_count}</p>
                  <p className="text-xs text-gray-600 mt-1">Passed</p>
                </div>
                <div className="text-center p-3 bg-red-50 rounded">
                  <p className="text-2xl font-bold text-red-600">{selectedTest.fail_count}</p>
                  <p className="text-xs text-gray-600 mt-1">Failed</p>
                </div>
                <div className="text-center p-3 bg-yellow-50 rounded">
                  <p className="text-2xl font-bold text-yellow-600">{selectedTest.warning_count}</p>
                  <p className="text-xs text-gray-600 mt-1">Warnings</p>
                </div>
              </div>

              {/* Scores */}
              {(selectedTest.health_score !== null || selectedTest.reliability_score !== null || selectedTest.performance_score !== null) && (
                <div className="grid grid-cols-3 gap-4">
                  {selectedTest.health_score !== null && (
                    <div className="text-center p-3 bg-purple-50 rounded">
                      <p className="text-2xl font-bold text-purple-600">{selectedTest.health_score.toFixed(0)}</p>
                      <p className="text-xs text-gray-600 mt-1">Health Score</p>
                    </div>
                  )}
                  {selectedTest.reliability_score !== null && (
                    <div className="text-center p-3 bg-blue-50 rounded">
                      <p className="text-2xl font-bold text-blue-600">{selectedTest.reliability_score.toFixed(0)}</p>
                      <p className="text-xs text-gray-600 mt-1">Reliability</p>
                    </div>
                  )}
                  {selectedTest.performance_score !== null && (
                    <div className="text-center p-3 bg-green-50 rounded">
                      <p className="text-2xl font-bold text-green-600">{selectedTest.performance_score.toFixed(0)}</p>
                      <p className="text-xs text-gray-600 mt-1">Performance</p>
                    </div>
                  )}
                </div>
              )}

              {/* Metadata */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                <div>
                  <p className="text-xs text-gray-500">Category</p>
                  <p className="text-sm font-medium text-gray-900">{selectedTest.test_category.replace(/_/g, ' ')}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Duration</p>
                  <p className="text-sm font-medium text-gray-900">{formatDuration(selectedTest.execution_duration_ms)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Completed</p>
                  <p className="text-sm font-medium text-gray-900">
                    {selectedTest.completed_at 
                      ? new Date(selectedTest.completed_at).toLocaleString() 
                      : 'Not completed'}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setSelectedTest(null)}
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
