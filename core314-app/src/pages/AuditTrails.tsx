import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { FileCheck, Download, Search, User, Calendar, Activity } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import { FeatureGuard } from '../components/FeatureGuard';
import { format } from 'date-fns';

interface AuditLog {
  id: string;
  created_at: string;
  user_id: string;
  user_email: string;
  action: string;
  resource_type: string;
  resource_id: string;
  details: any;
  ip_address: string;
  user_agent: string;
}

export function AuditTrails() {
  const { profile } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<AuditLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [timeRange, setTimeRange] = useState('30');
  const [stats, setStats] = useState({
    total_events: 0,
    unique_users: 0,
    critical_actions: 0,
    last_24h: 0,
  });

  useEffect(() => {
    if (profile?.id) {
      fetchAuditLogs();
    }
  }, [profile?.id, timeRange]);

  useEffect(() => {
    filterLogs();
  }, [auditLogs, searchQuery, actionFilter]);

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const daysAgo = parseInt(timeRange);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysAgo);

      const { data: logs } = await supabase
        .from('activity_logs')
        .select(`
          id,
          created_at,
          user_id,
          action,
          resource_type,
          resource_id,
          details,
          ip_address,
          user_agent,
          profiles:user_id (email)
        `)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(500);

      if (logs) {
        const formattedLogs = logs.map((log: any) => ({
          ...log,
          user_email: log.profiles?.email || 'Unknown',
        }));
        
        setAuditLogs(formattedLogs);

        const uniqueUsers = new Set(logs.map((log: any) => log.user_id));
        const criticalActions = logs.filter((log: any) => 
          ['delete', 'revoke', 'disable'].some(action => log.action.toLowerCase().includes(action))
        );
        const last24h = logs.filter((log: any) => {
          const logDate = new Date(log.created_at);
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          return logDate > yesterday;
        });

        setStats({
          total_events: logs.length,
          unique_users: uniqueUsers.size,
          critical_actions: criticalActions.length,
          last_24h: last24h.length,
        });
      }
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch audit logs',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const filterLogs = () => {
    let filtered = [...auditLogs];

    if (searchQuery) {
      filtered = filtered.filter(log =>
        log.user_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.resource_type.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (actionFilter !== 'all') {
      filtered = filtered.filter(log => log.action.toLowerCase().includes(actionFilter.toLowerCase()));
    }

    setFilteredLogs(filtered);
  };

  const handleExport = () => {
    const csvData = [
      ['Timestamp', 'User', 'Action', 'Resource Type', 'Resource ID', 'IP Address'],
      ...filteredLogs.map(log => [
        format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss'),
        log.user_email,
        log.action,
        log.resource_type,
        log.resource_id,
        log.ip_address || 'N/A',
      ]),
    ];

    const csv = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `core314_audit_trail_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    toast({
      title: '✅ Audit trail exported',
      description: 'Downloaded CSV report',
    });
  };

  const getActionColor = (action: string) => {
    const lowerAction = action.toLowerCase();
    if (lowerAction.includes('delete') || lowerAction.includes('revoke')) {
      return 'bg-red-100 text-red-800 border-red-300';
    }
    if (lowerAction.includes('create') || lowerAction.includes('add')) {
      return 'bg-green-100 text-green-800 border-green-300';
    }
    if (lowerAction.includes('update') || lowerAction.includes('edit')) {
      return 'bg-blue-100 text-blue-800 border-blue-300';
    }
    return 'bg-gray-100 text-gray-800 border-gray-300';
  };

  return (
    <FeatureGuard feature="audit_trails">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <FileCheck className="h-8 w-8" />
              Audit Trails
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Complete activity history and compliance tracking
            </p>
          </div>
          <Button onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Total Events
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.total_events}</div>
              <p className="text-xs text-gray-500 mt-1">In selected period</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                <User className="h-4 w-4" />
                Unique Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.unique_users}</div>
              <p className="text-xs text-gray-500 mt-1">Active users</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                <FileCheck className="h-4 w-4" />
                Critical Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.critical_actions}</div>
              <p className="text-xs text-gray-500 mt-1">Delete/revoke operations</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Last 24 Hours
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.last_24h}</div>
              <p className="text-xs text-gray-500 mt-1">Recent activity</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileCheck className="h-5 w-5" />
                  Activity Log
                </CardTitle>
                <CardDescription>Detailed audit trail of all system activities</CardDescription>
              </div>
              <div className="flex items-center gap-3">
                <Select value={timeRange} onValueChange={setTimeRange}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Time Range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">Last 7 days</SelectItem>
                    <SelectItem value="30">Last 30 days</SelectItem>
                    <SelectItem value="90">Last 90 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by user, action, or resource..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="create">Create</SelectItem>
                  <SelectItem value="update">Update</SelectItem>
                  <SelectItem value="delete">Delete</SelectItem>
                  <SelectItem value="login">Login</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
              </div>
            ) : filteredLogs.length > 0 ? (
              <div className="space-y-2">
                {filteredLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start justify-between p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={getActionColor(log.action)}>
                          {log.action}
                        </Badge>
                        <span className="text-xs text-gray-500">
                          {format(new Date(log.created_at), 'MMM dd, yyyy HH:mm:ss')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        <User className="h-4 w-4 text-gray-400" />
                        <span className="text-sm font-medium">{log.user_email}</span>
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        <span className="font-medium">{log.resource_type}</span>
                        {log.resource_id && (
                          <span className="ml-2 text-xs">
                            ID: <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">
                              {log.resource_id.substring(0, 8)}...
                            </code>
                          </span>
                        )}
                      </div>
                      {log.ip_address && (
                        <div className="text-xs text-gray-500 mt-1">
                          IP: {log.ip_address}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <FileCheck className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 dark:text-gray-400">
                  No audit logs found matching your filters
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </FeatureGuard>
  );
}
