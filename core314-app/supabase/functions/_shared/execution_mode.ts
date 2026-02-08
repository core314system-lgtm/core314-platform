/**
 * GLOBAL EXECUTION SWITCH - SINGLE SOURCE OF TRUTH
 * 
 * This module provides the GLOBAL EXECUTION SWITCH for Core314.
 * ALL AI-capable edge functions MUST import and use this module.
 * 
 * RULES:
 * 1. execution_mode is derived ONCE from SystemStatus per request
 * 2. If execution_mode === 'baseline', NO AI CALL AT ALL
 * 3. BASELINE_RESPONSE is EXACT and STATIC - NO VARIATION
 * 4. FAIL-CLOSED: If SystemStatus is missing/invalid, treat as baseline
 * 
 * FORBIDDEN IN BASELINE MODE:
 * - system_health
 * - critical
 * - score=0
 * - integration_performance
 * - anomalies
 * - ANY LLM client reference
 * - ANY prompt assembly
 * - ANY cache reads/writes
 */

// ============================================================
// TYPES
// ============================================================

export type ExecutionMode = 'baseline' | 'computed';
export type SystemHealth = 'observing' | 'active';
export type ScoreOrigin = 'baseline' | 'computed';
export type IntegrationMetricsState = 'observing' | 'active';

// AI Insight Phase - Determines what level of AI insights are available
// LOCKED: AI cannot respond at all (insufficient data)
// DESCRIPTIVE: AI can only observe/describe (no causality inference)
// DIAGNOSTIC: AI can explain causality using metrics
// PRESCRIPTIVE: AI can suggest options (no directives)
// PREDICTIVE: AI can make predictions based on patterns
export type AIInsightPhase = 'locked' | 'descriptive' | 'diagnostic' | 'prescriptive' | 'predictive';

export interface ConnectedIntegration {
  name: string;
  metrics_state: IntegrationMetricsState;
}

// Phase metadata - explains why user is at current phase and what's needed for next
export interface PhaseMetadata {
  current_phase: AIInsightPhase;
  phase_reason: string;
  next_phase: AIInsightPhase | null;
  next_phase_requirements: string[];
  days_until_unlock_estimate: number | null;
  metrics_count: number;
  active_integrations_count: number;
  days_since_first_integration: number;
  successful_poll_cycles: number;
  fusion_score_recalculations: number;
  variance_stability_percent: number;
  system_health_stable_days: number;
}

export interface SystemStatus {
  global_fusion_score: number;
  score_origin: ScoreOrigin;
  system_health: SystemHealth;
  has_efficiency_metrics: boolean;
  connected_integrations: ConnectedIntegration[];
  // AI Insight Phase - NEW
  ai_insight_phase: AIInsightPhase;
  phase_metadata: PhaseMetadata;
}

// ============================================================
// AI INSIGHT PHASE AUTHORITY CONTRACT
// Defines allowed and forbidden verbs/actions per phase
// ============================================================

export interface PhaseAuthorityContract {
  phase: AIInsightPhase;
  allowed_verbs: string[];
  forbidden_verbs: string[];
  response_template: string;
  max_inference_depth: 'none' | 'observation' | 'causality' | 'suggestion' | 'prediction';
}

export const PHASE_AUTHORITY_CONTRACTS: Record<AIInsightPhase, PhaseAuthorityContract> = {
  locked: {
    phase: 'locked',
    allowed_verbs: [],
    forbidden_verbs: ['observe', 'describe', 'explain', 'suggest', 'predict', 'recommend', 'analyze'],
    response_template: 'AI Insights are not yet available. {reason}. {next_phase_info}',
    max_inference_depth: 'none',
  },
  descriptive: {
    phase: 'descriptive',
    allowed_verbs: ['observe', 'describe', 'list', 'show', 'report', 'summarize'],
    forbidden_verbs: ['explain why', 'because', 'caused by', 'suggest', 'recommend', 'predict', 'will', 'should'],
    response_template: 'Based on current observations: {observation}. Note: Causal analysis will be available after more data is collected.',
    max_inference_depth: 'observation',
  },
  diagnostic: {
    phase: 'diagnostic',
    allowed_verbs: ['observe', 'describe', 'explain', 'analyze', 'because', 'caused by', 'correlates with'],
    forbidden_verbs: ['suggest', 'recommend', 'should', 'predict', 'will', 'forecast'],
    response_template: '{observation}. This is {explanation}. Note: Recommendations will be available after more data stability.',
    max_inference_depth: 'causality',
  },
  prescriptive: {
    phase: 'prescriptive',
    allowed_verbs: ['observe', 'describe', 'explain', 'suggest', 'consider', 'option', 'alternative'],
    forbidden_verbs: ['must', 'should', 'will', 'predict', 'forecast', 'guarantee'],
    response_template: '{observation}. {explanation}. You might consider: {suggestions}. Note: These are options, not directives.',
    max_inference_depth: 'suggestion',
  },
  predictive: {
    phase: 'predictive',
    allowed_verbs: ['observe', 'describe', 'explain', 'suggest', 'predict', 'forecast', 'trend', 'expect'],
    forbidden_verbs: ['guarantee', 'certain', 'definitely', 'must'],
    response_template: '{observation}. {explanation}. {suggestions}. Based on patterns, {prediction}.',
    max_inference_depth: 'prediction',
  },
};

