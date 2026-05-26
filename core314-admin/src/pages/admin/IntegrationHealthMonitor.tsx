import { useEffect, useState } from 'react';
import { fetchAdminData } from '../../lib/adminDataProxy';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Loader2, RefreshCw, Wifi, WifiOff, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts';

interface Integration {
  id: string;
  user_id: string;
  service_name: string;
  status: string;
  connected_at: string;
  last_health_check: string | null;
  health_status: string | null;
  token_expires_at: string | null;
  profiles?: { full_name: string; email: string } | null;
}

interface HealthLog {
  id: string;
  user_id: string;
  service_name: string;
  status: string;
  details: string | null;
  created_at: string;
}

const SERVICE_COLORS: Record<string, string> = {
  slack: '#4A154B',
  hubspot: '#ff7a59',
  quickbooks: '#2CA01C',
};

export function IntegrationHealthMonitor() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [healthLogs, setHealthLogs] = useState<HealthLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const result = await fetchAdminData<{ integrations: Integration[]; healthLogs: HealthLog[]; tableExists: boolean }>('integration-health');
      if (!result.tableExists) {
        console.warn('user_integrations table does not exist yet. Run migrations.');
      }
      setIntegrations(result.integrations || []);
      setHealthLogs(result.healthLogs || []);
    } catch (error) {
      console.error('Error fetching integration data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, []);
  const handleRefresh = () => { setRefreshing(true); fetchData(); };

  const activeIntegrations = integrations.filter(i => i.status === 'active');
  const inactiveIntegrations = integrations.filter(i => i.status !== 'active');
  const totalConnections = integrations.length;

  // Count by service
  const serviceCountMap = new Map<string, number>();
  activeIntegrations.forEach(i => {
    serviceCountMap.set(i.service_name, (serviceCountMap.get(i.service_name) || 0) + 1);
  });
  const serviceData = Array.from(serviceCountMap.entries())
    .map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }));

  // Token expiry alerts
  const now = new Date();
  const expiringTokens = activeIntegrations.filter(i => {
    if (!i.token_expires_at) return false;
    const expiresAt = new Date(i.token_expires_at);
    const hoursUntilExpiry = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);
    return hoursUntilExpiry < 24 && hoursUntilExpiry > 0;
  });

  const expiredTokens = activeIntegrations.filter(i => {
    if (!i.token_expires_at) return false;
    return new Date(i.token_expires_at) < now;
  });

  // Health check success rate
  const recentLogs = healthLogs.filter(l => {
    const logDate = new Date(l.created_at);
    return now.getTime() - logDate.getTime() < 24 * 60 * 60 * 1000;
  });
  const healthyChecks = recentLogs.filter(l => l.status === 'healthy').length;
  const successRate = recentLogs.length > 0 ? Math.round((healthyChecks / recentLogs.length) * 100) : 100;

  // Unique users with integrations
  const uniqueUsers = new Set(integrations.map(i => i.user_id)).size;

  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    inactive: 'bg-gray-100 text-gray-800',
    error: 'bg-red-100 text-red-800',
    expired: 'bg-orange-100 text-orange-800',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Integration Health</h1>
          <p className="text-gray-600 dark:text-gray-400">Real-time integration monitoring across all users</p>
        </div>
        <Button onClick={handleRefresh} disabled={refreshing} variant="outline">
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Connections</CardTitle>
            <Wifi className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeIntegrations.length}</div>
            <p className="text-xs text-muted-foreground">{totalConnections} total ({inactiveIntegrations.length} inactive)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Health Check Rate</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{successRate}%</div>
            <p className="text-xs text-muted-foreground">{recentLogs.length} checks in last 24h</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Token Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{expiringTokens.length + expiredTokens.length}</div>
            <p className="text-xs text-muted-foreground">
              {expiredTokens.length} expired, {expiringTokens.length} expiring soon
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Users Connected</CardTitle>
            <WifiOff className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{uniqueUsers}</div>
            <p className="text-xs text-muted-foreground">With at least 1 integration</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Connections by Service</CardTitle>
            <CardDescription>Active integration distribution</CardDescription>
          </CardHeader>
          <CardContent>
            {serviceData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={serviceData} cx="50%" cy="50%" outerRadius={80} dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {serviceData.map((entry, i) => (
                      <Cell key={i} fill={SERVICE_COLORS[entry.name.toLowerCase()] || '#6366f1'} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">No active integrations</div>
            )}
          </CardContent>
        </Card>

        {/* Token Expiry Alerts */}
        <Card>
          <CardHeader>
            <CardTitle>Token Expiry Alerts</CardTitle>
            <CardDescription>Tokens expiring or expired</CardDescription>
          </CardHeader>
          <CardContent>
            {(expiredTokens.length + expiringTokens.length) > 0 ? (
              <div className="space-y-3 max-h-[250px] overflow-y-auto">
                {expiredTokens.map(i => (
                  <div key={i.id} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <div>
                      <p className="font-medium text-red-800 dark:text-red-200">{i.profiles?.full_name} — {i.service_name}</p>
                      <p className="text-xs text-red-600">Expired {new Date(i.token_expires_at!).toLocaleString()}</p>
                    </div>
                    <Badge className="bg-red-100 text-red-800">Expired</Badge>
                  </div>
                ))}
                {expiringTokens.map(i => (
                  <div key={i.id} className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                    <div>
                      <p className="font-medium text-orange-800 dark:text-orange-200">{i.profiles?.full_name} — {i.service_name}</p>
                      <p className="text-xs text-orange-600">Expires {new Date(i.token_expires_at!).toLocaleString()}</p>
                    </div>
                    <Badge className="bg-orange-100 text-orange-800">Expiring</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">All tokens are healthy</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* All Integrations Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Integrations</CardTitle>
          <CardDescription>{integrations.length} integrations across all users</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Health</TableHead>
                <TableHead>Connected</TableHead>
                <TableHead>Last Health Check</TableHead>
                <TableHead>Token Expires</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {integrations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No integrations connected yet.
                  </TableCell>
                </TableRow>
              ) : (
                integrations.map(i => (
                  <TableRow key={i.id}>
                    <TableCell className="font-medium">{i.profiles?.full_name || 'Unknown'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" style={{ borderColor: SERVICE_COLORS[i.service_name] }}>
                        {i.service_name}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[i.status] || statusColors.inactive}>
                        {i.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {i.health_status ? (
                        <Badge className={i.health_status === 'healthy' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                          {i.health_status}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {i.connected_at ? new Date(i.connected_at).toLocaleDateString() : '—'}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {i.last_health_check ? new Date(i.last_health_check).toLocaleString() : 'Never'}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {i.token_expires_at ? (
                        <span className={new Date(i.token_expires_at) < now ? 'text-red-600 font-medium' : ''}>
                          {new Date(i.token_expires_at).toLocaleString()}
                        </span>
                      ) : '—'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Recent Health Logs */}
      {healthLogs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Health Checks</CardTitle>
            <CardDescription>Last {healthLogs.length} health check results</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Checked At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {healthLogs.slice(0, 20).map(log => (
                  <TableRow key={log.id}>
                    <TableCell><Badge variant="outline">{log.service_name}</Badge></TableCell>
                    <TableCell>
                      <Badge className={log.status === 'healthy' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                        {log.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{log.details || '—'}</TableCell>
                    <TableCell className="whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
