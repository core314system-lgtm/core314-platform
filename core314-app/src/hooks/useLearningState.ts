import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '../lib/supabase';
import { IntegrationWithScore, FusionScore, FusionScoreHistory, FusionMetric } from '../types';

/**
 * Learning State Hook - Phase: Learning Transparency & Proof Layer
 * 
 * Provides derived learning state per integration/metric from existing system signals.
 * All fields are DERIVED ONLY - no new persistence, fully deterministic and reproducible.
 * 
 * HARD CONSTRAINTS:
 * - Uses existing score_origin, variance, confidence, and snapshots
 * - No new persistence unless strictly required
 * - Must be reproducible deterministically
 * - No probabilistic language
 * - No recommendations
 */

// Variance trend enum
export type VarianceTrend = 'increasing' | 'decreasing' | 'stable';

// Maturity stage enum - maps to existing tier system
export type MaturityStage = 'observe' | 'analyze' | 'predict';

// Learning velocity enum
export type LearningVelocity = 'low' | 'medium' | 'high';

// Learning event types
export type LearningEventType = 
  | 'BASELINE_ESTABLISHED'
  | 'CONFIDENCE_INCREASED'
  | 'CONFIDENCE_DECREASED'
  | 'VARIANCE_STABILIZED'
  | 'MATURITY_PROMOTED'
  | 'ANOMALY_PATTERN_LEARNED';

/**
 * Derived Learning State per integration
 * All fields computed from existing data - no new storage
 */
export interface LearningState {
  integration_id: string;
  integration_name: string;
  baseline_established_at: string | null;
  snapshot_count: number;
  confidence_current: number;
  confidence_delta_30: number;
  variance_current: number;
  variance_trend: VarianceTrend;
  maturity_stage: MaturityStage;
  learning_velocity: LearningVelocity;
  last_promotion_event: string | null;
  suppression_events_count: number;
}

/**
 * Learning Event - read-only event from historical data
 */
export interface LearningEvent {
  id: string;
  event_type: LearningEventType;
  occurred_at: string;
  explanation: string;
  integration_id?: string;
  integration_name?: string;
}

/**
 * Global Learning Summary
 */
export interface GlobalLearningSummary {
  total_integrations: number;
  integrations_with_baseline: number;
  total_snapshot_count: number;
  average_confidence: number;
  overall_maturity_stage: MaturityStage;
  learning_in_progress: boolean;
  confidence_explanation: string;
}

