import { initSupabaseClient, getSupabaseFunctionUrl } from '../lib/supabase';
import { getTenantEntitlements, selectFusionContributors } from '../hooks/useEntitlements';

/**
 * ============================================================================
 * PHASE 11C: INTELLIGENCE CONTRACT FREEZE - FUSION ENGINE
 * PHASE 12: ENTITLEMENT-AWARE FUSION SCORE CALCULATION
 * ============================================================================
 * 
 * IMMUTABLE CONTRACT: Fusion Score Calculation
 * 
 * The Fusion Engine is a core component of Tier 0 Observational Intelligence.
 * This contract defines the calculation rules that MUST remain stable.
 * 
 * TIER 0 GUARANTEES (Fusion Engine):
 * 1. Fusion Score is derived from observed metrics only - no inferred data
 * 2. Failed integrations are EXCLUDED from score calculation (Phase 10A)
 * 3. Score changes are gradual and explainable
 * 4. User-facing score displays NEVER show technical calculation details
 * 
 * PROTECTED CALCULATIONS:
 * - calculateFusionScore: Core scoring algorithm (immutable logic)
 * - normalizeMetric: Metric normalization (immutable formula)
 * - DEFAULT_WEIGHTS: Base weight distribution (stable defaults)
 * 
 * MODIFICATION RESTRICTIONS:
 * - DO NOT change scoring formula without explicit approval
 * - DO NOT include failed integrations in score calculation
 * - DO NOT expose calculation internals to regular users
 * - DO NOT remove Phase 10A failure exclusion logic
 * 
 * This contract was established in Phase 11 (Launch Readiness & Trust Hardening)
 * and represents the trust foundation of Core314's Fusion Score system.
 * ============================================================================
 */

interface MetricWeights {
  count: number;
  sum: number;
  average: number;
  percentage: number;
  trend: number;
}

const DEFAULT_WEIGHTS: MetricWeights = {
  count: 0.2,
  sum: 0.3,
  average: 0.25,
  percentage: 0.15,
  trend: 0.1,
};

const INTEGRATION_CATEGORIES: Record<string, string> = {
  'quickbooks': 'Finance',
  'slack': 'Communications',
  'microsoft_teams': 'Communications',
  'microsoft_365': 'Productivity',
  'outlook': 'Communications',
  'gmail': 'Communications',
  'trello': 'Productivity',
  'sendgrid': 'Communications'
};

export async function normalizeMetric(
  _metricType: string,
  rawValue: number,
  historicalData?: number[]
): Promise<number> {
  if (!historicalData || historicalData.length === 0) {
    return Math.min(rawValue / 100, 1);
  }

  const min = Math.min(...historicalData);
  const max = Math.max(...historicalData);
  
  if (max === min) return 0.5;
  
  return (rawValue - min) / (max - min);
}

