import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '../lib/supabase';

/**
 * Microsoft Teams Intelligence KPIs - Phase 2
 * 
 * AGGREGATION STRATEGY:
 * All metrics are PRE-COMPUTED and stored in the telemetry_metrics table.
 * This hook reads cached/aggregated values - it does NOT compute metrics on page load.
 * Background jobs (future phase) will populate these metrics from Microsoft Graph API data.
 * 
 * METRIC NAMING CONVENTION:
 * - teams_meetings_per_user: Average meetings per user per week
 * - teams_avg_meeting_duration: Average meeting duration in minutes
 * - teams_chat_meeting_ratio: Ratio of chat messages to meetings
 * - teams_after_hours_rate: Percentage of activity occurring after business hours
 * 
 * NOTE: Fusion Score is NOT yet influenced by these metrics (Phase 1 requirement).
 */

export interface TeamsMetrics {
  // Meetings per User
  meetingsPerUser: number | null; // average per week
  meetingsPerUserTrend: 'up' | 'down' | 'stable' | null;
  totalMeetings: number | null;
  
  // Average Meeting Duration
  avgMeetingDuration: number | null; // in minutes
  avgMeetingDurationTrend: 'up' | 'down' | 'stable' | null;
  
  // Chat vs Meeting Ratio
  chatMeetingRatio: number | null; // e.g., 3.5 means 3.5 chats per meeting
  totalChats: number | null;
  
  // After-Hours Activity
  afterHoursRate: number | null; // percentage (0-100)
  afterHoursRateTrend: 'up' | 'down' | 'stable' | null;
  
  // Metadata
  lastUpdated: Date | null;
}

export interface UseTeamsMetricsResult {
  metrics: TeamsMetrics;
  loading: boolean;
  error: string | null;
  hasData: boolean;
}

const DEFAULT_METRICS: TeamsMetrics = {
  meetingsPerUser: null,
  meetingsPerUserTrend: null,
  totalMeetings: null,
  avgMeetingDuration: null,
  avgMeetingDurationTrend: null,
  chatMeetingRatio: null,
  totalChats: null,
  afterHoursRate: null,
  afterHoursRateTrend: null,
  lastUpdated: null,
};

/**
 * Hook to fetch cached Microsoft Teams metrics from telemetry_metrics table.
 * Returns pre-aggregated KPIs - does not compute on page load.
 */
export function useTeamsMetrics(): UseTeamsMetricsResult {
  const { profile } = useAuth();
  const [metrics, setMetrics] = useState<TeamsMetrics>(DEFAULT_METRICS);
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
        // Fetch all Teams metrics for this user from telemetry_metrics
        // These are pre-computed/cached values, not real-time calculations
        const { data, error: fetchError } = await supabase
          .from('telemetry_metrics')
          .select('metric_name, metric_value, metadata, timestamp')
          .eq('user_id', profile.id)
          .eq('source_app', 'teams')
          .in('metric_name', [
            'teams_meetings_per_user',
            'teams_meetings_per_user_trend',
            'teams_total_meetings',
            'teams_avg_meeting_duration',
            'teams_avg_meeting_duration_trend',
            'teams_chat_meeting_ratio',
            'teams_total_chats',
            'teams_after_hours_rate',
            'teams_after_hours_rate_trend',
          ])
          .order('timestamp', { ascending: false });

        if (fetchError) {
          console.error('Error fetching Teams metrics:', fetchError);
          setError('Failed to load Teams metrics');
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

        // Map to TeamsMetrics structure
        const parsedMetrics: TeamsMetrics = {
          meetingsPerUser: latestMetrics.get('teams_meetings_per_user')?.value ?? null,
          meetingsPerUserTrend: parseTrend(latestMetrics.get('teams_meetings_per_user_trend')?.value),
          totalMeetings: latestMetrics.get('teams_total_meetings')?.value ?? null,
          avgMeetingDuration: latestMetrics.get('teams_avg_meeting_duration')?.value ?? null,
          avgMeetingDurationTrend: parseTrend(latestMetrics.get('teams_avg_meeting_duration_trend')?.value),
          chatMeetingRatio: latestMetrics.get('teams_chat_meeting_ratio')?.value ?? null,
          totalChats: latestMetrics.get('teams_total_chats')?.value ?? null,
          afterHoursRate: latestMetrics.get('teams_after_hours_rate')?.value ?? null,
          afterHoursRateTrend: parseTrend(latestMetrics.get('teams_after_hours_rate_trend')?.value),
          lastUpdated: findLatestTimestamp(latestMetrics),
        };

        setMetrics(parsedMetrics);
      } catch (err) {
        console.error('Error in useTeamsMetrics:', err);
        setError('An unexpected error occurred');
        setMetrics(DEFAULT_METRICS);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, [profile?.id]);

  // Determine if we have any meaningful data
  const hasData = metrics.meetingsPerUser !== null ||
    metrics.avgMeetingDuration !== null ||
    metrics.chatMeetingRatio !== null ||
    metrics.afterHoursRate !== null;

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
