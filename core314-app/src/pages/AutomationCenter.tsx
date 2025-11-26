import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Play, Pause, AlertTriangle, CheckCircle, Clock, Zap } from 'lucide-react';
import { ExecutionMonitor } from '../components/automation/ExecutionMonitor';
import { OrchestrationBuilder } from '../components/automation/OrchestrationBuilder';
import { EscalationConsole } from '../components/automation/EscalationConsole';

interface FlowStats {
  total_flows: number;
  active_flows: number;
  total_executions: number;
  successful_executions: number;
  failed_executions: number;
  avg_execution_time_ms: number;
  success_rate: number;
}

interface QueueStats {
  queued: number;
  in_progress: number;
  completed: number;
  failed: number;
  pending_approval: number;
}

export function AutomationCenter() {
  const { user } = useAuth();
  const [flowStats, setFlowStats] = useState<FlowStats | null>(null);
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (user) {
      loadStats();
      setupRealtimeSubscription();
    }
  }, [user, refreshKey]);

  const setupRealtimeSubscription = () => {
    if (!user) return;

    const channel = supabase
      .channel('automation-center-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'execution_queue',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          loadStats();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orchestration_flows',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          loadStats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const loadStats = async () => {
    if (!user) return;

    try {
      const { data: flows, error: flowsError } = await supabase
        .from('orchestration_flows')
        .select('*')
        .eq('user_id', user.id);

      if (flowsError) throw flowsError;

      const activeFlows = flows?.filter(f => f.is_active) || [];
      const totalExecutions = flows?.reduce((sum, f) => sum + (f.total_executions || 0), 0) || 0;
      const successfulExecutions = flows?.reduce((sum, f) => sum + (f.successful_executions || 0), 0) || 0;
      const failedExecutions = flows?.reduce((sum, f) => sum + (f.failed_executions || 0), 0) || 0;
      const avgExecutionTime = flows?.reduce((sum, f) => sum + (f.avg_execution_time_ms || 0), 0) / (flows?.length || 1);
      const successRate = totalExecutions > 0 ? (successfulExecutions / totalExecutions) * 100 : 0;

      setFlowStats({
        total_flows: flows?.length || 0,
        active_flows: activeFlows.length,
        total_executions: totalExecutions,
        successful_executions: successfulExecutions,
        failed_executions: failedExecutions,
        avg_execution_time_ms: avgExecutionTime,
        success_rate: successRate,
      });

      const { data: queueItems, error: queueError } = await supabase
        .from('execution_queue')
        .select('execution_status')
        .eq('user_id', user.id);

      if (queueError) throw queueError;

      const queuedCount = queueItems?.filter(q => q.execution_status === 'queued').length || 0;
      const inProgressCount = queueItems?.filter(q => q.execution_status === 'in_progress').length || 0;
      const completedCount = queueItems?.filter(q => q.execution_status === 'completed').length || 0;
      const failedCount = queueItems?.filter(q => q.execution_status === 'failed').length || 0;

      const { data: pendingApprovals, error: approvalsError } = await supabase
        .from('execution_queue')
        .select('id')
        .eq('user_id', user.id)
        .eq('requires_approval', true)
        .eq('approval_status', 'pending');

      if (approvalsError) throw approvalsError;

      setQueueStats({
        queued: queuedCount,
        in_progress: inProgressCount,
        completed: completedCount,
        failed: failedCount,
        pending_approval: pendingApprovals?.length || 0,
      });
    } catch (error) {
      console.error('Failed to load automation stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Automation Center</h1>
          <p className="text-muted-foreground">
            Orchestrate and monitor autonomous execution across your integrations
          </p>
        </div>
        <Button onClick={() => setRefreshKey(prev => prev + 1)}>
          <Zap className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Flows</CardTitle>
            <Play className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{flowStats?.active_flows || 0}</div>
            <p className="text-xs text-muted-foreground">
              {flowStats?.total_flows || 0} total flows
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Execution Queue</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{queueStats?.queued || 0}</div>
            <p className="text-xs text-muted-foreground">
              {queueStats?.in_progress || 0} in progress
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {flowStats?.success_rate ? flowStats.success_rate.toFixed(1) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              {flowStats?.successful_executions || 0} / {flowStats?.total_executions || 0} successful
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{queueStats?.pending_approval || 0}</div>
            <p className="text-xs text-muted-foreground">
              {queueStats?.failed || 0} failed executions
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Performance Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Metrics</CardTitle>
          <CardDescription>
            Real-time execution performance and system health
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Avg Execution Time</span>
                <Badge variant="outline">
                  {flowStats?.avg_execution_time_ms ? `${flowStats.avg_execution_time_ms.toFixed(0)}ms` : 'N/A'}
                </Badge>
              </div>
              <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                <div
                  className="bg-primary h-full transition-all"
                  style={{
                    width: `${Math.min((flowStats?.avg_execution_time_ms || 0) / 2000 * 100, 100)}%`,
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">Target: &lt;2000ms</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Success Rate</span>
                <Badge variant={flowStats && flowStats.success_rate >= 98 ? 'default' : 'destructive'}>
                  {flowStats?.success_rate ? `${flowStats.success_rate.toFixed(1)}%` : 'N/A'}
                </Badge>
              </div>
              <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                <div
                  className="bg-green-500 h-full transition-all"
                  style={{
                    width: `${flowStats?.success_rate || 0}%`,
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">Target: ≥98%</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Total Executions</span>
                <Badge variant="outline">{flowStats?.total_executions || 0}</Badge>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-green-600">
                  ✓ {flowStats?.successful_executions || 0}
                </span>
                <span className="text-red-600">
                  ✗ {flowStats?.failed_executions || 0}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {queueStats?.pending_approval || 0} pending approval
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs defaultValue="monitor" className="space-y-4">
        <TabsList>
          <TabsTrigger value="monitor">Execution Monitor</TabsTrigger>
          <TabsTrigger value="builder">Flow Builder</TabsTrigger>
          <TabsTrigger value="escalations">Escalations</TabsTrigger>
        </TabsList>

        <TabsContent value="monitor" className="space-y-4">
          <ExecutionMonitor />
        </TabsContent>

        <TabsContent value="builder" className="space-y-4">
          <OrchestrationBuilder />
        </TabsContent>

        <TabsContent value="escalations" className="space-y-4">
          <EscalationConsole />
        </TabsContent>
      </Tabs>
    </div>
  );
}
