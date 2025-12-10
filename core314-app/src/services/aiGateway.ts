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