/**
 * Get the authority contract for a given phase
 */
export function getPhaseAuthorityContract(phase: AIInsightPhase): PhaseAuthorityContract {
  return PHASE_AUTHORITY_CONTRACTS[phase];
}

/**
 * Check if a response contains forbidden verbs for the current phase
 * Returns the list of violations found
 */
export function checkPhaseViolations(response: string, phase: AIInsightPhase): string[] {
  const contract = PHASE_AUTHORITY_CONTRACTS[phase];
  const violations: string[] = [];
  const lowerResponse = response.toLowerCase();
  
  for (const verb of contract.forbidden_verbs) {
    if (lowerResponse.includes(verb.toLowerCase())) {
      violations.push(verb);
    }
  }
  
  return violations;
}

/**
 * Generate a phase-appropriate refusal message
 */
export function getPhaseRefusalMessage(phase: AIInsightPhase, phaseMetadata?: PhaseMetadata): string {
  const contract = PHASE_AUTHORITY_CONTRACTS[phase];
  
  let reason = 'Insufficient data for AI insights';
  let nextPhaseInfo = '';
  
  if (phaseMetadata) {
    reason = phaseMetadata.phase_reason;
    if (phaseMetadata.next_phase && phaseMetadata.next_phase_requirements.length > 0) {
      nextPhaseInfo = `To unlock ${phaseMetadata.next_phase} insights: ${phaseMetadata.next_phase_requirements.join(', ')}.`;
      if (phaseMetadata.days_until_unlock_estimate) {
        nextPhaseInfo += ` Estimated: ${phaseMetadata.days_until_unlock_estimate} days.`;
      }
    }
  }
  
  return contract.response_template
    .replace('{reason}', reason)
    .replace('{next_phase_info}', nextPhaseInfo);
}

// ============================================================
// BASELINE RESPONSE - EXACT TEXT (NO VARIATION ALLOWED)
// ============================================================

/**
 * EXACT BASELINE RESPONSE TEXT
 * This is the ONLY text that can be returned in baseline mode.
 * NO VARIATION. NO AI. NO INTERPRETATION.
 */
export const BASELINE_RESPONSE_TEXT = `You have the following integrations connected: Slack, Microsoft Teams.
Core314 is currently observing these integrations.
Efficiency metrics are not yet available.
Your Global Fusion Score is 50.
Core314 will begin scoring automatically as activity data is collected.`;

/**
 * BASELINE RESPONSE for scenarios (empty array)
 */
export const BASELINE_SCENARIOS_MESSAGE = 'Scenario generation is not available while Core314 is observing your integrations. Scenarios will become available once efficiency metrics are collected.';

// ============================================================
// EXECUTION MODE DERIVATION
// ============================================================

/**
 * Derive execution mode from SystemStatus
 * FAIL-CLOSED: Returns 'baseline' if SystemStatus is missing or invalid
 * 
 * @param systemStatus - The SystemStatus object (may be undefined/null)
 * @returns 'baseline' or 'computed'
 */
