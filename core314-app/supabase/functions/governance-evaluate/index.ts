import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { withSentry, breadcrumb, handleSentryTest, jsonError } from "../_shared/sentry.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') || '';

serve(withSentry(async (req) => {
  const testResponse = await handleSentryTest(req);
  if (testResponse) return testResponse;

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { organization_id, event_type, decision_context } = await req.json();
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: policies } = await supabase
      .from('fusion_governance_policies')
      .select('*')
      .eq('active', true);

    const triggeredPolicies: string[] = [];
    let governanceAction = 'approved';
    let actionMessage = 'Decision approved under governance review';

    if (policies && policies.length > 0) {
      for (const policy of policies) {
        const condition = policy.condition;
        const metric = condition.metric;
        const operator = condition.operator;
        const value = condition.value;

        let metricValue = decision_context[metric];
        
        let conditionMet = false;
        if (operator === '<' && metricValue < value) conditionMet = true;
        if (operator === '>' && metricValue > value) conditionMet = true;
        if (operator === '<=' && metricValue <= value) conditionMet = true;
        if (operator === '>=' && metricValue >= value) conditionMet = true;
        if (operator === '==' && metricValue === value) conditionMet = true;

        if (conditionMet) {
          triggeredPolicies.push(policy.policy_name);
          
          const actionType = policy.action.type;
          if (actionType === 'halt_optimization') {
            governanceAction = 'halted';
            actionMessage = policy.action.message || 'Optimization halted by governance policy';
          } else if (actionType === 'require_manual_approval') {
            governanceAction = 'flagged';
            actionMessage = policy.action.message || 'Flagged for manual review';
          } else if (actionType === 'flag_for_review') {
            if (governanceAction === 'approved') {
              governanceAction = 'flagged';
              actionMessage = policy.action.message || 'Flagged for audit review';
            }
          }
        }
      }
    }

    const ethicalRiskScore = calculateEthicalRisk(decision_context);

    const gptPrompt = `You are Core314's Ethics Engine. Analyze this AI-driven decision and explain why it was ${governanceAction}.

Decision Type: ${event_type}
Governance Action: ${governanceAction}
Confidence: ${decision_context.confidence || 'N/A'}
Variance: ${decision_context.variance || 'N/A'}
Ethical Risk Score: ${ethicalRiskScore.toFixed(3)}
Triggered Policies: ${triggeredPolicies.length > 0 ? triggeredPolicies.join(', ') : 'None'}

Provide a clear, concise explanation (2-3 sentences) addressing:
1. Why this decision was ${governanceAction}
2. Key risk factors or concerns
3. Recommended next steps (if any)

Return only the explanation text, no JSON.`;

    const gptResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are Core314\'s Ethics Engine. Provide clear, concise explanations for AI governance decisions.',
          },
          {
            role: 'user',
            content: gptPrompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 300,
      }),
    });

    const gptData = await gptResponse.json();
    const explanation = gptData.choices?.[0]?.message?.content || actionMessage;

    const { data: auditRecord } = await supabase
      .from('fusion_governance_audit')
      .insert({
        organization_id,
        event_type,
        decision_context,
        policy_triggered: triggeredPolicies,
        governance_action: governanceAction,
        explanation,
        confidence_score: decision_context.confidence || null,
        ethical_risk_score: ethicalRiskScore,
      })
      .select()
      .single();

    if (governanceAction === 'halted') {
      const { data: profile } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('id', user.id)
        .single();

      const { data: org } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', organization_id)
        .single();

      if (profile && org) {
        try {
          await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-transactional-email`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            },
            body: JSON.stringify({
              type: 'governance_alert',
              to: profile.email,
              name: profile.full_name,
              data: {
                organization: org.name,
                organization_id,
                user_id: user.id,
                policy_name: triggeredPolicies.join(', '),
                reason: actionMessage,
                ethical_risk_score: ethicalRiskScore.toFixed(3),
                explanation,
              },
            }),
          });
        } catch (emailError) {
          console.error('Failed to send governance alert email:', emailError);
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      governance_action: governanceAction,
      triggered_policies: triggeredPolicies,
      explanation,
      ethical_risk_score: ethicalRiskScore,
      audit_id: auditRecord?.id,
      can_proceed: governanceAction !== 'halted',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Governance evaluate error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}, { name: "governance-evaluate" }));

function calculateEthicalRisk(context: any): number {
  let risk = 0.0;

  if (context.confidence !== undefined) {
    if (context.confidence < 0.6) risk += 0.3;
    else if (context.confidence < 0.7) risk += 0.2;
    else if (context.confidence < 0.8) risk += 0.1;
  }

  if (context.variance !== undefined) {
    if (context.variance > 0.4) risk += 0.3;
    else if (context.variance > 0.3) risk += 0.2;
    else if (context.variance > 0.2) risk += 0.1;
  }

  if (context.fusion_score !== undefined) {
    if (context.fusion_score < 60) risk += 0.2;
    else if (context.fusion_score < 70) risk += 0.1;
  }

  return Math.min(risk, 1.0);
}
