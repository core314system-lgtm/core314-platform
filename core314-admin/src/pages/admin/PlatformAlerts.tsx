import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Loader2, RefreshCw, Bell, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';

interface PlatformAlert {
  id: string;
  alert_type: string;
  severity: string;
  title: string;
  description: string | null;
  source: string | null;
  user_id: string | null;
  metadata: Record<string, unknown> | null;
  is_resolved: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
  error: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
  warning: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100',
  info: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
};

export function PlatformAlerts() {
  const [alerts, setAlerts] = useState<PlatformAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showResolved, setShowResolved] = useState(false);

  const fetchAlerts = async () => {
    try {
      let query = supabase
        .from('platform_alerts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (!showResolved) {
        query = query.eq('is_resolved', false);
      }

      const { data, error } = await query;
      if (error) throw error;
      setAlerts(data || []);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchAlerts(); }, [showResolved]);
  const handleRefresh = () => { setRefreshing(true); fetchAlerts(); };

  const resolveAlert = async (alertId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase
        .from('platform_alerts')
        .update({
          is_resolved: true,
          resolved_at: new Date().toISOString(),
          resolved_by: user?.id || null,
        })
        .eq('id', alertId);

      // Log the admin action
      if (user?.id) {
        await supabase.from('admin_audit_logs').insert({
          admin_id: user.id,
          action: 'alert.resolve',
          target_type: 'platform_alert',
          target_id: alertId,
          details: { resolved_at: new Date().toISOString() },
        });
      }

      fetchAlerts();
    } catch (error) {
      console.error('Error resolving alert:', error);
    }
  };

  const activeAlerts = alerts.filter(a => !a.is_resolved);
  const criticalAlerts = activeAlerts.filter(a => a.severity === 'critical');
  const warningAlerts = activeAlerts.filter(a => a.severity === 'warning');

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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Platform Alerts</h1>
          <p className="text-gray-600 dark:text-gray-400">Automated alerts for platform health issues</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setShowResolved(!showResolved)}
            variant={showResolved ? 'default' : 'outline'}
            size="sm"
          >
            {showResolved ? 'Hide Resolved' : 'Show Resolved'}
          </Button>
          <Button onClick={handleRefresh} disabled={refreshing} variant="outline">
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
            <Bell className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeAlerts.length}</div>
            <p className="text-xs text-muted-foreground">Unresolved</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Critical</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{criticalAlerts.length}</div>
            <p className="text-xs text-muted-foreground">Require immediate action</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Warnings</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{warningAlerts.length}</div>
            <p className="text-xs text-muted-foreground">Monitor closely</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Alerts</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{alerts.length}</div>
            <p className="text-xs text-muted-foreground">{showResolved ? 'Including resolved' : 'Active only'}</p>
          </CardContent>
        </Card>
      </div>

      {/* Critical Alerts Banner */}
      {criticalAlerts.length > 0 && (
        <Card className="border-red-300 bg-red-50 dark:bg-red-900/20">
          <CardHeader>
            <CardTitle className="text-red-800 dark:text-red-200 flex items-center gap-2">
              <XCircle className="h-5 w-5" />
              Critical Alerts
            </CardTitle>
            <CardDescription className="text-red-600">These require immediate attention</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {criticalAlerts.map(alert => (
              <div key={alert.id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-red-200">
                <div>
                  <p className="font-medium">{alert.title}</p>
                  <p className="text-sm text-muted-foreground">{alert.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {alert.source} — {new Date(alert.created_at).toLocaleString()}
                  </p>
                </div>
                <Button size="sm" onClick={() => resolveAlert(alert.id)} variant="outline">
                  Resolve
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* All Alerts Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Alerts</CardTitle>
          <CardDescription>{alerts.length} alerts</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Severity</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alerts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No alerts. The system is operating normally.
                  </TableCell>
                </TableRow>
              ) : (
                alerts.map(alert => (
                  <TableRow key={alert.id}>
                    <TableCell>
                      <Badge className={SEVERITY_COLORS[alert.severity] || SEVERITY_COLORS.info}>
                        {alert.severity.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{alert.title}</p>
                        {alert.description && (
                          <p className="text-xs text-muted-foreground max-w-xs truncate">{alert.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline">{alert.alert_type}</Badge></TableCell>
                    <TableCell>{alert.source || '—'}</TableCell>
                    <TableCell>
                      <Badge className={alert.is_resolved ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                        {alert.is_resolved ? 'Resolved' : 'Active'}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {new Date(alert.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {!alert.is_resolved && (
                        <Button size="sm" variant="outline" onClick={() => resolveAlert(alert.id)}>
                          Resolve
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
