import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '../lib/supabase';

/**
 * ============================================================================
 * PHASE 11C: INTELLIGENCE CONTRACT FREEZE
 * ============================================================================
 * 
 * IMMUTABLE CONTRACT: Tier 0 Observational Intelligence
 * 
 * This contract defines the foundational intelligence layer that MUST remain
 * stable and immutable. Any changes to this contract require explicit approval
 * and careful consideration of downstream impacts.
 * 
 * TIER 0 GUARANTEES:
 * 1. Observational data is read-only - Core314 NEVER modifies source systems
 * 2. Intelligence is derived from observed signals, not inferred behavior
 * 3. User-facing displays NEVER expose technical errors or failure states
 * 4. Admin-only views provide full technical transparency
 * 5. Freshness indicators use safe, non-alarming language only
 * 
 * PROTECTED INTERFACES:
 * - IntegrationIntelligence: Core metrics structure (immutable schema)
 * - IntegrationInsight: Insight delivery format (immutable schema)
 * - INTELLIGENCE_TOOLTIP_COPY: User-facing copy (trust-reinforcing only)
 * - FRESHNESS_DISPLAY_TEXT: Freshness labels (non-alarming only)
 * - TREND_FRAMING: Trend explanations (grounded, factual only)
 * 
 * MODIFICATION RESTRICTIONS:
 * - DO NOT add error/failure language to user-facing copy
 * - DO NOT expose timestamps or technical details to regular users
 * - DO NOT change the core metric normalization logic
 * - DO NOT remove or weaken admin visibility features
 * 
 * This contract was established in Phase 11 (Launch Readiness & Trust Hardening)
 * and represents the trust foundation of Core314's intelligence layer.
 * ============================================================================
 */

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
  // Phase 10A: Failure state tracking (internal use only - never expose to users)
  last_successful_run_at?: string | null;
  last_failed_run_at?: string | null;
  failure_reason?: string | null;
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
 * 
 * Phase 9.3: Updated for launch-grade UX - trustworthy, explainable, grounded
 */
export const INTELLIGENCE_TOOLTIP_COPY = {
  /** Standard tooltip for explaining intelligence data maturity */
  dataMaturity: 'Intelligence reflects real operational behavior. If activity is low or new, insights will appear as patterns form.',
  
  /** Tooltip for explaining what signals are */
  signals: 'Signals are data points Core314 observes from your connected integrations to generate insights.',
  
  /** Tooltip for explaining Fusion Score contribution - Phase 9.3 updated */
  fusionContribution: 'Fusion contribution reflects how much this integration influences your overall operational signal based on observed activity.',
  
  /** Data basis qualifier for insights */
  dataBasis: 'Based on recent observed activity',
  
  /** Aggregated signals qualifier */
  aggregatedSignals: 'Derived from aggregated signals',
  
  /** Phase 11A: Fusion Score confidence framing - reinforces trust, not uncertainty */
  fusionScoreConfidence: 'Your Fusion Score reflects available operational signals from connected systems. It updates automatically as your tools generate activity.',
  
  /** Phase 11A: Fusion Score confidence subtext for display */
  fusionScoreSubtext: 'Reflects operational signals from connected systems',
} as const;

/**
 * Phase 11A: Intelligence Freshness Indicator
 * 
 * Returns a user-friendly freshness label based on last_successful_run_at.
 * NEVER shows "failed", "error", "outdated", or timestamps to users.
 * 
 * Labels:
 * - "Updated recently" - last success within 1 hour
 * - "Analyzing new activity" - last success within 24 hours or no data yet
 * 
 * @returns A safe, non-alarming freshness label for UI display
 */
export function getIntelligenceFreshnessLabel(
  intelligence: IntegrationIntelligence | null
): 'updated_recently' | 'analyzing' {
  if (!intelligence) return 'analyzing';
  
  const lastSuccess = intelligence.last_successful_run_at 
    ? new Date(intelligence.last_successful_run_at) 
    : null;
  
  if (!lastSuccess) return 'analyzing';
  
  const now = new Date();
  const diffMs = now.getTime() - lastSuccess.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  
  // Within 1 hour = "Updated recently"
  if (diffHours <= 1) return 'updated_recently';
  
  // Otherwise = "Analyzing new activity" (safe, non-alarming)
  return 'analyzing';
}

