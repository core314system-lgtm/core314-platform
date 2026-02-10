import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

/**
 * CANONICAL SYSTEM STATUS ENDPOINT
 * GET /api/system/integrations
 * 
 * TRUST RESTORATION FIX - This endpoint returns the SINGLE CANONICAL SystemStatus
 * that BOTH UI and AI MUST consume. AI is NOT allowed to compute or infer anything
 * beyond this object.
 * 
 * RULES:
 * - AI must NEVER recalculate global_fusion_score
 * - AI must NEVER re-label system_health
 * - AI must NEVER infer severity
 * - AI must NEVER use words like "indicates", "suggests", "critical", "issues"
 * 
 * Response format (SystemStatus):
 * {
 *   "global_fusion_score": 50,
 *   "score_origin": "baseline" | "computed",
 *   "system_health": "observing" | "active",
 *   "has_efficiency_metrics": false,
 *   "connected_integrations": [{ name, metrics_state }]
 * }
 */

// System Health: ONLY two states allowed
// observing: No efficiency metrics exist yet OR metrics not recent
// active: Has recent metrics AND contributing to score
type SystemHealth = 'observing' | 'active';

// Score Origin: Where the score came from
// baseline: Using default 50 because no fusion_metrics exist or none are active
// computed: Calculated from actual fusion_metrics with active state
// NOTE: score_origin is derived from fusion_metrics ONLY, NOT fusion_scores
type ScoreOrigin = 'baseline' | 'computed';

// Per-integration metrics state (same vocabulary as system_health for consistency)
type IntegrationMetricsState = 'observing' | 'active';

// Per-integration facts
interface ConnectedIntegration {
  name: string;
  metrics_state: IntegrationMetricsState;
}

// ============================================================
// AI INSIGHT PHASE SYSTEM - DETERMINISTIC PHASE GATING
// ============================================================

/**
 * AI Insight Phase - Determines what level of AI insights are available
 * 
 * LOCKED: AI cannot respond at all (insufficient data)
 * DESCRIPTIVE: AI can only observe/describe (no causality inference)
 * DIAGNOSTIC: AI can explain causality using metrics
 * PRESCRIPTIVE: AI can suggest options (no directives)
 * PREDICTIVE: AI can make predictions based on patterns
 * 
 * Phase is derived DETERMINISTICALLY from:
 * - integration_metrics row count
 * - number of active integrations contributing metrics
 * - polling continuity (consecutive successful polls)
 * - variance stability (score variance over time)
 * - fusion score recalculation count
 * - system health stability (days in current state)
 */
type AIInsightPhase = 'locked' | 'descriptive' | 'diagnostic' | 'prescriptive' | 'predictive';

/**
 * Phase metadata - explains why user is at current phase and what's needed for next
 */
interface PhaseMetadata {
  current_phase: AIInsightPhase;
  phase_reason: string;
  next_phase: AIInsightPhase | null;
  next_phase_requirements: string[];
  days_until_unlock_estimate: number | null;
  // Raw metrics used for phase calculation (for auditing)
  metrics_count: number;
  active_integrations_count: number;
  days_since_first_integration: number;
  successful_poll_cycles: number;
  fusion_score_recalculations: number;
  variance_stability_percent: number;
  system_health_stable_days: number;
}

/**
 * Phase thresholds - DETERMINISTIC RULES (no heuristics, no defaults)
 * These values are carefully chosen based on data maturity requirements
 */
