
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { withSentry, breadcrumb, handleSentryTest, jsonError } from "../_shared/sentry.ts";
import { fetchUserExecutionMode, getBaselineDecisionResponse } from "../_shared/execution_mode.ts";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

interface DecisionRequest {
  user_id?: string; // Optional for service role auth
  decision_type: 'optimization' | 'alert' | 'recommendation' | 'automation';
  trigger_source: 'manual' | 'scheduled' | 'threshold' | 'insight';
  context_data: Record<string, any>;
  factors?: Array<{
    factor_name: string;
    factor_category: string;
    current_value: number;
    baseline_value?: number;
    threshold_value?: number;
    weight: number;
  }>;
  requires_approval?: boolean;
  priority?: number;
}

interface DecisionFactor {
  factor_name: string;
  factor_category: string;
  factor_source: string;
  current_value: number;
  baseline_value?: number;
  threshold_value?: number;
  deviation_percent?: number;
  weight: number;
  raw_score: number;
  weighted_score: number;
  confidence: number;
  context_tags: string[];
  related_metrics: string[];
}

interface DecisionResponse {
  success: boolean;
  decision_event_id?: string;
  recommended_action: string;
  action_details: Record<string, any>;
  confidence_score: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  reasoning: string;
  factors_analyzed: DecisionFactor[];
  expected_impact?: string;
  error?: string;
}

async function authenticateRequest(req: Request): Promise<{ userId: string; supabase: any }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    throw new Error('Missing Authorization header');
  }

  const token = authHeader.replace('Bearer ', '');
  
  const userSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: authHeader } }
  });
  
  const { data: { user }, error: userError } = await userSupabase.auth.getUser(token);
  
  if (user && !userError) {
    return { userId: user.id, supabase: userSupabase };
  }
  
  if (token === SUPABASE_SERVICE_ROLE_KEY) {
    const body = await req.json();
    if (!body.user_id) {
      throw new Error('user_id required when using service role key');
    }
    
    const serviceSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    return { userId: body.user_id, supabase: serviceSupabase };
  }
  
  throw new Error('Invalid authentication token');
}

function calculateDeviation(current: number, baseline: number): number {
  if (baseline === 0) return 0;
  return ((current - baseline) / baseline) * 100;
}

function normalizeScore(current: number, baseline: number, threshold: number, isHigherBetter: boolean = true): number {
  if (isHigherBetter) {
    if (current >= threshold) return 1.0;
    if (current <= baseline) return 0.0;
    return (current - baseline) / (threshold - baseline);
  } else {
    if (current <= threshold) return 1.0;
    if (current >= baseline) return 0.0;
    return (baseline - current) / (baseline - threshold);
  }
}

function analyzeFactors(factors: any[]): { analyzedFactors: DecisionFactor[]; totalScore: number; avgConfidence: number } {
  const analyzedFactors: DecisionFactor[] = [];
  let totalWeightedScore = 0;
  let totalConfidence = 0;
  let totalWeight = 0;
  
  for (const factor of factors) {
    const deviation = factor.baseline_value 
      ? calculateDeviation(factor.current_value, factor.baseline_value)
      : 0;
    
    const isHigherBetter = !['cost', 'error', 'latency', 'downtime'].some(
      term => factor.factor_name.toLowerCase().includes(term)
    );
    
    const rawScore = factor.threshold_value && factor.baseline_value
      ? normalizeScore(factor.current_value, factor.baseline_value, factor.threshold_value, isHigherBetter)
      : Math.abs(deviation) > 10 ? 0.5 : 0.8; // Default scoring
    
    const weightedScore = rawScore * factor.weight;
    
    const confidence = 0.85; // Default high confidence, could be enhanced with data quality metrics
    
    const analyzedFactor: DecisionFactor = {
      factor_name: factor.factor_name,
      factor_category: factor.factor_category,
      factor_source: 'telemetry',
      current_value: factor.current_value,
      baseline_value: factor.baseline_value,
      threshold_value: factor.threshold_value,
      deviation_percent: deviation,
      weight: factor.weight,
      raw_score: rawScore,
      weighted_score: weightedScore,
      confidence: confidence,
      context_tags: [factor.factor_category],
      related_metrics: [factor.factor_name],
    };
    
    analyzedFactors.push(analyzedFactor);
    totalWeightedScore += weightedScore;
    totalConfidence += confidence;
    totalWeight += factor.weight;
  }
  
  const avgConfidence = factors.length > 0 ? totalConfidence / factors.length : 0.5;
  
  return {
    analyzedFactors,
    totalScore: totalWeightedScore,
    avgConfidence,
  };
}