/**
 * Phase 11A: Get display text for freshness label
 * 
 * Maps freshness labels to user-friendly display text.
 * NEVER exposes technical details or timestamps.
 */
export const FRESHNESS_DISPLAY_TEXT = {
  updated_recently: 'Updated recently',
  analyzing: 'Analyzing new activity',
} as const;

/**
 * Phase 9.3: Trend framing explanatory subtext
 * Provides clear, grounded explanations for trend directions
 */
export const TREND_FRAMING = {
  stable: 'Activity levels have not meaningfully changed over the last observed period.',
  up: 'Activity has increased compared to the previous observed period.',
  down: 'Activity has decreased compared to the previous observed period.',
} as const;

/**
 * Get trend framing text for a given trend direction
 */
export function getTrendFramingText(trend: 'up' | 'down' | 'stable' | null | undefined): string {
  if (!trend) return TREND_FRAMING.stable;
  return TREND_FRAMING[trend] || TREND_FRAMING.stable;
}

/**
 * Static integration value data for Phase 9.2 - Integration Hub Value Clarity
 * 
 * Each integration has:
 * - valueSummary: 1-2 sentences explaining why this integration is useful in Core314
 * - signalsObserved: List of actual signals Core314 ingests from this integration
 */
export interface IntegrationValueData {
  valueSummary: string;
  signalsObserved: string[];
}