const PHASE_THRESHOLDS = {
  // DESCRIPTIVE phase requirements
  descriptive: {
    min_integrations: 1,
    min_metrics: 5,
    min_days_since_first_integration: 7,
    min_successful_polls: 3,
  },
  // DIAGNOSTIC phase requirements (includes all DESCRIPTIVE requirements)
  diagnostic: {
    min_integrations: 2,
    min_active_integrations: 1,
    min_metrics: 20,
    min_days_since_first_integration: 14,
    min_fusion_recalculations: 5,
    max_variance_percent: 20,
  },
  // PRESCRIPTIVE phase requirements (includes all DIAGNOSTIC requirements)
  prescriptive: {
    min_metrics: 50,
    min_days_since_first_integration: 21,
    min_fusion_recalculations: 10,
    min_system_health_stable_days: 7,
  },
  // PREDICTIVE phase requirements (includes all PRESCRIPTIVE requirements)
  predictive: {
    min_metrics: 100,
    min_days_since_first_integration: 30,
    min_fusion_recalculations: 20,
    max_variance_percent: 10,
    min_system_health_stable_days: 14,
  },
};

// SystemStatus - SINGLE CANONICAL OBJECT for UI and AI
// AI is NOT allowed to compute or infer anything beyond this object
interface SystemStatus {
  global_fusion_score: number;
  score_origin: ScoreOrigin;
  system_health: SystemHealth;
  has_efficiency_metrics: boolean;
  connected_integrations: ConnectedIntegration[];
  // AI Insight Phase - NEW
  ai_insight_phase: AIInsightPhase;
  phase_metadata: PhaseMetadata;
}

interface SystemStatusResponse {
  success: boolean;
  system_status: SystemStatus;
  error?: string;
}

// Baseline score when no metrics are available (matches fusionEngine.ts)
const BASELINE_SCORE = 50;

const ACTIVE_THRESHOLD_DAYS = 14;

/**
 * Compute system_health based on ACTUAL metrics existence
 * ONLY two states: 'observing' or 'active'
 * 
 * observing: No efficiency metrics exist OR metrics not recent
 * active: Has recent metrics AND contributing to score
 */
function computeSystemHealth(
  hasEfficiencyMetrics: boolean,
  lastMetricSync: string | null
): SystemHealth {
  // No metrics = 'observing'
  if (!hasEfficiencyMetrics) {
    return 'observing';
  }
  
  // Has metrics - check if recent
  if (lastMetricSync) {
    const now = new Date();
    const lastMetricDate = new Date(lastMetricSync);
    const daysSinceMetric = (now.getTime() - lastMetricDate.getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysSinceMetric < ACTIVE_THRESHOLD_DAYS) {
      return 'active';
    }
  }
  
  // Has metrics but not recent enough = 'observing'
  return 'observing';
}

/**
 * Compute per-integration metrics_state
 * ONLY two states: 'observing' or 'active'
 */
function computeIntegrationMetricsState(
  integrationId: string,
  metricsMap: Map<string, { hasMetrics: boolean; lastSyncedAt: string | null }>
): IntegrationMetricsState {
  const metricsData = metricsMap.get(integrationId);
  
  if (!metricsData || !metricsData.hasMetrics) {
    return 'observing';
  }
  
  if (metricsData.lastSyncedAt) {
    const now = new Date();
    const lastMetricDate = new Date(metricsData.lastSyncedAt);
    const daysSinceMetric = (now.getTime() - lastMetricDate.getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysSinceMetric < ACTIVE_THRESHOLD_DAYS) {
      return 'active';
    }
  }
  
  return 'observing';
}

/**
 * CALCULATE AI INSIGHT PHASE - DETERMINISTIC PHASE GATING
 * 
 * This function calculates the AI insight phase for a user based on:
 * - integration_metrics row count
 * - number of active integrations contributing metrics
 * - polling continuity (consecutive successful polls)
 * - variance stability (score variance over time)
 * - fusion score recalculation count
 * - system health stability (days in current state)
 * 
 * NO AI. NO HEURISTICS. NO DEFAULTS.
 * Phase is derived DETERMINISTICALLY from actual data.
 */
interface PhaseCalculationInputs {
  metricsCount: number;
  connectedIntegrationsCount: number;
  activeIntegrationsCount: number;
  daysSinceFirstIntegration: number;
  successfulPollCycles: number;
  fusionScoreRecalculations: number;
  varianceStabilityPercent: number;
  systemHealthStableDays: number;
}

