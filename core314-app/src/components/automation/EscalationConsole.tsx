import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { AlertTriangle, CheckCircle, Clock, XCircle, Search, Filter, Bell } from 'lucide-react';

interface EscalationEvent {
  id: string;
  escalation_rule_id: string;
  escalation_level: number;
  escalation_reason: string;
  status: string;
  triggered_at: string;
  acknowledged_at?: string;
  resolved_at?: string;
  actions_performed?: string[];
  notifications_sent?: string[];
  sla_response_breached: boolean;
  sla_resolution_breached: boolean;
  resolution_duration_minutes?: number;
}

interface EscalationRule {
  id: string;
  rule_name: string;
  rule_description: string;
  rule_category: string;
  is_active: boolean;
  priority: number;
  total_escalations: number;
  successful_resolutions: number;
  failed_resolutions: number;
  avg_resolution_time_minutes?: number;
}

export function EscalationConsole() {
  const { user } = useAuth();
  const [escalationEvents, setEscalationEvents] = useState<EscalationEvent[]>([]);
  const [escalationRules, setEscalationRules] = useState<EscalationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'events' | 'rules'>('events');
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
      .channel('escalation-console-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'escalation_events',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          if (view === 'events') loadData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'escalation_rules',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          if (view === 'rules') loadData();
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
      if (view === 'events') {
        const { data, error } = await supabase
          .from('escalation_events')
          .select('*')
          .eq('user_id', user.id)
          .order('triggered_at', { ascending: false })
          .limit(50);

        if (error) throw error;
        setEscalationEvents(data || []);
      } else {
        const { data, error } = await supabase
          .from('escalation_rules')
          .select('*')
          .eq('user_id', user.id)
          .order('priority', { ascending: true });

        if (error) throw error;
        setEscalationRules(data || []);
      }
    } catch (error) {
      console.error('Failed to load escalation data:', error);
    } finally {
      setLoading(false);
    }
  };

  const acknowledgeEscalation = async (eventId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('escalation_events')
        .update({
          status: 'acknowledged',
          acknowledged_by: user.id,
          acknowledged_at: new Date().toISOString(),
        })
        .eq('id', eventId);

      if (error) throw error;

      setEscalationEvents(
        escalationEvents.map((e) =>
          e.id === eventId
            ? { ...e, status: 'acknowledged', acknowledged_at: new Date().toISOString() }
            : e
        )
      );
    } catch (error) {
      console.error('Failed to acknowledge escalation:', error);
    }
  };

  const resolveEscalation = async (eventId: string) => {
    if (!user) return;

    try {
      const event = escalationEvents.find((e) => e.id === eventId);
      if (!event) return;

      const triggeredAt = new Date(event.triggered_at);
      const resolvedAt = new Date();
      const durationMinutes = Math.floor((resolvedAt.getTime() - triggeredAt.getTime()) / 60000);

      const { error } = await supabase
        .from('escalation_events')
        .update({
          status: 'resolved',
          resolved_by: user.id,
          resolved_at: resolvedAt.toISOString(),
          resolution_duration_minutes: durationMinutes,
        })
        .eq('id', eventId);

      if (error) throw error;

      setEscalationEvents(
        escalationEvents.map((e) =>
          e.id === eventId
            ? {
                ...e,
                status: 'resolved',
                resolved_at: resolvedAt.toISOString(),
                resolution_duration_minutes: durationMinutes,
              }
            : e
        )
      );
    } catch (error) {
      console.error('Failed to resolve escalation:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'triggered':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'acknowledged':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'resolved':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Bell className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'triggered':
        return <Badge variant="destructive">Triggered</Badge>;
      case 'acknowledged':
        return <Badge variant="default" className="bg-yellow-500">Acknowledged</Badge>;
      case 'resolved':
        return <Badge variant="default" className="bg-green-500">Resolved</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getLevelBadge = (level: number) => {
    const colors = {
      1: 'bg-yellow-500',
      2: 'bg-orange-500',
      3: 'bg-red-500',
    };
    return (
      <Badge variant="default" className={colors[level as keyof typeof colors] || 'bg-gray-500'}>
        Level {level}
      </Badge>
    );
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

  const filteredEvents = escalationEvents.filter((event) => {
    if (statusFilter !== 'all' && event.status !== statusFilter) return false;
    if (
      searchQuery &&
      !event.escalation_reason.toLowerCase().includes(searchQuery.toLowerCase())
    )
      return false;
    return true;
  });

  const filteredRules = escalationRules.filter((rule) => {
    if (searchQuery && !rule.rule_name.toLowerCase().includes(searchQuery.toLowerCase()))
      return false;
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
              <CardTitle>Escalation Console</CardTitle>
              <CardDescription>
                Monitor and manage triggered escalation events
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={view === 'events' ? 'default' : 'outline'}
                onClick={() => setView('events')}
              >
                Escalation Events
              </Button>
              <Button
                variant={view === 'rules' ? 'default' : 'outline'}
                onClick={() => setView('rules')}
              >
                Escalation Rules
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
                  placeholder={
                    view === 'events'
                      ? 'Search by escalation reason...'
                      : 'Search by rule name...'
                  }
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            {view === 'events' && (
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="triggered">Triggered</SelectItem>
                  <SelectItem value="acknowledged">Acknowledged</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Escalation Events View */}
          {view === 'events' && (
            <div className="space-y-2">
              {filteredEvents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No escalation events found
                </div>
              ) : (
                filteredEvents.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center gap-4 p-4 border rounded-lg hover:bg-accent transition-colors"
                  >
                    <div className="flex-shrink-0">{getStatusIcon(event.status)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{event.escalation_reason}</span>
                        {getLevelBadge(event.escalation_level)}
                        {event.sla_response_breached && (
                          <Badge variant="destructive" className="text-xs">
                            SLA Response Breached
                          </Badge>
                        )}
                        {event.sla_resolution_breached && (
                          <Badge variant="destructive" className="text-xs">
                            SLA Resolution Breached
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{formatTimestamp(event.triggered_at)}</span>
                        {event.actions_performed && event.actions_performed.length > 0 && (
                          <span>Actions: {event.actions_performed.join(', ')}</span>
                        )}
                        {event.notifications_sent && event.notifications_sent.length > 0 && (
                          <span>Notified: {event.notifications_sent.join(', ')}</span>
                        )}
                        {event.resolution_duration_minutes && (
                          <span>Resolved in {event.resolution_duration_minutes}m</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(event.status)}
                      {event.status === 'triggered' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => acknowledgeEscalation(event.id)}
                        >
                          Acknowledge
                        </Button>
                      )}
                      {event.status === 'acknowledged' && (
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => resolveEscalation(event.id)}
                        >
                          Resolve
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Escalation Rules View */}
          {view === 'rules' && (
            <div className="space-y-4">
              {filteredRules.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No escalation rules found
                </div>
              ) : (
                filteredRules.map((rule) => (
                  <Card key={rule.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <CardTitle className="text-lg">{rule.rule_name}</CardTitle>
                            {rule.is_active ? (
                              <Badge variant="default" className="bg-green-500">
                                Active
                              </Badge>
                            ) : (
                              <Badge variant="outline">Inactive</Badge>
                            )}
                            <Badge variant="outline">{rule.rule_category}</Badge>
                            <Badge variant="outline">Priority: {rule.priority}</Badge>
                          </div>
                          <CardDescription>
                            {rule.rule_description || 'No description'}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Total Escalations:</span>
                          <p className="font-medium">{rule.total_escalations || 0}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Successful:</span>
                          <p className="font-medium text-green-600">
                            {rule.successful_resolutions || 0}
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Failed:</span>
                          <p className="font-medium text-red-600">
                            {rule.failed_resolutions || 0}
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Avg Resolution:</span>
                          <p className="font-medium">
                            {rule.avg_resolution_time_minutes
                              ? `${rule.avg_resolution_time_minutes.toFixed(0)}m`
                              : 'N/A'}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
