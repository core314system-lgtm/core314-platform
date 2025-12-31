import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { withSentry, breadcrumb, handleSentryTest, jsonError } from "../_shared/sentry.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') || '';

serve(withSentry(async (req) => {
  const testResponse = await handleSentryTest(req);
  if (testResponse) return testResponse;

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const days = parseInt(url.searchParams.get('days') || '30');
    const organization_id = url.searchParams.get('organization_id');

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

    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);

    let query = supabase
      .from('fusion_governance_audit')
      .select('*')
      .gte('created_at', sinceDate.toISOString());

    if (organization_id) {
      query = query.eq('organization_id', organization_id);
    }

    const { data: audits } = await query;

    const totalDecisions = audits?.length || 0;
    const approved = audits?.filter(a => a.governance_action === 'approved').length || 0;
    const flagged = audits?.filter(a => a.governance_action === 'flagged').length || 0;
    const halted = audits?.filter(a => a.governance_action === 'halted').length || 0;
    const autoAdjusted = audits?.filter(a => a.governance_action === 'auto_adjusted').length || 0;

    const avgEthicalRisk = audits && audits.length > 0
      ? audits.reduce((sum, a) => sum + (a.ethical_risk_score || 0), 0) / audits.length
      : 0;

    const policyTriggerCounts: Record<string, number> = {};
    audits?.forEach(audit => {
      audit.policy_triggered?.forEach((policy: string) => {
        policyTriggerCounts[policy] = (policyTriggerCounts[policy] || 0) + 1;
      });
    });

    const topPolicies = Object.entries(policyTriggerCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const gptPrompt = `You are Core314's Governance Analyst. Analyze the governance activity and provide a summary.

Summary Statistics (Last ${days} Days):
- Total Decisions Evaluated: ${totalDecisions}
- Approved: ${approved} (${totalDecisions > 0 ? ((approved / totalDecisions) * 100).toFixed(1) : 0}%)
- Flagged for Review: ${flagged} (${totalDecisions > 0 ? ((flagged / totalDecisions) * 100).toFixed(1) : 0}%)
- Halted: ${halted} (${totalDecisions > 0 ? ((halted / totalDecisions) * 100).toFixed(1) : 0}%)
- Auto-Adjusted: ${autoAdjusted} (${totalDecisions > 0 ? ((autoAdjusted / totalDecisions) * 100).toFixed(1) : 0}%)
- Average Ethical Risk Score: ${avgEthicalRisk.toFixed(3)}

Top Triggered Policies:
${topPolicies.map(([policy, count]) => `- ${policy}: ${count} times`).join('\n')}

Provide a 2-3 paragraph analysis covering:
1. Overall governance health and compliance trends
2. Key risk areas or patterns requiring attention
3. Recommendations for policy adjustments or oversight improvements

Return only the narrative summary, no JSON.`;

    let aiSummary = 'No governance activity in the selected timeframe.';

    if (totalDecisions > 0) {
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
              content: 'You are Core314\'s Governance Analyst. Provide insightful analysis of AI governance trends and compliance.',
            },
            {
              role: 'user',
              content: gptPrompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 500,
        }),
      });

      const gptData = await gptResponse.json();
      aiSummary = gptData.choices?.[0]?.message?.content || aiSummary;
    }

    const timeSeriesData = generateTimeSeriesData(audits || [], days);

    await supabase.from('fusion_audit_log').insert({
      organization_id: organization_id || null,
      user_id: user.id,
      event_type: 'governance_summary_generated',
      event_data: { days, total_decisions: totalDecisions },
    });

    return new Response(JSON.stringify({
      success: true,
      summary: {
        total_decisions: totalDecisions,
        approved,
        flagged,
        halted,
        auto_adjusted: autoAdjusted,
        approval_rate: totalDecisions > 0 ? (approved / totalDecisions) * 100 : 0,
        flag_rate: totalDecisions > 0 ? (flagged / totalDecisions) * 100 : 0,
        halt_rate: totalDecisions > 0 ? (halted / totalDecisions) * 100 : 0,
        avg_ethical_risk: avgEthicalRisk,
      },
      top_policies: topPolicies.map(([policy, count]) => ({ policy, count })),
      ai_summary: aiSummary,
      time_series: timeSeriesData,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Governance summary error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}, { name: "governance-summary" }));

function generateTimeSeriesData(audits: any[], days: number) {
  const timeSeriesMap: Record<string, { flagged: number; halted: number; approved: number }> = {};

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];
    timeSeriesMap[dateStr] = { flagged: 0, halted: 0, approved: 0 };
  }

  audits.forEach(audit => {
    const dateStr = audit.created_at.split('T')[0];
    if (timeSeriesMap[dateStr]) {
      if (audit.governance_action === 'flagged') timeSeriesMap[dateStr].flagged++;
      if (audit.governance_action === 'halted') timeSeriesMap[dateStr].halted++;
      if (audit.governance_action === 'approved') timeSeriesMap[dateStr].approved++;
    }
  });

  return Object.entries(timeSeriesMap).map(([date, counts]) => ({
    date,
    ...counts,
  }));
}