function assessRiskLevel(score: number, decisionType: string, factors: DecisionFactor[]): 'low' | 'medium' | 'high' | 'critical' {
  const hasCriticalDeviation = factors.some(f => Math.abs(f.deviation_percent || 0) > 50);
  if (hasCriticalDeviation) return 'critical';
  
  const hasHighDeviation = factors.some(f => Math.abs(f.deviation_percent || 0) > 25);
  if (hasHighDeviation) return 'high';
  
  if (score < 0.3) return 'high';
  if (score < 0.6) return 'medium';
  return 'low';
}

async function generateAIReasoning(
  decisionType: string,
  factors: DecisionFactor[],
  contextData: Record<string, any>
): Promise<{ reasoning: string; recommendedAction: string; expectedImpact: string; tokens: number }> {
  
  const factorsSummary = factors.map(f => 
    `- ${f.factor_name}: ${f.current_value} (baseline: ${f.baseline_value}, deviation: ${f.deviation_percent?.toFixed(2)}%, weight: ${f.weight}, score: ${f.weighted_score.toFixed(3)})`
  ).join('\n');
  
  const prompt = `You are an AI decision engine for Core314, analyzing business operations data.

Decision Type: ${decisionType}
Context: ${JSON.stringify(contextData, null, 2)}

Factors Analyzed:
${factorsSummary}

Based on this data, provide:
1. A clear recommendation (approve/reject/escalate/automate)
2. Reasoning for your recommendation
3. Expected impact if the recommendation is followed

Format your response as JSON:
{
  "recommended_action": "approve|reject|escalate|automate",
  "reasoning": "Clear explanation of why this action is recommended",
  "expected_impact": "What will happen if this recommendation is followed"
}`;

  if (OPENAI_API_KEY) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: 'You are an expert AI decision engine for business operations. Provide clear, actionable recommendations based on data analysis.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.3,
          max_tokens: 500,
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        const content = data.choices[0].message.content;
        const tokens = data.usage.total_tokens;
        
        try {
          const parsed = JSON.parse(content);
          return {
            reasoning: parsed.reasoning,
            recommendedAction: parsed.recommended_action,
            expectedImpact: parsed.expected_impact,
            tokens,
          };
        } catch {
          return {
            reasoning: content,
            recommendedAction: 'escalate',
            expectedImpact: 'Requires human review',
            tokens,
          };
        }
      }
    } catch (error) {
      console.error('OpenAI API error:', error);
    }
  }
  
  const avgScore = factors.reduce((sum, f) => sum + f.weighted_score, 0);
  const hasNegativeDeviations = factors.some(f => (f.deviation_percent || 0) < -15);
  const hasPositiveDeviations = factors.some(f => (f.deviation_percent || 0) > 15);
  
  let recommendedAction = 'approve';
  let reasoning = '';
  let expectedImpact = '';
  
  if (avgScore > 0.7 && hasPositiveDeviations) {
    recommendedAction = 'approve';
    reasoning = `Strong positive indicators detected. Weighted score of ${avgScore.toFixed(2)} suggests favorable conditions. Key factors show positive deviations from baseline, indicating improved performance.`;
    expectedImpact = 'Proceeding with this action is likely to maintain or improve current positive trends.';
  } else if (avgScore < 0.4 || hasNegativeDeviations) {
    recommendedAction = 'reject';
    reasoning = `Concerning indicators detected. Weighted score of ${avgScore.toFixed(2)} is below acceptable threshold. Negative deviations suggest declining performance or unfavorable conditions.`;
    expectedImpact = 'Rejecting this action will prevent potential negative outcomes and allow time for corrective measures.';
  } else if (avgScore >= 0.4 && avgScore <= 0.7) {
    recommendedAction = 'escalate';
    reasoning = `Mixed indicators detected. Weighted score of ${avgScore.toFixed(2)} falls in the uncertain range. Some factors show positive trends while others show concerns.`;
    expectedImpact = 'Escalating for human review will ensure a balanced decision considering all factors.';
  }
  
  return {
    reasoning,
    recommendedAction,
    expectedImpact,
    tokens: 0, // No tokens used in fallback
  };
}

