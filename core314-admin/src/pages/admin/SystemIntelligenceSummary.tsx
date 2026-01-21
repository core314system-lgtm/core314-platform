import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { SystemHealth as SystemHealthType } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { 
  Activity, 
  CheckCircle2, 
  AlertCircle, 
  XCircle,
  Cpu,
  TrendingUp,
  TrendingDown,
  Minus,
  Signal,
  Shield,
  Building2,
  Eye,
  Zap,
  Brain
} from 'lucide-react';

/**
 * System Intelligence Summary Panel
 * 
 * This panel surfaces EXISTING operational intelligence from the Core314 platform.
 * It does NOT create new systems, logic, or data - it only wires existing data sources.
 * 
 * Data Sources:
 * - system_health table: Platform-level service health (already used by SystemHealth.tsx)
 * - trust_graph_dashboard view: Organization data with trust metrics (already used by TrustGraph.tsx)
 * - system_health_events table: Org-scoped health events (has organization_id column)
 * 
 * Required Fields:
 * 1. System Status: Derived from system_health table (platform) or system_health_events (org)
 * 2. Execution Mode: Not available at platform or org level (user-scoped only)
 * 3. Fusion Health: Not available at platform or org level (user-scoped only)
 * 4. Trend: Insufficient historical data (no platform/org-level trend exists)
 * 5. Primary Signals: From system_health (platform) or system_health_events (org)
 * 6. Confidence Level: Derived from data availability
 * 
 * Organization Selector:
 * - Lists organizations from trust_graph_dashboard (same pattern as TrustGraph.tsx)
 * - Default: "Platform Overview" shows platform-level intelligence
 * - Selecting an org switches to org-scoped view using system_health_events
 */

type PlatformStatus = 'Healthy' | 'Degraded' | 'Down';
type TrendDirection = 'Improving' | 'Stable' | 'Declining' | 'Insufficient historical data';
type ConfidenceLevel = 'Low' | 'Medium' | 'High' | 'Confidence pending sufficient data';

// Execution Readiness types (read-only visibility)
type ExecutionPresence = 'observed' | 'not_observed' | 'indeterminate';
type FusionPresence = 'present' | 'not_present' | 'indeterminate';
type OrgIntelligenceMaturity = 'Observing' | 'Partially Active' | 'Active' | 'Indeterminate';

interface ExecutionReadinessData {
  executionPresence: ExecutionPresence;
  fusionPresence: FusionPresence;
  maturity: OrgIntelligenceMaturity;
  userCountWithExecution: number;
  userCountWithFusion: number;
  totalUsersInOrg: number;
  dataSourceError: string | null;
}

interface PrimarySignal {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
}

interface Organization {
  id: string;
  name: string;
}

interface SystemHealthEvent {
  id: string;
  organization_id: string | null;
  component_type: string;
  component_name: string;
  status: string;
  created_at: string;
}

interface TrustGraphRecord {
  organization_id: string | null;
  organization_name: string | null;
}

