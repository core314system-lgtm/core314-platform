
import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Bell, BellOff, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';

interface Alert {
  id: string;
  metric_name: string;
  metric_value: number;
  threshold_value: number;
  alert_level: 'info' | 'warning' | 'critical';
  alert_message: string;
  created_at: string;
}

export const AlertCenter: React.FC = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'info' | 'warning' | 'critical'>('all');

  useEffect(() => {
    loadAlerts();

    const subscription = supabase
      .channel('alert_history_changes')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'alert_history',
      }, () => {
        loadAlerts();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Not authenticated');
      }

      const { data: alertsData, error: alertsError } = await supabase
        .rpc('get_unacknowledged_alerts', {
          p_user_id: user.id,
          p_limit: 50,
        });

      if (alertsError) throw alertsError;

      setAlerts(alertsData || []);
    } catch (err) {
      console.error('Error loading alerts:', err);
      setError(err instanceof Error ? err.message : 'Failed to load alerts');
    } finally {
      setLoading(false);
    }
  };

  const acknowledgeAlert = async (alertId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Not authenticated');
      }

      const { data, error } = await supabase
        .rpc('acknowledge_alert', {
          p_alert_id: alertId,
          p_user_id: user.id,
        });

      if (error) throw error;

      if (data) {
        setAlerts(alerts.filter(alert => alert.id !== alertId));
      }
    } catch (err) {
      console.error('Error acknowledging alert:', err);
      setError(err instanceof Error ? err.message : 'Failed to acknowledge alert');
    }
  };

  const acknowledgeAll = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Not authenticated');
      }

      await Promise.all(
        alerts.map(alert => 
          supabase.rpc('acknowledge_alert', {
            p_alert_id: alert.id,
            p_user_id: user.id,
          })
        )
      );

      setAlerts([]);
    } catch (err) {
      console.error('Error acknowledging all alerts:', err);
      setError(err instanceof Error ? err.message : 'Failed to acknowledge alerts');
    }
  };

  const getAlertIcon = (level: string) => {
    switch (level) {
      case 'critical':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      default:
        return <Info className="w-5 h-5 text-blue-600" />;
    }
  };

  const getAlertColor = (level: string) => {
    switch (level) {
      case 'critical':
        return 'bg-red-50 border-red-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      default:
        return 'bg-blue-50 border-blue-200';
    }
  };

  const formatMetricName = (name: string) => {
    return name
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const filteredAlerts = filter === 'all' 
    ? alerts 
    : alerts.filter(alert => alert.alert_level === filter);

  const alertCounts = {
    all: alerts.length,
    info: alerts.filter(a => a.alert_level === 'info').length,
    warning: alerts.filter(a => a.alert_level === 'warning').length,
    critical: alerts.filter(a => a.alert_level === 'critical').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Bell className="w-6 h-6 animate-pulse text-orange-600" />
        <span className="ml-2 text-gray-600">Loading Alerts...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center">
          <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
          <span className="text-red-800">{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Bell className="w-6 h-6 text-orange-600 mr-2" />
          <h2 className="text-2xl font-bold text-gray-900">Alert Center</h2>
          {alerts.length > 0 && (
            <span className="ml-3 px-3 py-1 text-sm font-semibold text-white bg-orange-600 rounded-full">
              {alerts.length}
            </span>
          )}
        </div>
        {alerts.length > 0 && (
          <button
            onClick={acknowledgeAll}
            className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Acknowledge All
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex space-x-2 border-b border-gray-200">
        {(['all', 'critical', 'warning', 'info'] as const).map((level) => (
          <button
            key={level}
            onClick={() => setFilter(level)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
              filter === level
                ? 'text-orange-600 border-b-2 border-orange-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {level} ({alertCounts[level]})
          </button>
        ))}
      </div>

      {filteredAlerts.length === 0 ? (
        <div className="p-8 text-center bg-gray-50 rounded-lg border border-gray-200">
          <BellOff className="w-12 h-12 mx-auto text-gray-400 mb-3" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Alerts</h3>
          <p className="text-gray-600">
            {filter === 'all' 
              ? "You're all caught up! No alerts require your attention."
              : `No ${filter} alerts at this time.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-4 rounded-lg border ${getAlertColor(alert.alert_level)} hover:shadow-md transition-shadow`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start flex-1">
                  <div className="mt-0.5">{getAlertIcon(alert.alert_level)}</div>
                  <div className="ml-3 flex-1">
                    <div className="flex items-center mb-1">
                      <h3 className="text-sm font-semibold text-gray-900">
                        {formatMetricName(alert.metric_name)}
                      </h3>
                      <span className="ml-2 px-2 py-0.5 text-xs font-medium text-gray-700 bg-white rounded-full uppercase">
                        {alert.alert_level}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 mb-2">{alert.alert_message}</p>
                    <div className="flex items-center text-xs text-gray-600 space-x-4">
                      <span>Current: {alert.metric_value}</span>
                      <span>Threshold: {alert.threshold_value}</span>
                      <span>{formatTimestamp(alert.created_at)}</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => acknowledgeAlert(alert.id)}
                  className="ml-4 p-2 text-gray-600 hover:text-gray-900 hover:bg-white rounded-lg transition-colors"
                  title="Acknowledge alert"
                >
                  <CheckCircle className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
