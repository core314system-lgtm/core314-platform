import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Loader2, CheckCircle, AlertCircle, XCircle, Clock } from 'lucide-react';
import { IntegrationConfig, IntegrationHealthLog } from '../types';

export default function IntegrationHub() {
  const { user } = useAuth();
  const [integrations, setIntegrations] = useState<IntegrationConfig[]>([]);
  const [healthLogs, setHealthLogs] = useState<Record<string, IntegrationHealthLog>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchIntegrations();
    }
  }, [user]);

  const fetchIntegrations = async () => {
    try {
      const { data, error } = await supabase
        .from('integration_configs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setIntegrations(data || []);

      for (const integration of data || []) {
        await fetchLatestHealthLog(integration.id);
      }
    } catch (error) {
      console.error('Error fetching integrations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLatestHealthLog = async (integrationId: string) => {
    try {
      const { data, error } = await supabase
        .from('integration_health_logs')
        .select('*')
        .eq('integration_id', integrationId)
        .order('check_time', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      if (data) {
        setHealthLogs((prev) => ({ ...prev, [integrationId]: data }));
      }
    } catch (error) {
      console.error('Error fetching health log:', error);
    }
  };

  const getStatusBadge = (status: 'healthy' | 'degraded' | 'down' | undefined) => {
    switch (status) {
      case 'healthy':
        return (
          <Badge className="bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            Healthy
          </Badge>
        );
      case 'degraded':
        return (
          <Badge className="bg-yellow-100 text-yellow-800">
            <AlertCircle className="h-3 w-3 mr-1" />
            Degraded
          </Badge>
        );
      case 'down':
        return (
          <Badge className="bg-red-100 text-red-800">
            <XCircle className="h-3 w-3 mr-1" />
            Down
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            Unknown
          </Badge>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Integration Hub</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Monitor the health and status of all your connected integrations
        </p>
      </div>

      {integrations.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <p className="text-gray-600 dark:text-gray-400">
                No integrations configured yet
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {integrations.map((integration) => {
            const healthLog = healthLogs[integration.id];
            return (
              <Card key={integration.id}>
                <CardHeader>
                  <div className="flex items-center justify-between mb-2">
                    <CardTitle className="capitalize text-lg">
                      {integration.integration_type.replace('_', ' ')}
                    </CardTitle>
                    {getStatusBadge(healthLog?.status)}
                  </div>
                  <CardDescription>
                    {integration.is_active ? 'Active' : 'Inactive'} • Sync: {integration.sync_frequency}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 text-sm">
                    {integration.last_sync && (
                      <div>
                        <p className="text-gray-500">Last Sync</p>
                        <p className="font-medium">
                          {new Date(integration.last_sync).toLocaleString()}
                        </p>
                      </div>
                    )}
                    {healthLog && (
                      <>
                        {healthLog.response_time_ms && (
                          <div>
                            <p className="text-gray-500">Response Time</p>
                            <p className="font-medium">{healthLog.response_time_ms}ms</p>
                          </div>
                        )}
                        {healthLog.error_message && (
                          <div>
                            <p className="text-gray-500 text-red-600">Error</p>
                            <p className="font-medium text-red-600 text-xs">
                              {healthLog.error_message}
                            </p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