export interface UseLearningStateResult {
  learningStates: LearningState[];
  learningEvents: LearningEvent[];
  globalSummary: GlobalLearningSummary;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Derive variance from score history
 */
function calculateVariance(scores: number[]): number {
  if (scores.length < 2) return 0;
  const mean = scores.reduce((sum, s) => sum + s, 0) / scores.length;
  const squaredDiffs = scores.map(s => Math.pow(s - mean, 2));
  return squaredDiffs.reduce((sum, d) => sum + d, 0) / scores.length;
}

/**
 * Derive variance trend from historical variance values
 */
function deriveVarianceTrend(recentVariance: number, olderVariance: number): VarianceTrend {
  const threshold = 2; // Minimum difference to consider a trend
  if (recentVariance < olderVariance - threshold) return 'decreasing';
  if (recentVariance > olderVariance + threshold) return 'increasing';
  return 'stable';
}

/**
 * Derive maturity stage from score_origin and data sufficiency
 */
function deriveMaturityStage(
  scoreOrigin: 'baseline' | 'computed' | undefined,
  snapshotCount: number,
  varianceLevel: number,
  confidenceLevel: number
): MaturityStage {
  // Baseline = Observe tier
  if (scoreOrigin === 'baseline' || snapshotCount < 5) {
    return 'observe';
  }
  
  // Computed with high confidence and low variance = Predict ready
  if (confidenceLevel >= 0.7 && varianceLevel < 10 && snapshotCount >= 14) {
    return 'predict';
  }
  
  // Computed = Analyze tier
  return 'analyze';
}

/**
 * Derive learning velocity from snapshot frequency and confidence growth
 */
function deriveLearningVelocity(
  snapshotCount: number,
  daysSinceBaseline: number,
  confidenceDelta: number
): LearningVelocity {
  if (daysSinceBaseline === 0) return 'low';
  
  const snapshotsPerDay = snapshotCount / daysSinceBaseline;
  
  // High velocity: frequent snapshots AND positive confidence growth
  if (snapshotsPerDay >= 2 && confidenceDelta > 0.1) return 'high';
  
  // Medium velocity: moderate activity
  if (snapshotsPerDay >= 0.5 || confidenceDelta > 0) return 'medium';
  
  return 'low';
}

/**
 * Derive confidence from data sufficiency signals
 */
function deriveConfidence(
  snapshotCount: number,
  metricsCount: number,
  varianceLevel: number,
  hasScore: boolean
): number {
  let confidence = 0;
  
  // Snapshot count contribution (0-0.3)
  if (snapshotCount >= 14) confidence += 0.3;
  else if (snapshotCount >= 7) confidence += 0.2;
  else if (snapshotCount >= 3) confidence += 0.1;
  
  // Metrics count contribution (0-0.3)
  if (metricsCount >= 20) confidence += 0.3;
  else if (metricsCount >= 10) confidence += 0.2;
  else if (metricsCount >= 3) confidence += 0.1;
  
  // Low variance contribution (0-0.2)
  if (varianceLevel < 5) confidence += 0.2;
  else if (varianceLevel < 15) confidence += 0.1;
  
  // Has computed score contribution (0-0.2)
  if (hasScore) confidence += 0.2;
  
  return Math.min(confidence, 1);
}

/**
 * Generate learning events from historical data
 */
function generateLearningEvents(
  integrations: IntegrationWithScore[],
  scoreHistory: Map<string, FusionScoreHistory[]>,
  metricsMap: Map<string, FusionMetric[]>
): LearningEvent[] {
  const events: LearningEvent[] = [];
  let eventId = 1;
  
  for (const integration of integrations) {
    const history = scoreHistory.get(integration.id) || [];
    const metrics = metricsMap.get(integration.id) || [];
    
    // BASELINE_ESTABLISHED event
    if (history.length > 0) {
      const firstScore = history[history.length - 1]; // Oldest score
      events.push({
        id: `event-${eventId++}`,
        event_type: 'BASELINE_ESTABLISHED',
        occurred_at: firstScore.recorded_at,
        explanation: `Baseline established for ${integration.integration_name} after ${metrics.length} observations.`,
        integration_id: integration.id,
        integration_name: integration.integration_name,
      });
    }
    
    // CONFIDENCE_INCREASED / CONFIDENCE_DECREASED events
    if (history.length >= 2) {
      const recentScores = history.slice(0, Math.min(7, history.length));
      const olderScores = history.slice(Math.min(7, history.length));
      
            if (olderScores.length > 0) {
              const recentVariance = calculateVariance(recentScores.map(s => s.fusion_score));
              const olderVariance = calculateVariance(olderScores.map(s => s.fusion_score));
        
        // Confidence increased if variance decreased significantly
        if (recentVariance < olderVariance * 0.7) {
          events.push({
            id: `event-${eventId++}`,
            event_type: 'CONFIDENCE_INCREASED',
                        occurred_at: recentScores[0].recorded_at,
                        explanation: `Confidence increased for ${integration.integration_name} as variance declined from ${olderVariance.toFixed(1)} to ${recentVariance.toFixed(1)}.`,
            integration_id: integration.id,
            integration_name: integration.integration_name,
          });
        } else if (recentVariance > olderVariance * 1.3) {
          events.push({
            id: `event-${eventId++}`,
            event_type: 'CONFIDENCE_DECREASED',
                        occurred_at: recentScores[0].recorded_at,
                        explanation: `Confidence decreased for ${integration.integration_name} as variance increased from ${olderVariance.toFixed(1)} to ${recentVariance.toFixed(1)}.`,
            integration_id: integration.id,
            integration_name: integration.integration_name,
          });
        }
        
        // VARIANCE_STABILIZED event
        if (recentVariance < 5 && olderVariance >= 5) {
          events.push({
            id: `event-${eventId++}`,
            event_type: 'VARIANCE_STABILIZED',
                        occurred_at: recentScores[0].recorded_at,
                        explanation: `Variance stabilized for ${integration.integration_name}. Patterns are now consistent.`,
            integration_id: integration.id,
            integration_name: integration.integration_name,
          });
        }
      }
    }
    
    // MATURITY_PROMOTED event - check if integration reached analyze or predict stage
    if (history.length >= 7 && integration.fusion_score !== undefined) {
      const variance = calculateVariance(history.slice(0, 7).map(s => s.fusion_score));
      if (variance < 10) {
        events.push({
          id: `event-${eventId++}`,
          event_type: 'MATURITY_PROMOTED',
                    occurred_at: history[0].recorded_at,
                    explanation: `${integration.integration_name} reached analysis readiness after stability window met.`,
          integration_id: integration.id,
          integration_name: integration.integration_name,
        });
      }
    }
    
    // ANOMALY_PATTERN_LEARNED event - if we have anomaly detection data
    if (history.length >= 14) {
      const scores = history.map(s => s.fusion_score);
      const mean = scores.reduce((sum, s) => sum + s, 0) / scores.length;
      const stdDev = Math.sqrt(calculateVariance(scores));
      
      // Check if there were anomalies that the system learned from
      const anomalies = scores.filter(s => Math.abs(s - mean) > 2 * stdDev);
      if (anomalies.length > 0 && anomalies.length < scores.length * 0.2) {
        events.push({
          id: `event-${eventId++}`,
          event_type: 'ANOMALY_PATTERN_LEARNED',
                    occurred_at: history[0].recorded_at,
                    explanation: `${integration.integration_name}: ${anomalies.length} anomaly pattern${anomalies.length !== 1 ? 's' : ''} identified and incorporated into baseline.`,
          integration_id: integration.id,
          integration_name: integration.integration_name,
        });
      }
    }
  }
  
  // Sort events by date, most recent first
  events.sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());
  