export function SystemIntelligenceSummary() {
  const [services, setServices] = useState<SystemHealthType[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('platform');
  const [orgHealthEvents, setOrgHealthEvents] = useState<SystemHealthEvent[]>([]);
  const [executionReadiness, setExecutionReadiness] = useState<ExecutionReadinessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedOrgId !== 'platform') {
      fetchOrgHealthEvents(selectedOrgId);
      fetchExecutionReadiness(selectedOrgId);
    } else {
      setExecutionReadiness(null);
    }
  }, [selectedOrgId]);

  const fetchData = async () => {
    try {
      // Fetch platform-level system health
      const { data: healthData, error: healthError } = await supabase
        .from('system_health')
        .select('*')
        .order('last_check_at', { ascending: false });

      if (healthError) throw healthError;
      setServices(healthData || []);

      // Fetch organizations from trust_graph_dashboard (same pattern as TrustGraph.tsx)
      // This ensures we only show orgs that have intelligence data available
      const { data: trustData, error: trustError } = await supabase
        .from('trust_graph_dashboard')
        .select('organization_id, organization_name');

      if (!trustError && trustData) {
        // Extract unique organizations (same pattern as TrustGraph.tsx)
        const uniqueOrgs = new Map<string, string>();
        (trustData as TrustGraphRecord[]).forEach(record => {
          if (record.organization_id && record.organization_name) {
            uniqueOrgs.set(record.organization_id, record.organization_name);
          }
        });
        
        const orgList: Organization[] = Array.from(uniqueOrgs.entries()).map(([id, name]) => ({
          id,
          name,
        }));
        setOrganizations(orgList);
      }

      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrgHealthEvents = async (orgId: string) => {
    try {
      // Fetch system_health_events for the selected organization
      // This table has organization_id column and admin RLS policy
      const { data, error } = await supabase
        .from('system_health_events')
        .select('id, organization_id, component_type, component_name, status, created_at')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching org health events:', error);
        setOrgHealthEvents([]);
      } else {
        setOrgHealthEvents(data || []);
      }
    } catch (error) {
      console.error('Error fetching org health events:', error);
      setOrgHealthEvents([]);
    }
  };

  /**
   * Fetch Execution Readiness Data (Read-Only)
   * 
   * This function queries EXISTING user-level data to derive org-level presence indicators.
   * It does NOT create new aggregation logic - it simply checks for existence of data.
   * 
   * Data Sources:
   * - profiles table: To get users in the organization (has organization_id)
   * - fusion_metrics table: To check for fusion intelligence presence (has user_id)
   * 
   * Derivation Rules:
   * - Execution Presence: "observed" if ANY user in org has recent fusion_metrics (within 14 days)
   * - Fusion Presence: "present" if ANY user in org has fusion_metrics records
   * - Maturity: Derived from execution + fusion presence
   *   - "Observing": No execution AND no fusion
   *   - "Partially Active": Has fusion but no execution, OR has execution but no fusion
   *   - "Active": Has both execution AND fusion
   * 
   * Honest Attribution:
   * - If query fails, display "indeterminate"
   * - If no data found, display "not observed" / "not present"
   * - Never imply AI is active unless data proves it
   */
  const fetchExecutionReadiness = async (orgId: string) => {
    try {
      // Step 1: Get all users in this organization
      const { data: orgUsers, error: usersError } = await supabase
        .from('profiles')
        .select('id')
        .eq('organization_id', orgId);

      if (usersError) {
        console.error('Error fetching org users:', usersError);
        setExecutionReadiness({
          executionPresence: 'indeterminate',
          fusionPresence: 'indeterminate',
          maturity: 'Indeterminate',
          userCountWithExecution: 0,
          userCountWithFusion: 0,
          totalUsersInOrg: 0,
          dataSourceError: `Failed to query profiles: ${usersError.message}`,
        });
        return;
      }

      const userIds = (orgUsers || []).map(u => u.id);
      const totalUsersInOrg = userIds.length;

      if (userIds.length === 0) {
        // No users in org - cannot determine presence
        setExecutionReadiness({
          executionPresence: 'not_observed',
          fusionPresence: 'not_present',
          maturity: 'Observing',
          userCountWithExecution: 0,
          userCountWithFusion: 0,
          totalUsersInOrg: 0,
          dataSourceError: null,
        });
        return;
      }

      // Step 2: Check for fusion_metrics presence for any user in org
      // This determines Fusion Intelligence Presence
      const { data: fusionMetrics, error: metricsError } = await supabase
        .from('fusion_metrics')
        .select('user_id, synced_at')
        .in('user_id', userIds);

      if (metricsError) {
        console.error('Error fetching fusion metrics:', metricsError);
        setExecutionReadiness({
          executionPresence: 'indeterminate',
          fusionPresence: 'indeterminate',
          maturity: 'Indeterminate',
          userCountWithExecution: 0,
          userCountWithFusion: 0,
          totalUsersInOrg,
          dataSourceError: `Failed to query fusion_metrics: ${metricsError.message}`,
        });
        return;
      }

      // Determine Fusion Presence: ANY user has fusion_metrics records
      const usersWithFusion = new Set((fusionMetrics || []).map(m => m.user_id));
      const hasFusionPresence = usersWithFusion.size > 0;

      // Determine Execution Presence: ANY user has RECENT fusion_metrics (within 14 days)
      // This matches the system-integrations.ts logic for score_origin derivation
      const ACTIVE_THRESHOLD_DAYS = 14;
      const now = new Date();
      const usersWithRecentMetrics = new Set<string>();
      
      (fusionMetrics || []).forEach(m => {
        if (m.synced_at) {
          const syncDate = new Date(m.synced_at);
          const daysSinceSync = (now.getTime() - syncDate.getTime()) / (1000 * 60 * 60 * 24);
          if (daysSinceSync < ACTIVE_THRESHOLD_DAYS) {
            usersWithRecentMetrics.add(m.user_id);
          }
        }
      });
      
      const hasExecutionPresence = usersWithRecentMetrics.size > 0;

      // Derive Org Intelligence Maturity
      let maturity: OrgIntelligenceMaturity;
      if (hasExecutionPresence && hasFusionPresence) {
        maturity = 'Active';
      } else if (hasExecutionPresence || hasFusionPresence) {
        maturity = 'Partially Active';
      } else {
        maturity = 'Observing';
      }

      setExecutionReadiness({
        executionPresence: hasExecutionPresence ? 'observed' : 'not_observed',
        fusionPresence: hasFusionPresence ? 'present' : 'not_present',
        maturity,
        userCountWithExecution: usersWithRecentMetrics.size,
        userCountWithFusion: usersWithFusion.size,
        totalUsersInOrg,
        dataSourceError: null,
      });
    } catch (error) {
      console.error('Error fetching execution readiness:', error);
      setExecutionReadiness({
        executionPresence: 'indeterminate',
        fusionPresence: 'indeterminate',
        maturity: 'Indeterminate',
        userCountWithExecution: 0,
        userCountWithFusion: 0,
        totalUsersInOrg: 0,
        dataSourceError: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const isOrgView = selectedOrgId !== 'platform';
  const selectedOrg = organizations.find(o => o.id === selectedOrgId);

  /**
   * Derive Platform System Status from system_health table
   * Rule: If any service is 'down' -> Down, if any 'degraded' -> Degraded, else Healthy
   */
  const derivePlatformStatus = (): PlatformStatus => {
    if (services.length === 0) return 'Healthy';
    
    const hasDown = services.some(s => s.status === 'down');
    if (hasDown) return 'Down';
    
    const hasDegraded = services.some(s => s.status === 'degraded');
    if (hasDegraded) return 'Degraded';
    
    return 'Healthy';
  };

  /**
   * Derive Org System Status from system_health_events table
   * Maps system_health_events.status (healthy/degraded/unhealthy/critical) to panel tri-state
   * Rule: If any critical/unhealthy -> Down, if any degraded -> Degraded, else Healthy
   */
  const deriveOrgStatus = (): PlatformStatus | null => {
    if (orgHealthEvents.length === 0) return null;
    
    const hasDown = orgHealthEvents.some(e => 
      e.status === 'critical' || e.status === 'unhealthy'
    );
    if (hasDown) return 'Down';
    
    const hasDegraded = orgHealthEvents.some(e => e.status === 'degraded');
    if (hasDegraded) return 'Degraded';
    
    return 'Healthy';
  };

  /**
   * Derive Confidence Level from data availability
   * Platform: Based on service health data
   * Org: Based on health events data
   */
  const deriveConfidenceLevel = (): ConfidenceLevel => {
    if (isOrgView) {
      if (orgHealthEvents.length === 0) return 'Confidence pending sufficient data';
      const healthyCount = orgHealthEvents.filter(e => e.status === 'healthy').length;
      if (healthyCount >= 3) return 'High';
      if (orgHealthEvents.length >= 2) return 'Medium';
      return 'Low';
    }
    
    if (services.length === 0) return 'Confidence pending sufficient data';
    const healthyCount = services.filter(s => s.status === 'healthy').length;
    if (healthyCount >= 3) return 'High';
    if (services.length >= 2) return 'Medium';
    return 'Low';
  };

  /**
   * Get Primary Signals
   * Platform: From system_health services
   * Org: From system_health_events components
   */
  const getPrimarySignals = (): PrimarySignal[] => {
    const statusPriority: Record<string, number> = { down: 0, critical: 0, unhealthy: 0, degraded: 1, healthy: 2 };
    
    if (isOrgView) {
      // Map system_health_events status to panel tri-state
      const mapStatus = (status: string): 'healthy' | 'degraded' | 'down' => {
        if (status === 'critical' || status === 'unhealthy') return 'down';
        if (status === 'degraded') return 'degraded';
        return 'healthy';
      };
      
      // Get unique components with their worst status
      const componentMap = new Map<string, string>();
      orgHealthEvents.forEach(e => {
        const existing = componentMap.get(e.component_name);
        if (!existing || (statusPriority[e.status] ?? 2) < (statusPriority[existing] ?? 2)) {
          componentMap.set(e.component_name, e.status);
        }
      });
      
      return Array.from(componentMap.entries())
        .sort((a, b) => (statusPriority[a[1]] ?? 2) - (statusPriority[b[1]] ?? 2))
        .slice(0, 5)
        .map(([name, status]) => ({
          name,
          status: mapStatus(status),
        }));
    }
    
    return services
      .slice()
      .sort((a, b) => (statusPriority[a.status] ?? 2) - (statusPriority[b.status] ?? 2))
      .slice(0, 5)
      .map(s => ({
        name: s.service_name,
        status: s.status,
      }));
  };

  const systemStatus = isOrgView ? deriveOrgStatus() : derivePlatformStatus();
  const confidenceLevel = deriveConfidenceLevel();
  const primarySignals = getPrimarySignals();
  const trend: TrendDirection = 'Insufficient historical data';

  const getStatusIcon = (status: PlatformStatus | null) => {
    if (!status) return <Minus className="h-6 w-6 text-gray-400" />;
    switch (status) {
      case 'Healthy':
        return <CheckCircle2 className="h-6 w-6 text-green-500" />;
      case 'Degraded':
        return <AlertCircle className="h-6 w-6 text-yellow-500" />;
      case 'Down':
        return <XCircle className="h-6 w-6 text-red-500" />;
    }
  };

  const getStatusBadgeColor = (status: PlatformStatus | null) => {
    if (!status) return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
    switch (status) {
      case 'Healthy':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'Degraded':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'Down':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    }
  };

  const getSignalStatusIcon = (status: 'healthy' | 'degraded' | 'down') => {
    switch (status) {
      case 'healthy':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'degraded':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'down':
        return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getTrendIcon = (trend: TrendDirection) => {
    switch (trend) {
      case 'Improving':
        return <TrendingUp className="h-5 w-5 text-green-500" />;
      case 'Declining':
        return <TrendingDown className="h-5 w-5 text-red-500" />;
      case 'Stable':
        return <Minus className="h-5 w-5 text-blue-500" />;
      default:
        return <Minus className="h-5 w-5 text-gray-400" />;
    }
  };

  const getConfidenceBadgeColor = (level: ConfidenceLevel) => {
    switch (level) {
      case 'High':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'Medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'Low':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const getMaturityBadgeColor = (maturity: OrgIntelligenceMaturity) => {
    switch (maturity) {
      case 'Active':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'Partially Active':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'Observing':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const getMaturityIcon = (maturity: OrgIntelligenceMaturity) => {
    switch (maturity) {
      case 'Active':
        return <Zap className="h-5 w-5 text-green-500" />;
      case 'Partially Active':
        return <Activity className="h-5 w-5 text-yellow-500" />;
      case 'Observing':
        return <Eye className="h-5 w-5 text-blue-500" />;
      default:
        return <Minus className="h-5 w-5 text-gray-400" />;
    }
  };

  if (loading) {
    return (
      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cpu className="h-5 w-5" />
            System Intelligence Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
            <Cpu className="h-5 w-5 text-blue-500" />
            System Intelligence Summary
          </CardTitle>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </span>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {isOrgView 
            ? `Organization-scoped intelligence for ${selectedOrg?.name || 'selected organization'}`
            : 'Platform-level operational intelligence derived from existing system data'
          }
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Organization Selector */}
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-3 mb-3">
            <Building2 className="h-5 w-5 text-blue-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Intelligence Scope
            </span>
          </div>
          <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select scope" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="platform">
                <div className="flex items-center gap-2">
                  <Cpu className="h-4 w-4" />
                  Platform Overview
                </div>
              </SelectItem>
              {organizations.length > 0 && (
                <>
                  <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400">
                    Organizations with Intelligence Data
                  </div>
                  {organizations.map(org => (
                    <SelectItem key={org.id} value={org.id}>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        {org.name}
                      </div>
                    </SelectItem>
                  ))}
                </>
              )}
            </SelectContent>
          </Select>
          {organizations.length === 0 && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              No organizations with intelligence data available
            </p>
          )}
        </div>

        {/* Row 1: System Status + Execution Mode */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* System Status */}
          <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                System Status {isOrgView && '(Org-Scoped)'}
              </span>
              {getStatusIcon(systemStatus)}
            </div>
            {systemStatus ? (
              <>
                <Badge className={`${getStatusBadgeColor(systemStatus)} text-sm px-3 py-1`}>
                  {systemStatus}
                </Badge>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  {isOrgView 
                    ? `Derived from ${orgHealthEvents.length} health event${orgHealthEvents.length !== 1 ? 's' : ''} for this organization`
                    : `Derived from ${services.length} monitored service${services.length !== 1 ? 's' : ''}`
                  }
                </p>
              </>
            ) : (
              <>
                <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 text-sm px-3 py-1">
                  No health data available
                </Badge>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  No system_health_events found for this organization
                </p>
              </>
            )}
          </div>

          {/* Execution Mode */}
          <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Execution Mode {isOrgView && '(Org-Scoped)'}
              </span>
              <Activity className="h-5 w-5 text-gray-400" />
            </div>
            <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 text-sm px-3 py-1">
              {isOrgView ? 'Org-level not available' : 'Platform-level not available'}
            </Badge>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              {isOrgView 
                ? 'Execution mode (Baseline/Computed) is derived per-user, not per-organization'
                : 'Execution mode is user-scoped (Baseline/Computed per tenant)'
              }
            </p>
          </div>
        </div>

        {/* Row 2: Fusion Health + Trend */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Fusion Health */}
          <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Fusion Health {isOrgView && '(Org-Scoped)'}
              </span>
              <Shield className="h-5 w-5 text-gray-400" />
            </div>
            <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 text-sm px-3 py-1">
              {isOrgView ? 'Org-level not available' : 'Platform-level not available'}
            </Badge>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              {isOrgView 
                ? 'Fusion scores are computed per-user from their connected integrations, not aggregated at org level'
                : 'Fusion scores are computed per-user from their connected integrations'
              }
            </p>
          </div>

          {/* Trend */}
          <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Trend {isOrgView && '(Org-Scoped)'}
              </span>
              {getTrendIcon(trend)}
            </div>
            <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 text-sm px-3 py-1">
              {trend}
            </Badge>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              {isOrgView 
                ? 'No historical trend data exists at organization scope'
                : 'Platform-level trend analysis requires historical aggregation'
              }
            </p>
          </div>
        </div>

        {/* Row 3: Primary Signals */}
        <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Primary Signals {isOrgView && '(Org-Scoped)'}
            </span>
            <Signal className="h-5 w-5 text-blue-500" />
          </div>
          {primarySignals.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {isOrgView 
                ? 'No component signals available for this organization'
                : 'No service signals available'
              }
            </p>
          ) : (
            <div className="space-y-2">
              {primarySignals.map((signal, index) => (
                <div 
                  key={index}
                  className="flex items-center justify-between py-2 px-3 bg-white dark:bg-gray-800 rounded-md"
                >
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {signal.name}
                  </span>
                  <div className="flex items-center gap-2">
                    {getSignalStatusIcon(signal.status)}
                    <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                      {signal.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
            {isOrgView 
              ? `Showing ${primarySignals.length} component${primarySignals.length !== 1 ? 's' : ''} from system_health_events`
              : `Showing top ${primarySignals.length} service${primarySignals.length !== 1 ? 's' : ''} by status priority`
            }
          </p>
        </div>

        {/* Row 4: Confidence Level */}
        <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Confidence Level {isOrgView && '(Org-Scoped)'}
            </span>
            <Activity className="h-5 w-5 text-blue-500" />
          </div>
          <Badge className={`${getConfidenceBadgeColor(confidenceLevel)} text-sm px-3 py-1`}>
            {confidenceLevel}
          </Badge>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            {isOrgView 
              ? 'Based on system_health_events data availability for this organization'
              : 'Based on service health data availability and coverage'
            }
          </p>
        </div>

        {/* Execution Readiness (Read-Only) - Org-Scoped Only */}
        {isOrgView && (
          <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
            <div className="flex items-center gap-3 mb-4">
              <Brain className="h-5 w-5 text-purple-500" />
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Execution Readiness (Read-Only)
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Organization-level visibility into AI execution and fusion intelligence presence.
              This section is read-only and reflects existing user-level data.
            </p>

            {executionReadiness?.dataSourceError ? (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-md border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-600 dark:text-red-400">
                  Data source error: {executionReadiness.dataSourceError}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Org Execution Presence */}
                <div className="p-3 bg-white dark:bg-gray-800 rounded-md">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Org Execution Presence
                    </span>
                    {executionReadiness?.executionPresence === 'observed' ? (
                      <Zap className="h-4 w-4 text-green-500" />
                    ) : executionReadiness?.executionPresence === 'indeterminate' ? (
                      <Minus className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-blue-500" />
                    )}
                  </div>
                  <Badge className={
                    executionReadiness?.executionPresence === 'observed'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs px-2 py-0.5'
                      : executionReadiness?.executionPresence === 'indeterminate'
                      ? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 text-xs px-2 py-0.5'
                      : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs px-2 py-0.5'
                  }>
                    {executionReadiness?.executionPresence === 'observed'
                      ? 'AI execution observed for one or more users'
                      : executionReadiness?.executionPresence === 'indeterminate'
                      ? 'Execution presence indeterminate'
                      : 'No AI execution observed'}
                  </Badge>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    {executionReadiness?.executionPresence === 'observed'
                      ? `${executionReadiness.userCountWithExecution} of ${executionReadiness.totalUsersInOrg} user${executionReadiness.totalUsersInOrg !== 1 ? 's' : ''} with recent metrics (within 14 days)`
                      : executionReadiness?.executionPresence === 'indeterminate'
                      ? 'Unable to query user-level execution data'
                      : `0 of ${executionReadiness?.totalUsersInOrg || 0} users with recent metrics`}
                  </p>
                </div>

                {/* Fusion Intelligence Presence */}
                <div className="p-3 bg-white dark:bg-gray-800 rounded-md">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Fusion Intelligence Presence
                    </span>
                    {executionReadiness?.fusionPresence === 'present' ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : executionReadiness?.fusionPresence === 'indeterminate' ? (
                      <Minus className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-blue-500" />
                    )}
                  </div>
                  <Badge className={
                    executionReadiness?.fusionPresence === 'present'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs px-2 py-0.5'
                      : executionReadiness?.fusionPresence === 'indeterminate'
                      ? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 text-xs px-2 py-0.5'
                      : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs px-2 py-0.5'
                  }>
                    {executionReadiness?.fusionPresence === 'present'
                      ? 'Fusion intelligence present for one or more users'
                      : executionReadiness?.fusionPresence === 'indeterminate'
                      ? 'Fusion presence indeterminate'
                      : 'No fusion intelligence present'}
                  </Badge>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    {executionReadiness?.fusionPresence === 'present'
                      ? `${executionReadiness.userCountWithFusion} of ${executionReadiness.totalUsersInOrg} user${executionReadiness.totalUsersInOrg !== 1 ? 's' : ''} with fusion_metrics records`
                      : executionReadiness?.fusionPresence === 'indeterminate'
                      ? 'Unable to query user-level fusion data'
                      : `0 of ${executionReadiness?.totalUsersInOrg || 0} users with fusion_metrics records`}
                  </p>
                </div>

                {/* Org Intelligence Maturity */}
                <div className="p-3 bg-white dark:bg-gray-800 rounded-md">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Org Intelligence Maturity
                    </span>
                    {getMaturityIcon(executionReadiness?.maturity || 'Indeterminate')}
                  </div>
                  <Badge className={`${getMaturityBadgeColor(executionReadiness?.maturity || 'Indeterminate')} text-xs px-2 py-0.5`}>
                    {executionReadiness?.maturity || 'Indeterminate'}
                  </Badge>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    {executionReadiness?.maturity === 'Active'
                      ? 'Both AI execution and fusion intelligence are present'
                      : executionReadiness?.maturity === 'Partially Active'
                      ? 'Either execution or fusion is present, but not both'
                      : executionReadiness?.maturity === 'Observing'
                      ? 'No AI execution or fusion intelligence detected yet'
                      : 'Unable to determine maturity level'}
                  </p>
                </div>
              </div>
            )}

            <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 pt-3 border-t border-purple-200 dark:border-purple-700">
              <strong>Data Sources:</strong> profiles table (organization membership), 
              fusion_metrics table (user-level metrics with synced_at timestamps).
              Execution presence derived from recent metrics within 14 days.
            </p>
          </div>
        )}

        {/* Footer: Data Source Attribution */}
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            <strong>Data Sources:</strong>{' '}
            {isOrgView ? (
              <>
                system_health_events table (org-scoped component monitoring), 
                trust_graph_dashboard view (organization list),
                profiles table (organization membership),
                fusion_metrics table (user-level metrics with synced_at timestamps).
                Execution Readiness section derives org-level presence from existing user-level data.
              </>
            ) : (
              <>
                system_health table (platform-level service monitoring).
                User-scoped intelligence (Execution Mode, Fusion Health) is available per-tenant in the user application.
              </>
            )}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