export const INTEGRATION_VALUE_DATA: Record<string, IntegrationValueData> = {
  // Communication Integrations
  slack: {
    valueSummary: 'Reveals communication patterns and team responsiveness. Helps Core314 understand how information flows and where coordination may slow down.',
    signalsObserved: [
      'Messages sent and received',
      'Channel activity volume',
      'Response times',
      'Active participation patterns',
    ],
  },
  microsoft_teams: {
    valueSummary: 'Tracks team collaboration across chats, channels, and meetings. Helps Core314 identify communication bottlenecks and engagement trends.',
    signalsObserved: [
      'Chat message activity',
      'Channel message volume',
      'Meeting frequency',
      'Last activity timestamps',
    ],
  },
  discord: {
    valueSummary: 'Monitors community and team communication patterns. Helps Core314 understand engagement levels and response dynamics.',
    signalsObserved: [
      'Message activity',
      'Channel participation',
      'Server engagement metrics',
    ],
  },

  // Meeting & Calendar Integrations
  zoom: {
    valueSummary: 'Measures meeting load and collaboration time. Helps Core314 assess whether meeting patterns support or hinder productivity.',
    signalsObserved: [
      'Meeting count',
      'Total meeting duration',
      'Participant counts',
      'Meeting frequency trends',
    ],
  },
  google_calendar: {
    valueSummary: 'Tracks scheduled events and meeting patterns. Helps Core314 understand time allocation and identify scheduling conflicts.',
    signalsObserved: [
      'Calendar events',
      'Meeting invitations',
      'Event duration',
      'Attendee counts',
    ],
  },
  gmeet: {
    valueSummary: 'Monitors Google Meet usage and participation. Helps Core314 track virtual collaboration patterns.',
    signalsObserved: [
      'Meeting occurrences',
      'Participant activity',
      'Meeting duration',
    ],
  },

  // Project Management Integrations
  jira: {
    valueSummary: 'Tracks issue lifecycle and project velocity. Helps Core314 identify workflow bottlenecks and team throughput.',
    signalsObserved: [
      'Issue counts by status',
      'Open vs in-progress vs done',
      'Project activity',
      'Last updated timestamps',
    ],
  },
  asana: {
    valueSummary: 'Monitors task completion and project progress. Helps Core314 understand workload distribution and delivery patterns.',
    signalsObserved: [
      'Task counts',
      'Completed vs incomplete tasks',
      'Project activity',
      'Task modifications',
    ],
  },
  trello: {
    valueSummary: 'Tracks board and card activity across projects. Helps Core314 visualize work-in-progress and completion rates.',
    signalsObserved: [
      'Board activity',
      'Card counts',
      'Open vs closed cards',
      'Last activity timestamps',
    ],
  },
  notion: {
    valueSummary: 'Monitors workspace activity and documentation updates. Helps Core314 track knowledge management and content creation.',
    signalsObserved: [
      'Page edits',
      'Database updates',
      'Workspace activity',
      'Last edited timestamps',
    ],
  },
  monday: {
    valueSummary: 'Tracks work items and board activity. Helps Core314 understand project flow and team workload.',
    signalsObserved: [
      'Item updates',
      'Board activity',
      'Status changes',
      'Assignment patterns',
    ],
  },
  clickup: {
    valueSummary: 'Monitors task and project activity. Helps Core314 assess team productivity and delivery cadence.',
    signalsObserved: [
      'Task updates',
      'Status transitions',
      'Project activity',
      'Time tracking data',
    ],
  },
  linear: {
    valueSummary: 'Tracks issue progress and sprint velocity. Helps Core314 understand engineering workflow efficiency.',
    signalsObserved: [
      'Issue counts',
      'Cycle progress',
      'Status changes',
      'Priority distributions',
    ],
  },
  basecamp: {
    valueSummary: 'Monitors project discussions and to-do progress. Helps Core314 track team coordination and deliverables.',
    signalsObserved: [
      'To-do completions',
      'Message activity',
      'Project updates',
      'Schedule events',
    ],
  },
  planner: {
    valueSummary: 'Tracks Microsoft Planner tasks and plans. Helps Core314 understand task distribution and completion rates.',
    signalsObserved: [
      'Task counts',
      'Plan activity',
      'Assignment changes',
      'Due date tracking',
    ],
  },
  smartsheet: {
    valueSummary: 'Monitors sheet updates and project tracking. Helps Core314 assess collaborative planning and execution.',
    signalsObserved: [
      'Sheet modifications',
      'Row updates',
      'Attachment activity',
      'Comment threads',
    ],
  },

  // Development Integrations
  github: {
    valueSummary: 'Tracks repository activity and code collaboration. Helps Core314 measure development velocity and code review patterns.',
    signalsObserved: [
      'Repository count',
      'Open issues',
      'Pull request activity',
      'Last commit timestamps',
    ],
  },
  gitlab: {
    valueSummary: 'Monitors repository and pipeline activity. Helps Core314 understand development workflow and CI/CD patterns.',
    signalsObserved: [
      'Project activity',
      'Merge request status',
      'Pipeline runs',
      'Issue tracking',
    ],
  },
  bitbucket: {
    valueSummary: 'Tracks repository and pull request activity. Helps Core314 assess code collaboration and review cycles.',
    signalsObserved: [
      'Repository updates',
      'Pull request activity',
      'Branch changes',
      'Commit patterns',
    ],
  },

  // Support & Customer Service Integrations
  zendesk: {
    valueSummary: 'Tracks support ticket lifecycle and resolution. Helps Core314 identify support load and response efficiency.',
    signalsObserved: [
      'Ticket counts',
      'Open vs pending vs solved',
      'Resolution times',
      'Ticket updates',
    ],
  },
  freshdesk: {
    valueSummary: 'Monitors support ticket activity and agent performance. Helps Core314 assess customer service efficiency.',
    signalsObserved: [
      'Ticket volume',
      'Status distributions',
      'Response metrics',
      'Agent activity',
    ],
  },
  intercom: {
    valueSummary: 'Tracks customer conversations and engagement. Helps Core314 understand support patterns and customer interaction.',
    signalsObserved: [
      'Conversation counts',
      'Response times',
      'User engagement',
      'Message activity',
    ],
  },
  servicenow: {
    valueSummary: 'Monitors IT service requests and incident management. Helps Core314 track operational efficiency and issue resolution.',
    signalsObserved: [
      'Incident counts',
      'Request status',
      'Resolution metrics',
      'Service activity',
    ],
  },

  // Design & Collaboration Integrations
  figma: {
    valueSummary: 'Tracks design file activity and collaboration. Helps Core314 understand design workflow and iteration patterns.',
    signalsObserved: [
      'File updates',
      'Comment activity',
      'Version history',
      'Collaboration events',
    ],
  },
  miro: {
    valueSummary: 'Monitors whiteboard activity and team brainstorming. Helps Core314 track visual collaboration and ideation.',
    signalsObserved: [
      'Board updates',
      'Widget activity',
      'Collaboration sessions',
      'Comment threads',
    ],
  },

  // Data & Documentation Integrations
  confluence: {
    valueSummary: 'Tracks documentation updates and knowledge sharing. Helps Core314 assess information flow and content creation.',
    signalsObserved: [
      'Page edits',
      'Space activity',
      'Comment threads',
      'Content creation',
    ],
  },
  airtable: {
    valueSummary: 'Monitors base and record activity. Helps Core314 track data management and collaborative workflows.',
    signalsObserved: [
      'Record updates',
      'Base activity',
      'View modifications',
      'Automation triggers',
    ],
  },
} as const;

