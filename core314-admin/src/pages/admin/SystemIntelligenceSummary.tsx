import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { SystemHealth as SystemHealthType } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
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
  Shield
} from 'lucide-react';

/**
 * System Intelligence Summary Panel
 * 
 * This panel surfaces EXISTING operational intelligence from the Core314 platform.
 * It does NOT create new systems, logic, or data - it only wires existing data sources.
 * 
 * Data Sources:
 * - system_health table: Platform-level service health (already used by SystemHealth.tsx)
 * 
 * Required Fields:
 * 1. System Status: Derived from system_health table aggregation
 * 2. Execution Mode: Platform-level not available (user-scoped in production)
 * 3. Fusion Health: Platform-level not available (user-scoped in production)
 * 4. Trend: Insufficient historical data (no platform-level trend exists)
 * 5. Primary Signals: From system_health service names and statuses
 * 6. Confidence Level: Derived from service health data availability
 */

type PlatformStatus = 'Healthy' | 'Degraded' | 'Down';
type TrendDirection = 'Improving' | 'Stable' | 'Declining' | 'Insufficient historical data';
type ConfidenceLevel = 'Low' | 'Medium' | 'High' | 'Confidence pending sufficient data';

interface PrimarySignal {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
}

export function SystemIntelligenceSummary() {
  const [services, setServices] = useState<SystemHealthType[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  useEffect(() => {
    fetchSystemHealth();
    const interval = setInterval(fetchSystemHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchSystemHealth = async () => {
    try {
      const { data, error } = await supabase
        .from('system_health')
        .select('*')
        .order('last_check_at', { ascending: false });

      if (error) throw error;
      setServices(data || []);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching system health:', error);
    } finally {
      setLoading(false);
    }
  };

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
   * Derive Confidence Level from service health data availability
   * Rule: No services -> Low, some services -> Medium, 3+ healthy services -> High
   */
  const deriveConfidenceLevel = (): ConfidenceLevel => {
    if (services.length === 0) return 'Confidence pending sufficient data';
    
    const healthyCount = services.filter(s => s.status === 'healthy').length;
    
    if (healthyCount >= 3) return 'High';
    if (services.length >= 2) return 'Medium';
    return 'Low';
  };

  /**
   * Get Primary Signals from system_health services
   * Returns top 5 services sorted by status (down first, then degraded, then healthy)
   */
  const getPrimarySignals = (): PrimarySignal[] => {
    const statusPriority = { down: 0, degraded: 1, healthy: 2 };
    
    return services
      .slice()
      .sort((a, b) => statusPriority[a.status] - statusPriority[b.status])
      .slice(0, 5)
      .map(s => ({
        name: s.service_name,
        status: s.status,
      }));
  };

  const platformStatus = derivePlatformStatus();
  const confidenceLevel = deriveConfidenceLevel();
  const primarySignals = getPrimarySignals();
  const trend: TrendDirection = 'Insufficient historical data';

  const getStatusIcon = (status: PlatformStatus) => {
    switch (status) {
      case 'Healthy':
        return <CheckCircle2 className="h-6 w-6 text-green-500" />;
      case 'Degraded':
        return <AlertCircle className="h-6 w-6 text-yellow-500" />;
      case 'Down':
        return <XCircle className="h-6 w-6 text-red-500" />;
    }
  };

  const getStatusBadgeColor = (status: PlatformStatus) => {
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
          Platform-level operational intelligence derived from existing system data
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Row 1: System Status + Execution Mode */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* System Status */}
          <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                System Status
              </span>
              {getStatusIcon(platformStatus)}
            </div>
            <Badge className={`${getStatusBadgeColor(platformStatus)} text-sm px-3 py-1`}>
              {platformStatus}
            </Badge>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Derived from {services.length} monitored service{services.length !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Execution Mode */}
          <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Execution Mode
              </span>
              <Activity className="h-5 w-5 text-gray-400" />
            </div>
            <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 text-sm px-3 py-1">
              Platform-level not available
            </Badge>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Execution mode is user-scoped (Baseline/Computed per tenant)
            </p>
          </div>
        </div>

        {/* Row 2: Fusion Health + Trend */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Fusion Health */}
          <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Fusion Health
              </span>
              <Shield className="h-5 w-5 text-gray-400" />
            </div>
            <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 text-sm px-3 py-1">
              Platform-level not available
            </Badge>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Fusion scores are computed per-user from their connected integrations
            </p>
          </div>

          {/* Trend */}
          <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Trend
              </span>
              {getTrendIcon(trend)}
            </div>
            <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 text-sm px-3 py-1">
              {trend}
            </Badge>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Platform-level trend analysis requires historical aggregation
            </p>
          </div>
        </div>

        {/* Row 3: Primary Signals */}
        <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Primary Signals
            </span>
            <Signal className="h-5 w-5 text-blue-500" />
          </div>
          {primarySignals.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No service signals available
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
            Showing top {primarySignals.length} service{primarySignals.length !== 1 ? 's' : ''} by status priority
          </p>
        </div>

        {/* Row 4: Confidence Level */}
        <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Confidence Level
            </span>
            <Activity className="h-5 w-5 text-blue-500" />
          </div>
          <Badge className={`${getConfidenceBadgeColor(confidenceLevel)} text-sm px-3 py-1`}>
            {confidenceLevel}
          </Badge>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Based on service health data availability and coverage
          </p>
        </div>

        {/* Footer: Data Source Attribution */}
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            <strong>Data Sources:</strong> system_health table (platform-level service monitoring). 
            User-scoped intelligence (Execution Mode, Fusion Health) is available per-tenant in the user application.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