function calculateAIInsightPhase(inputs: PhaseCalculationInputs): { phase: AIInsightPhase; metadata: PhaseMetadata } {
  const {
    metricsCount,
    connectedIntegrationsCount,
    activeIntegrationsCount,
    daysSinceFirstIntegration,
    successfulPollCycles,
    fusionScoreRecalculations,
    varianceStabilityPercent,
    systemHealthStableDays,
  } = inputs;

  // Build base metadata (will be updated with phase-specific info)
  const baseMetadata: Omit<PhaseMetadata, 'current_phase' | 'phase_reason' | 'next_phase' | 'next_phase_requirements' | 'days_until_unlock_estimate'> = {
    metrics_count: metricsCount,
    active_integrations_count: activeIntegrationsCount,
    days_since_first_integration: daysSinceFirstIntegration,
    successful_poll_cycles: successfulPollCycles,
    fusion_score_recalculations: fusionScoreRecalculations,
    variance_stability_percent: varianceStabilityPercent,
    system_health_stable_days: systemHealthStableDays,
  };

  // ============================================================
  // PHASE CALCULATION - DETERMINISTIC RULES (checked in order)
  // ============================================================

  // Check PREDICTIVE phase (highest tier)
  const predictiveReqs = PHASE_THRESHOLDS.predictive;
  const prescriptiveReqs = PHASE_THRESHOLDS.prescriptive;
  const diagnosticReqs = PHASE_THRESHOLDS.diagnostic;
  const descriptiveReqs = PHASE_THRESHOLDS.descriptive;

  // PREDICTIVE: All requirements met
  if (
    metricsCount >= predictiveReqs.min_metrics &&
    daysSinceFirstIntegration >= predictiveReqs.min_days_since_first_integration &&
    fusionScoreRecalculations >= predictiveReqs.min_fusion_recalculations &&
    varianceStabilityPercent <= predictiveReqs.max_variance_percent &&
    systemHealthStableDays >= predictiveReqs.min_system_health_stable_days &&
    // Also must meet all prescriptive requirements
    systemHealthStableDays >= prescriptiveReqs.min_system_health_stable_days &&
    // Also must meet all diagnostic requirements
    connectedIntegrationsCount >= diagnosticReqs.min_integrations &&
    activeIntegrationsCount >= diagnosticReqs.min_active_integrations &&
    varianceStabilityPercent <= diagnosticReqs.max_variance_percent &&
    // Also must meet all descriptive requirements
    connectedIntegrationsCount >= descriptiveReqs.min_integrations &&
    successfulPollCycles >= descriptiveReqs.min_successful_polls
  ) {
    return {
      phase: 'predictive',
      metadata: {
        ...baseMetadata,
        current_phase: 'predictive',
        phase_reason: 'All predictive requirements met. AI can make predictions based on established patterns.',
        next_phase: null,
        next_phase_requirements: [],
        days_until_unlock_estimate: null,
      },
    };
  }

  // PRESCRIPTIVE: All requirements met
  if (
    metricsCount >= prescriptiveReqs.min_metrics &&
    daysSinceFirstIntegration >= prescriptiveReqs.min_days_since_first_integration &&
    fusionScoreRecalculations >= prescriptiveReqs.min_fusion_recalculations &&
    systemHealthStableDays >= prescriptiveReqs.min_system_health_stable_days &&
    // Also must meet all diagnostic requirements
    connectedIntegrationsCount >= diagnosticReqs.min_integrations &&
    activeIntegrationsCount >= diagnosticReqs.min_active_integrations &&
    metricsCount >= diagnosticReqs.min_metrics &&
    varianceStabilityPercent <= diagnosticReqs.max_variance_percent &&
    // Also must meet all descriptive requirements
    connectedIntegrationsCount >= descriptiveReqs.min_integrations &&
    successfulPollCycles >= descriptiveReqs.min_successful_polls
  ) {
    const nextReqs: string[] = [];
    if (metricsCount < predictiveReqs.min_metrics) {
      nextReqs.push(`Need ${predictiveReqs.min_metrics - metricsCount} more metrics (have ${metricsCount}/${predictiveReqs.min_metrics})`);
    }
    if (daysSinceFirstIntegration < predictiveReqs.min_days_since_first_integration) {
      nextReqs.push(`Need ${predictiveReqs.min_days_since_first_integration - daysSinceFirstIntegration} more days of data`);
    }
    if (fusionScoreRecalculations < predictiveReqs.min_fusion_recalculations) {
      nextReqs.push(`Need ${predictiveReqs.min_fusion_recalculations - fusionScoreRecalculations} more score recalculations`);
    }
    if (varianceStabilityPercent > predictiveReqs.max_variance_percent) {
      nextReqs.push(`Variance must stabilize below ${predictiveReqs.max_variance_percent}% (currently ${varianceStabilityPercent.toFixed(1)}%)`);
    }
    if (systemHealthStableDays < predictiveReqs.min_system_health_stable_days) {
      nextReqs.push(`System health must be stable for ${predictiveReqs.min_system_health_stable_days - systemHealthStableDays} more days`);
    }

    const daysEstimate = Math.max(0, predictiveReqs.min_days_since_first_integration - daysSinceFirstIntegration);

    return {
      phase: 'prescriptive',
      metadata: {
        ...baseMetadata,
        current_phase: 'prescriptive',
        phase_reason: 'AI can suggest options based on diagnostic insights. Predictive capabilities unlock with more data stability.',
        next_phase: 'predictive',
        next_phase_requirements: nextReqs,
        days_until_unlock_estimate: daysEstimate > 0 ? daysEstimate : null,
      },
    };
  }

  // DIAGNOSTIC: All requirements met
  if (
    connectedIntegrationsCount >= diagnosticReqs.min_integrations &&
    activeIntegrationsCount >= diagnosticReqs.min_active_integrations &&
    metricsCount >= diagnosticReqs.min_metrics &&
    daysSinceFirstIntegration >= diagnosticReqs.min_days_since_first_integration &&
    fusionScoreRecalculations >= diagnosticReqs.min_fusion_recalculations &&
    varianceStabilityPercent <= diagnosticReqs.max_variance_percent &&
    // Also must meet all descriptive requirements
    connectedIntegrationsCount >= descriptiveReqs.min_integrations &&
    successfulPollCycles >= descriptiveReqs.min_successful_polls
  ) {
    const nextReqs: string[] = [];
    if (metricsCount < prescriptiveReqs.min_metrics) {
      nextReqs.push(`Need ${prescriptiveReqs.min_metrics - metricsCount} more metrics (have ${metricsCount}/${prescriptiveReqs.min_metrics})`);
    }
    if (daysSinceFirstIntegration < prescriptiveReqs.min_days_since_first_integration) {
      nextReqs.push(`Need ${prescriptiveReqs.min_days_since_first_integration - daysSinceFirstIntegration} more days of data`);
    }
    if (fusionScoreRecalculations < prescriptiveReqs.min_fusion_recalculations) {
      nextReqs.push(`Need ${prescriptiveReqs.min_fusion_recalculations - fusionScoreRecalculations} more score recalculations`);
    }
    if (systemHealthStableDays < prescriptiveReqs.min_system_health_stable_days) {
      nextReqs.push(`System health must be stable for ${prescriptiveReqs.min_system_health_stable_days - systemHealthStableDays} more days`);
    }

    const daysEstimate = Math.max(0, prescriptiveReqs.min_days_since_first_integration - daysSinceFirstIntegration);

    return {
      phase: 'diagnostic',
      metadata: {
        ...baseMetadata,
        current_phase: 'diagnostic',
        phase_reason: 'AI can explain causality using metrics. Prescriptive suggestions unlock with more data maturity.',
        next_phase: 'prescriptive',
        next_phase_requirements: nextReqs,
        days_until_unlock_estimate: daysEstimate > 0 ? daysEstimate : null,
      },
    };
  }

  // DESCRIPTIVE: All requirements met
  if (
    connectedIntegrationsCount >= descriptiveReqs.min_integrations &&
    metricsCount >= descriptiveReqs.min_metrics &&
    daysSinceFirstIntegration >= descriptiveReqs.min_days_since_first_integration &&
    successfulPollCycles >= descriptiveReqs.min_successful_polls
  ) {
    const nextReqs: string[] = [];
    if (connectedIntegrationsCount < diagnosticReqs.min_integrations) {
      nextReqs.push(`Connect ${diagnosticReqs.min_integrations - connectedIntegrationsCount} more integration(s)`);
    }
    if (activeIntegrationsCount < diagnosticReqs.min_active_integrations) {
      nextReqs.push(`Need ${diagnosticReqs.min_active_integrations - activeIntegrationsCount} more active integration(s)`);
    }
    if (metricsCount < diagnosticReqs.min_metrics) {
      nextReqs.push(`Need ${diagnosticReqs.min_metrics - metricsCount} more metrics (have ${metricsCount}/${diagnosticReqs.min_metrics})`);
    }
    if (daysSinceFirstIntegration < diagnosticReqs.min_days_since_first_integration) {
      nextReqs.push(`Need ${diagnosticReqs.min_days_since_first_integration - daysSinceFirstIntegration} more days of data`);
    }
    if (fusionScoreRecalculations < diagnosticReqs.min_fusion_recalculations) {
      nextReqs.push(`Need ${diagnosticReqs.min_fusion_recalculations - fusionScoreRecalculations} more score recalculations`);
    }
    if (varianceStabilityPercent > diagnosticReqs.max_variance_percent) {
      nextReqs.push(`Variance must stabilize below ${diagnosticReqs.max_variance_percent}% (currently ${varianceStabilityPercent.toFixed(1)}%)`);
    }

    const daysEstimate = Math.max(0, diagnosticReqs.min_days_since_first_integration - daysSinceFirstIntegration);

    return {
      phase: 'descriptive',
      metadata: {
        ...baseMetadata,
        current_phase: 'descriptive',
        phase_reason: 'AI can observe and describe system state. Diagnostic insights unlock with more integrations and data.',
        next_phase: 'diagnostic',
        next_phase_requirements: nextReqs,
        days_until_unlock_estimate: daysEstimate > 0 ? daysEstimate : null,
      },
    };
  }

  // LOCKED: Default state - insufficient data
  const nextReqs: string[] = [];
  if (connectedIntegrationsCount < descriptiveReqs.min_integrations) {
    nextReqs.push(`Connect at least ${descriptiveReqs.min_integrations} integration(s)`);
  }
  if (metricsCount < descriptiveReqs.min_metrics) {
    nextReqs.push(`Need ${descriptiveReqs.min_metrics - metricsCount} more metrics (have ${metricsCount}/${descriptiveReqs.min_metrics})`);
  }
  if (daysSinceFirstIntegration < descriptiveReqs.min_days_since_first_integration) {
    nextReqs.push(`Need ${descriptiveReqs.min_days_since_first_integration - daysSinceFirstIntegration} more days of data`);
  }
  if (successfulPollCycles < descriptiveReqs.min_successful_polls) {
    nextReqs.push(`Need ${descriptiveReqs.min_successful_polls - successfulPollCycles} more successful poll cycles`);
  }

  const daysEstimate = connectedIntegrationsCount > 0 
    ? Math.max(0, descriptiveReqs.min_days_since_first_integration - daysSinceFirstIntegration)
    : descriptiveReqs.min_days_since_first_integration;

  return {
    phase: 'locked',
    metadata: {
      ...baseMetadata,
      current_phase: 'locked',
      phase_reason: 'Insufficient data for AI insights. Connect integrations and allow time for data collection.',
      next_phase: 'descriptive',
      next_phase_requirements: nextReqs,
      days_until_unlock_estimate: daysEstimate > 0 ? daysEstimate : null,
    },
  };
}

