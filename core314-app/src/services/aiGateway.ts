import { initSupabaseClient, getSupabaseFunctionUrl } from '../lib/supabase';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatContext {
  integration_name?: string;
  metric_data?: Record<string, unknown>;
  user_goal?: string;
}

export interface DataContext {
  global_fusion_score: number;
  top_deficiencies: Array<{
    integration: string;
    score: number;
    issue: string;
  }>;
  system_health: string;
  anomalies_today: number;
  recent_alerts: Array<{
    type: string;
    message: string;
    timestamp: string;
  }>;
  integration_performance: Array<{
    name: string;
    status: string;
    efficiency: number;
  }>;
  recent_optimizations: number;
}

export interface DataContextResponse {
  success: boolean;
  data?: DataContext;
  error?: string;
}

export interface ChatResponse {
  success: boolean;
  reply?: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  error?: string;
  quota_exceeded?: boolean;
}

// ============================================================
// SYSTEM TRUTH SNAPSHOT - SINGLE SOURCE OF TRUTH
// This MUST match the response from /api/system/integrations
// BOTH UI and AI consume this snapshot - they MUST NEVER contradict
// ============================================================

// Metrics State (UI-LOCKED terminology)
// observing: No efficiency metrics exist yet (HARD GATED)
// stabilizing: Has some metrics but still collecting data
// active: Has recent metrics AND contributing to score
export type MetricsState = 'observing' | 'stabilizing' | 'active';

// Per-integration facts
export interface ConnectedIntegration {
  name: string;
  connection_status: 'connected' | 'disconnected';
}

// SystemTruthSnapshot - SINGLE SOURCE OF TRUTH for UI and AI
export interface SystemTruthSnapshot {
  connected_integrations: ConnectedIntegration[];
  ui_global_fusion_score: number;
  has_efficiency_metrics: boolean;
  metrics_state: MetricsState;
  contributes_to_score: boolean;
  last_updated_at: string;
}

export interface SystemIntegrationsResponse {
  success: boolean;
  snapshot: SystemTruthSnapshot;
  error?: string;
}

// FORBIDDEN WORDS - AI must NEVER use these
const FORBIDDEN_WORDS = [
  'critical',
  'misconfigured',
  'no integrations',
  'score is actually',
];

// ============================================================
// SYSTEM FACT QUERY PATTERNS
// These patterns identify queries that ask about SYSTEM FACTS
// (integration existence, count, names, connection status)
// SYSTEM FACTS must NEVER be answered by AI - only deterministically
// ============================================================

