import { useEffect, useState, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { Bell, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '../../../lib/supabase';

interface Alert {
  id: string;
  alert_type: 'reliability' | 'churn' | 'onboarding' | 'signup' | 'system';
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  metadata: Record<string, any>;
  user_id: string | null;
  throttle_key: string;
  is_resolved: boolean;
  resolved_at: string | null;
  created_at: string;
  user_name?: string;
  user_email?: string;
}

interface KPIs {
  critical: number;
  errors: number;
  warnings: number;
  unresolved: number;
}

export default function AlertsPanel() {
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [kpis, setKPIs] = useState<KPIs>({
    critical: 0,
    errors: 0,
    warnings: 0,
    unresolved: 0,
  });
  const [resolvingAlerts, setResolvingAlerts] = useState<Set<string>>(new Set());
  const refreshIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    fetchAlerts();

    refreshIntervalRef.current = window.setInterval(() => {
      fetchAlerts();
    }, 10000);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, []);

  const fetchAlerts = async () => {
    try {
      setLoading(true);

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: alertsData, error } = await supabase
        .from('alerts')
        .select('*')
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching alerts:', error);
        toast.error('Failed to load alerts');
        return;
      }

      const userIds = [...new Set(alertsData?.filter(a => a.user_id).map(a => a.user_id) || [])];
      let userMap: Record<string, { full_name: string; email: string }> = {};

      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', userIds);

        if (profiles) {
          userMap = profiles.reduce((acc, p) => {
            acc[p.id] = { full_name: p.full_name, email: p.email };
            return acc;
          }, {} as Record<string, { full_name: string; email: string }>);
        }
      }

      const enrichedAlerts = (alertsData || []).map(alert => ({
        ...alert,
        user_name: alert.user_id ? userMap[alert.user_id]?.full_name : undefined,
        user_email: alert.user_id ? userMap[alert.user_id]?.email : undefined,
      }));

      setAlerts(enrichedAlerts);

      const twentyFourHoursAgo = new Date();
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

      const last24hAlerts = enrichedAlerts.filter(
        (a) => new Date(a.created_at) >= twentyFourHoursAgo
      );

      const criticalCount = last24hAlerts.filter((a) => a.severity === 'critical').length;
      const errorCount = last24hAlerts.filter((a) => a.severity === 'error').length;
      const warningCount = last24hAlerts.filter((a) => a.severity === 'warning').length;
      const unresolvedCount = enrichedAlerts.filter((a) => !a.is_resolved).length;

      setKPIs({
        critical: criticalCount,
        errors: errorCount,
        warnings: warningCount,
        unresolved: unresolvedCount,
      });
    } catch (error) {
      console.error('Error in fetchAlerts:', error);
      toast.error('Failed to load alerts');
    } finally {
      setLoading(false);
    }
  };

  const handleResolveAlert = async (alertId: string) => {
    try {
      setResolvingAlerts(prev => new Set(prev).add(alertId));

      const { error } = await supabase
        .from('alerts')
        .update({
          is_resolved: true,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', alertId);

      if (error) {
        throw error;
      }

      setAlerts(prev =>
        prev.map(alert =>
          alert.id === alertId
            ? { ...alert, is_resolved: true, resolved_at: new Date().toISOString() }
            : alert
        )
      );

      setKPIs(prev => ({
        ...prev,
        unresolved: Math.max(0, prev.unresolved - 1),
      }));

      toast.success('Alert resolved successfully');
    } catch (error) {
      console.error('Error resolving alert:', error);
      toast.error('Failed to resolve alert');
    } finally {
      setResolvingAlerts(prev => {
        const next = new Set(prev);
        next.delete(alertId);
        return next;
      });
    }
  };

  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'error':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'warning':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'info':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getTypeColor = (type: string): string => {
    switch (type) {
      case 'reliability':
        return 'bg-purple-100 text-purple-700';
      case 'churn':
        return 'bg-red-100 text-red-700';
      case 'onboarding':
        return 'bg-blue-100 text-blue-700';
      case 'signup':
        return 'bg-green-100 text-green-700';
      case 'system':
        return 'bg-gray-100 text-gray-700';
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Bell className="w-16 h-16 text-gray-400 mb-4" />
        <p className="text-gray-600 text-lg">No alerts found.</p>
        <p className="text-gray-500 text-sm mt-2">
          The alerts system is monitoring your platform. Alerts will appear here when conditions are met.
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
            <h3 className="text-sm font-medium text-gray-500">Critical (24h)</h3>
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <p className="text-3xl font-bold text-red-600">{kpis.critical}</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-500">Errors (24h)</h3>
            <XCircle className="w-5 h-5 text-orange-500" />
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
            <h3 className="text-sm font-medium text-gray-500">Unresolved</h3>
            <Bell className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-3xl font-bold text-blue-600">{kpis.unresolved}</p>
        </div>
      </div>

      {/* Alerts Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">All Alerts</h2>
          <p className="text-sm text-gray-500">Auto-refreshes every 10 seconds</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Severity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Title
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Message
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {alerts.map((alert) => (
                <tr
                  key={alert.id}
                  className={`hover:bg-gray-50 ${alert.is_resolved ? 'opacity-60' : ''}`}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    {alert.is_resolved ? (
                      <span className="flex items-center gap-1 text-xs text-green-600">
                        <CheckCircle className="w-4 h-4" />
                        Resolved
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-blue-600">
                        <Bell className="w-4 h-4" />
                        Active
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(alert.created_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded ${getTypeColor(
                        alert.alert_type
                      )}`}
                    >
                      {alert.alert_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded border ${getSeverityColor(
                        alert.severity
                      )}`}
                    >
                      {alert.severity.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 max-w-xs">
                    <div className="font-medium">{alert.title}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 max-w-md">
                    <div className="truncate" title={alert.message}>
                      {alert.message}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {alert.user_name ? (
                      <div>
                        <div className="font-medium">{alert.user_name}</div>
                        <div className="text-xs text-gray-500">{alert.user_email}</div>
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {!alert.is_resolved && (
                      <button
                        onClick={() => handleResolveAlert(alert.id)}
                        disabled={resolvingAlerts.has(alert.id)}
                        className="text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50"
                      >
                        {resolvingAlerts.has(alert.id) ? 'Resolving...' : 'Resolve'}
                      </button>
                    )}
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
