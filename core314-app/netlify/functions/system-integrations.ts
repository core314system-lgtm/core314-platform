import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

/**
 * AUTHORITATIVE SYSTEM FACT ENDPOINT
 * GET /api/system/integrations
 * 
 * This endpoint is the SINGLE SOURCE OF TRUTH for integration facts.
 * It MUST:
 * - Query the same source used by the dashboard UI (user_integrations)
 * - Return factual data ONLY
 * - NEVER invoke any LLM
 * - NEVER depend on AI context or prompts
 * 
 * Response format:
 * {
 *   "integrations": [
 *     {
 *       "name": "Slack",
 *       "connection_status": "connected",
 *       "metrics_state": "stabilizing",
 *       "last_activity_timestamp": "2026-01-04T13:12:00Z"
 *     }
 *   ]
 * }
 */

// Metrics State (v1.1 terminology)
// active: Has recent metrics (within 14 days)
// stabilizing: Connected recently (<7 days) OR has some data but still stabilizing
// dormant: Connected but no recent activity (>30 days)
type MetricsState = 'active' | 'stabilizing' | 'dormant';

interface SystemIntegration {
  name: string;
  connection_status: 'connected' | 'disconnected';
  metrics_state: MetricsState;
  last_activity_timestamp: string | null;
}

interface SystemIntegrationsResponse {
  success: boolean;
  integrations: SystemIntegration[];
  error?: string;
}

const ACTIVE_THRESHOLD_DAYS = 14;
const EMERGING_THRESHOLD_DAYS = 7;
const DORMANT_THRESHOLD_DAYS = 30;

function computeMetricsState(
  connectedAt: string | null,
  lastDataAt: string | null,
  hasMetrics: boolean
): MetricsState {
  const now = new Date();
  const connectedDate = connectedAt ? new Date(connectedAt) : null;
  const lastDataDate = lastDataAt ? new Date(lastDataAt) : null;
  
  // If connected recently (< 7 days), it's stabilizing
  if (connectedDate) {
    const daysSinceConnected = (now.getTime() - connectedDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceConnected < EMERGING_THRESHOLD_DAYS) {
      return 'stabilizing';
    }
  }
  
  // If has recent data (< 14 days), it's active
  if (lastDataDate) {
    const daysSinceData = (now.getTime() - lastDataDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceData < ACTIVE_THRESHOLD_DAYS) {
      return 'active';
    }
    // If no data for > 30 days, it's dormant
    if (daysSinceData > DORMANT_THRESHOLD_DAYS) {
      return 'dormant';
    }
  }
  
  // If has metrics but not recent, it's stabilizing
  if (hasMetrics) {
    return 'stabilizing';
  }
  
  // No metrics at all - dormant
  return 'dormant';
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

    // Fetch fusion scores for user's integrations (for last_activity_timestamp)
    const { data: fusionScores } = await supabase
      .from('fusion_scores')
      .select('integration_id, updated_at')
      .eq('user_id', userId);

    const scoreMap = new Map<string, string>();
    fusionScores?.forEach(s => scoreMap.set(s.integration_id, s.updated_at));

    // Fetch distinct metric names per integration for the user, with most recent synced_at
    const { data: userMetrics } = await supabase
      .from('fusion_metrics')
      .select('integration_id, synced_at')
      .eq('user_id', userId);

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

    // Build integrations array with FACTS ONLY
    const integrations: SystemIntegration[] = (userIntegrations || []).map(ui => {
      const master = ui.integrations_master as { id: string; integration_name: string } | null;
      if (!master) return null;
      
      const metricsData = metricsMap.get(ui.integration_id);
      const lastMetricSync = metricsData?.lastSyncedAt || null;
      const lastScoreUpdate = scoreMap.get(ui.integration_id) || null;
      const lastDataAt = lastMetricSync && lastScoreUpdate 
        ? (lastMetricSync > lastScoreUpdate ? lastMetricSync : lastScoreUpdate)
        : (lastMetricSync || lastScoreUpdate);
      const connectedAt = ui.date_added || null;
      const hasMetrics = metricsData?.hasMetrics || false;
      
      return {
        name: master.integration_name,
        connection_status: 'connected' as const, // All rows from user_integrations with status='active' are connected
        metrics_state: computeMetricsState(connectedAt, lastDataAt, hasMetrics),
        last_activity_timestamp: lastDataAt,
      };
    }).filter((i): i is SystemIntegration => i !== null);

    const response: SystemIntegrationsResponse = {
      success: true,
      integrations,
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
