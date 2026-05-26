import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { RefreshCw, TrendingUp, Target, CheckCircle, Activity } from 'lucide-react';

interface AdaptiveWorkflowMetric {
  id: string;
  workflow_id: string;
  event_type: string;
  trigger_source: string;
  outcome: string;
  confidence_score: number;
  metadata: any;
  created_at: string;
}

interface Stats {
  totalEvents: number;
  avgConfidence: number;
  mostCommonOutcome: { outcome: string; count: number } | null;
  recentActivity: number;
}

export function AdaptiveWorkflows() {
  const [metrics, setMetrics] = useState<AdaptiveWorkflowMetric[]>([]);
  const [filteredMetrics, setFilteredMetrics] = useState<AdaptiveWorkflowMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({
    totalEvents: 0,
    avgConfidence: 0,
    mostCommonOutcome: null,
    recentActivity: 0,
  });

  const [eventTypeFilter, setEventTypeFilter] = useState<string>('all');
  const [triggerSourceFilter, setTriggerSourceFilter] = useState<string>('all');
  const [outcomeFilter, setOutcomeFilter] = useState<string>('all');

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('adaptive_workflow_metrics')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      setMetrics(data || []);
      calculateStats(data || []);
    } catch (error) {
      console.error('Error fetching adaptive workflow metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (data: AdaptiveWorkflowMetric[]) => {
    if (data.length === 0) {
      setStats({
        totalEvents: 0,
        avgConfidence: 0,
        mostCommonOutcome: null,
        recentActivity: 0,
      });
      return;
    }

    const totalEvents = data.length;

    const avgConfidence =
      data.reduce((sum, m) => sum + (m.confidence_score || 0), 0) / totalEvents;

    const outcomeCounts: Record<string, number> = {};
    data.forEach((m) => {
      outcomeCounts[m.outcome] = (outcomeCounts[m.outcome] || 0) + 1;
    });
    const mostCommonOutcome = Object.entries(outcomeCounts).reduce(
      (max, [outcome, count]) =>
        count > (max?.count || 0) ? { outcome, count } : max,
      null as { outcome: string; count: number } | null
    );

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentActivity = data.filter(
      (m) => new Date(m.created_at) > oneDayAgo
    ).length;

    setStats({
      totalEvents,
      avgConfidence,
      mostCommonOutcome,
      recentActivity,
    });
  };

  useEffect(() => {
    let filtered = [...metrics];

    if (eventTypeFilter !== 'all') {
      filtered = filtered.filter((m) => m.event_type === eventTypeFilter);
    }

    if (triggerSourceFilter !== 'all') {
      filtered = filtered.filter((m) => m.trigger_source === triggerSourceFilter);
    }

    if (outcomeFilter !== 'all') {
      filtered = filtered.filter((m) => m.outcome === outcomeFilter);
    }

    setFilteredMetrics(filtered);
  }, [metrics, eventTypeFilter, triggerSourceFilter, outcomeFilter]);

  useEffect(() => {
    fetchMetrics();

    const channel = supabase
      .channel('adaptive-workflow-metrics-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'adaptive_workflow_metrics',
        },
        (payload) => {
          console.log('New adaptive workflow event:', payload.new);
          setMetrics((prev) => [payload.new as AdaptiveWorkflowMetric, ...prev]);
          calculateStats([payload.new as AdaptiveWorkflowMetric, ...metrics]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const formatConfidence = (score: number) => {
    return `${(score * 100).toFixed(1)}%`;
  };

  const formatRelativeTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const getEventTypeBadgeColor = (eventType: string) => {
    switch (eventType) {
      case 'integration_triggered':
        return 'bg-blue-100 text-blue-800';
      case 'recovery_attempted':
        return 'bg-yellow-100 text-yellow-800';
      case 'workflow_completed':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getOutcomeBadgeColor = (outcome: string) => {
    switch (outcome) {
      case 'success':
        return 'bg-green-100 text-green-800';
      case 'failure':
        return 'bg-red-100 text-red-800';
      case 'partial':
        return 'bg-yellow-100 text-yellow-800';
      case 'retry_scheduled':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Adaptive Workflows</h1>
          <p className="text-gray-600 mt-1">
            Monitor AI-driven workflow intelligence and telemetry
          </p>
        </div>
        <Button onClick={fetchMetrics} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
            <Activity className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalEvents}</div>
            <p className="text-xs text-gray-600 mt-1">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Confidence</CardTitle>
            <TrendingUp className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.avgConfidence > 0 ? formatConfidence(stats.avgConfidence) : 'N/A'}
            </div>
            <p className="text-xs text-gray-600 mt-1">Workflow decisions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Most Common</CardTitle>
            <Target className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.mostCommonOutcome?.outcome || 'N/A'}
            </div>
            <p className="text-xs text-gray-600 mt-1">
              {stats.mostCommonOutcome
                ? `${stats.mostCommonOutcome.count} events`
                : 'No data'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
            <CheckCircle className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.recentActivity}</div>
            <p className="text-xs text-gray-600 mt-1">Last 24 hours</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {/* Event Type Filter */}
            <div>
              <label className="text-sm font-medium mb-2 block">Event Type</label>
              <div className="flex gap-2">
                <Button
                  variant={eventTypeFilter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setEventTypeFilter('all')}
                >
                  All
                </Button>
                <Button
                  variant={eventTypeFilter === 'integration_triggered' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setEventTypeFilter('integration_triggered')}
                >
                  Integration
                </Button>
                <Button
                  variant={eventTypeFilter === 'recovery_attempted' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setEventTypeFilter('recovery_attempted')}
                >
                  Recovery
                </Button>
                <Button
                  variant={eventTypeFilter === 'workflow_completed' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setEventTypeFilter('workflow_completed')}
                >
                  Completed
                </Button>
              </div>
            </div>

            {/* Trigger Source Filter */}
            <div>
              <label className="text-sm font-medium mb-2 block">Trigger Source</label>
              <div className="flex gap-2">
                <Button
                  variant={triggerSourceFilter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTriggerSourceFilter('all')}
                >
                  All
                </Button>
                <Button
                  variant={triggerSourceFilter === 'slack' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTriggerSourceFilter('slack')}
                >
                  Slack
                </Button>
                <Button
                  variant={triggerSourceFilter === 'teams' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTriggerSourceFilter('teams')}
                >
                  Teams
                </Button>
                <Button
                  variant={triggerSourceFilter === 'stripe' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTriggerSourceFilter('stripe')}
                >
                  Stripe
                </Button>
                <Button
                  variant={triggerSourceFilter === 'self_healing' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTriggerSourceFilter('self_healing')}
                >
                  Self-Healing
                </Button>
              </div>
            </div>

            {/* Outcome Filter */}
            <div>
              <label className="text-sm font-medium mb-2 block">Outcome</label>
              <div className="flex gap-2">
                <Button
                  variant={outcomeFilter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setOutcomeFilter('all')}
                >
                  All
                </Button>
                <Button
                  variant={outcomeFilter === 'success' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setOutcomeFilter('success')}
                >
                  Success
                </Button>
                <Button
                  variant={outcomeFilter === 'failure' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setOutcomeFilter('failure')}
                >
                  Failure
                </Button>
                <Button
                  variant={outcomeFilter === 'partial' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setOutcomeFilter('partial')}
                >
                  Partial
                </Button>
                <Button
                  variant={outcomeFilter === 'retry_scheduled' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setOutcomeFilter('retry_scheduled')}
                >
                  Retry
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Events Table */}
      <Card>
        <CardHeader>
          <CardTitle>Workflow Events ({filteredMetrics.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-gray-600">Loading metrics...</div>
          ) : filteredMetrics.length === 0 ? (
            <div className="text-center py-8 text-gray-600">
              No adaptive workflow events found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Workflow ID</TableHead>
                  <TableHead>Event Type</TableHead>
                  <TableHead>Trigger Source</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMetrics.map((metric) => (
                  <TableRow key={metric.id}>
                    <TableCell className="font-mono text-xs">
                      {metric.workflow_id.substring(0, 8)}...
                    </TableCell>
                    <TableCell>
                      <Badge className={getEventTypeBadgeColor(metric.event_type)}>
                        {metric.event_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="capitalize">{metric.trigger_source}</span>
                    </TableCell>
                    <TableCell>
                      <Badge className={getOutcomeBadgeColor(metric.outcome)}>
                        {metric.outcome}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatConfidence(metric.confidence_score)}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm">
                          {formatRelativeTime(metric.created_at)}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(metric.created_at).toLocaleString()}
                        </span>
                      </div>
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