  return events;
}

/**
 * Hook to get learning state for all integrations
 */
export function useLearningState(): UseLearningStateResult {
  const { profile } = useAuth();
  const [learningStates, setLearningStates] = useState<LearningState[]>([]);
  const [learningEvents, setLearningEvents] = useState<LearningEvent[]>([]);
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

      // Fetch user integrations
      const { data: userInts } = await supabase
        .from('user_integrations')
        .select(`
          id,
          integration_id,
          date_added,
          integrations_master (*)
        `)
        .eq('user_id', profile.id)
        .eq('status', 'active')
        .eq('added_by_user', true);

      if (!userInts || userInts.length === 0) {
        setLearningStates([]);
        setLearningEvents([]);
        setLoading(false);
        return;
      }

      // Fetch fusion scores for all integrations
      const { data: scores } = await supabase
        .from('fusion_scores')
        .select('*')
        .eq('user_id', profile.id);

      // Fetch fusion score history
      const { data: scoreHistory } = await supabase
        .from('fusion_score_history')
        .select('*')
        .eq('user_id', profile.id)
        .order('recorded_at', { ascending: false });

      // Fetch metrics for all integrations
      const { data: metrics } = await supabase
        .from('fusion_metrics')
        .select('*')
        .eq('user_id', profile.id);

            // Build maps for efficient lookup
            const scoreMap = new Map<string, FusionScore>();
            scores?.forEach(s => scoreMap.set(s.integration_id, s));

            const historyMap = new Map<string, FusionScoreHistory[]>();
            scoreHistory?.forEach(s => {
              const existing = historyMap.get(s.integration_id) || [];
              existing.push(s as FusionScoreHistory);
              historyMap.set(s.integration_id, existing);
            });

            const metricsMap = new Map<string, FusionMetric[]>();
      metrics?.forEach(m => {
        const existing = metricsMap.get(m.integration_id) || [];
        existing.push(m);
        metricsMap.set(m.integration_id, existing);
      });

      // Build integrations with scores for event generation
      const integrationsWithScores: IntegrationWithScore[] = userInts.map(ui => {
        const master = ui.integrations_master;
        const score = scoreMap.get(ui.integration_id);
        if (!master || typeof master !== 'object') return null;
        return {
          ...(master as unknown as Record<string, unknown>),
          fusion_score: score?.fusion_score,
          trend_direction: score?.trend_direction,
          metrics_count: metricsMap.get(ui.integration_id)?.length || 0,
        } as IntegrationWithScore;
      }).filter((i): i is IntegrationWithScore => i !== null);

      // Derive learning state for each integration
      const states: LearningState[] = userInts.map(ui => {
        const master = ui.integrations_master as unknown as Record<string, unknown> | null;
        if (!master) return null;

        const integrationId = ui.integration_id;
        const integrationName = master.integration_name as string || 'Unknown';
        const score = scoreMap.get(integrationId);
        const history = historyMap.get(integrationId) || [];
        const integrationMetrics = metricsMap.get(integrationId) || [];

        // Calculate snapshot count from history
        const snapshotCount = history.length;

        // Calculate variance from recent scores
        const recentScores = history.slice(0, Math.min(7, history.length)).map(s => s.fusion_score);
        const olderScores = history.slice(Math.min(7, history.length)).map(s => s.fusion_score);
        const varianceCurrent = calculateVariance(recentScores);
        const varianceOlder = calculateVariance(olderScores);
        const varianceTrend = deriveVarianceTrend(varianceCurrent, varianceOlder);

        // Derive confidence
        const confidenceCurrent = deriveConfidence(
          snapshotCount,
          integrationMetrics.length,
          varianceCurrent,
          score?.fusion_score !== undefined
        );

        // Calculate confidence delta (last 30 days approximation)
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const recentHistory = history.filter(h => new Date(h.recorded_at) > thirtyDaysAgo);
        const olderHistory = history.filter(h => new Date(h.recorded_at) <= thirtyDaysAgo);
        
        let confidenceDelta30 = 0;
        if (recentHistory.length > 0 && olderHistory.length > 0) {
          const recentConf = deriveConfidence(
            recentHistory.length,
            integrationMetrics.length,
            calculateVariance(recentHistory.map(h => h.fusion_score)),
            true
          );
          const olderConf = deriveConfidence(
            olderHistory.length,
            Math.floor(integrationMetrics.length * 0.7), // Approximate older metrics
            calculateVariance(olderHistory.map(h => h.fusion_score)),
            true
          );
          confidenceDelta30 = recentConf - olderConf;
        }

        // Derive maturity stage
        const scoreOrigin = score?.fusion_score !== undefined ? 'computed' : 'baseline';
        const maturityStage = deriveMaturityStage(
          scoreOrigin,
          snapshotCount,
          varianceCurrent,
          confidenceCurrent
        );

        // Calculate days since baseline
        const baselineDate = ui.date_added ? new Date(ui.date_added) : new Date();
        const daysSinceBaseline = Math.max(1, Math.floor((Date.now() - baselineDate.getTime()) / (24 * 60 * 60 * 1000)));

        // Derive learning velocity
        const learningVelocity = deriveLearningVelocity(
          snapshotCount,
          daysSinceBaseline,
          confidenceDelta30
        );

        // Find last promotion event (when maturity changed)
        let lastPromotionEvent: string | null = null;
        if (maturityStage !== 'observe' && history.length >= 7) {
          lastPromotionEvent = history[6]?.recorded_at || null;
        }

        // Count suppression events (anomalies that were filtered)
        const suppressionEventsCount = history.filter(h => {
          const scores = history.map(s => s.fusion_score);
          const mean = scores.reduce((sum, s) => sum + s, 0) / scores.length;
          const stdDev = Math.sqrt(calculateVariance(scores));
          return Math.abs(h.fusion_score - mean) > 2 * stdDev;
        }).length;

        return {
          integration_id: integrationId,
          integration_name: integrationName,
          baseline_established_at: ui.date_added || null,
          snapshot_count: snapshotCount,
          confidence_current: confidenceCurrent,
          confidence_delta_30: confidenceDelta30,
          variance_current: varianceCurrent,
          variance_trend: varianceTrend,
          maturity_stage: maturityStage,
          learning_velocity: learningVelocity,
          last_promotion_event: lastPromotionEvent,
          suppression_events_count: suppressionEventsCount,
        };
      }).filter((s): s is LearningState => s !== null);

      setLearningStates(states);

      // Generate learning events
      const events = generateLearningEvents(integrationsWithScores, historyMap, metricsMap);
      setLearningEvents(events);

    } catch (err) {
      console.error('[useLearningState] Error:', err);
      setError('Failed to load learning state');
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Compute global summary
  const globalSummary = useMemo((): GlobalLearningSummary => {
    if (learningStates.length === 0) {
      return {
        total_integrations: 0,
        integrations_with_baseline: 0,
        total_snapshot_count: 0,
        average_confidence: 0,
        overall_maturity_stage: 'observe',
        learning_in_progress: false,
        confidence_explanation: 'No integrations connected. Connect integrations to begin system learning.',
      };
    }

    const integrationsWithBaseline = learningStates.filter(s => s.baseline_established_at !== null).length;
    const totalSnapshots = learningStates.reduce((sum, s) => sum + s.snapshot_count, 0);
    const avgConfidence = learningStates.reduce((sum, s) => sum + s.confidence_current, 0) / learningStates.length;

    // Determine overall maturity stage
    const predictCount = learningStates.filter(s => s.maturity_stage === 'predict').length;
    const analyzeCount = learningStates.filter(s => s.maturity_stage === 'analyze').length;
    
    let overallStage: MaturityStage = 'observe';
    if (predictCount > learningStates.length / 2) {
      overallStage = 'predict';
    } else if (analyzeCount + predictCount > learningStates.length / 2) {
      overallStage = 'analyze';
    }

    // Determine if learning is in progress
    const learningInProgress = learningStates.some(s => 
      s.maturity_stage === 'observe' || s.confidence_current < 0.5
    );

    // Generate confidence explanation
    let confidenceExplanation: string;
    if (avgConfidence >= 0.7) {
      confidenceExplanation = `System confidence is high based on ${learningStates.length} connected integration${learningStates.length !== 1 ? 's' : ''} and ${totalSnapshots} observed signals.`;
    } else if (avgConfidence >= 0.4) {
      confidenceExplanation = `System confidence is building with ${learningStates.length} integration${learningStates.length !== 1 ? 's' : ''} and ${totalSnapshots} signals observed.`;
    } else {
      confidenceExplanation = `System confidence is establishing as Core314 accumulates behavioral data from ${learningStates.length} integration${learningStates.length !== 1 ? 's' : ''}.`;
    }

    return {
      total_integrations: learningStates.length,
      integrations_with_baseline: integrationsWithBaseline,
      total_snapshot_count: totalSnapshots,
      average_confidence: avgConfidence,
      overall_maturity_stage: overallStage,
      learning_in_progress: learningInProgress,
      confidence_explanation: confidenceExplanation,
    };
  }, [learningStates]);

  return {
    learningStates,
    learningEvents,
    globalSummary,
    loading,
    error,
    refetch: fetchData,
  };
}
