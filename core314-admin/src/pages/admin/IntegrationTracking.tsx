import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { AdminIntegrationTracking } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { Layers } from 'lucide-react';

export function IntegrationTracking() {
  const [integrations, setIntegrations] = useState<AdminIntegrationTracking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const fetchIntegrations = async () => {
    try {
      // Query user_integrations - the same source of truth as User Integration Hub
      const { data: userIntegrations, error: userError } = await supabase
        .from('user_integrations')
        .select('*')
        .order('created_at', { ascending: false });

      if (userError) throw userError;

      if (!userIntegrations || userIntegrations.length === 0) {
        setIntegrations([]);
        setLoading(false);
        return;
      }

      // Get provider IDs to fetch registry data
      const providerIds = userIntegrations
        .map(ui => ui.provider_id || ui.integration_id)
        .filter(Boolean);

      // Fetch integration registry for display names
      const { data: registryData, error: registryError } = await supabase
        .from('integration_registry')
        .select('id, service_name, display_name, category')
        .in('id', providerIds);

      if (registryError) throw registryError;

      // Fetch user profiles for user reference
      const userIds = [...new Set(userIntegrations.map(ui => ui.user_id))];
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      // Merge data with registry and user info
      const merged: AdminIntegrationTracking[] = userIntegrations
        .map(ui => {
          const registry = registryData?.find(r => 
            r.id === ui.provider_id || r.id === ui.integration_id
          );
          const user = profilesData?.find(p => p.id === ui.user_id);
          
          return {
            id: ui.id,
            user_id: ui.user_id,
            provider_id: ui.provider_id || ui.integration_id,
            status: ui.status || 'active',
            created_at: ui.created_at,
            last_verified_at: ui.last_verified_at,
            error_message: ui.error_message,
            environment: 'beta' as const, // All current integrations are beta
            registry: registry ? {
              id: registry.id,
              service_name: registry.service_name,
              display_name: registry.display_name,
              category: registry.category,
            } : undefined,
            user: user ? {
              id: user.id,
              email: user.email,
              full_name: user.full_name,
            } : undefined,
          };
        })
        .filter(integration => integration.registry !== undefined);

      setIntegrations(merged);
    } catch (error) {
      console.error('Error fetching integrations:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'syncing':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'error':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const formatIntegrationType = (type: string) => {
    return type
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  const integrationStats = {
    total: integrations.length,
    active: integrations.filter(i => i.status === 'active').length,
    inactive: integrations.filter(i => i.status === 'inactive').length,
    error: integrations.filter(i => i.status === 'error').length,
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Integration Tracking</h1>
        <p className="text-gray-600 dark:text-gray-400">Monitor all integration statuses across the platform</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Integrations</CardTitle>
            <Layers className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{integrationStats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <div className="h-3 w-3 bg-green-500 rounded-full"></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{integrationStats.active}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Inactive</CardTitle>
            <div className="h-3 w-3 bg-gray-400 rounded-full"></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{integrationStats.inactive}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Errors</CardTitle>
            <div className="h-3 w-3 bg-red-500 rounded-full"></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{integrationStats.error}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Integrations</CardTitle>
        </CardHeader>
        <CardContent>
          {integrations.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              No integrations configured yet
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tool Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Environment</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Last Verified</TableHead>
                  <TableHead>Error</TableHead>
                  <TableHead>Connected</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {integrations.map((integration) => (
                  <TableRow key={integration.id}>
                    <TableCell className="font-medium">
                      {integration.registry?.display_name || formatIntegrationType(integration.provider_id)}
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusBadgeColor(integration.status)}>
                        {integration.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                        {integration.environment}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {integration.user?.email || integration.user_id.slice(0, 8) + '...'}
                    </TableCell>
                    <TableCell>
                      {integration.last_verified_at
                        ? new Date(integration.last_verified_at).toLocaleString()
                        : 'Never'}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {integration.error_message || '-'}
                    </TableCell>
                    <TableCell>
                      {new Date(integration.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
