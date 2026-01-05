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
// AUTHORITATIVE SYSTEM FACT TYPES
// These types represent the SINGLE SOURCE OF TRUTH for integration facts
// ============================================================

export type MetricsState = 'active' | 'stabilizing' | 'dormant';

export interface SystemIntegration {
  name: string;
  connection_status: 'connected' | 'disconnected';
  metrics_state: MetricsState;
  last_activity_timestamp: string | null;
}

export interface SystemIntegrationsResponse {
  success: boolean;
  integrations: SystemIntegration[];
  error?: string;
}

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
 * This function NEVER calls AI - it builds responses purely from system data
 */
export function generateDeterministicFactResponse(
  query: string,
  integrations: SystemIntegration[]
): string {
  const normalizedQuery = query.toLowerCase();
  
  // Check if asking about a specific integration
  const specificIntegrationMatch = normalizedQuery.match(/(?:do i have |is |am i connected to |have i connected? )(\w+)/i);
  if (specificIntegrationMatch) {
    const requestedIntegration = specificIntegrationMatch[1].toLowerCase();
    const found = integrations.find(i => i.name.toLowerCase().includes(requestedIntegration));
    
    if (found) {
      return `Yes, ${found.name} is connected to your Core314 account. ` +
        `Metrics state: ${found.metrics_state}. ` +
        (found.metrics_state === 'stabilizing' 
          ? 'Core314 will automatically begin evaluating efficiency signals as activity data is observed.'
          : found.metrics_state === 'active'
            ? 'This integration is actively contributing efficiency signals.'
            : 'This integration has been dormant. Core314 will resume evaluation when activity resumes.') +
        `\n\n[Based on Core314 system data]`;
    } else {
      return `No, ${specificIntegrationMatch[1]} is not currently connected to your Core314 account. ` +
        `To connect it, visit the Integration Hub.\n\n[Based on Core314 system data]`;
    }
  }
  
  // Check if asking about count
  if (/how many/i.test(normalizedQuery)) {
    if (integrations.length === 0) {
      return `You currently have 0 integrations connected to your Core314 account. ` +
        `To get started, visit the Integration Hub to connect your first integration.\n\n[Based on Core314 system data]`;
    }
    return `You have ${integrations.length} integration${integrations.length > 1 ? 's' : ''} connected to your Core314 account: ` +
      `${integrations.map(i => i.name).join(', ')}.\n\n[Based on Core314 system data]`;
  }
  
  // Default: list all integrations
  if (integrations.length === 0) {
    return `You currently have no integrations connected to your Core314 account.\n\n` +
      `To get started, visit the Integration Hub to connect your first integration. ` +
      `Core314 supports Slack, Microsoft Teams, and other business tools.\n\n[Based on Core314 system data]`;
  }
  
  let response = `I see the following integrations connected to your Core314 account:\n`;
  integrations.forEach(int => {
    response += `- ${int.name}\n`;
  });
  response += '\n';
  
  // Describe metric availability STATE (separate from existence FACT)
  const activeIntegrations = integrations.filter(i => i.metrics_state === 'active');
  const stabilizingIntegrations = integrations.filter(i => i.metrics_state === 'stabilizing');
  const dormantIntegrations = integrations.filter(i => i.metrics_state === 'dormant');
  
  if (activeIntegrations.length > 0 && stabilizingIntegrations.length > 0) {
    response += `${activeIntegrations.map(i => i.name).join(' and ')} ${activeIntegrations.length > 1 ? 'are' : 'is'} actively contributing efficiency signals. `;
    response += `${stabilizingIntegrations.map(i => i.name).join(' and ')} ${stabilizingIntegrations.length > 1 ? 'are' : 'is'} still stabilizing and will begin contributing as activity data is observed.\n\n`;
  } else if (activeIntegrations.length > 0) {
    response += `All connected integrations are actively contributing efficiency signals to your Core314 dashboard.\n\n`;
  } else if (stabilizingIntegrations.length > 0) {
    response += `At this time, efficiency metrics are still stabilizing, so these integrations are not yet contributing scored efficiency signals. `;
    response += `Core314 will automatically begin evaluating them as activity data is observed.\n\n`;
  } else if (dormantIntegrations.length > 0) {
    response += `These integrations have been dormant. Core314 will resume evaluation when activity resumes.\n\n`;
  } else {
    response += `Core314 is monitoring these integrations. Efficiency metrics will be computed as activity data accumulates.\n\n`;
  }
  
  response += `[Based on Core314 system data for: ${integrations.map(i => i.name).join(', ')}]`;
  
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
export async function fetchSystemIntegrations(): Promise<SystemIntegrationsResponse> {
  try {
    const supabase = await initSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { success: false, integrations: [], error: 'Not authenticated' };
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
      return { success: false, integrations: [], error: `HTTP ${response.status}: ${response.statusText}` };
    }

    const result: SystemIntegrationsResponse = await response.json();
    return result;
  } catch (error) {
    console.error('System integrations fetch error:', error);
    return { 
      success: false, 
      integrations: [], 
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
      
      // Generate deterministic response from system data (NO AI)
      const deterministicResponse = generateDeterministicFactResponse(
        latestUserQuery,
        systemIntegrations.integrations
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
          // Inject system facts so AI is always fact-aware
          system_integrations: systemIntegrations.success ? systemIntegrations.integrations : [],
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
