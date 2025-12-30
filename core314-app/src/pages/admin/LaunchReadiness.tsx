import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Progress } from '../../components/ui/progress';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { 
  Rocket, 
  CreditCard, 
  Brain, 
  Shield, 
  Activity,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Clock,
  Users,
  Zap,
  TrendingUp
} from 'lucide-react';

/**
 * ============================================================================
 * PHASE 15.5: ADMIN LAUNCH READINESS DASHBOARD
 * ============================================================================
 * 
 * Comprehensive system health dashboard showing:
 * - Stripe connection status
 * - Intelligence scheduler status
 * - Healthy vs failed integrations count
 * - Entitlement enforcement active
 * - Kill switch states
 * - Timestamp of last successful aggregator run
 * - Conversion funnel metrics
 * 
 * NON-NEGOTIABLE RULES:
 * 1. Real-time status updates
 * 2. Health indicators (green/yellow/red)
 * 3. Admin-only access
 * ============================================================================
 */

interface LaunchReadinessStatus {
  timestamp: string;
  kill_switches: Record<string, { enabled: boolean; updated_at: string }>;
  integration_health: {
    total_integrations: number;
    healthy_integrations: number;
    failed_integrations: number;
    pending_integrations: number;
  };
  last_aggregator_run: string | null;
  conversion_metrics_30d: {
    trials_started: number;
    first_integrations: number;
    first_intelligence: number;
    fusion_nonzero: number;
    upgrades_completed: number;
    cancellations: number;
  };
  entitlement_enforcement_active: boolean;
  stripe_billing_active: boolean;
}

type HealthStatus = 'healthy' | 'warning' | 'critical' | 'unknown';