export async function calculateFusionScore(
  userId: string,
  integrationId: string
): Promise<{ score: number; breakdown: Record<string, number>; trend: 'up' | 'down' | 'stable'; excluded?: boolean }> {
  const supabase = await initSupabaseClient();

  // Phase 10A: Check if integration has a failure state
  // Integrations with failure_reason are excluded from Fusion Score calculation
  const { data: intelligenceState } = await supabase
    .from('integration_intelligence')
    .select('failure_reason, last_successful_run_at, last_failed_run_at')
    .eq('user_id', userId)
    .eq('integration_id', integrationId)
    .single();

  // Phase 10A: Exclude failed integrations from Fusion Score
  // A failed integration has failure_reason set and last_failed_run_at >= last_successful_run_at
  if (intelligenceState?.failure_reason) {
    const lastSuccess = intelligenceState.last_successful_run_at ? new Date(intelligenceState.last_successful_run_at) : null;
    const lastFailed = intelligenceState.last_failed_run_at ? new Date(intelligenceState.last_failed_run_at) : null;
    
    // If failure is more recent than success (or no success), exclude from calculation
    if (!lastSuccess || (lastFailed && lastFailed >= lastSuccess)) {
      console.log(`[FusionScore] Excluding integration ${integrationId} due to failure: ${intelligenceState.failure_reason}`);
      return { score: 0, breakdown: {}, trend: 'stable', excluded: true };
    }
  }

  const { data: metrics, error } = await supabase
    .from('fusion_metrics')
    .select('*')
    .eq('user_id', userId)
    .eq('integration_id', integrationId);

  if (error || !metrics || metrics.length === 0) {
    return { score: 0, breakdown: {}, trend: 'stable' };
  }

  const { data: integration } = await supabase
    .from('integrations_master')
    .select('integration_type')
    .eq('id', integrationId)
    .single();

  const category = integration ? INTEGRATION_CATEGORIES[integration.integration_type] : 'General';
  const categoryMultiplier = category === 'Finance' ? 1.2 : category === 'Communications' ? 1.0 : 1.1;

  const { data: weightings } = await supabase
    .from('fusion_weightings')
    .select('metric_id, final_weight')
    .eq('user_id', userId)
    .eq('integration_id', integrationId);

  const weightMap = new Map<string, number>();
  weightings?.forEach(w => weightMap.set(w.metric_id, w.final_weight));

  let weightedSum = 0;
  let totalWeight = 0;
  const breakdown: Record<string, number> = {};

  metrics.forEach((metric) => {
    const baseWeight = weightMap.get(metric.id) || 
                   metric.weight || 
                   DEFAULT_WEIGHTS[metric.metric_type as keyof MetricWeights] || 
                   0.2;
    
    const weight = baseWeight * categoryMultiplier;
    
    const contribution = metric.normalized_value * weight;
    weightedSum += contribution;
    totalWeight += weight;
    breakdown[metric.metric_name] = contribution;
  });

  const fusionScore = totalWeight > 0 ? (weightedSum / totalWeight) * 100 : 0;

  const { data: previousScore } = await supabase
    .from('fusion_scores')
    .select('fusion_score')
    .eq('user_id', userId)
    .eq('integration_id', integrationId)
    .order('calculated_at', { ascending: false })
    .limit(1)
    .single();

  let trend: 'up' | 'down' | 'stable' = 'stable';
  if (previousScore) {
    const diff = fusionScore - previousScore.fusion_score;
    if (diff > 5) trend = 'up';
    else if (diff < -5) trend = 'down';
  }

  return { score: fusionScore, breakdown, trend };
}

export async function updateFusionScore(
  userId: string,
  integrationId: string,
  includeAI: boolean = false
): Promise<void> {
  const supabase = await initSupabaseClient();
  const { score, breakdown, trend } = await calculateFusionScore(userId, integrationId);

  let aiSummary: string | undefined;
  if (includeAI) {
    const { data: existingScore } = await supabase
      .from('fusion_scores')
      .select('ai_summary, ai_cached_at')
      .eq('user_id', userId)
      .eq('integration_id', integrationId)
      .single();

    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
    const needsNewSummary = !existingScore?.ai_cached_at || 
      new Date(existingScore.ai_cached_at) < fourHoursAgo;

    if (needsNewSummary) {
      aiSummary = await generateAISummary(userId, integrationId);
    } else {
      aiSummary = existingScore.ai_summary || undefined;
    }
  }

  const { error } = await supabase
    .from('fusion_scores')
    .upsert({
      user_id: userId,
      integration_id: integrationId,
      fusion_score: score,
      score_breakdown: breakdown,
      trend_direction: trend,
      ai_summary: aiSummary,
      ai_cached_at: aiSummary ? new Date().toISOString() : null,
      calculated_at: new Date().toISOString(),
      weight_factor: 1.0,
      baseline_score: 50,
      learning_rate: 0.05,
      last_adjusted: new Date().toISOString(),
      adaptive_notes: 'Auto-calculated',
    }, {
      onConflict: 'user_id,integration_id'
    });

  if (error) {
    console.error('Error updating fusion score:', error);
  }
}

async function generateAISummary(userId: string, integrationId: string): Promise<string> {
  try {
    const supabase = await initSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return 'Unable to generate AI summary';

    const url = await getSupabaseFunctionUrl('generate-ai-insights');
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ userId, integrationId }),
    });

    const data = await response.json();
    return data.summary || 'Unable to generate AI summary';
  } catch (error) {
    console.error('AI summary generation error:', error);
    return 'AI insights temporarily unavailable';
  }
}

/**
 * ============================================================================
 * PHASE 12: ENTITLEMENT-AWARE AGGREGATE FUSION SCORE
 * ============================================================================
 * 
 * Calculates the aggregate Fusion Score across all integrations while
 * respecting the max_fusion_contributors entitlement limit.
 * 
 * ENTITLEMENT ENFORCEMENT:
 * 1. Fetches user's entitlements via getTenantEntitlements
 * 2. Selects top N integrations by signal strength (deterministic)
 * 3. Only selected integrations contribute to the aggregate score
 * 4. Degradation is graceful and silent - no errors, no partial data
 * 
 * SELECTION CRITERIA (in order):
 * 1. Highest activity_volume
 * 2. Most recent last_successful_run_at
 * 3. Alphabetical by service_name (for determinism)
 * ============================================================================
 */

