import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './useAuth';
import { useIntelligenceDashboard } from './useIntelligenceDashboard';
import { supabase } from '../lib/supabase';

/**
 * Core Beta Insights - Phase 9.1
 * 
 * Implements 3 read-only, Tier 0 "Aha" insights that appear on the dashboard
 * within 24-48 hours of data ingestion. No automation, no actions, no messaging.
 * 
 * INSIGHTS:
 * 1. Response Drag - Detects when response times increase by day-of-week
 * 2. Meeting Load vs Responsiveness - Correlates high meeting weeks with response degradation
 * 3. Execution Bottleneck - Detects PR/issue cycle time patterns (currently dormant - no data)
 * 
 * THRESHOLDS:
 * - Response Drag: >25% increase in response time, minimum 5 data points
 * - Meeting Load: 6+ meetings correlates with >15% response time increase
 * - Execution Bottleneck: >1.5x delay for late-day PRs (not implemented - no data)
 * 
 * All insights are hidden if confidence threshold is not met.
 */

export interface CoreInsight {
  key: 'response_drag' | 'meeting_load_vs_responsiveness' | 'execution_bottleneck';
  message: string;
  confidence: number;
  metadata: Record<string, unknown>;
}

export interface UseCoreInsightsResult {
  insights: CoreInsight[];
  loading: boolean;
  error: string | null;
  isEnabled: boolean;
}

// Minimum data points required for each insight
const MIN_DATA_POINTS = {
  response_drag: 5,
  meeting_load: 4, // At least 4 weeks of data
  execution_bottleneck: 30, // PRs needed (not implemented)
};

// Threshold percentages for triggering insights
const THRESHOLDS = {
  response_drag_pct: 25, // 25% increase triggers insight
  meeting_load_threshold: 6, // 6+ meetings = high load
  meeting_load_response_pct: 15, // 15% response degradation
  execution_bottleneck_multiplier: 1.5, // 1.5x delay
};