export default function AdminLaunchReadiness() {
  useAuth();
  const [status, setStatus] = useState<LaunchReadinessStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  useEffect(() => {
    fetchStatus();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      setError(null);

      // Try to call the RPC function first
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('get_launch_readiness_status');

      if (!rpcError && rpcData) {
        setStatus(rpcData as LaunchReadinessStatus);
        setLastRefresh(new Date());
        return;
      }

      // Fallback: fetch data manually if RPC doesn't exist yet
      const [killSwitchesRes, integrationsRes, healthEventsRes, launchEventsRes] = await Promise.all([
        supabase.from('system_control_flags').select('*'),
        supabase.from('user_integrations').select('id, status'),
        supabase.from('system_health_events')
          .select('created_at')
          .or('component_name.ilike.%intelligence%,component_name.ilike.%aggregator%')
          .order('created_at', { ascending: false })
          .limit(1),
        supabase.from('launch_events')
          .select('event_type')
          .gte('occurred_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      ]);

      // Build kill switches object
      const killSwitches: Record<string, { enabled: boolean; updated_at: string }> = {};
      (killSwitchesRes.data || []).forEach((flag: { key: string; enabled: boolean; updated_at: string }) => {
        killSwitches[flag.key] = { enabled: flag.enabled, updated_at: flag.updated_at };
      });

      // Calculate integration health
      const integrations = integrationsRes.data || [];
      const integrationHealth = {
        total_integrations: integrations.length,
        healthy_integrations: integrations.filter((i: { status: string }) => i.status === 'active' || i.status === 'connected').length,
        failed_integrations: integrations.filter((i: { status: string }) => i.status === 'failed' || i.status === 'error').length,
        pending_integrations: integrations.filter((i: { status: string }) => i.status === 'pending').length,
      };

      // Get last aggregator run
      const lastAggregatorRun = healthEventsRes.data?.[0]?.created_at || null;

      // Calculate conversion metrics
      const events = launchEventsRes.data || [];
      const conversionMetrics = {
        trials_started: events.filter((e: { event_type: string }) => e.event_type === 'trial_started').length,
        first_integrations: events.filter((e: { event_type: string }) => e.event_type === 'first_integration_connected').length,
        first_intelligence: events.filter((e: { event_type: string }) => e.event_type === 'first_intelligence_generated').length,
        fusion_nonzero: events.filter((e: { event_type: string }) => e.event_type === 'fusion_score_nonzero').length,
        upgrades_completed: events.filter((e: { event_type: string }) => e.event_type === 'upgrade_completed').length,
        cancellations: events.filter((e: { event_type: string }) => e.event_type === 'cancellation').length,
      };

      setStatus({
        timestamp: new Date().toISOString(),
        kill_switches: killSwitches,
        integration_health: integrationHealth,
        last_aggregator_run: lastAggregatorRun,
        conversion_metrics_30d: conversionMetrics,
        entitlement_enforcement_active: killSwitches['entitlement_mutations_enabled']?.enabled ?? true,
        stripe_billing_active: killSwitches['stripe_billing_enabled']?.enabled ?? true,
      });
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Error fetching launch readiness status:', err);
      setError('Failed to load launch readiness status. Some tables may not exist yet.');
    } finally {
      setLoading(false);
    }
  };

  const getOverallHealth = (): HealthStatus => {
    if (!status) return 'unknown';
    
    // Critical if any kill switch is disabled
    const disabledSwitches = Object.values(status.kill_switches).filter(s => !s.enabled).length;
    if (disabledSwitches > 0) return 'critical';
    
    // Warning if high failure rate
    const failureRate = status.integration_health.total_integrations > 0
      ? status.integration_health.failed_integrations / status.integration_health.total_integrations
      : 0;
    if (failureRate > 0.1) return 'warning';
    
    // Warning if aggregator hasn't run recently (24 hours)
    if (status.last_aggregator_run) {
      const lastRun = new Date(status.last_aggregator_run);
      const hoursSinceRun = (Date.now() - lastRun.getTime()) / (1000 * 60 * 60);
      if (hoursSinceRun > 24) return 'warning';
    }
    
    return 'healthy';
  };

  const getHealthColor = (health: HealthStatus) => {
    switch (health) {
      case 'healthy': return 'text-green-600 dark:text-green-400';
      case 'warning': return 'text-amber-600 dark:text-amber-400';
      case 'critical': return 'text-red-600 dark:text-red-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getHealthBadge = (health: HealthStatus) => {
    switch (health) {
      case 'healthy': return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Healthy</Badge>;
      case 'warning': return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">Warning</Badge>;
      case 'critical': return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Critical</Badge>;
      default: return <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200">Unknown</Badge>;
    }
  };

  const getHealthIcon = (health: HealthStatus) => {
    switch (health) {
      case 'healthy': return <CheckCircle className={`h-6 w-6 ${getHealthColor(health)}`} />;
      case 'warning': return <AlertTriangle className={`h-6 w-6 ${getHealthColor(health)}`} />;
      case 'critical': return <XCircle className={`h-6 w-6 ${getHealthColor(health)}`} />;
      default: return <Activity className={`h-6 w-6 ${getHealthColor(health)}`} />;
    }
  };

  const formatTimestamp = (ts: string | null) => {
    if (!ts) return 'Never';
    return new Date(ts).toLocaleString();
  };

  const overallHealth = getOverallHealth();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Rocket className="h-6 w-6" />
            Launch Readiness
          </h1>
          <p className="text-muted-foreground">
            System health and operational status dashboard
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground">
            Last refresh: {lastRefresh.toLocaleTimeString()}
          </div>
          <Button onClick={fetchStatus} variant="outline" size="sm" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overall Health Status */}
      <Card className={overallHealth === 'critical' ? 'border-red-500' : overallHealth === 'warning' ? 'border-amber-500' : 'border-green-500'}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {getHealthIcon(overallHealth)}
              <div>
                <h2 className="text-xl font-semibold">Overall System Health</h2>
                <p className="text-muted-foreground">
                  {overallHealth === 'healthy' && 'All systems operational'}
                  {overallHealth === 'warning' && 'Some systems require attention'}
                  {overallHealth === 'critical' && 'Critical issues detected - action required'}
                  {overallHealth === 'unknown' && 'Unable to determine system status'}
                </p>
              </div>
            </div>
            {getHealthBadge(overallHealth)}
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-amber-500 bg-amber-50 dark:bg-amber-950">
          <CardContent className="pt-6">
            <p className="text-amber-800 dark:text-amber-200">{error}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Stripe Billing Status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Stripe Billing
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">
                {status?.stripe_billing_active ? 'Active' : 'Disabled'}
              </span>
              {status?.stripe_billing_active ? (
                <CheckCircle className="h-6 w-6 text-green-600" />
              ) : (
                <XCircle className="h-6 w-6 text-red-600" />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Intelligence Aggregator Status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Brain className="h-4 w-4" />
              Intelligence Aggregator
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">
                {status?.kill_switches?.['intelligence_aggregator_enabled']?.enabled !== false ? 'Active' : 'Paused'}
              </span>
              {status?.kill_switches?.['intelligence_aggregator_enabled']?.enabled !== false ? (
                <CheckCircle className="h-6 w-6 text-green-600" />
              ) : (
                <AlertTriangle className="h-6 w-6 text-amber-600" />
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Last run: {formatTimestamp(status?.last_aggregator_run || null)}
            </p>
          </CardContent>
        </Card>

        {/* Entitlement Enforcement */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Entitlement Enforcement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">
                {status?.entitlement_enforcement_active ? 'Active' : 'Frozen'}
              </span>
              {status?.entitlement_enforcement_active ? (
                <CheckCircle className="h-6 w-6 text-green-600" />
              ) : (
                <AlertTriangle className="h-6 w-6 text-amber-600" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Integration Health */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Integration Health
          </CardTitle>
          <CardDescription>
            Status of all user integrations across the platform
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <div className="text-3xl font-bold">{status?.integration_health?.total_integrations || 0}</div>
              <div className="text-sm text-muted-foreground">Total</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-green-50 dark:bg-green-950">
              <div className="text-3xl font-bold text-green-600">{status?.integration_health?.healthy_integrations || 0}</div>
              <div className="text-sm text-green-700 dark:text-green-300">Healthy</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-red-50 dark:bg-red-950">
              <div className="text-3xl font-bold text-red-600">{status?.integration_health?.failed_integrations || 0}</div>
              <div className="text-sm text-red-700 dark:text-red-300">Failed</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-amber-50 dark:bg-amber-950">
              <div className="text-3xl font-bold text-amber-600">{status?.integration_health?.pending_integrations || 0}</div>
              <div className="text-sm text-amber-700 dark:text-amber-300">Pending</div>
            </div>
          </div>
          {status?.integration_health?.total_integrations ? (
            <div className="mt-4">
              <div className="flex justify-between text-sm mb-1">
                <span>Health Rate</span>
                <span>{Math.round((status.integration_health.healthy_integrations / status.integration_health.total_integrations) * 100)}%</span>
              </div>
              <Progress 
                value={(status.integration_health.healthy_integrations / status.integration_health.total_integrations) * 100} 
                className="h-2"
              />
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Kill Switch Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Kill Switch Status
          </CardTitle>
          <CardDescription>
            Current state of all system kill switches
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {status?.kill_switches && Object.entries(status.kill_switches).map(([key, value]) => (
              <div 
                key={key} 
                className={`p-3 rounded-lg border ${value.enabled ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {value.enabled ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                  <span className={`text-sm font-medium ${value.enabled ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}`}>
                    {value.enabled ? 'ON' : 'OFF'}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {key.replace(/_/g, ' ')}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Conversion Funnel Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Conversion Funnel (Last 30 Days)
          </CardTitle>
          <CardDescription>
            User journey metrics from trial to conversion
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold">{status?.conversion_metrics_30d?.trials_started || 0}</div>
              <div className="text-xs text-muted-foreground">Trials Started</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold">{status?.conversion_metrics_30d?.first_integrations || 0}</div>
              <div className="text-xs text-muted-foreground">First Integration</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold">{status?.conversion_metrics_30d?.first_intelligence || 0}</div>
              <div className="text-xs text-muted-foreground">First Intelligence</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold">{status?.conversion_metrics_30d?.fusion_nonzero || 0}</div>
              <div className="text-xs text-muted-foreground">Fusion Score</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-green-50 dark:bg-green-950">
              <div className="text-2xl font-bold text-green-600">{status?.conversion_metrics_30d?.upgrades_completed || 0}</div>
              <div className="text-xs text-green-700 dark:text-green-300">Upgrades</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-red-50 dark:bg-red-950">
              <div className="text-2xl font-bold text-red-600">{status?.conversion_metrics_30d?.cancellations || 0}</div>
              <div className="text-xs text-red-700 dark:text-red-300">Cancellations</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* System Timestamp */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Status as of: {formatTimestamp(status?.timestamp || null)}
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Auto-refresh: Every 30 seconds
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