serve(withSentry(async (req) => {
  const testResponse = await handleSentryTest(req);
  if (testResponse) return testResponse;

  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    });
  }

  try {
    const { userId, supabase } = await authenticateRequest(req);
    
    // ============================================================
    // BASELINE MODE GATE - MUST BE BEFORE ANY AI PROCESSING
    // ============================================================
    const executionMode = await fetchUserExecutionMode(supabase, userId);
    if (executionMode === 'baseline') {
      return new Response(JSON.stringify(getBaselineDecisionResponse()), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
    // ============================================================
    
    const body: DecisionRequest = await req.json();
    const {
      decision_type,
      trigger_source,
      context_data,
      factors = [],
      requires_approval = true,
      priority = 5,
    } = body;
    
    if (!decision_type || !trigger_source || !context_data) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields: decision_type, trigger_source, context_data' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    const { analyzedFactors, totalScore, avgConfidence } = analyzeFactors(factors);
    
    const riskLevel = assessRiskLevel(totalScore, decision_type, analyzedFactors);
    
    const { reasoning, recommendedAction, expectedImpact, tokens } = await generateAIReasoning(
      decision_type,
      analyzedFactors,
      context_data
    );
    
    const { data: decisionEvent, error: decisionError } = await supabase
      .from('decision_events')
      .insert({
        user_id: userId,
        decision_type,
        trigger_source,
        context_data,
        reasoning_model: OPENAI_API_KEY ? 'gpt-4o' : 'rule-based',
        reasoning_prompt: OPENAI_API_KEY ? 'GPT-4o reasoning' : 'Rule-based analysis',
        reasoning_response: reasoning,
        reasoning_tokens: tokens,
        factors_analyzed: analyzedFactors,
        total_confidence_score: avgConfidence,
        recommended_action: recommendedAction,
        action_details: { priority, requires_approval },
        expected_impact: expectedImpact,
        risk_level: riskLevel,
        status: 'pending',
        requires_approval,
        priority,
        tags: [decision_type, trigger_source],
      })
      .select()
      .single();
    
    if (decisionError) {
      throw new Error(`Failed to create decision event: ${decisionError.message}`);
    }
    
    if (analyzedFactors.length > 0) {
      const factorsToInsert = analyzedFactors.map(factor => ({
        user_id: userId,
        decision_event_id: decisionEvent.id,
        ...factor,
      }));
      
      const { error: factorsError } = await supabase
        .from('decision_factors')
        .insert(factorsToInsert);
      
      if (factorsError) {
        console.error('Failed to insert decision factors:', factorsError);
      }
    }
    
    await supabase.rpc('log_decision_event', {
      p_user_id: userId,
      p_decision_event_id: decisionEvent.id,
      p_event_type: 'decision_created',
      p_event_category: 'decision',
      p_event_description: `Created ${decision_type} decision with ${recommendedAction} recommendation`,
      p_actor_id: userId,
      p_actor_type: 'ai',
      p_new_state: { decision_event_id: decisionEvent.id, status: 'pending' },
      p_metadata: { factors_count: analyzedFactors.length, confidence: avgConfidence },
    });
    
    const response: DecisionResponse = {
      success: true,
      decision_event_id: decisionEvent.id,
      recommended_action: recommendedAction,
      action_details: { priority, requires_approval },
      confidence_score: avgConfidence,
      risk_level: riskLevel,
      reasoning,
      factors_analyzed: analyzedFactors,
      expected_impact: expectedImpact,
    };
    
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
    
  } catch (error) {
    console.error('Cognitive Decision Engine error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
}, { name: "cognitive-decision-engine" }));
