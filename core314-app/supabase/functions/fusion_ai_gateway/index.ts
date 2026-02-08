import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { corsHeaders } from '../_shared/cors.ts';
import { verifyAndAuthorizeWithPolicy } from '../_shared/auth.ts';
import { withSentry, breadcrumb, handleSentryTest, jsonError } from "../_shared/sentry.ts";
import { 
  deriveExecutionMode, 
  getBaselineChatResponse,
  BASELINE_RESPONSE_TEXT,
  type SystemStatus,
  type ExecutionMode 
} from '../_shared/execution_mode.ts';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// FORBIDDEN WORDS - AI must NEVER use these
const FORBIDDEN_WORDS = [
  'critical',
  'misconfigured',
  'no integrations',
  'score is actually',
  'indicates',
  'suggests',
  'issues',
];

interface ChatRequest {
  messages: ChatMessage[];
  context?: {
    integration_name?: string;
    metric_data?: Record<string, unknown>;
    user_goal?: string;
  };
  data_context?: Record<string, unknown>; // Live metrics from ai_data_context
  system_status?: SystemStatus; // CANONICAL SystemStatus from /api/system/integrations
}

interface ChatResponse {
  success: boolean;
  reply?: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  error?: string;
}

Deno.serve(withSentry(async (req) => {
  const testResponse = await handleSentryTest(req);
  if (testResponse) return testResponse;

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authResult = await verifyAndAuthorizeWithPolicy(
      req,
      supabase,
      ['platform_admin', 'operator', 'admin', 'manager'],
      'fusion_ai_gateway'
    );

    if (!authResult.ok) {
      return authResult.response;
    }

    const userId = authResult.context.userId;
    const orgId = authResult.context.orgId;

    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_tier, organization_id')
      .eq('id', userId)
      .single();

    if (!profile) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'User profile not found',
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const userTier = profile.subscription_tier;
    const userOrgId = profile.organization_id || orgId;

    const { data: hasQuota } = await supabase.rpc('check_ai_quota', {
      p_user_id: userId,
      p_tier: userTier,
    });

    if (!hasQuota) {
      const { data: quotaLimit } = await supabase.rpc('get_ai_quota_for_tier', {
        p_tier: userTier,
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: `AI request quota exceeded. Your ${userTier} plan includes ${quotaLimit} requests per month. Please upgrade to access more AI insights.`,
          quota_exceeded: true,
        }),
        {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ success: false, error: 'Method not allowed' }),
        {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const body: ChatRequest = await req.json();

    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Messages array is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // ============================================================
    // GLOBAL EXECUTION SWITCH - SINGLE SOURCE OF TRUTH
    // MANDATORY: This gate MUST be checked at the VERY TOP before ANY processing
    // FAIL-CLOSED: If system_status is missing OR execution_mode === 'baseline', NO AI CALL
    // ============================================================
    const systemStatus = body.system_status as SystemStatus | undefined;
    const execution_mode: ExecutionMode = deriveExecutionMode(systemStatus);
    
    // HARD DISABLE: If baseline mode, return IMMEDIATELY with fixed response
    // NO prompt assembly, NO cache access, NO LLM client reference
    if (execution_mode === 'baseline') {
      const baselineResponse = getBaselineChatResponse();
      return new Response(
        JSON.stringify(baselineResponse),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
    
    // ============================================================
    // AI ALLOWED: All conditions met (computed score, has metrics, active integration)
    // ============================================================
    console.log('AI ALLOWED: All conditions met - proceeding to OpenAI');

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    const openaiEndpoint = Deno.env.get('CORE314_AI_ENDPOINT') || 'https://api.openai.com/v1/chat/completions';
    const openaiModel = Deno.env.get('CORE314_AI_MODEL') || 'gpt-4o-mini';

    if (!openaiApiKey) {
      console.error('OPENAI_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'AI service not configured' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Intelligence Contract v1.1 - Server-side Query Router
    // CRITICAL: Route system fact queries to deterministic responses WITHOUT calling LLM
    
    // Extract the latest user message for classification
    const userMessages = body.messages.filter(m => m.role === 'user');
    const latestUserQuery = userMessages[userMessages.length - 1]?.content || '';
    const normalizedQuery = latestUserQuery.toLowerCase().replace(/[?!.,]/g, '').trim();
    
    // SYSTEM_FACT_QUERY patterns - whitelist approach (broad to maximize recall)
    // These queries ask about integration existence, count, or names
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
    ];
    
    // Check if query matches any SYSTEM_FACT_PATTERN
    const isSystemFactQuery = SYSTEM_FACT_PATTERNS.some(pattern => pattern.test(latestUserQuery));
    
    // Determine if this is a global (all integrations) or scoped query
    const isGlobalScope = !body.context?.integration_name;
    const scopedIntegrationName = body.context?.integration_name;
    
    // Extract intelligence snapshot (AUTHORITATIVE SOURCE) - Intelligence Contract v1.1
    // Prefer intelligence_snapshot if available, fall back to connected_integrations for backward compatibility
    interface IntegrationData {
      id?: string;
      name: string;
      fusion_score: number | null;
      trend: string;
      metrics_tracked: string[];
      data_status: string;
      confidence_level?: string;
      last_data_at?: string | null;
      connected_at?: string | null;
      contribution_to_global?: number;
      // Intelligence Contract v1.1 - Additional fields
      integration_key?: string;
      display_name?: string;
      connection_status?: 'connected' | 'disconnected';
      metrics_state?: 'active' | 'stabilizing' | 'dormant';
      contributes_to_global_score?: boolean;
      last_activity_timestamp?: string | null;
    }
    
    const snapshot = body.data_context?.intelligence_snapshot as {
      user_id?: string;
      connected_integrations: IntegrationData[];
      global_fusion_score: number;
      global_fusion_score_trend: string;
      total_integrations: number;
      active_integrations: number;
      emerging_integrations: number;
      dormant_integrations: number;
      last_analysis_timestamp: string | null;
      // Intelligence Contract v1.1 - Additional fields
      scoring_confidence?: 'high' | 'medium' | 'low';
      system_reasoning?: string;
    } | undefined;
    
    // Use snapshot if available, otherwise fall back to legacy connected_integrations
    let allIntegrations: IntegrationData[] = snapshot?.connected_integrations || 
      (body.data_context?.connected_integrations as IntegrationData[]) || [];
    
    // SERVER-SIDE ROUTING ENFORCEMENT (Intelligence Contract v1.0)
    // For scoped queries, filter the snapshot to ONLY include the requested integration
    let connectedIntegrations: IntegrationData[];
    if (isGlobalScope) {
      // Global scope: use all integrations
      connectedIntegrations = allIntegrations;
    } else {
      // Scoped query: filter to only the requested integration (case-insensitive match)
      connectedIntegrations = allIntegrations.filter(i => 
        i.name.toLowerCase() === scopedIntegrationName?.toLowerCase()
      );
      // If no exact match found, try partial match as fallback
      if (connectedIntegrations.length === 0) {
        connectedIntegrations = allIntegrations.filter(i => 
          i.name.toLowerCase().includes(scopedIntegrationName?.toLowerCase() || '') ||
          (scopedIntegrationName?.toLowerCase() || '').includes(i.name.toLowerCase())
        );
      }
    }
    
    // Pre-compute integration ranking for comparative queries (sorted by fusion_score ASC - weakest first)
    const rankedIntegrations = [...connectedIntegrations]
      .filter(i => i.fusion_score !== null)
      .sort((a, b) => {
        // Primary: fusion_score ASC (lower = weaker)
        const scoreDiff = (a.fusion_score ?? 0) - (b.fusion_score ?? 0);
        if (scoreDiff !== 0) return scoreDiff;
        // Secondary: trend (declining < stable < improving)
        const trendOrder: Record<string, number> = { 'declining': 0, 'stable': 1, 'improving': 2, 'up': 2, 'down': 0 };
        return (trendOrder[a.trend] ?? 1) - (trendOrder[b.trend] ?? 1);
      });
    
    const integrationNames = connectedIntegrations.map(i => i.name).join(', ');
    const allIntegrationNames = allIntegrations.map(i => i.name).join(', ');
    const weakestIntegration = rankedIntegrations[0];
    const strongestIntegration = rankedIntegrations[rankedIntegrations.length - 1];
    
    // Global metrics from snapshot
    const globalFusionScore = snapshot?.global_fusion_score ?? (body.data_context?.global_fusion_score as number) ?? 0;
    const globalTrend = snapshot?.global_fusion_score_trend ?? 'stable';

    // Intelligence Contract v1.1 - Extract scoring_confidence and system_reasoning
    const scoringConfidence = snapshot?.scoring_confidence || 'low';
    const systemReasoning = snapshot?.system_reasoning || 'No system reasoning available';

    // ============================================================
    // TRUST RESTORATION FIX - QUERY ROUTER (CONTROL PLANE)
    // CRITICAL: System fact queries NEVER invoke the LLM
    // Uses SystemStatus for CANONICAL truth enforcement
    // AI is NOT allowed to compute or infer anything beyond SystemStatus
    // ============================================================
    if (isSystemFactQuery) {
      console.log('TRUST RESTORATION: System fact query detected, bypassing LLM');
      
      // Use SystemStatus if available (CANONICAL), otherwise fall back to legacy data_context
      const systemStatus = body.system_status;
      
      // Generate deterministic response using EXACT FIXED TEMPLATE (NO VARIATION ALLOWED)
      let deterministicResponse = '';
      
      if (systemStatus) {
        // USE SystemStatus (CANONICAL OBJECT)
        const integrations = systemStatus.connected_integrations;
        const integrationNames = integrations.map(i => i.name).join(', ');
        
        if (integrations.length === 0) {
          deterministicResponse = 'You currently have no integrations connected to your Core314 account.\n';
          deterministicResponse += 'To get started, visit the Integration Hub to connect your first integration.';
        } else {
          // EXACT FIXED TEMPLATE - NO VARIATION ALLOWED
          if (!systemStatus.has_efficiency_metrics) {
            // Template for: has_efficiency_metrics === false
            deterministicResponse = `You have the following integrations connected: ${integrationNames}.\n`;
            deterministicResponse += `Core314 is currently observing these integrations.\n`;
            deterministicResponse += `Efficiency metrics are not yet available.\n`;
            deterministicResponse += `Your Global Fusion Score is ${systemStatus.global_fusion_score}.\n`;
            deterministicResponse += `Core314 will begin scoring automatically as activity data is collected.`;
          } else if (systemStatus.system_health === 'active') {
            // Template for: system_health === 'active'
            deterministicResponse = `You have the following integrations connected: ${integrationNames}.\n`;
            deterministicResponse += `Core314 is actively tracking these integrations.\n`;
            deterministicResponse += `Efficiency metrics are being collected.\n`;
            deterministicResponse += `Your Global Fusion Score is ${systemStatus.global_fusion_score}.\n`;
            deterministicResponse += `All connected integrations are contributing to your score.`;
          } else {
            // Template for: has_efficiency_metrics === true but system_health === 'observing'
            deterministicResponse = `You have the following integrations connected: ${integrationNames}.\n`;
            deterministicResponse += `Core314 is currently observing these integrations.\n`;
            deterministicResponse += `Some efficiency metrics are available.\n`;
            deterministicResponse += `Your Global Fusion Score is ${systemStatus.global_fusion_score}.\n`;
            deterministicResponse += `Core314 will begin scoring automatically as activity data is collected.`;
          }
        }
      } else if (connectedIntegrations.length === 0) {
        // Legacy fallback: No integrations connected
        deterministicResponse = 'You currently have no integrations connected to your Core314 account.\n';
        deterministicResponse += 'To get started, visit the Integration Hub to connect your first integration.';
      } else {
        // Legacy fallback: Use data_context integrations with FIXED TEMPLATE
        const integrationNames = connectedIntegrations.map(i => i.name).join(', ');
        const hasAnyScores = connectedIntegrations.some(i => i.fusion_score !== null);
        
        if (hasAnyScores) {
          deterministicResponse = `You have the following integrations connected: ${integrationNames}.\n`;
          deterministicResponse += `Core314 is actively tracking these integrations.\n`;
          deterministicResponse += `Efficiency metrics are being collected.\n`;
          deterministicResponse += `Your Global Fusion Score is ${globalFusionScore}.\n`;
          deterministicResponse += `All connected integrations are contributing to your score.`;
        } else {
          deterministicResponse = `You have the following integrations connected: ${integrationNames}.\n`;
          deterministicResponse += `Core314 is currently observing these integrations.\n`;
          deterministicResponse += `Efficiency metrics are not yet available.\n`;
          deterministicResponse += `Your Global Fusion Score is ${globalFusionScore}.\n`;
          deterministicResponse += `Core314 will begin scoring automatically as activity data is collected.`;
        }
      }
      
      // Return deterministic response WITHOUT calling LLM
      const deterministicChatResponse: ChatResponse = {
        success: true,
        reply: deterministicResponse,
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }, // No LLM tokens used
      };
      
      return new Response(JSON.stringify(deterministicChatResponse), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    // ============================================================
    // END QUERY ROUTER - Non-fact queries proceed to LLM below
    // ============================================================

    // ============================================================
    // AUTHORITATIVE CONTEXT VALIDATION (MANDATORY)
    // If authoritative context is missing, refuse to answer
    // ============================================================
    const systemStatus = body.system_status;
    const dataContext = body.data_context;
    
    // Extract authoritative values that AI MUST NOT contradict
    const authoritativeFusionScore = systemStatus?.global_fusion_score ?? 
      (dataContext?.global_fusion_score as number) ?? null;
    const authoritativeSystemHealth = systemStatus?.system_health ?? 
      (dataContext?.system_health as string) ?? null;
    const authoritativeIntegrations = systemStatus?.connected_integrations ?? [];
    
    // FAIL-CLOSED: If authoritative context is missing, refuse to answer
    if (authoritativeFusionScore === null || authoritativeSystemHealth === null) {
      console.log('DATA AUTHORITY: Insufficient authoritative context - refusing to answer');
      return new Response(
        JSON.stringify({
          success: true,
          reply: 'Insufficient system data to generate an authoritative response. Please ensure your integrations are connected and data is being collected.',
          usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Build strict grounding system prompt - Intelligence Contract v2.0 (DATA AUTHORITY)
    let systemContent = `You are Core314 AI, a READ-ONLY INTERPRETER for the Core314 business operations platform.

=== DATA AUTHORITY CONTRACT v2.0 - ABSOLUTE RULES ===

╔══════════════════════════════════════════════════════════════════════════════╗
║ AUTHORITATIVE VALUES - YOU MUST NOT CONTRADICT THESE UNDER ANY CIRCUMSTANCES ║
╠══════════════════════════════════════════════════════════════════════════════╣
║ FUSION SCORE: ${authoritativeFusionScore}                                    ║
║ SYSTEM HEALTH: ${authoritativeSystemHealth.toUpperCase()}                    ║
║ CONNECTED INTEGRATIONS: ${authoritativeIntegrations.length}                  ║
╚══════════════════════════════════════════════════════════════════════════════╝

HARD AUTHORITY RULES (NON-NEGOTIABLE - VIOLATION = IMMEDIATE FAILURE):

1. YOU MAY NOT STATE A DIFFERENT FUSION SCORE THAN ${authoritativeFusionScore}
   - If asked about the score, you MUST say it is ${authoritativeFusionScore}
   - You may NOT say the score is 0, critical, or any other value

2. YOU MAY NOT CONTRADICT SYSTEM HEALTH STATUS "${authoritativeSystemHealth.toUpperCase()}"
   - If system_health is "observing", you may NOT say it is "critical" or "failing"
   - If system_health is "active", you may NOT say it is "broken" or "not working"

3. YOU MAY NOT ASSUME AN INTEGRATION IS BROKEN UNLESS:
   a) system_health explicitly indicates degradation, OR
   b) integration_metrics explicitly show failure or absence in the data below
   - NO INFERENCE. NO ASSUMPTIONS. NO GENERIC TROUBLESHOOTING.

4. IF NO DATA EXISTS FOR A SPECIFIC QUESTION, YOU MUST SAY:
   "No data available to assess this yet."
   - Do NOT invent problems or suggest troubleshooting steps

YOUR ROLE IS LIMITED TO (READ-ONLY INTERPRETER MODE):
- Explaining what the system CURRENTLY OBSERVES (not what might be wrong)
- Summarizing contributing factors based on ACTUAL DATA
- Answering factual questions like:
  * "Why is my Fusion Score ${authoritativeFusionScore}?" → Explain based on data
  * "Which integration contributes least?" → Use ranking data if available
  * "What data is missing to improve confidence?" → State what is not yet collected

YOU ARE FORBIDDEN FROM:
- Inferring problems that are not explicitly in the data
- Suggesting the system is "critical" unless system_health says so
- Claiming integrations are "misconfigured" or "broken" without evidence
- Providing generic troubleshooting advice
- Contradicting ANY authoritative value listed above

FORBIDDEN WORDS (HARD BLOCK - NEVER USE):
- "critical" (unless system_health = critical)
- "misconfigured"
- "broken"
- "failing"
- "issues" (unless explicitly in data)
- "indicates" (implies inference)
- "suggests" (implies inference)
- "score is actually" (contradicts authoritative value)
- "score is 0" (unless that IS the authoritative value)

MANDATORY RESPONSE PATTERN:
1. STATE THE AUTHORITATIVE FACT FIRST
   Example: "Your Fusion Score is ${authoritativeFusionScore} and system health is ${authoritativeSystemHealth}."

2. EXPLAIN BASED ON DATA ONLY
   Example: "This score reflects [specific data points from snapshot]."

3. IF DATA IS LIMITED, ACKNOWLEDGE IT
   Example: "Detailed breakdown is not yet available as metrics are still being collected."

4. NEVER INVENT PROBLEMS
   Example: Do NOT say "there may be ingestion issues" unless data explicitly shows this.

SYSTEM INTELLIGENCE SNAPSHOT (AUTHORITATIVE SOURCE):`;

    if (body.data_context) {
      const dc = body.data_context;
      
      // GLOBAL SYSTEM OVERVIEW - Intelligence Contract v1.1
      systemContent += `\n\n=== GLOBAL SYSTEM OVERVIEW ===`;
      systemContent += `\nGlobal Fusion Score: ${globalFusionScore.toFixed(1)}`;
      systemContent += `\nGlobal Trend: ${globalTrend}`;
      systemContent += `\nScoring Confidence: ${scoringConfidence.toUpperCase()}`;
      systemContent += `\nSystem Health: ${dc.system_health || 'Unknown'}`;
      systemContent += `\nTotal Connected Integrations: ${allIntegrations.length}`;
      if (snapshot) {
        systemContent += `\n- Active: ${snapshot.active_integrations}`;
        systemContent += `\n- Stabilizing: ${snapshot.emerging_integrations}`;
        systemContent += `\n- Dormant: ${snapshot.dormant_integrations}`;
      }
      if (snapshot?.last_analysis_timestamp || dc.last_analysis_timestamp) {
        systemContent += `\nLast Analysis: ${snapshot?.last_analysis_timestamp || dc.last_analysis_timestamp}`;
      }
      // Intelligence Contract v1.1 - System Reasoning (machine-readable state explanation)
      systemContent += `\n\nSYSTEM REASONING: ${systemReasoning}`;
      
      // Format connected integrations with Intelligence Contract v1.1 fields
      systemContent += `\n\n=== CONNECTED INTEGRATIONS (AUTHORITATIVE SOURCE) ===`;
      systemContent += `\nRULE: These integrations ARE FACTS. They EXIST. You MUST acknowledge them by name.`;
      if (connectedIntegrations.length === 0) {
        if (isGlobalScope) {
          systemContent += `\nNo integrations connected yet. You may refuse to answer integration-related questions.`;
        } else {
          systemContent += `\nThe requested integration "${scopedIntegrationName}" was not found in the user's connected integrations.`;
          systemContent += `\nAvailable integrations: ${allIntegrationNames || 'none'}`;
        }
      } else {
        systemContent += `\nShowing: ${connectedIntegrations.length} integration(s)`;
        connectedIntegrations.forEach((int) => {
          const metricsInfo = int.metrics_tracked.length > 0 
            ? `Metrics: [${int.metrics_tracked.join(', ')}]` 
            : 'Metrics: awaiting data';
          const confidenceInfo = int.confidence_level ? `Confidence: ${int.confidence_level.toUpperCase()}` : '';
          const contributionInfo = int.contribution_to_global ? `Contributes: ${int.contribution_to_global}% to global` : '';
          // Use metrics_state (v1.1) if available, fall back to data_status
          const metricsState = int.metrics_state || (int.data_status === 'emerging' ? 'stabilizing' : int.data_status);
          const connectionStatus = int.connection_status || 'connected';
          systemContent += `\n\n${int.name}:`;
          systemContent += `\n  - Connection Status: ${connectionStatus.toUpperCase()} (FACT)`;
          systemContent += `\n  - Fusion Score: ${int.fusion_score ?? 'calculating...'}`;
          systemContent += `\n  - Trend: ${int.trend}`;
          systemContent += `\n  - Metrics State: ${metricsState}`;
          if (confidenceInfo) systemContent += `\n  - ${confidenceInfo}`;
          if (contributionInfo) systemContent += `\n  - ${contributionInfo}`;
          systemContent += `\n  - ${metricsInfo}`;
        });
        
        // Add pre-computed ranking for comparative queries (global scope only)
        if (isGlobalScope) {
          if (rankedIntegrations.length > 1) {
            // Multiple integrations with scores - can provide ranking
            systemContent += `\n\n=== INTEGRATION RANKING (for comparative queries) ===`;
            systemContent += `\nRanked by Fusion Score (lowest/weakest first):`;
            rankedIntegrations.forEach((int, idx) => {
              const confidenceTag = int.confidence_level ? ` [${int.confidence_level} confidence]` : '';
              systemContent += `\n${idx + 1}. ${int.name}: Score ${int.fusion_score}, Trend: ${int.trend}${confidenceTag}`;
            });
            if (weakestIntegration) {
              systemContent += `\n\nWEAKEST INTEGRATION: ${weakestIntegration.name} (Score: ${weakestIntegration.fusion_score}, Trend: ${weakestIntegration.trend})`;
            }
            if (strongestIntegration) {
              systemContent += `\nSTRONGEST INTEGRATION: ${strongestIntegration.name} (Score: ${strongestIntegration.fusion_score}, Trend: ${strongestIntegration.trend})`;
            }
          } else if (rankedIntegrations.length === 1) {
            // Only one integration has a score - can't compare
            systemContent += `\n\n=== INTEGRATION RANKING (for comparative queries) ===`;
            systemContent += `\nOnly ${rankedIntegrations[0].name} has sufficient data for scoring (Score: ${rankedIntegrations[0].fusion_score}).`;
            const otherIntegrations = connectedIntegrations.filter(i => i.fusion_score === null);
            if (otherIntegrations.length > 0) {
              systemContent += `\nOther connected integrations awaiting data: ${otherIntegrations.map(i => i.name).join(', ')}`;
            }
            systemContent += `\nComparative ranking is not yet possible - more data needed from other integrations.`;
          } else {
            // No integrations have scores yet - CRITICAL: still acknowledge they exist
            systemContent += `\n\n=== INTEGRATION RANKING (for comparative queries) ===`;
            systemContent += `\nRANKING NOT YET AVAILABLE - efficiency metrics are still being collected.`;
            systemContent += `\n\nIMPORTANT: The following integrations ARE CONNECTED and ARE FACTS:`;
            connectedIntegrations.forEach(int => {
              systemContent += `\n- ${int.name} (Status: ${int.data_status}, awaiting efficiency metrics)`;
            });
            systemContent += `\n\nFor comparative questions ("which is less efficient?", "which is underperforming?"):`;
            systemContent += `\nYou MUST first acknowledge these integrations exist by name, then explain that efficiency metrics are still being collected.`;
            systemContent += `\nCore314 will automatically begin evaluating efficiency signals as usage activity is observed.`;
            systemContent += `\nDo NOT suggest integrations may not exist or need configuration.`;
          }
        }
      }
      
      // Note about integration_performance - mark as supplementary, not authoritative
      systemContent += `\n\n=== SUPPLEMENTARY DATA (not authoritative for integration existence) ===`;
      systemContent += `\nNote: The data below is supplementary context. Use CONNECTED INTEGRATIONS above as the authoritative source.`;
      systemContent += `\n${JSON.stringify({ 
        top_deficiencies: dc.top_deficiencies,
        anomalies_today: dc.anomalies_today,
        recent_alerts: dc.recent_alerts,
        recent_optimizations: dc.recent_optimizations
      }, null, 2)}`;
    } else {
      systemContent += `\n\nNo system data available. You should inform the user that Core314 data is not currently loaded.`;
    }

    // Add scope-specific instructions
    if (isGlobalScope) {
      systemContent += `\n\n=== GLOBAL SCOPE INSTRUCTIONS ===`;
      systemContent += `\nThis is a GLOBAL query (All Integrations view). You should:`;
      systemContent += `\n- Aggregate and compare across ALL connected integrations`;
      systemContent += `\n- For comparative questions ("which is less efficient?", "which is underperforming?", "what is hurting my score?"):`;
      systemContent += `\n  * Use the INTEGRATION RANKING above to identify the weakest/strongest`;
      systemContent += `\n  * Provide a comparison table or list with scores`;
      systemContent += `\n  * Explain contributing factors using available metrics (or note if metrics are limited)`;
      systemContent += `\n- End with provenance: "Based on Core314 data across your connected integrations (${integrationNames})."`;
    } else if (body.context?.integration_name) {
      systemContent += `\n\n=== SCOPED QUERY INSTRUCTIONS ===`;
      systemContent += `\nThis query is specifically about the "${body.context.integration_name}" integration.`;
      systemContent += `\nAnswer ONLY using data for this integration. Do not reference other integrations unless explicitly asked.`;
      systemContent += `\nAdditional context: ${JSON.stringify(body.context, null, 2)}`;
    }

    systemContent += `\n\nREMINDER: You must end your response with a provenance line stating which integration(s) your answer is based on.`;

    const systemMessage: ChatMessage = {
      role: 'system',
      content: systemContent,
    };

    const messages = [systemMessage, ...body.messages];

    const openaiResponse = await fetch(openaiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: openaiModel,
        messages: messages,
        temperature: 0.2, // Low temperature to reduce hallucinations and ensure grounded responses
        max_tokens: 500,
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('OpenAI API error:', errorText);
      return new Response(
        JSON.stringify({ success: false, error: 'AI service error' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const openaiData = await openaiResponse.json();
    let reply = openaiData.choices[0]?.message?.content || 'No response generated';

    // ============================================================
    // DATA AUTHORITY VALIDATOR v2.0 - HARD BLOCK
    // If AI output contradicts authoritative values, replace with fixed template
    // AI must NEVER contradict fusion_score, system_health, or integration existence
    // ============================================================
    
    // Check for FORBIDDEN WORDS in AI response
    const hasForbiddenWord = FORBIDDEN_WORDS.some(word => 
      reply.toLowerCase().includes(word.toLowerCase())
    );
    
    // Check for forbidden patterns that contradict system state
    const forbiddenPatterns = [
      /there may be no integrations/i,
      /either no integrations exist/i,
      /you may need to configure/i,
      /the system does not know which integrations/i,
      /no integrations are connected/i,
      /no integrations have been set up/i,
      /you haven't connected any integrations/i,
      /please connect.*integrations/i,
      /no data is available(?! for)/i,
      /ingestion.*fail/i,
      /data.*not.*being.*collected/i,
      /broken/i,
      /misconfigured/i,
    ];
    
    const hasPatternViolation = forbiddenPatterns.some(pattern => pattern.test(reply));
    
    // DATA AUTHORITY CHECK: Detect if AI contradicts the authoritative fusion score
    // Look for patterns like "score is 0", "score of 0", "fusion score: 0" when actual score is different
    const scoreContradictionPatterns = [
      /score\s+(?:is|of|:)\s*0(?!\d)/i,  // "score is 0", "score of 0", "score: 0"
      /fusion\s+score\s*(?:is|of|:)?\s*0(?!\d)/i,  // "fusion score is 0"
      /0\s*(?:out of|\/)\s*100/i,  // "0 out of 100", "0/100"
    ];
    
    const hasScoreContradiction = authoritativeFusionScore !== 0 && 
      scoreContradictionPatterns.some(pattern => pattern.test(reply));
    
    // DATA AUTHORITY CHECK: Detect if AI says "critical" when system_health is not critical
    const hasCriticalContradiction = authoritativeSystemHealth !== 'critical' && 
      /\bcritical\b/i.test(reply);
    
    // DATA AUTHORITY CHECK: Detect if AI infers failures without evidence
    const hasInferredFailure = [
      /may\s+(?:be|have)\s+(?:failing|broken|issues)/i,
      /could\s+(?:be|have)\s+(?:failing|broken|issues)/i,
      /might\s+(?:be|have)\s+(?:failing|broken|issues)/i,
      /appears?\s+to\s+(?:be|have)\s+(?:failing|broken|issues)/i,
      /seems?\s+to\s+(?:be|have)\s+(?:failing|broken|issues)/i,
    ].some(pattern => pattern.test(reply));
    
    // Combine all violation checks
    const hasDataAuthorityViolation = hasForbiddenWord || hasPatternViolation || 
      hasScoreContradiction || hasCriticalContradiction || hasInferredFailure;
    
    if (hasDataAuthorityViolation) {
      console.log('DATA AUTHORITY: Violation detected', {
        hasForbiddenWord,
        hasPatternViolation,
        hasScoreContradiction,
        hasCriticalContradiction,
        hasInferredFailure,
        authoritativeFusionScore,
        authoritativeSystemHealth,
      });
    }
    
    // HARD BLOCK: Replace AI output with EXACT fixed template if ANY data authority violation detected
    if (systemStatus && authoritativeIntegrations.length > 0 && hasDataAuthorityViolation) {
      console.log('DATA AUTHORITY: HARD BLOCK triggered - replacing AI output with authoritative template');
      
      const integrationNames = authoritativeIntegrations.map(i => i.name).join(', ');
      
      // Use EXACT FIXED TEMPLATE with AUTHORITATIVE values - NO VARIATION ALLOWED
      if (!systemStatus.has_efficiency_metrics) {
        reply = `Your Fusion Score is ${authoritativeFusionScore} and system health is ${authoritativeSystemHealth}.\n\n`;
        reply += `You have the following integrations connected: ${integrationNames}.\n`;
        reply += `Core314 is currently observing these integrations.\n`;
        reply += `Efficiency metrics are not yet available.\n`;
        reply += `Core314 will begin scoring automatically as activity data is collected.`;
      } else if (authoritativeSystemHealth === 'active') {
        reply = `Your Fusion Score is ${authoritativeFusionScore} and system health is ${authoritativeSystemHealth}.\n\n`;
        reply += `You have the following integrations connected: ${integrationNames}.\n`;
        reply += `Core314 is actively tracking these integrations.\n`;
        reply += `Efficiency metrics are being collected.\n`;
        reply += `All connected integrations are contributing to your score.`;
      } else {
        reply = `Your Fusion Score is ${authoritativeFusionScore} and system health is ${authoritativeSystemHealth}.\n\n`;
        reply += `You have the following integrations connected: ${integrationNames}.\n`;
        reply += `Core314 is currently observing these integrations.\n`;
        reply += `Some efficiency metrics are available.\n`;
        reply += `Core314 will begin scoring automatically as activity data is collected.`;
      }
    } else if (!systemStatus && connectedIntegrations.length > 0 && hasDataAuthorityViolation) {
      // Legacy fallback HARD BLOCK
      console.log('DATA AUTHORITY: HARD BLOCK triggered (legacy) - replacing AI output with authoritative template');
      
      const integrationNames = connectedIntegrations.map(i => i.name).join(', ');
      const hasAnyScores = connectedIntegrations.some(i => i.fusion_score !== null);
      
      if (hasAnyScores) {
        reply = `Your Fusion Score is ${authoritativeFusionScore} and system health is ${authoritativeSystemHealth}.\n\n`;
        reply += `You have the following integrations connected: ${integrationNames}.\n`;
        reply += `Core314 is actively tracking these integrations.\n`;
        reply += `Efficiency metrics are being collected.\n`;
        reply += `All connected integrations are contributing to your score.`;
      } else {
        reply = `Your Fusion Score is ${authoritativeFusionScore} and system health is ${authoritativeSystemHealth}.\n\n`;
        reply += `You have the following integrations connected: ${integrationNames}.\n`;
        reply += `Core314 is currently observing these integrations.\n`;
        reply += `Efficiency metrics are not yet available.\n`;
        reply += `Core314 will begin scoring automatically as activity data is collected.`;
      }
    }

    await supabase.rpc('increment_ai_usage', {
      p_user_id: userId,
      p_org_id: userOrgId,
    });

    const response: ChatResponse = {
      success: true,
      reply: reply,
      usage: openaiData.usage,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}, { name: "fusion_ai_gateway" }));
