import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { withSentry, breadcrumb, handleSentryTest, jsonError } from "../_shared/sentry.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(withSentry(async (req) => {
  const testResponse = await handleSentryTest(req);
  if (testResponse) return testResponse;

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: recentDecisions } = await supabase
      .from('fusion_governance_audit')
      .select('*')
      .gte('created_at', oneDayAgo);

    const totalReviewed = recentDecisions?.length || 0;
    const flaggedCount = recentDecisions?.filter(d => d.governance_action === 'flagged').length || 0;
    const haltedCount = recentDecisions?.filter(d => d.governance_action === 'halted').length || 0;

    const avgEthicalRisk = recentDecisions && recentDecisions.length > 0
      ? recentDecisions.reduce((sum, d) => sum + (d.ethical_risk_score || 0), 0) / recentDecisions.length
      : 0;

    const highRiskDecisions = recentDecisions?.filter(d => (d.ethical_risk_score || 0) > 0.7) || [];

    let outliers: any[] = [];
    if (highRiskDecisions.length > 0) {
      outliers = highRiskDecisions.map(d => ({
        id: d.id,
        organization_id: d.organization_id,
        event_type: d.event_type,
        ethical_risk_score: d.ethical_risk_score,
        governance_action: d.governance_action,
        created_at: d.created_at,
      }));
    }

    await supabase.from('fusion_audit_log').insert({
      organization_id: null,
      user_id: null,
      event_type: 'governance_auto_review_completed',
      event_data: {
        total_reviewed: totalReviewed,
        flagged: flaggedCount,
        halted: haltedCount,
        avg_ethical_risk: avgEthicalRisk,
        outliers_found: outliers.length,
      },
    });

    return new Response(JSON.stringify({
      success: true,
      review: {
        total_reviewed: totalReviewed,
        flagged: flaggedCount,
        halted: haltedCount,
        avg_ethical_risk: avgEthicalRisk,
        outliers,
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Governance auto-review error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}, { name: "governance-auto-review" }));