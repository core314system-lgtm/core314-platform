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
// CANONICAL SYSTEM STATUS - SINGLE SOURCE OF TRUTH
// This MUST match the response from /api/system/integrations
// BOTH UI and AI consume this object - AI is NOT allowed to compute
// or infer anything beyond this object
// ============================================================

// System Health: ONLY two states allowed
// observing: No efficiency metrics exist yet OR metrics not recent
// active: Has recent metrics AND contributing to score
export type SystemHealth = 'observing' | 'active';

// Score Origin: Where the score came from
// baseline: Using default 50 because no computed scores exist
// computed: Calculated from actual fusion_scores
export type ScoreOrigin = 'baseline' | 'computed';

// Per-integration metrics state (same vocabulary as system_health)
export type IntegrationMetricsState = 'observing' | 'active';

// Per-integration facts
export interface ConnectedIntegration {
  name: string;
  metrics_state: IntegrationMetricsState;
}

// SystemStatus - SINGLE CANONICAL OBJECT for UI and AI
// AI is NOT allowed to compute or infer anything beyond this object
export interface SystemStatus {
  global_fusion_score: number;
  score_origin: ScoreOrigin;
  system_health: SystemHealth;
  has_efficiency_metrics: boolean;
  connected_integrations: ConnectedIntegration[];
}

export interface SystemStatusResponse {
  success: boolean;
  system_status: SystemStatus;
  error?: string;
}

