import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { FileText, Search, Filter, Download, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface AuditLogEntry {
  id: string;
  user_id: string;
  decision_event_id: string;
  event_type: string;
  event_category: string;
  event_description: string;
  actor_id: string;
  actor_type: string;
  is_override: boolean;
  decision_type: string;
  decision_confidence: number;
  factors_involved: string[];
  override_reason: string;
  execution_duration_ms: number;
  execution_success: boolean;
  compliance_flags: string[];
  security_level: string;
  requires_review: boolean;
  created_at: string;
  tags: string[];
}

export function DecisionAudit() {
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('all');
  const [actorTypeFilter, setActorTypeFilter] = useState<string>('all');
  const [overrideFilter, setOverrideFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('7d');

  useEffect(() => {
    loadAuditLogs();

    const channel = supabase
      .channel('audit-log-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'decision_audit_log',
        },
        () => {
          loadAuditLogs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [dateRange]);

  useEffect(() => {
    applyFilters();
  }, [auditLogs, searchTerm, eventTypeFilter, actorTypeFilter, overrideFilter]);

  async function loadAuditLogs() {
    try {
      const daysAgo = parseInt(dateRange.replace('d', ''));
      const threshold = new Date();
      threshold.setDate(threshold.getDate() - daysAgo);

      const { data, error } = await supabase
        .from('decision_audit_log')
        .select('*')
        .gte('created_at', threshold.toISOString())
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;
      setAuditLogs(data || []);
    } catch (error) {
      console.error('Failed to load audit logs:', error);
    } finally {
      setLoading(false);
    }
  }

  function applyFilters() {
    let filtered = [...auditLogs];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (log) =>
          log.event_description.toLowerCase().includes(term) ||
          log.event_type.toLowerCase().includes(term) ||
          log.tags?.some((tag) => tag.toLowerCase().includes(term))
      );
    }

    if (eventTypeFilter !== 'all') {
      filtered = filtered.filter((log) => log.event_type === eventTypeFilter);
    }

    if (actorTypeFilter !== 'all') {
      filtered = filtered.filter((log) => log.actor_type === actorTypeFilter);
    }

    if (overrideFilter === 'overrides') {
      filtered = filtered.filter((log) => log.is_override);
    } else if (overrideFilter === 'no_overrides') {
      filtered = filtered.filter((log) => !log.is_override);
    }

    setFilteredLogs(filtered);
  }

  function exportToCSV() {
    const headers = [
      'Timestamp',
      'Event Type',
      'Event Category',
      'Description',
      'Actor Type',
      'Is Override',
      'Decision Type',
      'Confidence',
      'Execution Duration (ms)',
      'Success',
    ];

    const rows = filteredLogs.map((log) => [
      new Date(log.created_at).toISOString(),
      log.event_type,
      log.event_category,
      log.event_description,
      log.actor_type,
      log.is_override ? 'Yes' : 'No',
      log.decision_type || '',
      log.decision_confidence?.toFixed(2) || '',
      log.execution_duration_ms || '',
      log.execution_success !== null ? (log.execution_success ? 'Yes' : 'No') : '',
    ]);

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `decision-audit-${new Date().toISOString()}.csv`;
    a.click();
  }

  function getEventCategoryColor(category: string) {
    switch (category) {
      case 'decision': return 'bg-blue-500';
      case 'approval': return 'bg-green-500';
      case 'execution': return 'bg-purple-500';
      case 'override': return 'bg-orange-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FileText className="h-8 w-8 text-blue-500" />
            Decision Audit Log
          </h1>
          <p className="text-muted-foreground mt-1">
            Complete audit trail of all AI decision events and actions
          </p>
        </div>
        <Button onClick={exportToCSV} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{auditLogs.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Overrides</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">
              {auditLogs.filter((log) => log.is_override).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Requires Review</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              {auditLogs.filter((log) => log.requires_review).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Filtered Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredLogs.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>

            <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Event Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Events</SelectItem>
                <SelectItem value="decision_created">Decision Created</SelectItem>
                <SelectItem value="decision_approved">Decision Approved</SelectItem>
                <SelectItem value="decision_rejected">Decision Rejected</SelectItem>
                <SelectItem value="recommendation_executed">Recommendation Executed</SelectItem>
                <SelectItem value="override_applied">Override Applied</SelectItem>
                <SelectItem value="error_occurred">Error Occurred</SelectItem>
              </SelectContent>
            </Select>

            <Select value={actorTypeFilter} onValueChange={setActorTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Actor Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actors</SelectItem>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="system">System</SelectItem>
                <SelectItem value="ai">AI</SelectItem>
                <SelectItem value="automation">Automation</SelectItem>
              </SelectContent>
            </Select>

            <Select value={overrideFilter} onValueChange={setOverrideFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Overrides" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="overrides">Overrides Only</SelectItem>
                <SelectItem value="no_overrides">No Overrides</SelectItem>
              </SelectContent>
            </Select>

            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger>
                <SelectValue placeholder="Date Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1d">Last 24 hours</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Audit Log Entries */}
      <Card>
        <CardHeader>
          <CardTitle>Audit Trail</CardTitle>
          <CardDescription>
            Showing {filteredLogs.length} of {auditLogs.length} events
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredLogs.length > 0 ? (
            <div className="space-y-3">
              {filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={getEventCategoryColor(log.event_category)}>
                          {log.event_category}
                        </Badge>
                        <span className="text-sm font-medium">{log.event_type}</span>
                        <Badge variant="outline" className="capitalize">
                          {log.actor_type}
                        </Badge>
                        {log.is_override && (
                          <Badge variant="outline" className="text-orange-500">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Override
                          </Badge>
                        )}
                        {log.requires_review && (
                          <Badge variant="outline" className="text-red-500">
                            Requires Review
                          </Badge>
                        )}
                      </div>

                      <p className="text-sm text-muted-foreground mb-2">
                        {log.event_description}
                      </p>

                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>
                          {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                        </span>
                        {log.decision_confidence && (
                          <span>Confidence: {(log.decision_confidence * 100).toFixed(0)}%</span>
                        )}
                        {log.execution_duration_ms && (
                          <span>Duration: {log.execution_duration_ms}ms</span>
                        )}
                        {log.execution_success !== null && (
                          <span className={log.execution_success ? 'text-green-500' : 'text-red-500'}>
                            {log.execution_success ? 'Success' : 'Failed'}
                          </span>
                        )}
                      </div>

                      {log.factors_involved && log.factors_involved.length > 0 && (
                        <div className="mt-2 flex items-center gap-1 flex-wrap">
                          <span className="text-xs text-muted-foreground">Factors:</span>
                          {log.factors_involved.slice(0, 3).map((factor, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {factor}
                            </Badge>
                          ))}
                          {log.factors_involved.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{log.factors_involved.length - 3} more
                            </Badge>
                          )}
                        </div>
                      )}

                      {log.override_reason && (
                        <div className="mt-2 text-xs text-orange-600">
                          Override reason: {log.override_reason}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No audit logs found</p>
              <p className="text-sm text-muted-foreground">
                Try adjusting your filters
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
