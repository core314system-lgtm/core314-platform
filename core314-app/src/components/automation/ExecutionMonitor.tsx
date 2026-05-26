import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { CheckCircle, XCircle, Clock, AlertCircle, Play, Search, Filter } from 'lucide-react';

interface ExecutionLogEntry {
  id: string;
  action_type: string;
  action_target: string;
  execution_status: string;
  execution_duration_ms: number;
  success: boolean;
  started_at: string;
  completed_at: string;
  execution_error?: string;
  integration_name?: string;
  http_status_code?: number;
}

interface QueueEntry {
  id: string;
  action_type: string;
  action_target: string;
  execution_status: string;
  priority: number;
  urgency: string;
  created_at: string;
  scheduled_for?: string;
  requires_approval: boolean;
  approval_status?: string;
}

export function ExecutionMonitor() {
  const { user } = useAuth();
  const [executionLogs, setExecutionLogs] = useState<ExecutionLogEntry[]>([]);
  const [queueEntries, setQueueEntries] = useState<QueueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'logs' | 'queue'>('logs');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (user) {
      loadData();
      setupRealtimeSubscription();
    }
  }, [user, view]);

  const setupRealtimeSubscription = () => {
    if (!user) return;

    const channel = supabase
      .channel('execution-monitor-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'execution_log',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          if (view === 'logs') loadData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'execution_queue',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          if (view === 'queue') loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const loadData = async () => {
    if (!user) return;

    try {
      if (view === 'logs') {
        const { data, error } = await supabase
          .from('execution_log')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) throw error;
        setExecutionLogs(data || []);
      } else {
        const { data, error } = await supabase
          .from('execution_queue')
          .select('*')
          .eq('user_id', user.id)
          .order('priority', { ascending: true })
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) throw error;
        setQueueEntries(data || []);
      }
    } catch (error) {
      console.error('Failed to load execution data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string, success?: boolean) => {
    if (status === 'completed' && success) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    } else if (status === 'failed' || (status === 'completed' && !success)) {
      return <XCircle className="h-4 w-4 text-red-500" />;
    } else if (status === 'in_progress') {
      return <Play className="h-4 w-4 text-blue-500 animate-pulse" />;
    } else if (status === 'queued' || status === 'scheduled') {
      return <Clock className="h-4 w-4 text-yellow-500" />;
    } else {
      return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string, success?: boolean) => {
    if (status === 'completed' && success) {
      return <Badge variant="default" className="bg-green-500">Completed</Badge>;
    } else if (status === 'failed' || (status === 'completed' && !success)) {
      return <Badge variant="destructive">Failed</Badge>;
    } else if (status === 'in_progress') {
      return <Badge variant="default" className="bg-blue-500">In Progress</Badge>;
    } else if (status === 'queued') {
      return <Badge variant="outline">Queued</Badge>;
    } else if (status === 'scheduled') {
      return <Badge variant="secondary">Scheduled</Badge>;
    } else {
      return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getUrgencyBadge = (urgency: string) => {
    const colors = {
      critical: 'bg-red-500',
      high: 'bg-orange-500',
      medium: 'bg-yellow-500',
      low: 'bg-green-500',
    };
    return (
      <Badge variant="default" className={colors[urgency as keyof typeof colors] || 'bg-gray-500'}>
        {urgency}
      </Badge>
    );
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
    return `${(ms / 60000).toFixed(2)}m`;
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const filteredLogs = executionLogs.filter(log => {
    if (statusFilter !== 'all' && log.execution_status !== statusFilter) return false;
    if (searchQuery && !log.action_type.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !log.action_target.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const filteredQueue = queueEntries.filter(entry => {
    if (statusFilter !== 'all' && entry.execution_status !== statusFilter) return false;
    if (searchQuery && !entry.action_type.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !entry.action_target.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Execution Monitor</CardTitle>
              <CardDescription>
                Real-time log stream with success/failure metrics
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={view === 'logs' ? 'default' : 'outline'}
                onClick={() => setView('logs')}
              >
                Execution Logs
              </Button>
              <Button
                variant={view === 'queue' ? 'default' : 'outline'}
                onClick={() => setView('queue')}
              >
                Execution Queue
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex items-center gap-4 mb-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by action type or target..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="queued">Queued</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Execution Logs View */}
          {view === 'logs' && (
            <div className="space-y-2">
              {filteredLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No execution logs found
                </div>
              ) : (
                filteredLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center gap-4 p-4 border rounded-lg hover:bg-accent transition-colors"
                  >
                    <div className="flex-shrink-0">
                      {getStatusIcon(log.execution_status, log.success)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{log.action_type}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="text-sm text-muted-foreground">{log.action_target}</span>
                        {log.integration_name && (
                          <Badge variant="outline" className="text-xs">
                            {log.integration_name}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{formatTimestamp(log.completed_at)}</span>
                        <span>Duration: {formatDuration(log.execution_duration_ms)}</span>
                        {log.http_status_code && (
                          <span>HTTP {log.http_status_code}</span>
                        )}
                        {log.execution_error && (
                          <span className="text-red-500 truncate max-w-xs">
                            Error: {log.execution_error}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      {getStatusBadge(log.execution_status, log.success)}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Execution Queue View */}
          {view === 'queue' && (
            <div className="space-y-2">
              {filteredQueue.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No queued executions found
                </div>
              ) : (
                filteredQueue.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center gap-4 p-4 border rounded-lg hover:bg-accent transition-colors"
                  >
                    <div className="flex-shrink-0">
                      {getStatusIcon(entry.execution_status)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{entry.action_type}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="text-sm text-muted-foreground">{entry.action_target}</span>
                        <Badge variant="outline" className="text-xs">
                          Priority: {entry.priority}
                        </Badge>
                        {getUrgencyBadge(entry.urgency)}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{formatTimestamp(entry.created_at)}</span>
                        {entry.scheduled_for && (
                          <span>Scheduled: {formatTimestamp(entry.scheduled_for)}</span>
                        )}
                        {entry.requires_approval && (
                          <Badge variant="outline" className="text-xs">
                            Requires Approval: {entry.approval_status || 'pending'}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      {getStatusBadge(entry.execution_status)}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
