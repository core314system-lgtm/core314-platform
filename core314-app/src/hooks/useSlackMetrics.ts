import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '../lib/supabase';

/**
 * Slack Intelligence KPIs - Phase 2
 * 
 * AGGREGATION STRATEGY:
 * All metrics are PRE-COMPUTED and stored in the telemetry_metrics table.
 * This hook reads cached/aggregated values - it does NOT compute metrics on page load.
 * Background jobs (future phase) will populate these metrics from Slack API data.
 * 
 * METRIC NAMING CONVENTION:
 * - slack_message_volume_daily: Average messages per day
 * - slack_response_latency_median: Median response time in minutes
 * - slack_active_participation_rate: % of active users vs total users
 * - slack_channels_active: Count of active channels
 * - slack_channels_idle: Count of idle channels
 * 
 * NOTE: Fusion Score is NOT yet influenced by these metrics (Phase 1 requirement).
 */

export interface SlackMetrics {
  // Message Volume
  messageVolumeDaily7d: number | null;
  messageVolumeDaily30d: number | null;
  messageVolumeTrend: 'up' | 'down' | 'stable' | null;
  
  // Response Latency
  responseLatencyMedian: number | null; // in minutes
  responseLatencyTrend: 'up' | 'down' | 'stable' | null;
  
  // Active Participation
  activeParticipationRate: number | null; // percentage (0-100)
  totalUsers: number | null;
  activeUsers: number | null;
  
  // Channel Activity
  activeChannels: number | null;
  idleChannels: number | null;
  
  // Metadata
  lastUpdated: Date | null;
}

export interface UseSlackMetricsResult {
  metrics: SlackMetrics;
  loading: boolean;
  error: string | null;
  hasData: boolean;
}

const DEFAULT_METRICS: SlackMetrics = {
  messageVolumeDaily7d: null,
  messageVolumeDaily30d: null,
  messageVolumeTrend: null,
  responseLatencyMedian: null,
  responseLatencyTrend: null,
  activeParticipationRate: null,
  totalUsers: null,
  activeUsers: null,
  activeChannels: null,
  idleChannels: null,
  lastUpdated: null,
};

/**
 * Hook to fetch cached Slack metrics from telemetry_metrics table.
 * Returns pre-aggregated KPIs - does not compute on page load.
 */
export function useSlackMetrics(): UseSlackMetricsResult {
  const { profile } = useAuth();
  const [metrics, setMetrics] = useState<SlackMetrics>(DEFAULT_METRICS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      if (!profile?.id) {
        setMetrics(DEFAULT_METRICS);
        setLoading(false);
        return;
      }

      try {
        // Fetch all Slack metrics for this user from telemetry_metrics
        // These are pre-computed/cached values, not real-time calculations
        const { data, error: fetchError } = await supabase
          .from('telemetry_metrics')
          .select('metric_name, metric_value, metadata, timestamp')
          .eq('user_id', profile.id)
          .eq('source_app', 'slack')
          .in('metric_name', [
            'slack_message_volume_daily_7d',
            'slack_message_volume_daily_30d',
            'slack_message_volume_trend',
            'slack_response_latency_median',
            'slack_response_latency_trend',
            'slack_active_participation_rate',
            'slack_total_users',
            'slack_active_users',
            'slack_channels_active',
            'slack_channels_idle',
          ])
          .order('timestamp', { ascending: false });

        if (fetchError) {
          console.error('Error fetching Slack metrics:', fetchError);
          setError('Failed to load Slack metrics');
          setMetrics(DEFAULT_METRICS);
          return;
        }

        if (!data || data.length === 0) {
          // No metrics available yet - this is expected for new integrations
          setMetrics(DEFAULT_METRICS);
          setLoading(false);
          return;
        }

        // Get the most recent value for each metric
        const latestMetrics = new Map<string, { value: number; timestamp: string; metadata?: Record<string, unknown> }>();
        for (const row of data) {
          if (!latestMetrics.has(row.metric_name)) {
            latestMetrics.set(row.metric_name, {
              value: row.metric_value,
              timestamp: row.timestamp,
              metadata: row.metadata as Record<string, unknown> | undefined,
            });
          }
        }

        // Map to SlackMetrics structure
        const parsedMetrics: SlackMetrics = {
          messageVolumeDaily7d: latestMetrics.get('slack_message_volume_daily_7d')?.value ?? null,
          messageVolumeDaily30d: latestMetrics.get('slack_message_volume_daily_30d')?.value ?? null,
          messageVolumeTrend: parseTrend(latestMetrics.get('slack_message_volume_trend')?.value),
          responseLatencyMedian: latestMetrics.get('slack_response_latency_median')?.value ?? null,
          responseLatencyTrend: parseTrend(latestMetrics.get('slack_response_latency_trend')?.value),
          activeParticipationRate: latestMetrics.get('slack_active_participation_rate')?.value ?? null,
          totalUsers: latestMetrics.get('slack_total_users')?.value ?? null,
          activeUsers: latestMetrics.get('slack_active_users')?.value ?? null,
          activeChannels: latestMetrics.get('slack_channels_active')?.value ?? null,
          idleChannels: latestMetrics.get('slack_channels_idle')?.value ?? null,
          lastUpdated: findLatestTimestamp(latestMetrics),
        };

        setMetrics(parsedMetrics);
      } catch (err) {
        console.error('Error in useSlackMetrics:', err);
        setError('An unexpected error occurred');
        setMetrics(DEFAULT_METRICS);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, [profile?.id]);

  // Determine if we have any meaningful data
  const hasData = metrics.messageVolumeDaily7d !== null ||
    metrics.responseLatencyMedian !== null ||
    metrics.activeParticipationRate !== null ||
    metrics.activeChannels !== null;

  return {
    metrics,
    loading,
    error,
    hasData,
  };
}

/**
 * Parse trend value from numeric to string.
 * Convention: 1 = up, -1 = down, 0 = stable
 */
function parseTrend(value: number | undefined): 'up' | 'down' | 'stable' | null {
  if (value === undefined || value === null) return null;
  if (value > 0) return 'up';
  if (value < 0) return 'down';
  return 'stable';
}

/**
 * Find the most recent timestamp from all metrics.
 */
function findLatestTimestamp(metricsMap: Map<string, { value: number; timestamp: string }>): Date | null {
  let latest: Date | null = null;
  for (const [, data] of metricsMap) {
    const ts = new Date(data.timestamp);
    if (!latest || ts > latest) {
      latest = ts;
    }
  }
  return latest;
}
