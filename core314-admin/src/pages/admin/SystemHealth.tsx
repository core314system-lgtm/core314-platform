import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { SystemHealth as SystemHealthType } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Activity, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';

export function SystemHealth() {
  const [services, setServices] = useState<SystemHealthType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSystemHealth();
    const interval = setInterval(fetchSystemHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchSystemHealth = async () => {
    try {
      const { data, error } = await supabase
        .from('system_health')
        .select('*')
        .order('last_check_at', { ascending: false });

      if (error) throw error;
      setServices(data || []);
    } catch (error) {
      console.error('Error fetching system health:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle2 className="h-8 w-8 text-green-500" />;
      case 'degraded':
        return <AlertCircle className="h-8 w-8 text-yellow-500" />;
      case 'down':
        return <XCircle className="h-8 w-8 text-red-500" />;
      default:
        return <Activity className="h-8 w-8 text-gray-500" />;
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'degraded':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'down':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const healthyCount = services.filter(s => s.status === 'healthy').length;
  const degradedCount = services.filter(s => s.status === 'degraded').length;
  const downCount = services.filter(s => s.status === 'down').length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">System Health</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Real-time service monitoring - Auto-refreshes every 30 seconds
          </p>
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Last updated: {new Date().toLocaleTimeString()}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Healthy Services</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{healthyCount}</div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Operating normally
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Degraded Services</CardTitle>
            <AlertCircle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{degradedCount}</div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Performance issues
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Down Services</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{downCount}</div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Requires attention
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {services.map((service) => (
          <Card key={service.id}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-4">
                  {getStatusIcon(service.status)}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {service.service_name}
                    </h3>
                    <Badge className={getStatusBadgeColor(service.status)}>
                      {service.status}
                    </Badge>
                  </div>
                </div>
                {service.response_time_ms && (
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {service.response_time_ms}ms
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Response time
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                Last check: {new Date(service.last_check_at).toLocaleString()}
              </div>
              {service.error_message && (
                <div className="mt-2 text-sm text-red-600 dark:text-red-400">
                  Error: {service.error_message}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