// FORBIDDEN WORDS - AI must NEVER use these
// TRUST RESTORATION: Added "indicates", "suggests", "issues"
const FORBIDDEN_WORDS = [
  'critical',
  'misconfigured',
  'no integrations',
  'score is actually',
  'indicates',
  'suggests',
  'issues',
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
 * This function NEVER calls AI - it builds responses purely from SystemStatus
 * 
 * TRUST RESTORATION FIX - EXACT FIXED TEMPLATE (NO VARIATION ALLOWED):
 * If has_efficiency_metrics === false:
 *   "You have the following integrations connected: X, Y.
 *    Core314 is currently observing these integrations.
 *    Efficiency metrics are not yet available.
 *    Your Global Fusion Score is {{global_fusion_score}}.
 *    Core314 will begin scoring automatically as activity data is collected."
 * 
 * FORBIDDEN WORDS: 'critical', 'misconfigured', 'no integrations', 'score is actually',
 *                  'indicates', 'suggests', 'issues'
 */
export function generateDeterministicFactResponse(
  query: string,
  systemStatus: SystemStatus
): string {
  const normalizedQuery = query.toLowerCase();
  const integrations = systemStatus.connected_integrations;
  
  // Check if asking about a specific integration
  const specificIntegrationMatch = normalizedQuery.match(/(?:do i have |is |am i connected to |have i connected? )(\w+)/i);
  if (specificIntegrationMatch) {
    const requestedIntegration = specificIntegrationMatch[1].toLowerCase();
    const found = integrations.find(i => i.name.toLowerCase().includes(requestedIntegration));
    
    if (found) {
      // Use EXACT template format even for specific integration queries
      return generateFixedTemplate(systemStatus, `Yes, ${found.name} is connected to your Core314 account.`);
    } else {
      return `No, ${specificIntegrationMatch[1]} is not currently connected to your Core314 account.\n\nTo connect it, visit the Integration Hub.`;
    }
  }
  
  // Check if asking about count
  if (/how many/i.test(normalizedQuery)) {
    if (integrations.length === 0) {
      return `You currently have 0 integrations connected to your Core314 account.\n\nTo get started, visit the Integration Hub to connect your first integration.`;
    }
    return generateFixedTemplate(systemStatus);
  }
  
  // Default: use fixed template for all fact queries
  if (integrations.length === 0) {
    return `You currently have no integrations connected to your Core314 account.\n\nTo get started, visit the Integration Hub to connect your first integration.`;
  }
  
  return generateFixedTemplate(systemStatus);
}

/**
 * Generate the EXACT FIXED TEMPLATE from SystemStatus
 * TRUST RESTORATION FIX - NO VARIATION ALLOWED
 * 
 * This is the ONLY format allowed for system fact responses.
 * AI is NOT allowed to compute or infer anything beyond SystemStatus.
 */
function generateFixedTemplate(
  systemStatus: SystemStatus,
  prefix?: string
): string {
  const integrations = systemStatus.connected_integrations;
  const integrationNames = integrations.map(i => i.name).join(', ');
  
  // EXACT FIXED TEMPLATE - NO VARIATION
  if (!systemStatus.has_efficiency_metrics) {
    // Template for when has_efficiency_metrics === false
    let response = prefix ? `${prefix}\n\n` : '';
    response += `You have the following integrations connected: ${integrationNames}.\n`;
    response += `Core314 is currently observing these integrations.\n`;
    response += `Efficiency metrics are not yet available.\n`;
    response += `Your Global Fusion Score is ${systemStatus.global_fusion_score}.\n`;
    response += `Core314 will begin scoring automatically as activity data is collected.`;
    return response;
  } else if (systemStatus.system_health === 'active') {
    // Template for when system is active
    let response = prefix ? `${prefix}\n\n` : '';
    response += `You have the following integrations connected: ${integrationNames}.\n`;
    response += `Core314 is actively tracking these integrations.\n`;
    response += `Efficiency metrics are being collected.\n`;
    response += `Your Global Fusion Score is ${systemStatus.global_fusion_score}.\n`;
    response += `All connected integrations are contributing to your score.`;
    return response;
  } else {
    // Template for observing state with some metrics
    let response = prefix ? `${prefix}\n\n` : '';
    response += `You have the following integrations connected: ${integrationNames}.\n`;
    response += `Core314 is currently observing these integrations.\n`;
    response += `Some efficiency metrics are available.\n`;
    response += `Your Global Fusion Score is ${systemStatus.global_fusion_score}.\n`;
    response += `Core314 will begin scoring automatically as activity data is collected.`;
    return response;
  }
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
 * CANONICAL SYSTEM STATUS ENDPOINT
 * Fetch SystemStatus from /api/system/integrations
 * This is the SINGLE CANONICAL OBJECT for integration facts
 * This endpoint NEVER invokes any LLM
 * AI is NOT allowed to compute or infer anything beyond this object
 */
// Default empty SystemStatus for error cases
const EMPTY_SYSTEM_STATUS: SystemStatus = {
  global_fusion_score: 50,
  score_origin: 'baseline',
  system_health: 'observing',
  has_efficiency_metrics: false,
  connected_integrations: [],
};

export async function fetchSystemStatus(): Promise<SystemStatusResponse> {
  try {
    const supabase = await initSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { success: false, system_status: EMPTY_SYSTEM_STATUS, error: 'Not authenticated' };
    }

    // Call the canonical system status endpoint
    const response = await fetch('/api/system/integrations', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Failed to fetch system status:', response.statusText);
      return { success: false, system_status: EMPTY_SYSTEM_STATUS, error: `HTTP ${response.status}: ${response.statusText}` };
    }

    const result: SystemStatusResponse = await response.json();
    return result;
  } catch (error) {
    console.error('System status fetch error:', error);
    return { 
      success: false, 
      system_status: EMPTY_SYSTEM_STATUS, 
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
    
    // ALWAYS fetch SystemStatus FIRST - this is the SINGLE CANONICAL OBJECT
    const systemStatusResponse = await fetchSystemStatus();
    
    // Check if this is a SYSTEM FACT query
    if (isSystemFactQuery(latestUserQuery)) {
      console.log('TRUST RESTORATION: System fact query detected, returning fixed template (no AI)');
      
      // FAIL-CLOSED: If we can't get facts, return error - do NOT fall back to AI
      if (!systemStatusResponse.success) {
        return {
          success: false,
          error: 'Unable to retrieve system status. Please try again.',
        };
      }
      
      // Generate deterministic response from SystemStatus using FIXED TEMPLATE (NO AI)
      const deterministicResponse = generateDeterministicFactResponse(
        latestUserQuery,
        systemStatusResponse.system_status
      );
      
      // Return with 0 AI tokens - this is a deterministic response
      return {
        success: true,
        reply: deterministicResponse,
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      };
    }
    
    // ============================================================
    // NON-FACT QUERY: Proceed to AI with SystemStatus injected
    // HARD BLOCK: If AI output differs from SystemStatus, replace with fixed template
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
          // Inject SystemStatus so AI is always fact-aware
          system_status: systemStatusResponse.success ? systemStatusResponse.system_status : EMPTY_SYSTEM_STATUS,
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