const SYSTEM_FACT_PATTERNS = [
  // Integration existence queries
  /what integrations? (?:are |is )?connected/i,
  /which integrations? (?:are |is |do i have )?connected/i,
  /what integrations? do i have/i,
  /which integrations? do i have/i,
  /list (?:my |the )?(?:connected )?integrations?/i,
  /show (?:me )?(?:my |the )?(?:connected )?integrations?/i,
  /(?:tell me |what are )(?:my |the )?(?:connected )?integrations?/i,
  // Specific integration existence queries
  /do i have (\w+) connected/i,
  /is (\w+) connected/i,
  /(?:am i |are we )connected to (\w+)/i,
  /(?:have i |did i )connect(?:ed)? (\w+)/i,
  // Count queries
  /how many integrations? (?:are |do i have )?connected/i,
  /how many integrations? do i have/i,
  /(?:what is |what's )the (?:number|count) of (?:my )?integrations?/i,
  // General existence queries
  /(?:what|which) (?:apps?|tools?|services?) (?:are |is )?connected/i,
  /(?:what|which) (?:apps?|tools?|services?) do i have/i,
  // Reporting data queries (AI must NOT answer these)
  /(?:are |is )(?:my )?integrations? reporting/i,
  /(?:are |is )(?:my )?integrations? sending data/i,
  /(?:what|which) integrations? (?:are |is )?reporting/i,
];

/**
 * Check if a query is a SYSTEM FACT query
 * System fact queries ask about integration existence, count, names, or connection status
 * These queries must NEVER be answered by AI - only deterministically from system data
 */
export function isSystemFactQuery(query: string): boolean {
  return SYSTEM_FACT_PATTERNS.some(pattern => pattern.test(query));
}

/**
 * Generate a deterministic response for system fact queries
 * This function NEVER calls AI - it builds responses purely from SystemTruthSnapshot
 * 
 * MANDATORY RESPONSE TEMPLATE (NO VARIATION ALLOWED):
 * 1. ACKNOWLEDGE FACTS (list integrations)
 * 2. STATE CURRENT SYSTEM STATE (verbatim from snapshot)
 * 3. EXPLAIN WHAT CORE314 IS DOING NEXT (never user blame)
 * 
 * FORBIDDEN WORDS: 'critical', 'misconfigured', 'no integrations', 'score is actually'
 */
export function generateDeterministicFactResponse(
  query: string,
  snapshot: SystemTruthSnapshot
): string {
  const normalizedQuery = query.toLowerCase();
  const integrations = snapshot.connected_integrations;
  
  // Check if asking about a specific integration
  const specificIntegrationMatch = normalizedQuery.match(/(?:do i have |is |am i connected to |have i connected? )(\w+)/i);
  if (specificIntegrationMatch) {
    const requestedIntegration = specificIntegrationMatch[1].toLowerCase();
    const found = integrations.find(i => i.name.toLowerCase().includes(requestedIntegration));
    
    if (found) {
      // Use EXACT template format even for specific integration queries
      return generateFullResponseFromSnapshot(snapshot, `Yes, ${found.name} is connected to your Core314 account.`);
    } else {
      return `No, ${specificIntegrationMatch[1]} is not currently connected to your Core314 account.\n\n` +
        `To connect it, visit the Integration Hub.\n\n[Based on Core314 system data]`;
    }
  }
  
  // Check if asking about count
  if (/how many/i.test(normalizedQuery)) {
    if (integrations.length === 0) {
      return `You currently have 0 integrations connected to your Core314 account.\n\n` +
        `To get started, visit the Integration Hub to connect your first integration.\n\n[Based on Core314 system data]`;
    }
    return generateFullResponseFromSnapshot(snapshot);
  }
  
  // Check if asking about fusion score
  if (/fusion score|global score|my score/i.test(normalizedQuery)) {
    return generateFullResponseFromSnapshot(snapshot);
  }
  
  // Check if asking about contribution status
  if (/contribut|reporting|sending data/i.test(normalizedQuery)) {
    return generateFullResponseFromSnapshot(snapshot);
  }
  
  // Default: use full template for all fact queries
  if (integrations.length === 0) {
    return `You currently have no integrations connected to your Core314 account.\n\n` +
      `To get started, visit the Integration Hub to connect your first integration.\n\n[Based on Core314 system data]`;
  }
  
  return generateFullResponseFromSnapshot(snapshot);
}

/**
 * Generate the EXACT response template from SystemTruthSnapshot
 * This is the MANDATORY format - NO VARIATION ALLOWED
 */
function generateFullResponseFromSnapshot(
  snapshot: SystemTruthSnapshot,
  prefix?: string
): string {
  const integrations = snapshot.connected_integrations;
  
  // 1. ACKNOWLEDGE FACTS - List integrations
  let response = prefix ? `${prefix}\n\n` : '';
  response += `I see the following integrations connected to your Core314 account:\n`;
  integrations.forEach(int => {
    response += `- ${int.name}\n`;
  });
  response += '\n';
  
  // 2. STATE CURRENT SYSTEM STATE - Verbatim from snapshot
  response += `Your current Global Fusion Score is ${snapshot.ui_global_fusion_score}. `;
  
  // STATE-GATING: Use EXACT phrasing based on metrics_state
  if (snapshot.metrics_state === 'observing') {
    // HARD GATED: No metrics = observing state
    response += `This is a baseline score while Core314 is observing activity.\n`;
    response += `These integrations are connected and being observed. Efficiency metrics are not yet contributing.\n`;
  } else if (snapshot.metrics_state === 'stabilizing') {
    // Has some metrics but not fully active
    response += `This score is based on early efficiency signals that are still stabilizing.\n`;
    response += `These integrations are connected and metrics are being collected. Full scoring will begin as more data is observed.\n`;
  } else if (snapshot.metrics_state === 'active') {
    // Fully active and contributing
    response += `This score reflects active efficiency signals from your connected integrations.\n`;
    response += `All connected integrations are actively contributing to your fusion score.\n`;
  }
  
  // 3. EXPLAIN WHAT CORE314 IS DOING NEXT - Never user blame
  response += `Core314 will automatically begin scoring as activity data is collected.\n\n`;
  
  response += `[Based on Core314 system data]`;
  
  return response;
}

export interface ScenarioCard {
  id: string;
  title: string;
  description: string;
  expected_impact: string;
  confidence: number;
  recommended_action: string;
  horizon: string;
  tags: string[];
}

export interface ScenarioRequest {
  goal?: string;
  metrics_snapshot?: Record<string, unknown>;
  horizon?: string;
  constraints?: string[];
}

export interface ScenarioResponse {
  success: boolean;
  scenarios?: ScenarioCard[];
  error?: string;
}

/**
 * AUTHORITATIVE SYSTEM FACT ENDPOINT
 * Fetch system integrations from /api/system/integrations
 * This is the SINGLE SOURCE OF TRUTH for integration facts
 * This endpoint NEVER invokes any LLM
 */
// Default empty snapshot for error cases
const EMPTY_SNAPSHOT: SystemTruthSnapshot = {
  connected_integrations: [],
  ui_global_fusion_score: 50,
  has_efficiency_metrics: false,
  metrics_state: 'observing',
  contributes_to_score: false,
  last_updated_at: new Date().toISOString(),
};

export async function fetchSystemIntegrations(): Promise<SystemIntegrationsResponse> {
  try {
    const supabase = await initSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { success: false, snapshot: EMPTY_SNAPSHOT, error: 'Not authenticated' };
    }

    // Call the authoritative system fact endpoint
    const response = await fetch('/api/system/integrations', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Failed to fetch system integrations:', response.statusText);
      return { success: false, snapshot: EMPTY_SNAPSHOT, error: `HTTP ${response.status}: ${response.statusText}` };
    }

    const result: SystemIntegrationsResponse = await response.json();
    return result;
  } catch (error) {
    console.error('System integrations fetch error:', error);
    return { 
      success: false, 
      snapshot: EMPTY_SNAPSHOT, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Fetch live data context for AI requests
 */
export async function fetchDataContext(): Promise<DataContext | null> {
  try {
    const supabase = await initSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return null;
    }

    const url = await getSupabaseFunctionUrl('ai_data_context');
    const response = await fetch(
      url,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.error('Failed to fetch data context:', response.statusText);
      return null;
    }

    const result: DataContextResponse = await response.json();
    return result.success ? result.data || null : null;
  } catch (error) {
    console.error('Data context fetch error:', error);
    return null;
  }
}

/**
 * Chat with Core314 AI using the conversational insight engine with live data context
 * 
 * CRITICAL: This function enforces the FACTS-FIRST rule:
 * 1. ALWAYS fetch system integrations FIRST (from /api/system/integrations)
 * 2. If query is a SYSTEM FACT query, return deterministic response (NO AI call)
 * 3. Only call AI for non-fact queries (why, how, explain, recommend, predict)
 * 
 * AI token usage MUST be zero for system fact queries.
 */
export async function chatWithCore314(
  messages: ChatMessage[],
  context?: ChatContext
): Promise<ChatResponse> {
  try {
    const supabase = await initSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    // ============================================================
    // FACTS-FIRST ENFORCEMENT (MANDATORY)
    // Before ANY AI call, fetch system facts from authoritative endpoint
    // ============================================================
    
    // Extract the latest user message for classification
    const userMessages = messages.filter(m => m.role === 'user');
    const latestUserQuery = userMessages[userMessages.length - 1]?.content || '';
    
    // ALWAYS fetch system integrations FIRST - this is the SINGLE SOURCE OF TRUTH
    const systemIntegrations = await fetchSystemIntegrations();
    
    // Check if this is a SYSTEM FACT query
    if (isSystemFactQuery(latestUserQuery)) {
      console.log('FACTS-FIRST: System fact query detected, returning deterministic response (no AI)');
      
      // FAIL-CLOSED: If we can't get facts, return error - do NOT fall back to AI
      if (!systemIntegrations.success) {
        return {
          success: false,
          error: 'Unable to retrieve integration facts. Please try again.',
        };
      }
      
      // Generate deterministic response from SystemTruthSnapshot (NO AI)
      const deterministicResponse = generateDeterministicFactResponse(
        latestUserQuery,
        systemIntegrations.snapshot
      );
      
      // Return with 0 AI tokens - this is a deterministic response
      return {
        success: true,
        reply: deterministicResponse,
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      };
    }
    
    // ============================================================
    // NON-FACT QUERY: Proceed to AI with facts injected
    // ============================================================

    const dataContext = await fetchDataContext();

    const url = await getSupabaseFunctionUrl('fusion_ai_gateway');
    const response = await fetch(
      url,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          messages, 
          context,
          data_context: dataContext,
          // Inject SystemTruthSnapshot so AI is always fact-aware
          system_truth_snapshot: systemIntegrations.success ? systemIntegrations.snapshot : EMPTY_SNAPSHOT,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.error || `HTTP ${response.status}: ${response.statusText}`,
        quota_exceeded: errorData.quota_exceeded,
      };
    }

    return await response.json();
  } catch (error) {
    console.error('Chat error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Generate predictive optimization scenarios
 */
export async function generateScenarios(
  request: ScenarioRequest = {}
): Promise<ScenarioResponse> {
  try {
    const supabase = await initSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    const url = await getSupabaseFunctionUrl('ai_scenario_generator');
    const response = await fetch(
      url,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.error || `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    return await response.json();
  } catch (error) {
    console.error('Scenario generation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Quick query helper for simple questions
 */
export async function quickQuery(question: string): Promise<string> {
  const response = await chatWithCore314([
    { role: 'user', content: question },
  ]);

  if (!response.success || !response.reply) {
    return response.error || 'Failed to get response';
  }

  return response.reply;
}
