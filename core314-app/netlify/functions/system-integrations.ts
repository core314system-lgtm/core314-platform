import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

/**
 * AUTHORITATIVE SYSTEM TRUTH ENDPOINT
 * GET /api/system/integrations
 * 
 * This endpoint returns the SINGLE SOURCE OF TRUTH (SystemTruthSnapshot)
 * that BOTH UI and AI MUST consume. This ensures they NEVER contradict.
 * 
 * It MUST:
 * - Query the same sources used by the dashboard UI
 * - Return factual data ONLY
 * - NEVER invoke any LLM
 * - NEVER depend on AI context or prompts
 * 
 * HARD GATING RULES:
 * - If has_efficiency_metrics === false:
 *   - metrics_state MUST be 'observing'
 *   - contributes_to_score MUST be false
 * 
 * Response format (SystemTruthSnapshot):
 * {
 *   "connected_integrations": [{ name, connection_status }],
 *   "ui_global_fusion_score": 50,
 *   "has_efficiency_metrics": false,
 *   "metrics_state": "observing",
 *   "contributes_to_score": false,
 *   "last_updated_at": "2026-01-04T13:12:00Z"
 * }
 */

// Metrics State (UI-LOCKED terminology)
// observing: No efficiency metrics exist yet (HARD GATED: has_efficiency_metrics === false)
// stabilizing: Has some metrics but still collecting data
// active: Has recent metrics (within 14 days) AND contributing to score
type MetricsState = 'observing' | 'stabilizing' | 'active';

// Per-integration facts
interface ConnectedIntegration {
  name: string;
  connection_status: 'connected' | 'disconnected';
}

// SystemTruthSnapshot - SINGLE SOURCE OF TRUTH for UI and AI
interface SystemTruthSnapshot {
  // Integration facts
  connected_integrations: ConnectedIntegration[];
  // Global score (MUST match UI gauge - computed same way as Dashboard)
  ui_global_fusion_score: number;
  // HARD GATED: If false, metrics_state MUST be 'observing', contributes_to_score MUST be false
  has_efficiency_metrics: boolean;
  // Global metrics state (observing | stabilizing | active)
  metrics_state: MetricsState;
  // True ONLY if has_efficiency_metrics AND metrics are recent
  contributes_to_score: boolean;
  // Timestamp of last data update
  last_updated_at: string;
}

interface SystemIntegrationsResponse {
  success: boolean;
  snapshot: SystemTruthSnapshot;
  error?: string;
}

// Baseline score when no metrics are available (matches fusionEngine.ts)
const BASELINE_SCORE = 50;

const ACTIVE_THRESHOLD_DAYS = 14;

/**
 * HARD GATING: Compute global metrics_state based on ACTUAL metrics existence
 * 
 * CRITICAL RULES (NON-NEGOTIABLE):
 * - If has_efficiency_metrics === false: metrics_state MUST be 'observing'
 * - If has_efficiency_metrics === true but not recent: metrics_state is 'stabilizing'
 * - If has_efficiency_metrics === true AND recent: metrics_state is 'active'
 * 
 * This function enforces UI-LOCKED truth - AI MUST use these exact states.
 */
function computeGlobalMetricsState(
  hasEfficiencyMetrics: boolean,
  lastMetricSync: string | null
): MetricsState {
  // HARD GATING: No metrics = 'observing' (NEVER 'stabilizing' or 'active')
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
  
  // Has metrics but not recent enough
  return 'stabilizing';
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

    // Compute global has_efficiency_metrics (ANY metrics exist for ANY integration)
    const globalHasEfficiencyMetrics = (userMetrics && userMetrics.length > 0) || false;
    
    // Find most recent metric sync timestamp
    let lastMetricSync: string | null = null;
    userMetrics?.forEach(m => {
      if (m.synced_at && (!lastMetricSync || m.synced_at > lastMetricSync)) {
        lastMetricSync = m.synced_at;
      }
    });

    // Compute ui_global_fusion_score (MUST match Dashboard.tsx calculation)
    // Dashboard computes: average of all fusion_scores for connected integrations
    // If no valid scores, use BASELINE_SCORE (50)
    let uiGlobalFusionScore = BASELINE_SCORE;
    let lastUpdatedAt = new Date().toISOString();
    
    if (fusionScores && fusionScores.length > 0) {
      const validScores = fusionScores.filter(s => s.fusion_score !== null && s.fusion_score !== undefined);
      if (validScores.length > 0) {
        uiGlobalFusionScore = validScores.reduce((sum, s) => sum + (s.fusion_score || 0), 0) / validScores.length;
        // Find most recent update timestamp
        const mostRecentScore = validScores.reduce((latest, s) => 
          (!latest || s.updated_at > latest.updated_at) ? s : latest
        );
        if (mostRecentScore?.updated_at) {
          lastUpdatedAt = mostRecentScore.updated_at;
        }
      }
    }

    // Build connected_integrations array (simple facts only)
    const connectedIntegrations: ConnectedIntegration[] = (userIntegrations || []).map(ui => {
      const master = ui.integrations_master as { id: string; integration_name: string } | null;
      if (!master) return null;
      
      return {
        name: master.integration_name,
        connection_status: 'connected' as const,
      };
    }).filter((i): i is ConnectedIntegration => i !== null);

    // HARD GATING: Compute global metrics_state
    const globalMetricsState = computeGlobalMetricsState(globalHasEfficiencyMetrics, lastMetricSync);
    
    // HARD GATING: contributes_to_score is true ONLY if:
    // - has_efficiency_metrics === true
    // - metrics_state === 'active'
    const globalContributesToScore = globalHasEfficiencyMetrics && globalMetricsState === 'active';

    // Build SystemTruthSnapshot
    const snapshot: SystemTruthSnapshot = {
      connected_integrations: connectedIntegrations,
      ui_global_fusion_score: Math.round(uiGlobalFusionScore * 10) / 10, // Round to 1 decimal
      has_efficiency_metrics: globalHasEfficiencyMetrics,
      metrics_state: globalMetricsState,
      contributes_to_score: globalContributesToScore,
      last_updated_at: lastUpdatedAt,
    };

    const response: SystemIntegrationsResponse = {
      success: true,
      snapshot,
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