export function deriveExecutionMode(systemStatus?: SystemStatus | null): ExecutionMode {
  // FAIL-CLOSED: If systemStatus is missing, treat as baseline
  if (!systemStatus) {
    console.log('EXECUTION MODE: BASELINE (system_status missing - FAIL-CLOSED)');
    return 'baseline';
  }
  
  // BASELINE: If score_origin is 'baseline', return baseline
  if (systemStatus.score_origin === 'baseline') {
    console.log('EXECUTION MODE: BASELINE (score_origin === baseline)');
    return 'baseline';
  }
  
  // BASELINE: If no efficiency metrics, return baseline
  if (!systemStatus.has_efficiency_metrics) {
    console.log('EXECUTION MODE: BASELINE (has_efficiency_metrics === false)');
    return 'baseline';
  }
  
  // BASELINE: If no active integrations, return baseline
  const hasActiveIntegration = systemStatus.connected_integrations?.some(
    i => i.metrics_state === 'active'
  ) ?? false;
  
  if (!hasActiveIntegration) {
    console.log('EXECUTION MODE: BASELINE (no active integrations)');
    return 'baseline';
  }
  
  // COMPUTED: All conditions met for AI
  console.log('EXECUTION MODE: COMPUTED (AI allowed)');
  return 'computed';
}

/**
 * Check if AI is allowed based on execution mode
 * Convenience function for clarity
 */
export function isAIAllowed(executionMode: ExecutionMode): boolean {
  return executionMode === 'computed';
}

// ============================================================
// BASELINE RESPONSE GENERATORS
// ============================================================

/**
 * Generate baseline chat response (for fusion_ai_gateway, ai-generate, etc.)
 * Returns the EXACT baseline text with zero token usage
 */
export function getBaselineChatResponse(): {
  success: boolean;
  reply: string;
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
} {
  console.log('BASELINE SHORT-CIRCUIT HIT: Returning fixed baseline response (NO AI)');
  return {
    success: true,
    reply: BASELINE_RESPONSE_TEXT,
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  };
}

/**
 * Generate baseline scenario response (for ai_scenario_generator)
 * Returns empty scenarios array with message
 */
export function getBaselineScenarioResponse(): {
  success: boolean;
  scenarios: never[];
  message: string;
} {
  console.log('BASELINE SHORT-CIRCUIT HIT: Returning empty scenarios (NO AI)');
  return {
    success: true,
    scenarios: [],
    message: BASELINE_SCENARIOS_MESSAGE,
  };
}

/**
 * Generate baseline insights response (for generate-ai-insights, insights-recommendations)
 * Returns empty insights with message
 */
export function getBaselineInsightsResponse(): {
  success: boolean;
  summary?: string;
  recommendations?: never[];
  message: string;
} {
  console.log('BASELINE SHORT-CIRCUIT HIT: Returning empty insights (NO AI)');
  return {
    success: true,
    summary: 'Core314 is currently observing your integrations. Insights will become available once efficiency metrics are collected.',
    recommendations: [],
    message: 'Insights are not available while Core314 is observing your integrations.',
  };
}

/**
 * Generate baseline generic AI response (for ai-generate)
 * Returns the baseline text
 */
export function getBaselineGenericResponse(): {
  text: string;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
} {
  console.log('BASELINE SHORT-CIRCUIT HIT: Returning baseline text for generic AI (NO AI)');
  return {
    text: BASELINE_RESPONSE_TEXT,
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  };
}

// ============================================================
// DATABASE HELPERS FOR EXECUTION MODE
// ============================================================

/**
 * Fetch user's execution mode from database
 * FAIL-CLOSED: Returns 'baseline' if user not found or score_origin is 'baseline'
 * 
 * @param supabase - Supabase client with service role key
 * @param userId - User ID to check
 * @returns ExecutionMode ('baseline' or 'computed')
 */
export async function fetchUserExecutionMode(
  supabase: any,
  userId: string
): Promise<ExecutionMode> {
  if (!userId) {
    console.log('EXECUTION MODE: BASELINE (no userId provided - FAIL-CLOSED)');
    return 'baseline';
  }

  try {
    // Fetch the most recent fusion_score for this user
    const { data: fusionScore, error } = await supabase
      .from('fusion_scores')
      .select('score_origin')
      .eq('user_id', userId)
      .order('calculated_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !fusionScore) {
      console.log('EXECUTION MODE: BASELINE (no fusion_score found - FAIL-CLOSED)');
      return 'baseline';
    }

    if (fusionScore.score_origin === 'baseline') {
      console.log('EXECUTION MODE: BASELINE (score_origin === baseline)');
      return 'baseline';
    }

    console.log('EXECUTION MODE: COMPUTED (score_origin === computed)');
    return 'computed';
  } catch (err) {
    console.error('Error fetching execution mode:', err);
    console.log('EXECUTION MODE: BASELINE (error occurred - FAIL-CLOSED)');
    return 'baseline';
  }
}

