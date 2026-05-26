import { useState, useEffect, useMemo } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '../lib/supabase';
import { useIntelligenceDashboard } from './useIntelligenceDashboard';

/**
 * Communication Health Score - Phase 3
 * 
 * WEIGHTING MODEL (LOCKED):
 * Communication Health contributes a MAX of 20 points to the overall Fusion Score (out of 100).
 * 
 * Slack (12 points total):
 * - Response Latency → 6 points max
 * - Active Participation Rate → 6 points max
 * 
 * Microsoft Teams (8 points total):
 * - Meeting Load Balance → 4 points max
 * - After-Hours Activity Rate → 4 points max
 * 
 * NORMALIZATION RULES:
 * Each metric is normalized to a 0-1 range, then mapped to its max point contribution.
 * - Good range → full contribution (1.0)
 * - Degraded range → partial contribution (0.5)
 * - Poor range → minimal contribution (0.2)
 * - Missing data → neutral (0 contribution, NOT a penalty)
 * 
 * DAILY AGGREGATION:
 * All metrics are read from pre-computed/cached values in telemetry_metrics.
 * No real-time recalculation on page load.
 * Updates happen daily via background jobs.
 * 
 * SMOOTHING / STABILITY:
 * - Daily aggregation only
 * - No sudden score drops or spikes
 * - Gradual directional change
 * 
 * NOTE: This hook only provides the Communication Health contribution.
 * The main Fusion Score integration happens in FusionOverviewWidget.
 */

// Weighting constants (LOCKED - do not modify without explicit approval)
const WEIGHTS = {
  slack: {
    responseLatency: 6,      // 6 points max
    participationRate: 6,    // 6 points max
  },
  teams: {
    meetingLoadBalance: 4,   // 4 points max
    afterHoursRate: 4,       // 4 points max
  },
  maxTotal: 20,              // 20 points max total
} as const;

export interface MetricContribution {
  metricName: string;
  displayName: string;
  normalizedValue: number;  // 0-1 range
  pointContribution: number; // actual points contributed
  maxPoints: number;         // max possible points
  trend: 'up' | 'down' | 'stable' | null;
  hasData: boolean;
}

export interface CommunicationHealthScore {
  totalContribution: number;  // 0-20 points
  maxPossible: number;        // 20 points
  percentage: number;         // 0-100%
  breakdown: {
    slack: MetricContribution[];
    teams: MetricContribution[];
  };
  hasAnyData: boolean;
  lastUpdated: Date | null;
}

export interface UseCommunicationHealthScoreResult {
  score: CommunicationHealthScore;
  loading: boolean;
  error: string | null;
  isEnabled: boolean;  // Feature flag status
}

/**
 * Normalize Response Latency (lower is better)
 * Good: < 5 min → 1.0
 * Degraded: 5-30 min → 0.5
 * Poor: > 30 min → 0.2
 */
function normalizeResponseLatency(minutes: number | null): number {
  if (minutes === null) return 0; // Missing data = neutral
  if (minutes < 5) return 1.0;
  if (minutes <= 30) return 0.5;
  return 0.2;
}

/**
 * Normalize Active Participation Rate (higher is better)
 * Good: > 70% → 1.0
 * Degraded: 40-70% → 0.5
 * Poor: < 40% → 0.2
 */
function normalizeParticipationRate(rate: number | null): number {
  if (rate === null) return 0; // Missing data = neutral
  if (rate > 70) return 1.0;
  if (rate >= 40) return 0.5;
  return 0.2;
}

/**
 * Normalize Meeting Load Balance (moderate is best)
 * Good: 3-8 meetings/user/week → 1.0
 * Degraded: 1-3 or 8-15 → 0.5
 * Poor: 0 or > 15 → 0.2
 */
function normalizeMeetingLoad(meetingsPerUser: number | null): number {
  if (meetingsPerUser === null) return 0; // Missing data = neutral
  if (meetingsPerUser >= 3 && meetingsPerUser <= 8) return 1.0;
  if ((meetingsPerUser >= 1 && meetingsPerUser < 3) || (meetingsPerUser > 8 && meetingsPerUser <= 15)) return 0.5;
  return 0.2;
}