interface TelemetryMetric {
  metric_name: string;
  metric_value: number;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

/**
 * Hook to compute and display Core Beta Insights.
 * Only active when Intelligence Dashboard feature flag is ON.
 * Logs shown insights to user_insight_logs for internal validation.
 */
export function useCoreInsights(): UseCoreInsightsResult {
  const { profile } = useAuth();
  const { isIntelligenceDashboardEnabled: isEnabled } = useIntelligenceDashboard();
  const [insights, setInsights] = useState<CoreInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoggedRef = useRef(false);
  const previousInsightKeysRef = useRef<string>('');

  const logInsights = useCallback(async (insightsToLog: CoreInsight[]) => {
    if (!profile?.id || insightsToLog.length === 0) return;

    try {
      const insightLogs = insightsToLog.map(insight => ({
        user_id: profile.id,
        insight_key: insight.key,
        shown_at: new Date().toISOString(),
        metadata: {
          message: insight.message,
          confidence: insight.confidence,
          ...insight.metadata,
        },
      }));

      const { error: insertError } = await supabase
        .from('user_insight_logs')
        .insert(insightLogs);

      if (insertError) {
        console.error('[useCoreInsights] Error logging insights:', insertError);
      } else {
        console.log('[useCoreInsights] Logged insights:', insightsToLog.map(i => i.key));
      }
    } catch (err) {
      console.error('[useCoreInsights] Error logging insights:', err);
    }
  }, [profile?.id]);

  useEffect(() => {
    const computeInsights = async () => {
      if (!isEnabled) {
        setInsights([]);
        setLoading(false);
        return;
      }

      if (!profile?.id) {
        setInsights([]);
        setLoading(false);
        return;
      }

      try {
        // Fetch telemetry metrics for the last 30 days
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        
        const { data: metrics, error: fetchError } = await supabase
          .from('telemetry_metrics')
          .select('metric_name, metric_value, timestamp, metadata')
          .eq('user_id', profile.id)
          .gte('timestamp', thirtyDaysAgo)
          .in('metric_name', [
            'slack_response_latency_median',
            'teams_meetings_per_user',
            'slack_active_participation_rate',
          ])
          .order('timestamp', { ascending: true });

        if (fetchError) {
          console.error('[useCoreInsights] Error fetching metrics:', fetchError);
          setError('Failed to load insights data');
          setInsights([]);
          setLoading(false);
          return;
        }

        const computedInsights: CoreInsight[] = [];

        // Compute Insight 1: Response Drag
        const responseDragInsight = computeResponseDrag(metrics || []);
        if (responseDragInsight) {
          computedInsights.push(responseDragInsight);
        }

        // Compute Insight 2: Meeting Load vs Responsiveness
        const meetingLoadInsight = computeMeetingLoadVsResponsiveness(metrics || []);
        if (meetingLoadInsight) {
          computedInsights.push(meetingLoadInsight);
        }

        // Insight 3: Execution Bottleneck - currently dormant (no PR/issue cycle time data)
        // The plumbing is here but will return null until data is available
        const executionInsight = computeExecutionBottleneck();
        if (executionInsight) {
          computedInsights.push(executionInsight);
        }

        setInsights(computedInsights);

        // Log insights only when they change (not on every render)
        const currentKeys = computedInsights.map(i => i.key).sort().join(',');
        if (currentKeys !== previousInsightKeysRef.current && !hasLoggedRef.current) {
          hasLoggedRef.current = true;
          previousInsightKeysRef.current = currentKeys;
          await logInsights(computedInsights);
        }
      } catch (err) {
        console.error('[useCoreInsights] Error computing insights:', err);
        setError('An unexpected error occurred');
        setInsights([]);
      } finally {
        setLoading(false);
      }
    };

    computeInsights();
  }, [profile?.id, isEnabled, logInsights]);

  return {
    insights,
    loading,
    error,
    isEnabled,
  };
}

/**
 * Insight 1: Response Drag
 * Detects when response times increase significantly by day-of-week.
 * 
 * Logic:
 * - Group response latency by day of week
 * - Compare Friday/late-week to early-week baseline
 * - Trigger if >25% increase detected
 */
function computeResponseDrag(metrics: TelemetryMetric[]): CoreInsight | null {
  const responseMetrics = metrics.filter(m => m.metric_name === 'slack_response_latency_median');
  
  if (responseMetrics.length < MIN_DATA_POINTS.response_drag) {
    return null;
  }

  // Group by day of week (0 = Sunday, 5 = Friday)
  const byDayOfWeek: Record<number, number[]> = {};
  for (const metric of responseMetrics) {
    const dayOfWeek = new Date(metric.timestamp).getDay();
    if (!byDayOfWeek[dayOfWeek]) {
      byDayOfWeek[dayOfWeek] = [];
    }
    byDayOfWeek[dayOfWeek].push(metric.metric_value);
  }

  // Calculate average for each day
  const avgByDay: Record<number, number> = {};
  for (const [day, values] of Object.entries(byDayOfWeek)) {
    avgByDay[Number(day)] = values.reduce((a, b) => a + b, 0) / values.length;
  }

  // Calculate early-week baseline (Mon-Wed: days 1-3)
  const earlyWeekDays = [1, 2, 3];
  const earlyWeekAvgs = earlyWeekDays
    .filter(d => avgByDay[d] !== undefined)
    .map(d => avgByDay[d]);
  
  if (earlyWeekAvgs.length === 0) {
    return null;
  }
  
  const earlyWeekBaseline = earlyWeekAvgs.reduce((a, b) => a + b, 0) / earlyWeekAvgs.length;

  // Check Friday (day 5) for significant increase
  const fridayAvg = avgByDay[5];
  if (fridayAvg === undefined || earlyWeekBaseline === 0) {
    return null;
  }

  const percentIncrease = ((fridayAvg - earlyWeekBaseline) / earlyWeekBaseline) * 100;

  if (percentIncrease >= THRESHOLDS.response_drag_pct) {
    // Also check if there's a pattern of late-day degradation
    const thursdayAvg = avgByDay[4];
    const lateWeekPattern = thursdayAvg !== undefined && thursdayAvg > earlyWeekBaseline;

    const message = lateWeekPattern
      ? `Your team's average response time increases ${Math.round(percentIncrease)}% later in the week, especially on Fridays.`
      : `Your team's average response time increases ${Math.round(percentIncrease)}% on Fridays compared to early week.`;

    return {
      key: 'response_drag',
      message,
      confidence: Math.min(0.9, 0.5 + (responseMetrics.length / 20) * 0.4),
      metadata: {
        percent_increase: Math.round(percentIncrease),
        early_week_baseline_minutes: Math.round(earlyWeekBaseline),
        friday_avg_minutes: Math.round(fridayAvg),
        sample_size: responseMetrics.length,
      },
    };
  }

  return null;
}

/**
 * Insight 2: Meeting Load vs Responsiveness
 * Correlates high meeting weeks with response time degradation.
 * 
 * Logic:
 * - Group metrics by week
 * - Identify high-load weeks (6+ meetings per person)
 * - Compare response times between high-load and normal weeks
 * - Trigger if >15% degradation in high-load weeks
 */
function computeMeetingLoadVsResponsiveness(metrics: TelemetryMetric[]): CoreInsight | null {
  const meetingMetrics = metrics.filter(m => m.metric_name === 'teams_meetings_per_user');
  const responseMetrics = metrics.filter(m => m.metric_name === 'slack_response_latency_median');

  if (meetingMetrics.length < MIN_DATA_POINTS.meeting_load || responseMetrics.length < MIN_DATA_POINTS.meeting_load) {
    return null;
  }

  // Group by week (ISO week number)
  const getWeekKey = (timestamp: string): string => {
    const date = new Date(timestamp);
    const startOfYear = new Date(date.getFullYear(), 0, 1);
    const weekNumber = Math.ceil(((date.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
    return `${date.getFullYear()}-W${weekNumber}`;
  };

  // Build weekly meeting load map
  const weeklyMeetings: Record<string, number[]> = {};
  for (const metric of meetingMetrics) {
    const weekKey = getWeekKey(metric.timestamp);
    if (!weeklyMeetings[weekKey]) {
      weeklyMeetings[weekKey] = [];
    }
    weeklyMeetings[weekKey].push(metric.metric_value);
  }

  // Build weekly response time map
  const weeklyResponse: Record<string, number[]> = {};
  for (const metric of responseMetrics) {
    const weekKey = getWeekKey(metric.timestamp);
    if (!weeklyResponse[weekKey]) {
      weeklyResponse[weekKey] = [];
    }
    weeklyResponse[weekKey].push(metric.metric_value);
  }

  // Calculate averages per week
  const weeklyAvgMeetings: Record<string, number> = {};
  const weeklyAvgResponse: Record<string, number> = {};

  for (const [week, values] of Object.entries(weeklyMeetings)) {
    weeklyAvgMeetings[week] = values.reduce((a, b) => a + b, 0) / values.length;
  }

  for (const [week, values] of Object.entries(weeklyResponse)) {
    weeklyAvgResponse[week] = values.reduce((a, b) => a + b, 0) / values.length;
  }

  // Separate into high-load and normal weeks
  const highLoadWeeks: string[] = [];
  const normalWeeks: string[] = [];

  for (const week of Object.keys(weeklyAvgMeetings)) {
    if (weeklyAvgResponse[week] !== undefined) {
      if (weeklyAvgMeetings[week] >= THRESHOLDS.meeting_load_threshold) {
        highLoadWeeks.push(week);
      } else {
        normalWeeks.push(week);
      }
    }
  }

  if (highLoadWeeks.length < 2 || normalWeeks.length < 2) {
    return null;
  }

  // Calculate average response time for each bucket
  const highLoadResponseAvg = highLoadWeeks
    .map(w => weeklyAvgResponse[w])
    .reduce((a, b) => a + b, 0) / highLoadWeeks.length;

  const normalResponseAvg = normalWeeks
    .map(w => weeklyAvgResponse[w])
    .reduce((a, b) => a + b, 0) / normalWeeks.length;

  if (normalResponseAvg === 0) {
    return null;
  }

  const percentDegradation = ((highLoadResponseAvg - normalResponseAvg) / normalResponseAvg) * 100;

  if (percentDegradation >= THRESHOLDS.meeting_load_response_pct) {
    return {
      key: 'meeting_load_vs_responsiveness',
      message: `Weeks with ${THRESHOLDS.meeting_load_threshold}+ meetings per person correlate with a ${Math.round(percentDegradation)}% drop in message responsiveness.`,
      confidence: Math.min(0.85, 0.4 + (highLoadWeeks.length + normalWeeks.length) / 16 * 0.45),
      metadata: {
        percent_degradation: Math.round(percentDegradation),
        high_load_weeks: highLoadWeeks.length,
        normal_weeks: normalWeeks.length,
        high_load_response_avg_minutes: Math.round(highLoadResponseAvg),
        normal_response_avg_minutes: Math.round(normalResponseAvg),
        meeting_threshold: THRESHOLDS.meeting_load_threshold,
      },
    };
  }

  return null;
}

/**
 * Insight 3: Execution Bottleneck
 * Detects when PRs/issues created at certain times take longer to complete.
 * 
 * CURRENTLY DORMANT: No PR/issue cycle time data available in the system.
 * The GitHub/Jira poll functions only store aggregate counts, not timestamps.
 * 
 * This function is implemented as a placeholder that will return null
 * until the data infrastructure is enhanced to support cycle time analysis.
 */
function computeExecutionBottleneck(): CoreInsight | null {
  // Currently no PR/issue cycle time data available
  // GitHub/Jira poll functions only store aggregate counts:
  // - github: repo_count, open_issues, open_pull_requests
  // - jira: issue_count, open_issues, in_progress_issues, done_issues
  // 
  // To implement this insight, we would need:
  // - PR/issue creation timestamps
  // - PR/issue completion/merge timestamps
  // - Ability to calculate cycle time per item
  //
  // Returning null to honor "hide insights if confidence threshold not met"
  return null;
}