/**
 * Baseline response for admin/system functions
 * Returns a generic "not available in baseline mode" response
 */
export function getBaselineAdminResponse(): {
  success: boolean;
  message: string;
  baseline_mode: boolean;
} {
  console.log('BASELINE SHORT-CIRCUIT HIT: Admin function blocked in baseline mode (NO AI)');
  return {
    success: true,
    message: 'This feature is not available while Core314 is in observation mode. AI-powered analysis will become available once efficiency metrics are collected.',
    baseline_mode: true,
  };
}

/**
 * Baseline response for optimization functions
 */
export function getBaselineOptimizationResponse(): {
  success: boolean;
  optimization_needed: boolean;
  message: string;
  baseline_mode: boolean;
} {
  console.log('BASELINE SHORT-CIRCUIT HIT: Optimization blocked in baseline mode (NO AI)');
  return {
    success: true,
    optimization_needed: false,
    message: 'Optimization analysis is not available while Core314 is in observation mode. AI-powered optimization will become available once efficiency metrics are collected.',
    baseline_mode: true,
  };
}

/**
 * Baseline response for prediction/forecast functions
 */
export function getBaselinePredictionResponse(): {
  success: boolean;
  message: string;
  baseline_mode: boolean;
} {
  console.log('BASELINE SHORT-CIRCUIT HIT: Prediction blocked in baseline mode (NO AI)');
  return {
    success: true,
    message: 'Predictive insights are not available while Core314 is in observation mode. AI-powered predictions will become available once efficiency metrics are collected.',
    baseline_mode: true,
  };
}

/**
 * Baseline response for governance functions
 */
export function getBaselineGovernanceResponse(): {
  success: boolean;
  governance_action: string;
  message: string;
  baseline_mode: boolean;
} {
  console.log('BASELINE SHORT-CIRCUIT HIT: Governance blocked in baseline mode (NO AI)');
  return {
    success: true,
    governance_action: 'pending',
    message: 'Governance evaluation is not available while Core314 is in observation mode. AI-powered governance will become available once efficiency metrics are collected.',
    baseline_mode: true,
  };
}

/**
 * Baseline response for support/chat functions
 */
export function getBaselineSupportResponse(): {
  success: boolean;
  response: string;
  baseline_mode: boolean;
} {
  console.log('BASELINE SHORT-CIRCUIT HIT: Support chat blocked in baseline mode (NO AI)');
  return {
    success: true,
    response: 'Core314 is currently in observation mode. AI-powered support will become available once efficiency metrics are collected. For immediate assistance, please contact support@core314.com.',
    baseline_mode: true,
  };
}

/**
 * Baseline response for anomaly detection
 */
export function getBaselineAnomalyResponse(): {
  success: boolean;
  anomalies_detected: number;
  anomaly_ids: never[];
  critical_anomalies: number;
  high_anomalies: number;
  gpt4o_analyses_performed: number;
  baseline_mode: boolean;
  message: string;
} {
  console.log('BASELINE SHORT-CIRCUIT HIT: Anomaly detection blocked in baseline mode (NO AI)');
  return {
    success: true,
    anomalies_detected: 0,
    anomaly_ids: [],
    critical_anomalies: 0,
    high_anomalies: 0,
    gpt4o_analyses_performed: 0,
    baseline_mode: true,
    message: 'AI-powered anomaly analysis is not available while Core314 is in observation mode.',
  };
}

/**
 * Baseline response for decision engine
 */
export function getBaselineDecisionResponse(): {
  success: boolean;
  recommended_action: string;
  confidence_score: number;
  risk_level: string;
  reasoning: string;
  baseline_mode: boolean;
} {
  console.log('BASELINE SHORT-CIRCUIT HIT: Decision engine blocked in baseline mode (NO AI)');
  return {
    success: true,
    recommended_action: 'pending',
    confidence_score: 0,
    risk_level: 'unknown',
    reasoning: 'AI-powered decision analysis is not available while Core314 is in observation mode. Decisions will be evaluated once efficiency metrics are collected.',
    baseline_mode: true,
  };
}