export interface AggregateFusionResult {
  /** The aggregate Fusion Score (0-100) */
  aggregateScore: number;
  
  /** Number of integrations contributing to the score */
  contributorCount: number;
  
  /** Maximum contributors allowed by entitlements (-1 = unlimited) */
  maxContributors: number;
  
  /** Whether the score is limited by entitlements */
  isLimited: boolean;
  
  /** Integration IDs that are contributing to the score */
  contributingIntegrations: string[];
  
  /** Integration IDs that are excluded due to limits */
  excludedIntegrations: string[];
  
  /** Per-integration scores for contributors */
  breakdown: Record<string, { score: number; serviceName: string }>;
  
  /** Overall trend direction */
  trend: 'up' | 'down' | 'stable';
}

export async function calculateAggregateFusionScore(
  userId: string
): Promise<AggregateFusionResult> {
  const supabase = await initSupabaseClient();
  
  // Phase 12: Get user's entitlements
  const entitlements = await getTenantEntitlements(userId);
  const maxContributors = entitlements.max_fusion_contributors;
  
  // Fetch all integration intelligence for this user
  const { data: allIntelligence, error: intError } = await supabase
    .from('integration_intelligence')
    .select('integration_id, service_name, activity_volume, last_successful_run_at, failure_reason, last_failed_run_at')
    .eq('user_id', userId);
  
  if (intError || !allIntelligence || allIntelligence.length === 0) {
    return {
      aggregateScore: 0,
      contributorCount: 0,
      maxContributors,
      isLimited: false,
      contributingIntegrations: [],
      excludedIntegrations: [],
      breakdown: {},
      trend: 'stable',
    };
  }
  
  // Filter out failed integrations (Phase 10A)
  const healthyIntegrations = allIntelligence.filter(int => {
    if (!int.failure_reason) return true;
    
    const lastSuccess = int.last_successful_run_at ? new Date(int.last_successful_run_at) : null;
    const lastFailed = int.last_failed_run_at ? new Date(int.last_failed_run_at) : null;
    
    // Include if success is more recent than failure
    return lastSuccess && (!lastFailed || lastSuccess > lastFailed);
  });
  
  // Phase 12: Select top N contributors based on entitlements
  const selectedIntegrations = selectFusionContributors(
    healthyIntegrations,
    maxContributors
  );
  
  const contributingIds = selectedIntegrations.map(i => i.integration_id);
  const excludedIds = healthyIntegrations
    .filter(i => !contributingIds.includes(i.integration_id))
    .map(i => i.integration_id);
  
  // Calculate individual scores for selected integrations
  const breakdown: Record<string, { score: number; serviceName: string }> = {};
  let totalScore = 0;
  let scoreCount = 0;
  
  for (const integration of selectedIntegrations) {
    const { score } = await calculateFusionScore(userId, integration.integration_id);
    if (score > 0) {
      breakdown[integration.integration_id] = {
        score,
        serviceName: integration.service_name,
      };
      totalScore += score;
      scoreCount++;
    }
  }
  
  // Calculate aggregate score (weighted average)
  const aggregateScore = scoreCount > 0 ? totalScore / scoreCount : 0;
  
  // Determine trend based on previous aggregate
  const { data: previousAggregate } = await supabase
    .from('fusion_aggregate_history')
    .select('aggregate_score')
    .eq('user_id', userId)
    .order('recorded_at', { ascending: false })
    .limit(1)
    .single();
  
  let trend: 'up' | 'down' | 'stable' = 'stable';
  if (previousAggregate) {
    const diff = aggregateScore - previousAggregate.aggregate_score;
    if (diff > 3) trend = 'up';
    else if (diff < -3) trend = 'down';
  }
  
  return {
    aggregateScore,
    contributorCount: scoreCount,
    maxContributors,
    isLimited: maxContributors !== -1 && healthyIntegrations.length > maxContributors,
    contributingIntegrations: contributingIds,
    excludedIntegrations: excludedIds,
    breakdown,
    trend,
  };
}

/**
 * Check if an integration is currently contributing to the Fusion Score
 * based on entitlement limits and signal strength.
 * 
 * This is useful for UI to show which integrations are "active" contributors.
 */
export async function isIntegrationContributing(
  userId: string,
  integrationId: string
): Promise<boolean> {
  const result = await calculateAggregateFusionScore(userId);
  return result.contributingIntegrations.includes(integrationId);
}