const handler: Handler = async (event: HandlerEvent, _context: HandlerContext) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers,
      body: "",
    };
  }

  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, integrations: [], error: "Method not allowed" }),
    };
  }

  // Extract JWT from Authorization header
  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ success: false, integrations: [], error: "Unauthorized: Missing or invalid Authorization header" }),
    };
  }

  const jwt = authHeader.substring(7);

  // Initialize Supabase client
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, integrations: [], error: "Server configuration error" }),
    };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    },
  });

  try {
    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
    
    if (authError || !user) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ success: false, integrations: [], error: "Unauthorized: Invalid token" }),
      };
    }

    const userId = user.id;

    // Fetch user's ACTUAL connected integrations (same source as Dashboard)
    const { data: userIntegrations, error: integrationsError } = await supabase
      .from('user_integrations')
      .select(`
        id,
        integration_id,
        date_added,
        integrations_master (id, integration_name)
      `)
      .eq('user_id', userId)
      .eq('status', 'active')
      .eq('added_by_user', true);

    if (integrationsError) {
      console.error('Error fetching user integrations:', integrationsError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ success: false, integrations: [], error: "Failed to fetch integrations" }),
      };
    }

    // Fetch fusion scores for user's integrations (for ui_global_fusion_score calculation)
    // This MUST match how Dashboard.tsx computes globalScore
    // Also fetch calculated_at for phase calculation (fusion_score_recalculations count)
    const { data: fusionScores } = await supabase
      .from('fusion_scores')
      .select('integration_id, fusion_score, updated_at, calculated_at')
      .eq('user_id', userId);

    // Fetch efficiency metrics to determine has_efficiency_metrics
    // This is the SAME check the UI uses to show "No fusion efficiency metrics available yet"
    const { data: userMetrics } = await supabase
      .from('fusion_metrics')
      .select('integration_id, synced_at')
      .eq('user_id', userId);

    // ============================================================
    // PHASE CALCULATION DATA FETCHING
    // Fetch additional data needed for AI Insight Phase calculation
    // ============================================================

    // Fetch integration_metrics for phase calculation (row count and poll cycles)
    const { data: integrationMetrics } = await supabase
      .from('integration_metrics')
      .select('id, integration_id, created_at, poll_success')
      .eq('user_id', userId);

    // Fetch poll run metadata for successful poll cycles count
    const { data: pollRunMetadata } = await supabase
      .from('poll_run_metadata')
      .select('id, integration_id, success, created_at')
      .eq('user_id', userId)
      .eq('success', true);

    // Fetch system health history for stability calculation
    // We'll use fusion_scores history to determine system health stability
    const { data: fusionScoreHistory } = await supabase
      .from('fusion_scores')
      .select('fusion_score, calculated_at, updated_at')
      .eq('user_id', userId)
      .order('calculated_at', { ascending: false })
      .limit(30); // Last 30 recalculations for variance calculation

    // Build per-integration metrics map
    const metricsMap = new Map<string, { hasMetrics: boolean; lastSyncedAt: string | null }>();
    userMetrics?.forEach(m => {
      if (!metricsMap.has(m.integration_id)) {
        metricsMap.set(m.integration_id, { hasMetrics: false, lastSyncedAt: null });
      }
      const entry = metricsMap.get(m.integration_id)!;
      entry.hasMetrics = true;
      if (m.synced_at && (!entry.lastSyncedAt || m.synced_at > entry.lastSyncedAt)) {
        entry.lastSyncedAt = m.synced_at;
      }
    });

    // Compute global has_efficiency_metrics (ANY metrics exist for ANY integration)
    const globalHasEfficiencyMetrics = (userMetrics && userMetrics.length > 0) || false;
    
    // Find most recent metric sync timestamp
    let lastMetricSync: string | null = null;
    userMetrics?.forEach(m => {
      if (m.synced_at && (!lastMetricSync || m.synced_at > lastMetricSync)) {
        lastMetricSync = m.synced_at;
      }
    });

    // Build connected_integrations array with per-integration metrics_state FIRST
    // We need this to determine score_origin
    const connectedIntegrations: ConnectedIntegration[] = (userIntegrations || []).map(ui => {
      const master = ui.integrations_master as { id: string; integration_name: string } | null;
      if (!master) return null;
      
      return {
        name: master.integration_name,
        metrics_state: computeIntegrationMetricsState(ui.integration_id, metricsMap),
      };
    }).filter((i): i is ConnectedIntegration => i !== null);

    // Compute system_health (observing | active)
    const systemHealth = computeSystemHealth(globalHasEfficiencyMetrics, lastMetricSync);

    // ============================================================
    // SCORE_ORIGIN DERIVATION - AUTHORITATIVE RULE
    // score_origin is derived from fusion_metrics ONLY, NOT fusion_scores
    // 
    // score_origin = 'computed' ONLY IF:
    //   - fusion_metrics has >= 1 row (globalHasEfficiencyMetrics === true)
    //   - AND at least one integration has metrics_state === 'active'
    //   - AND integration is connected (connectedIntegrations.length > 0)
    // Otherwise:
    //   - score_origin = 'baseline'
    // ============================================================
    let scoreOrigin: ScoreOrigin = 'baseline';
    const hasActiveIntegration = connectedIntegrations.some(i => i.metrics_state === 'active');
    
    if (
      globalHasEfficiencyMetrics &&
      hasActiveIntegration &&
      connectedIntegrations.length > 0
    ) {
      scoreOrigin = 'computed';
    }

    // Compute global_fusion_score for UI display
    // Dashboard computes: average of fusion_scores ONLY for connected integrations (added_by_user=true)
    // If no valid scores, use BASELINE_SCORE (50)
    // NOTE: This does NOT affect score_origin - that is derived from fusion_metrics only
    // 
    // CRITICAL FIX: Must filter fusionScores to only include scores for integrations
    // that are in userIntegrations (added_by_user=true). This matches Dashboard.tsx behavior.
    let globalFusionScore = BASELINE_SCORE;
    
    // Get the set of integration_ids from userIntegrations (added_by_user=true)
    const connectedIntegrationIds = new Set(
      (userIntegrations || []).map(ui => ui.integration_id)
    );
    
    if (fusionScores && fusionScores.length > 0) {
      // Filter to only include scores for connected integrations (matches Dashboard.tsx)
      const validScores = fusionScores.filter(s => 
        s.fusion_score !== null && 
        s.fusion_score !== undefined &&
        connectedIntegrationIds.has(s.integration_id)
      );
      if (validScores.length > 0) {
        globalFusionScore = validScores.reduce((sum, s) => sum + (s.fusion_score || 0), 0) / validScores.length;
      }
    }

    // ============================================================
    // AI INSIGHT PHASE CALCULATION
    // Calculate phase inputs from fetched data
    // ============================================================

    // 1. Metrics count (integration_metrics rows)
    const metricsCount = integrationMetrics?.length || 0;

    // 2. Active integrations count (integrations with metrics_state === 'active')
    const activeIntegrationsCount = connectedIntegrations.filter(i => i.metrics_state === 'active').length;

    // 3. Days since first integration
    let daysSinceFirstIntegration = 0;
    if (userIntegrations && userIntegrations.length > 0) {
      const firstIntegrationDate = userIntegrations
        .map(ui => new Date(ui.date_added))
        .sort((a, b) => a.getTime() - b.getTime())[0];
      if (firstIntegrationDate) {
        daysSinceFirstIntegration = Math.floor(
          (Date.now() - firstIntegrationDate.getTime()) / (1000 * 60 * 60 * 24)
        );
      }
    }

    // 4. Successful poll cycles count
    const successfulPollCycles = pollRunMetadata?.length || 0;

    // 5. Fusion score recalculations count (unique calculated_at timestamps)
    const fusionScoreRecalculations = fusionScoreHistory?.length || 0;

    // 6. Variance stability (coefficient of variation of fusion scores)
    // Lower variance = more stable = better
    let varianceStabilityPercent = 100; // Default to high variance (unstable)
    if (fusionScoreHistory && fusionScoreHistory.length >= 3) {
      const scores = fusionScoreHistory.map(s => s.fusion_score).filter((s): s is number => s !== null);
      if (scores.length >= 3) {
        const mean = scores.reduce((sum, s) => sum + s, 0) / scores.length;
        if (mean > 0) {
          const variance = scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length;
          const stdDev = Math.sqrt(variance);
          varianceStabilityPercent = (stdDev / mean) * 100; // Coefficient of variation as percentage
        }
      }
    }

    // 7. System health stable days
    // Count consecutive days where system_health has been the same
    // For simplicity, we'll use the days since the most recent score change > 5%
    let systemHealthStableDays = 0;
    if (fusionScoreHistory && fusionScoreHistory.length >= 2) {
      const sortedHistory = [...fusionScoreHistory].sort((a, b) => 
        new Date(b.calculated_at || b.updated_at).getTime() - new Date(a.calculated_at || a.updated_at).getTime()
      );
      
      // Find the most recent significant change (> 5% change)
      let lastStableDate = new Date();
      for (let i = 1; i < sortedHistory.length; i++) {
        const current = sortedHistory[i - 1].fusion_score || 0;
        const previous = sortedHistory[i].fusion_score || 0;
        if (previous > 0) {
          const changePercent = Math.abs((current - previous) / previous) * 100;
          if (changePercent > 5) {
            lastStableDate = new Date(sortedHistory[i - 1].calculated_at || sortedHistory[i - 1].updated_at);
            break;
          }
        }
      }
      systemHealthStableDays = Math.floor(
        (Date.now() - lastStableDate.getTime()) / (1000 * 60 * 60 * 24)
      );
    } else if (fusionScoreHistory && fusionScoreHistory.length === 1) {
      // Only one score, use its date
      const scoreDate = new Date(fusionScoreHistory[0].calculated_at || fusionScoreHistory[0].updated_at);
      systemHealthStableDays = Math.floor(
        (Date.now() - scoreDate.getTime()) / (1000 * 60 * 60 * 24)
      );
    }

    // Calculate AI Insight Phase
    const { phase: aiInsightPhase, metadata: phaseMetadata } = calculateAIInsightPhase({
      metricsCount,
      connectedIntegrationsCount: connectedIntegrations.length,
      activeIntegrationsCount,
      daysSinceFirstIntegration,
      successfulPollCycles,
      fusionScoreRecalculations,
      varianceStabilityPercent: Math.round(varianceStabilityPercent * 10) / 10,
      systemHealthStableDays,
    });

    console.log(`[AI Insight Phase] User ${userId}: phase=${aiInsightPhase}, metrics=${metricsCount}, active=${activeIntegrationsCount}, days=${daysSinceFirstIntegration}`);

    // Build SystemStatus - SINGLE CANONICAL OBJECT
    const systemStatus: SystemStatus = {
      global_fusion_score: Math.round(globalFusionScore * 10) / 10, // Round to 1 decimal
      score_origin: scoreOrigin,
      system_health: systemHealth,
      has_efficiency_metrics: globalHasEfficiencyMetrics,
      connected_integrations: connectedIntegrations,
      ai_insight_phase: aiInsightPhase,
      phase_metadata: phaseMetadata,
    };

    const response: SystemStatusResponse = {
      success: true,
      system_status: systemStatus,
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('System integrations endpoint error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, integrations: [], error: "Internal server error" }),
    };
  }
};

export { handler };
