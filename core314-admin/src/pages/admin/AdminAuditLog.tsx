import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Loader2, RefreshCw, Shield, FileText, Clock, Users } from 'lucide-react';

interface AuditEntry {
  id: string;
  admin_id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

const ACTION_COLORS: Record<string, string> = {
  'user.delete': 'bg-red-100 text-red-800',
  'user.edit': 'bg-blue-100 text-blue-800',
  'user.create': 'bg-green-100 text-green-800',
  'subscription.change': 'bg-purple-100 text-purple-800',
  'system.config': 'bg-yellow-100 text-yellow-800',
  'alert.resolve': 'bg-teal-100 text-teal-800',
};

export function AdminAuditLog() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchEntries = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      setEntries(data || []);
    } catch (error) {
      console.error('Error fetching audit log:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchEntries(); }, []);
  const handleRefresh = () => { setRefreshing(true); fetchEntries(); };

  const totalEntries = entries.length;
  const uniqueAdmins = new Set(entries.map(e => e.admin_id)).size;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEntries = entries.filter(e => new Date(e.created_at) >= todayStart).length;

  // Action breakdown
  const actionMap = new Map<string, number>();
  entries.forEach(e => {
    actionMap.set(e.action, (actionMap.get(e.action) || 0) + 1);
  });

  const getActionBadge = (action: string) => {
    const colorClass = ACTION_COLORS[action] || 'bg-gray-100 text-gray-800';
    return <Badge className={colorClass}>{action}</Badge>;
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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Admin Audit Log</h1>
          <p className="text-gray-600 dark:text-gray-400">Complete record of all admin actions</p>
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
            <CardTitle className="text-sm font-medium">Total Actions</CardTitle>
            <FileText className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEntries}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Today&apos;s Actions</CardTitle>
            <Clock className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayEntries}</div>
            <p className="text-xs text-muted-foreground">Since midnight</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Admins</CardTitle>
            <Users className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{uniqueAdmins}</div>
            <p className="text-xs text-muted-foreground">Distinct administrators</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Action Types</CardTitle>
            <Shield className="h-4 w-4 text-sky-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{actionMap.size}</div>
            <p className="text-xs text-muted-foreground">Unique action categories</p>
          </CardContent>
        </Card>
      </div>

      {/* Action Type Breakdown */}
      {actionMap.size > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Action Breakdown</CardTitle>
            <CardDescription>Count by action type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {Array.from(actionMap.entries()).sort((a, b) => b[1] - a[1]).map(([action, count]) => (
                <div key={action} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  {getActionBadge(action)}
                  <span className="font-bold">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Audit Log Table */}
      <Card>
        <CardHeader>
          <CardTitle>Audit Trail</CardTitle>
          <CardDescription>{entries.length} entries</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Target ID</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>IP Address</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No admin actions logged yet. Actions will be recorded as admins interact with the dashboard.
                  </TableCell>
                </TableRow>
              ) : (
                entries.map(entry => (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap">
                      {new Date(entry.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>{getActionBadge(entry.action)}</TableCell>
                    <TableCell>{entry.target_type || '—'}</TableCell>
                    <TableCell className="font-mono text-xs max-w-[120px] truncate">
                      {entry.target_id || '—'}
                    </TableCell>
                    <TableCell className="max-w-xs">
                      {entry.details ? (
                        <pre className="text-xs bg-gray-50 dark:bg-gray-800 rounded p-1 max-h-20 overflow-auto">
                          {JSON.stringify(entry.details, null, 1)}
                        </pre>
                      ) : '—'}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{entry.ip_address || '—'}</TableCell>
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
