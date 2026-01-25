import { useSystemStatus } from '../../hooks/useSystemStatus';
import { Activity, AlertCircle, CheckCircle } from 'lucide-react';

/**
 * SystemHealthIndicator - Displays current system health status in top nav
 * 
 * Health states:
 * - Healthy: system_health === 'active' and no errors
 * - Attention Needed: system_health === 'observing' (system not fully active yet)
 * - Degraded: error state or fetch failure
 * 
 * Uses existing useSystemStatus hook - no new API calls or business logic.
 */
export function SystemHealthIndicator() {
  const { systemStatus, loading, error } = useSystemStatus();

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800">
        <div className="h-2 w-2 rounded-full bg-gray-400 animate-pulse" />
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
          Loading...
        </span>
      </div>
    );
  }

  // Degraded: error state
  if (error) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
        <AlertCircle className="h-3.5 w-3.5 text-red-500" />
        <span className="text-xs font-medium text-red-700 dark:text-red-300">
          Degraded
        </span>
      </div>
    );
  }

  // Attention Needed: system is observing (not fully active yet)
  if (systemStatus?.system_health === 'observing') {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
        <Activity className="h-3.5 w-3.5 text-amber-500" />
        <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
          Attention Needed
        </span>
      </div>
    );
  }

  // Healthy: system is active
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
      <CheckCircle className="h-3.5 w-3.5 text-green-500" />
      <span className="text-xs font-medium text-green-700 dark:text-green-300">
        Healthy
      </span>
    </div>
  );
}
