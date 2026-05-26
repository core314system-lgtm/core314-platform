import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useSupabaseClient } from '../../contexts/SupabaseClientContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { RefreshCw, CheckCircle, AlertTriangle, Clock, Activity } from 'lucide-react';
import { format } from 'date-fns';

/**
 * Phase 11B: Admin Integration Health Panel
 * 
 * Admin-only view showing integration health status.
 * This data is NEVER accessible to regular users.
 * 
 * Status mapping:
 * - Healthy: last_successful_run_at present, no failure_reason
 * - Analyzing: zero activity, no failure
 * - Temporarily Unavailable: failure_reason present
 */

interface IntegrationHealthData {
  id: string;
  user_id: string;
  integration_id: string;
  service_name: string;
  last_successful_run_at: string | null;
  last_failed_run_at: string | null;
  failure_reason: string | null;
  activity_volume: number;
  computed_at: string;
}

type HealthStatus = 'healthy' | 'analyzing' | 'temporarily_unavailable';

function getHealthStatus(data: IntegrationHealthData): HealthStatus {
  // If failure_reason is present and failure is more recent than success
  if (data.failure_reason) {
    const lastSuccess = data.last_successful_run_at ? new Date(data.last_successful_run_at) : null;
    const lastFailed = data.last_failed_run_at ? new Date(data.last_failed_run_at) : null;
    
    if (!lastSuccess || (lastFailed && lastFailed >= lastSuccess)) {
      return 'temporarily_unavailable';
    }
  }
  
  // If no activity but no failure = analyzing
  if (data.activity_volume === 0 && !data.failure_reason) {
    return 'analyzing';
  }
  
  // Otherwise healthy
  return 'healthy';
}

function getStatusBadge(status: HealthStatus) {
  switch (status) {
    case 'healthy':
      return (
        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
          <CheckCircle className="h-3 w-3 mr-1" />
          Healthy
        </Badge>
      );
    case 'analyzing':
      return (
        <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
          <Clock className="h-3 w-3 mr-1" />
          Analyzing
        </Badge>
      );
    case 'temporarily_unavailable':
      return (
        <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Temporarily Unavailable
        </Badge>
      );
  }
}

function formatServiceName(serviceName: string): string {
  return serviceName
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function IntegrationHealth() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const supabase = useSupabaseClient();
  
  const [healthData, setHealthData] = useState<IntegrationHealthData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isAdmin = () => {
    return profile?.role === 'admin';
  };

  useEffect(() => {
    if (profile && isAdmin()) {
      fetchHealthData();
    }
  }, [profile]);

  const fetchHealthData = async () => {
    if (!profile?.id) return;

    try {
      // Fetch all integration intelligence data for admin view
      const { data, error } = await supabase
        .from('integration_intelligence')
        .select('id, user_id, integration_id, service_name, last_successful_run_at, last_failed_run_at, failure_reason, activity_volume, computed_at')
        .order('service_name', { ascending: true });

      if (error) {
        console.error('Error fetching integration health data:', error);
        return;
      }

      setHealthData(data || []);
    } catch (error) {
      console.error('Error fetching integration health data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchHealthData();
    setRefreshing(false);
  };

  // Count integrations by status
  const statusCounts = healthData.reduce(
    (acc, item) => {
      const status = getHealthStatus(item);
      acc[status]++;
      return acc;
    },
    { healthy: 0, analyzing: 0, temporarily_unavailable: 0 }
  );

  return (
    <div className="p-6 space-y-6">
      {profile && !isAdmin() ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Access Restricted
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            This page is only accessible to administrators.
          </p>
          <Button onClick={() => navigate('/dashboard')}>
            Return to Dashboard
          </Button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Integration Health Panel
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Admin-only view of integration operational status
              </p>
            </div>
            <Button onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Healthy</p>
                    <p className="text-2xl font-bold text-green-600">{statusCounts.healthy}</p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Analyzing</p>
                    <p className="text-2xl font-bold text-blue-600">{statusCounts.analyzing}</p>
                  </div>
                  <Clock className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Temporarily Unavailable</p>
                    <p className="text-2xl font-bold text-amber-600">{statusCounts.temporarily_unavailable}</p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-amber-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Integration Health Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Integration Intelligence Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-center py-8 text-gray-600">Loading integration health data...</p>
              ) : healthData.length === 0 ? (
                <p className="text-center py-8 text-gray-600">
                  No integration intelligence data available.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3">Integration</th>
                        <th className="text-center p-3">Status</th>
                        <th className="text-left p-3">Last Success</th>
                        <th className="text-left p-3">Last Failure</th>
                        <th className="text-left p-3">Failure Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {healthData.map((item) => {
                        const status = getHealthStatus(item);
                        return (
                          <tr key={item.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                            <td className="p-3 font-medium">
                              {formatServiceName(item.service_name)}
                            </td>
                            <td className="p-3 text-center">
                              {getStatusBadge(status)}
                            </td>
                            <td className="p-3 text-sm text-gray-600 dark:text-gray-400">
                              {item.last_successful_run_at 
                                ? format(new Date(item.last_successful_run_at), 'MMM dd, yyyy h:mm a')
                                : 'Never'}
                            </td>
                            <td className="p-3 text-sm text-gray-600 dark:text-gray-400">
                              {item.last_failed_run_at 
                                ? format(new Date(item.last_failed_run_at), 'MMM dd, yyyy h:mm a')
                                : 'Never'}
                            </td>
                            <td className="p-3 text-sm">
                              {item.failure_reason ? (
                                <span className="text-red-600 dark:text-red-400 font-mono text-xs">
                                  {item.failure_reason}
                                </span>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Admin Notice */}
          <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
            This data is for administrative purposes only and is never exposed to regular users.
          </div>
        </>
      )}
    </div>
  );
}