/**
 * Get static value data for an integration by service name
 * Returns default values if integration is not in the mapping
 */
export function getIntegrationValueData(serviceName: string): IntegrationValueData {
  // Normalize service name (handle variations like "Slack" vs "slack")
  const normalizedName = serviceName.toLowerCase().replace(/\s+/g, '_');
  
  const data = INTEGRATION_VALUE_DATA[normalizedName];
  
  if (data) {
    return data;
  }
  
  // Default fallback for integrations not yet mapped
  return {
    valueSummary: 'Provides operational signals that contribute to your overall intelligence. Core314 analyzes activity patterns to generate insights.',
    signalsObserved: [
      'Activity events',
      'Usage patterns',
      'Engagement metrics',
    ],
  };
}

/**
 * Phase 10A: Check if an integration is in a failed state
 * 
 * UI Safety Contract: This function is for INTERNAL use only.
 * When an integration is failed, UI should:
 * - Show last known good data (preserved metrics)
 * - NOT show error messages, stack traces, or failure reasons
 * - NOT show partial or corrupted intelligence
 * 
 * @returns true if the integration has a recent failure (failure more recent than success)
 */
export function isIntegrationFailed(intelligence: IntegrationIntelligence | null): boolean {
  if (!intelligence) return false;
  if (!intelligence.failure_reason) return false;
  
  const lastSuccess = intelligence.last_successful_run_at 
    ? new Date(intelligence.last_successful_run_at) 
    : null;
  const lastFailed = intelligence.last_failed_run_at 
    ? new Date(intelligence.last_failed_run_at) 
    : null;
  
  // If failure is more recent than success (or no success), integration is failed
  if (!lastSuccess) return true;
  if (lastFailed && lastFailed >= lastSuccess) return true;
  
  return false;
}

/**
 * Phase 10A: Get safe display status for an integration
 * 
 * UI Safety Contract: This function returns user-friendly status text
 * that NEVER exposes technical error details.
 * 
 * @returns A safe status string for UI display
 */
export function getIntegrationDisplayStatus(
  intelligence: IntegrationIntelligence | null
): 'active' | 'analyzing' | 'observing' {
  if (!intelligence) return 'observing';
  
  // If failed, show last known good state (don't indicate failure to user)
  if (isIntegrationFailed(intelligence)) {
    // Return 'analyzing' to indicate we're working on it without alarming user
    return 'analyzing';
  }
  
  // Check if we have meaningful data
  const hasActivity = intelligence.activity_volume > 0 || 
    intelligence.participation_level > 0 ||
    intelligence.responsiveness > 0 ||
    intelligence.throughput > 0;
  
  if (hasActivity) return 'active';
  
  // Zero data but not failed = still observing/analyzing
  return 'analyzing';
}
