import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '../lib/supabase';

/**
 * System Status Hook - Fetches canonical system status from /api/system/integrations
 * 
 * This hook provides:
 * - score_origin: 'baseline' | 'computed' - Determines if user is in Observe tier
 * - system_health: 'observing' | 'active' - Current system state
 * - global_fusion_score: number - The canonical fusion score
 * - connected_integrations: Array of connected integrations with their metrics state
 * - has_efficiency_metrics: boolean - Whether any metrics exist
 * 
 * OBSERVE TIER DETECTION:
 * - score_origin === 'baseline' means user is in Observe tier (no active metrics)
 * - score_origin === 'computed' means user has active metrics (Analyze/Predict tier)
 */

export type ScoreOrigin = 'baseline' | 'computed';
export type SystemHealth = 'observing' | 'active';
export type IntegrationMetricsState = 'observing' | 'active';

export interface ConnectedIntegration {
  name: string;
  metrics_state: IntegrationMetricsState;
}

export interface SystemStatus {
  global_fusion_score: number;
  score_origin: ScoreOrigin;
  system_health: SystemHealth;
  has_efficiency_metrics: boolean;
  connected_integrations: ConnectedIntegration[];
}

export interface UseSystemStatusResult {
  systemStatus: SystemStatus | null;
  loading: boolean;
  error: string | null;
  isObserveTier: boolean;
  refetch: () => Promise<void>;
}

export function useSystemStatus(): UseSystemStatusResult {
  const { profile } = useAuth();
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSystemStatus = useCallback(async () => {
    if (!profile?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('No active session');
        setLoading(false);
        return;
      }

      const response = await fetch('/.netlify/functions/system-integrations', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch system status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.system_status) {
        setSystemStatus(data.system_status);
      } else {
        setError(data.error || 'Failed to fetch system status');
      }
    } catch (err) {
      console.error('[useSystemStatus] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch system status');
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    fetchSystemStatus();
  }, [fetchSystemStatus]);

  // Observe tier = score_origin is 'baseline' (no active metrics yet)
  const isObserveTier = systemStatus?.score_origin === 'baseline';

  return {
    systemStatus,
    loading,
    error,
    isObserveTier,
    refetch: fetchSystemStatus,
  };
}
