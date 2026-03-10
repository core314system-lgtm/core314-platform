import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
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
import { Layers, Briefcase, RefreshCw, Clock, AlertCircle } from 'lucide-react';

interface AdminIntegrationRecord {
  id: string;
  user_id: string;
  provider_id: string;
  status: string;
  date_added: string;
  last_verified_at: string | null;
  error_message: string | null;
  user_email: string;
  user_name: string | null;
  service_name: string;
  display_name: string;
}

interface IntegrationStats {
  total: number;
  active: number;
  inactive: number;
  error: number;
  pending: number;
}

interface HubSpotConnection {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string | null;
  hubspot_portal_id: string | null;
  sync_status: string;
  sync_error: string | null;
  last_sync_at: string | null;
  contacts_synced: number;
  deals_synced: number;
  companies_synced: number;
  created_at: string;
  updated_at: string;
}

interface HubSpotStats {
  total: number;
  syncing: number;
  success: number;
  error: number;
  pending: number;
}

export function IntegrationTracking() {
  const [integrations, setIntegrations] = useState<AdminIntegrationRecord[]>([]);
  const [stats, setStats] = useState<IntegrationStats>({ total: 0, active: 0, inactive: 0, error: 0, pending: 0 });
  const [hubspotConnections, setHubspotConnections] = useState<HubSpotConnection[]>([]);
  const [hubspotStats, setHubspotStats] = useState<HubSpotStats>({ total: 0, syncing: 0, success: 0, error: 0, pending: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchIntegrations();
    fetchHubSpotConnections();
  }, []);

  const fetchIntegrations = async () => {
    try {
      setError(null);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError('No active session. Please log in again.');
        setLoading(false);
        return;
      }

      const response = await fetch('/.netlify/functions/admin-list-integrations', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch integrations');
      }

      const data = await response.json();
      setIntegrations(data.integrations || []);
      setStats(data.stats || { total: 0, active: 0, inactive: 0, error: 0, pending: 0 });
    } catch (err) {
      console.error('Error fetching integrations:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch integrations');
    } finally {
      setLoading(false);
    }
  };

  const fetchHubSpotConnections = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const response = await fetch('/.netlify/functions/admin-hubspot-connections', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setHubspotConnections(data.connections || []);
        setHubspotStats(data.stats || { total: 0, syncing: 0, success: 0, error: 0, pending: 0 });
      }
    } catch (err) {
      console.error('Error fetching HubSpot connections:', err);
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'pending':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'error':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'inactive':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const getSyncBadgeColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'syncing':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'error':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
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

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Integration Tracking</h1>
        <p className="text-gray-600 dark:text-gray-400">Monitor all user-connected integrations across the platform</p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Integrations</CardTitle>
            <Layers className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <div className="h-3 w-3 bg-green-500 rounded-full"></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Inactive</CardTitle>
            <div className="h-3 w-3 bg-gray-400 rounded-full"></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.inactive}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <div className="h-3 w-3 bg-blue-500 rounded-full"></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Errors</CardTitle>
            <div className="h-3 w-3 bg-red-500 rounded-full"></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.error}</div>
          </CardContent>
        </Card>
      </div>

      {/* HubSpot Connections Section */}
      {hubspotConnections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-orange-500" />
              HubSpot Connections
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                <p className="text-xs text-gray-500">Connected Accounts</p>
                <p className="text-xl font-bold">{hubspotStats.total}</p>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
                <p className="text-xs text-gray-500">Syncing Successfully</p>
                <p className="text-xl font-bold text-green-600">{hubspotStats.success}</p>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
                <p className="text-xs text-gray-500">Sync Errors</p>
                <p className="text-xl font-bold text-red-600">{hubspotStats.error}</p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                <p className="text-xs text-gray-500">Pending Setup</p>
                <p className="text-xl font-bold text-blue-600">{hubspotStats.pending}</p>
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Portal ID</TableHead>
                  <TableHead>Sync Status</TableHead>
                  <TableHead>Last Sync</TableHead>
                  <TableHead>Contacts</TableHead>
                  <TableHead>Deals</TableHead>
                  <TableHead>Companies</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hubspotConnections.map((conn) => (
                  <TableRow key={conn.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{conn.user_email}</div>
                        {conn.user_name && (
                          <div className="text-xs text-gray-500">{conn.user_name}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{conn.hubspot_portal_id || '-'}</TableCell>
                    <TableCell>
                      <Badge className={getSyncBadgeColor(conn.sync_status)}>
                        {conn.sync_status === 'syncing' && <RefreshCw className="h-3 w-3 mr-1 animate-spin" />}
                        {conn.sync_status === 'success' && <Clock className="h-3 w-3 mr-1" />}
                        {conn.sync_status === 'error' && <AlertCircle className="h-3 w-3 mr-1" />}
                        {conn.sync_status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {conn.last_sync_at ? new Date(conn.last_sync_at).toLocaleString() : 'Never'}
                    </TableCell>
                    <TableCell>{conn.contacts_synced}</TableCell>
                    <TableCell>{conn.deals_synced}</TableCell>
                    <TableCell>{conn.companies_synced}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      {conn.sync_error || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All Connected Integrations</CardTitle>
        </CardHeader>
        <CardContent>
          {integrations.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              No user-connected integrations found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Integration</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Verified</TableHead>
                  <TableHead>Error</TableHead>
                  <TableHead>Connected</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {integrations.map((integration) => (
                  <TableRow key={integration.id}>
                    <TableCell className="font-medium">
                      {integration.display_name}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      <div>
                        <div className="font-medium">{integration.user_email}</div>
                        {integration.user_name && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">{integration.user_name}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusBadgeColor(integration.status)}>
                        {integration.status}
                      </Badge>
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
                      {new Date(integration.date_added).toLocaleDateString()}
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
