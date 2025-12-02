
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { withSentry, breadcrumb, handleSentryTest } from "../_shared/sentry.ts";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface BehavioralMetric {
  id: string;
  user_id: string | null;
  event_type: string;
  event_source: string;
  event_context: Record<string, any>;
  outcome_reference: string | null;
  behavior_score: number;
  created_at: string;
}

interface OptimizationEvent {
  id: string;
  optimization_action: string;
  efficiency_index: number;
  applied: boolean;
  created_at: string;
}

interface CorrelationResult {
  event_type: string;
  total_events: number;
  avg_behavior_score: number;
  correlated_outcomes: number;
  success_rate: number;
  avg_efficiency_impact: number;
  behavior_impact_score: number;
}

/**
 * Fetch recent behavioral metrics (last 7 days)
 */
async function fetchRecentBehavioralMetrics(): Promise<BehavioralMetric[]> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('fusion_behavioral_metrics')
    .select('*')
    .gte('created_at', sevenDaysAgo)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[BCE] Error fetching behavioral metrics:', error);
    throw new Error(`Failed to fetch behavioral metrics: ${error.message}`);
  }

  return (data || []) as BehavioralMetric[];
}

/**
 * Fetch optimization events for correlation
 */
async function fetchOptimizationEvents(): Promise<OptimizationEvent[]> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('fusion_optimization_events')
    .select('id, optimization_action, efficiency_index, applied, created_at')
    .gte('created_at', sevenDaysAgo)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[BCE] Error fetching optimization events:', error);
    throw new Error(`Failed to fetch optimization events: ${error.message}`);
  }

  return (data || []) as OptimizationEvent[];
}

/**
 * Correlate behavioral events with optimization outcomes
 */
function correlateBehaviorWithOutcomes(
  metrics: BehavioralMetric[],
  optimizations: OptimizationEvent[]
): CorrelationResult[] {
  const eventTypeGroups = new Map<string, BehavioralMetric[]>();

  for (const metric of metrics) {
    if (!eventTypeGroups.has(metric.event_type)) {
      eventTypeGroups.set(metric.event_type, []);
    }
    eventTypeGroups.get(metric.event_type)!.push(metric);
  }

  const correlations: CorrelationResult[] = [];

  for (const [event_type, events] of eventTypeGroups.entries()) {
    const total_events = events.length;

    const avg_behavior_score = events.reduce((sum, e) => sum + (e.behavior_score || 0), 0) / total_events;

    const correlated = events.filter(e => e.outcome_reference !== null);
    const correlated_outcomes = correlated.length;

    const successful_events = events.filter(e => (e.behavior_score || 0) >= 60);
    const success_rate = successful_events.length / total_events;

    let avg_efficiency_impact = 0;
    if (correlated_outcomes > 0) {
      const efficiencies = correlated
        .map(e => {
          const opt = optimizations.find(o => o.id === e.outcome_reference);
          return opt ? opt.efficiency_index : 0;
        })
        .filter(e => e > 0);

      avg_efficiency_impact = efficiencies.length > 0
        ? efficiencies.reduce((sum, e) => sum + e, 0) / efficiencies.length
        : 0;
    }

    const behavior_impact_score = 
      (avg_behavior_score * 0.4) +
      (success_rate * 100 * 0.3) +
      (avg_efficiency_impact * 0.3);

    correlations.push({
      event_type,
      total_events,
      avg_behavior_score: parseFloat(avg_behavior_score.toFixed(2)),
      correlated_outcomes,
      success_rate: parseFloat((success_rate * 100).toFixed(2)),
      avg_efficiency_impact: parseFloat(avg_efficiency_impact.toFixed(2)),
      behavior_impact_score: parseFloat(behavior_impact_score.toFixed(2)),
    });

    console.log(`[BCE] Correlation for ${event_type}:`, {
      total_events,
      avg_behavior_score: avg_behavior_score.toFixed(2),
      correlated_outcomes,
      success_rate: (success_rate * 100).toFixed(2) + '%',
      behavior_impact_score: behavior_impact_score.toFixed(2),
    });
  }

  return correlations.sort((a, b) => b.behavior_impact_score - a.behavior_impact_score);
}

/**
 * Update behavioral metrics with recalculated scores based on correlations
 */
async function updateBehavioralScores(
  metrics: BehavioralMetric[],
  correlations: CorrelationResult[]
): Promise<number> {
  let updated = 0;

  for (const correlation of correlations) {
    const eventsToUpdate = metrics.filter(m => m.event_type === correlation.event_type);

    for (const event of eventsToUpdate) {
      const original_score = event.behavior_score || 50;
      const correlation_adjustment = (correlation.behavior_impact_score - 50) * 0.2; // 20% weight
      const new_score = Math.max(0, Math.min(100, original_score + correlation_adjustment));

      if (Math.abs(new_score - original_score) > 5) {
        const { error } = await supabase
          .from('fusion_behavioral_metrics')
          .update({ behavior_score: new_score })
          .eq('id', event.id);

        if (error) {
          console.error(`[BCE] Error updating metric ${event.id}:`, error);
        } else {
          updated++;
        }
      }
    }
  }

  return updated;
}

/**
 * Main handler for behavioral correlation engine
 */
serve(withSentry(async (req) => {
  const testResponse = await handleSentryTest(req);
  if (testResponse) return testResponse;

  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    console.log('[BCE] Behavioral Correlation Engine invoked');

    const metrics = await fetchRecentBehavioralMetrics();
    console.log(`[BCE] Fetched ${metrics.length} behavioral metrics from last 7 days`);

    if (metrics.length === 0) {
      return new Response(
        JSON.stringify({
          status: 'success',
          message: 'No behavioral metrics to analyze',
          correlations: [],
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    const optimizations = await fetchOptimizationEvents();
    console.log(`[BCE] Fetched ${optimizations.length} optimization events`);

    const correlations = correlateBehaviorWithOutcomes(metrics, optimizations);
    console.log(`[BCE] Generated ${correlations.length} correlation insights`);

    const updated = await updateBehavioralScores(metrics, correlations);
    console.log(`[BCE] Updated ${updated} behavioral metric scores`);

    const overall_impact_score = correlations.length > 0
      ? correlations.reduce((sum, c) => sum + c.behavior_impact_score, 0) / correlations.length
      : 0;

    return new Response(
      JSON.stringify({
        status: 'success',
        message: 'Behavioral correlation analysis complete',
        summary: {
          total_metrics_analyzed: metrics.length,
          total_optimizations: optimizations.length,
          correlation_insights: correlations.length,
          scores_updated: updated,
          overall_behavior_impact_score: parseFloat(overall_impact_score.toFixed(2)),
        },
        correlations,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );

  } catch (error) {
    console.error('[BCE] Error:', error);
    return new Response(
      JSON.stringify({
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
}), { name: "behavioral-correlation-engine" }));