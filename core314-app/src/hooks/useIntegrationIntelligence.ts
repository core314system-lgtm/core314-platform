import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '../lib/supabase';

/**
 * Universal Integration Intelligence Hook - Phase 8 UIIC
 * 
 * Provides access to normalized intelligence metrics and insights for any integration.
 * Every integration must expose:
 * - Normalized metrics (activity_volume, participation, responsiveness, throughput)
 * - Human-readable insights
 * - Fusion Score contribution
 * - Signals used for transparency
 */

export interface IntegrationIntelligence {
  service_name: string;
  activity_volume: number;
  participation_level: number;
  responsiveness: number;
  throughput: number;
  week_over_week_change: number;
  trend_direction: 'up' | 'down' | 'stable';
  anomaly_score: number;
  anomaly_detected: boolean;
  fusion_contribution: number;
  fusion_weight: number;
  raw_metrics: Record<string, number>;
  signals_used: string[];
  computed_at: string;
}

export interface IntegrationInsight {
  id: string;
  service_name: string;
  insight_key: string;
  insight_text: string;
  severity: 'info' | 'warning' | 'positive' | 'negative';
  confidence: number;
  metadata: Record<string, unknown>;
  computed_at: string;
}

export interface UseIntegrationIntelligenceResult {
  intelligence: IntegrationIntelligence | null;
  insights: IntegrationInsight[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export interface UseAllIntegrationIntelligenceResult {
  intelligenceMap: Record<string, IntegrationIntelligence>;
  insightsMap: Record<string, IntegrationInsight[]>;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to get intelligence data for a specific integration
 */
export function useIntegrationIntelligence(serviceName: string): UseIntegrationIntelligenceResult {
  const { profile } = useAuth();
  const [intelligence, setIntelligence] = useState<IntegrationIntelligence | null>(null);
  const [insights, setInsights] = useState<IntegrationInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!profile?.id || !serviceName) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch intelligence metrics
      const { data: intelligenceData, error: intError } = await supabase
        .from('integration_intelligence')
        .select('*')
        .eq('user_id', profile.id)
        .eq('service_name', serviceName)
        .order('computed_at', { ascending: false })
        .limit(1)
        .single();

      if (intError && intError.code !== 'PGRST116') {
        console.error('[useIntegrationIntelligence] Error fetching intelligence:', intError);
      }

      // Fetch insights
      const { data: insightsData, error: insError } = await supabase
        .from('integration_insights')
        .select('*')
        .eq('user_id', profile.id)
        .eq('service_name', serviceName)
        .order('computed_at', { ascending: false });

      if (insError) {
        console.error('[useIntegrationIntelligence] Error fetching insights:', insError);
      }

      setIntelligence(intelligenceData as IntegrationIntelligence | null);
      setInsights((insightsData as IntegrationInsight[]) || []);
    } catch (err) {
      console.error('[useIntegrationIntelligence] Error:', err);
      setError('Failed to load integration intelligence');
    } finally {
      setLoading(false);
    }
  }, [profile?.id, serviceName]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    intelligence,
    insights,
    loading,
    error,
    refetch: fetchData,
  };
}

/**
 * Hook to get intelligence data for ALL integrations at once
 * Useful for dashboard views that need to show all integration insights
 */
export function useAllIntegrationIntelligence(): UseAllIntegrationIntelligenceResult {
  const { profile } = useAuth();
  const [intelligenceMap, setIntelligenceMap] = useState<Record<string, IntegrationIntelligence>>({});
  const [insightsMap, setInsightsMap] = useState<Record<string, IntegrationInsight[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!profile?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch all intelligence metrics for this user
      const { data: intelligenceData, error: intError } = await supabase
        .from('integration_intelligence')
        .select('*')
        .eq('user_id', profile.id)
        .order('computed_at', { ascending: false });

      if (intError) {
        console.error('[useAllIntegrationIntelligence] Error fetching intelligence:', intError);
      }

      // Fetch all insights for this user
      const { data: insightsData, error: insError } = await supabase
        .from('integration_insights')
        .select('*')
        .eq('user_id', profile.id)
        .order('computed_at', { ascending: false });

      if (insError) {
        console.error('[useAllIntegrationIntelligence] Error fetching insights:', insError);
      }

      // Build maps keyed by service_name
      const intMap: Record<string, IntegrationIntelligence> = {};
      const insMap: Record<string, IntegrationInsight[]> = {};

      if (intelligenceData) {
        for (const item of intelligenceData as IntegrationIntelligence[]) {
          // Keep only the most recent entry per service
          if (!intMap[item.service_name]) {
            intMap[item.service_name] = item;
          }
        }
      }

      if (insightsData) {
        for (const item of insightsData as IntegrationInsight[]) {
          if (!insMap[item.service_name]) {
            insMap[item.service_name] = [];
          }
          insMap[item.service_name].push(item);
        }
      }

      setIntelligenceMap(intMap);
      setInsightsMap(insMap);
    } catch (err) {
      console.error('[useAllIntegrationIntelligence] Error:', err);
      setError('Failed to load integration intelligence');
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    intelligenceMap,
    insightsMap,
    loading,
    error,
    refetch: fetchData,
  };
}

