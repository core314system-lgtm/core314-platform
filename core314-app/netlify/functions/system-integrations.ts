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

// SystemStatus - SINGLE CANONICAL OBJECT for UI and AI
// AI is NOT allowed to compute or infer anything beyond this object
interface SystemStatus {
  global_fusion_score: number;
  score_origin: ScoreOrigin;
  system_health: SystemHealth;
  has_efficiency_metrics: boolean;
  connected_integrations: ConnectedIntegration[];
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
    const { data: fusionScores } = await supabase
      .from('fusion_scores')
      .select('integration_id, fusion_score, updated_at')
      .eq('user_id', userId);

    // Fetch efficiency metrics to determine has_efficiency_metrics
    // This is the SAME check the UI uses to show "No fusion efficiency metrics available yet"
    const { data: userMetrics } = await supabase
      .from('fusion_metrics')
      .select('integration_id, synced_at')
      .eq('user_id', userId);

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
    // Dashboard computes: average of all fusion_scores for connected integrations
    // If no valid scores, use BASELINE_SCORE (50)
    // NOTE: This does NOT affect score_origin - that is derived from fusion_metrics only
    let globalFusionScore = BASELINE_SCORE;
    
    if (fusionScores && fusionScores.length > 0) {
      const validScores = fusionScores.filter(s => s.fusion_score !== null && s.fusion_score !== undefined);
      if (validScores.length > 0) {
        globalFusionScore = validScores.reduce((sum, s) => sum + (s.fusion_score || 0), 0) / validScores.length;
      }
    }

    // Build SystemStatus - SINGLE CANONICAL OBJECT
    const systemStatus: SystemStatus = {
      global_fusion_score: Math.round(globalFusionScore * 10) / 10, // Round to 1 decimal
      score_origin: scoreOrigin,
      system_health: systemHealth,
      has_efficiency_metrics: globalHasEfficiencyMetrics,
      connected_integrations: connectedIntegrations,
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