/**
 * Normalize After-Hours Activity Rate (lower is better)
 * Good: < 10% → 1.0
 * Degraded: 10-25% → 0.5
 * Poor: > 25% → 0.2
 */
function normalizeAfterHoursRate(rate: number | null): number {
  if (rate === null) return 0; // Missing data = neutral
  if (rate < 10) return 1.0;
  if (rate <= 25) return 0.5;
  return 0.2;
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

const DEFAULT_SCORE: CommunicationHealthScore = {
  totalContribution: 0,
  maxPossible: WEIGHTS.maxTotal,
  percentage: 0,
  breakdown: {
    slack: [],
    teams: [],
  },
  hasAnyData: false,
  lastUpdated: null,
};

/**
 * Hook to calculate Communication Health contribution to Fusion Score.
 * Only active when feature flag is ON.
 * Returns 0 contribution when flag is OFF or no data available.
 */
export function useCommunicationHealthScore(): UseCommunicationHealthScoreResult {
  const { profile } = useAuth();
  const { isIntelligenceDashboardEnabled: isEnabled } = useIntelligenceDashboard();
  const [rawMetrics, setRawMetrics] = useState<Map<string, { value: number; trend?: number; timestamp: string }>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      // If feature flag is OFF, don't fetch metrics
      if (!isEnabled) {
        setRawMetrics(new Map());
        setLoading(false);
        return;
      }

      if (!profile?.id) {
        setRawMetrics(new Map());
        setLoading(false);
        return;
      }

      try {
        // Fetch all Communication Health metrics from telemetry_metrics
        // These are pre-computed/cached values, not real-time calculations
        const { data, error: fetchError } = await supabase
          .from('telemetry_metrics')
          .select('metric_name, metric_value, metadata, timestamp')
          .eq('user_id', profile.id)
          .in('source_app', ['slack', 'teams'])
          .in('metric_name', [
            // Slack metrics
            'slack_response_latency_median',
            'slack_response_latency_trend',
            'slack_active_participation_rate',
            'slack_active_participation_trend',
            // Teams metrics
            'teams_meetings_per_user',
            'teams_meetings_per_user_trend',
            'teams_after_hours_rate',
            'teams_after_hours_rate_trend',
          ])
          .order('timestamp', { ascending: false });

        if (fetchError) {
          console.error('Error fetching Communication Health metrics:', fetchError);
          setError('Failed to load Communication Health metrics');
          setRawMetrics(new Map());
          return;
        }

        // Get the most recent value for each metric
        const metricsMap = new Map<string, { value: number; trend?: number; timestamp: string }>();
        for (const row of data || []) {
          if (!metricsMap.has(row.metric_name)) {
            metricsMap.set(row.metric_name, {
              value: row.metric_value,
              timestamp: row.timestamp,
            });
          }
        }

        // Extract trend values and associate with main metrics
        const latencyTrend = metricsMap.get('slack_response_latency_trend')?.value;
        const participationTrend = metricsMap.get('slack_active_participation_trend')?.value;
        const meetingsTrend = metricsMap.get('teams_meetings_per_user_trend')?.value;
        const afterHoursTrend = metricsMap.get('teams_after_hours_rate_trend')?.value;

        // Update main metrics with trend values
        const latencyMetric = metricsMap.get('slack_response_latency_median');
        if (latencyMetric) latencyMetric.trend = latencyTrend;
        
        const participationMetric = metricsMap.get('slack_active_participation_rate');
        if (participationMetric) participationMetric.trend = participationTrend;
        
        const meetingsMetric = metricsMap.get('teams_meetings_per_user');
        if (meetingsMetric) meetingsMetric.trend = meetingsTrend;
        
        const afterHoursMetric = metricsMap.get('teams_after_hours_rate');
        if (afterHoursMetric) afterHoursMetric.trend = afterHoursTrend;

        setRawMetrics(metricsMap);
      } catch (err) {
        console.error('Error in useCommunicationHealthScore:', err);
        setError('An unexpected error occurred');
        setRawMetrics(new Map());
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, [profile?.id, isEnabled]);

  // Calculate the score from raw metrics
  const score = useMemo((): CommunicationHealthScore => {
    // If feature flag is OFF, return default (0 contribution)
    if (!isEnabled) {
      return DEFAULT_SCORE;
    }

    // Extract raw values
    const responseLatency = rawMetrics.get('slack_response_latency_median')?.value ?? null;
    const participationRate = rawMetrics.get('slack_active_participation_rate')?.value ?? null;
    const meetingsPerUser = rawMetrics.get('teams_meetings_per_user')?.value ?? null;
    const afterHoursRate = rawMetrics.get('teams_after_hours_rate')?.value ?? null;

    // Normalize each metric (0-1 range)
    const normalizedLatency = normalizeResponseLatency(responseLatency);
    const normalizedParticipation = normalizeParticipationRate(participationRate);
    const normalizedMeetings = normalizeMeetingLoad(meetingsPerUser);
    const normalizedAfterHours = normalizeAfterHoursRate(afterHoursRate);

    // Calculate point contributions
    const latencyPoints = normalizedLatency * WEIGHTS.slack.responseLatency;
    const participationPoints = normalizedParticipation * WEIGHTS.slack.participationRate;
    const meetingsPoints = normalizedMeetings * WEIGHTS.teams.meetingLoadBalance;
    const afterHoursPoints = normalizedAfterHours * WEIGHTS.teams.afterHoursRate;

    // Build breakdown
    const slackBreakdown: MetricContribution[] = [
      {
        metricName: 'slack_response_latency',
        displayName: 'Response Latency',
        normalizedValue: normalizedLatency,
        pointContribution: latencyPoints,
        maxPoints: WEIGHTS.slack.responseLatency,
        trend: parseTrend(rawMetrics.get('slack_response_latency_median')?.trend),
        hasData: responseLatency !== null,
      },
      {
        metricName: 'slack_participation_rate',
        displayName: 'Participation Rate',
        normalizedValue: normalizedParticipation,
        pointContribution: participationPoints,
        maxPoints: WEIGHTS.slack.participationRate,
        trend: parseTrend(rawMetrics.get('slack_active_participation_rate')?.trend),
        hasData: participationRate !== null,
      },
    ];

    const teamsBreakdown: MetricContribution[] = [
      {
        metricName: 'teams_meeting_load',
        displayName: 'Meeting Load',
        normalizedValue: normalizedMeetings,
        pointContribution: meetingsPoints,
        maxPoints: WEIGHTS.teams.meetingLoadBalance,
        trend: parseTrend(rawMetrics.get('teams_meetings_per_user')?.trend),
        hasData: meetingsPerUser !== null,
      },
      {
        metricName: 'teams_after_hours',
        displayName: 'After-Hours Activity',
        normalizedValue: normalizedAfterHours,
        pointContribution: afterHoursPoints,
        maxPoints: WEIGHTS.teams.afterHoursRate,
        trend: parseTrend(rawMetrics.get('teams_after_hours_rate')?.trend),
        hasData: afterHoursRate !== null,
      },
    ];

    // Calculate totals
    const totalContribution = latencyPoints + participationPoints + meetingsPoints + afterHoursPoints;
    const hasAnyData = responseLatency !== null || participationRate !== null || 
                       meetingsPerUser !== null || afterHoursRate !== null;

    // Find latest timestamp
    let lastUpdated: Date | null = null;
    for (const [, data] of rawMetrics) {
      const ts = new Date(data.timestamp);
      if (!lastUpdated || ts > lastUpdated) {
        lastUpdated = ts;
      }
    }

    return {
      totalContribution,
      maxPossible: WEIGHTS.maxTotal,
      percentage: (totalContribution / WEIGHTS.maxTotal) * 100,
      breakdown: {
        slack: slackBreakdown,
        teams: teamsBreakdown,
      },
      hasAnyData,
      lastUpdated,
    };
  }, [rawMetrics, isEnabled]);

  return {
    score,
    loading,
    error,
    isEnabled,
  };
}
