import { useSystemStatus } from '../../hooks/useSystemStatus';
import { Badge } from '../ui/badge';
import { Activity, AlertTriangle, CheckCircle } from 'lucide-react';

/**
 * SystemHealthIndicator - Displays system health status in the top navigation
 * 
 * States:
 * - "Healthy" (green): system_health === 'active' and no error
 * - "Attention Needed" (amber): system_health === 'observing'
 * - "Degraded" (red): error state
 * 
 * This is a read-only status indicator, NOT a navigation control.
 */
export function SystemHealthIndicator() {
  const { systemStatus, loading, error } = useSystemStatus();

  if (loading) {
    return (
      <Badge variant="outline" className="flex items-center gap-1.5 px-3 py-1 text-gray-500">
        <Activity className="h-3.5 w-3.5 animate-pulse" />
        <span className="text-xs font-medium">Loading...</span>
      </Badge>
    );
  }

  if (error) {
    return (
      <Badge variant="destructive" className="flex items-center gap-1.5 px-3 py-1">
        <AlertTriangle className="h-3.5 w-3.5" />
        <span className="text-xs font-medium">Degraded</span>
      </Badge>
    );
  }

  if (!systemStatus) {
    return null;
  }

  const isHealthy = systemStatus.system_health === 'active';
  const isObserving = systemStatus.system_health === 'observing';

  if (isHealthy) {
    return (
      <Badge 
        variant="outline" 
        className="flex items-center gap-1.5 px-3 py-1 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800"
      >
        <CheckCircle className="h-3.5 w-3.5" />
        <span className="text-xs font-medium">Healthy</span>
      </Badge>
    );
  }

  if (isObserving) {
    return (
      <Badge 
        variant="outline" 
        className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800"
      >
        <Activity className="h-3.5 w-3.5" />
        <span className="text-xs font-medium">Attention Needed</span>
      </Badge>
    );
  }

  return null;
}