/**
 * Get a summary of what an integration contributes to Core314
 */
export function getIntegrationValueSummary(
  intelligence: IntegrationIntelligence | null,
  insights: IntegrationInsight[]
): {
  whyItMatters: string;
  signalsContributed: string[];
  whatCore314IsLearning: string;
} {
  if (!intelligence) {
    return {
      whyItMatters: 'Waiting for data to analyze patterns',
      signalsContributed: [],
      whatCore314IsLearning: 'Connect and sync to start receiving insights',
    };
  }

  const signalsContributed = intelligence.signals_used || [];
  
  // Generate "why it matters" based on category and metrics
  let whyItMatters = '';
  const fusionPct = Math.round(intelligence.fusion_contribution);
  
  if (fusionPct > 20) {
    whyItMatters = `Major contributor to your Fusion Score (${fusionPct}% impact)`;
  } else if (fusionPct > 10) {
    whyItMatters = `Meaningful contributor to operational health (${fusionPct}% impact)`;
  } else {
    whyItMatters = `Provides supporting signals for holistic analysis`;
  }

  // Generate "what Core314 is learning" based on insights
  let whatCore314IsLearning = '';
  if (insights.length > 0) {
    const latestInsight = insights[0];
    whatCore314IsLearning = latestInsight.insight_text;
  } else if (intelligence.trend_direction === 'up') {
    whatCore314IsLearning = 'Activity is trending upward — monitoring for patterns';
  } else if (intelligence.trend_direction === 'down') {
    whatCore314IsLearning = 'Activity is trending downward — watching for impact';
  } else {
    whatCore314IsLearning = 'Establishing baseline patterns from your data';
  }

  return {
    whyItMatters,
    signalsContributed,
    whatCore314IsLearning,
  };
}

/**
 * Format signals for display
 */
export function formatSignals(signals: string[]): string {
  if (signals.length === 0) return 'No signals yet';
  
  const formatted = signals.map(s => 
    s.replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase())
  );
  
  if (formatted.length <= 3) {
    return formatted.join(', ');
  }
  
  return `${formatted.slice(0, 3).join(', ')} +${formatted.length - 3} more`;
}

/**
 * Get severity color for insights
 */
export function getInsightSeverityColor(severity: IntegrationInsight['severity']): string {
  switch (severity) {
    case 'positive':
      return 'text-green-600 dark:text-green-400';
    case 'warning':
      return 'text-amber-600 dark:text-amber-400';
    case 'negative':
      return 'text-red-600 dark:text-red-400';
    case 'info':
    default:
      return 'text-blue-600 dark:text-blue-400';
  }
}

/**
 * Get severity icon name for insights
 */
export function getInsightSeverityIcon(severity: IntegrationInsight['severity']): string {
  switch (severity) {
    case 'positive':
      return 'TrendingUp';
    case 'warning':
      return 'AlertTriangle';
    case 'negative':
      return 'AlertCircle';
    case 'info':
    default:
      return 'Info';
  }
}

/**
 * Reusable tooltip copy for intelligence clarification
 * Use this wherever clarification about intelligence data maturity is helpful
 */
export const INTELLIGENCE_TOOLTIP_COPY = {
  /** Standard tooltip for explaining intelligence data maturity */
  dataMaturity: 'Intelligence reflects real operational behavior. If activity is low or new, insights will appear as patterns form.',
  
  /** Tooltip for explaining what signals are */
  signals: 'Signals are data points Core314 observes from your connected integrations to generate insights.',
  
  /** Tooltip for explaining Fusion Score contribution */
  fusionContribution: 'This percentage represents how much this integration contributes to your overall Fusion Score.',
} as const;
