import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

/**
 * Operational Health Score Calculator
 * 
 * Calculates a composite score (0-100) reflecting overall operational health.
 * 
 * Inputs:
 * - Active operational signals (type, severity, confidence)
 * - Integration data freshness
 * - Integration coverage (how many sources connected)
 * 
 * Output:
 * - Score 0-100 with label: Healthy / Moderate / At Risk / Critical
 * - Breakdown by category
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Severity penalty weights
const SEVERITY_PENALTIES: Record<string, number> = {
  'low': 3,
  'medium': 7,
  'high': 15,
  'critical': 25,
};

function getScoreLabel(score: number): string {
  if (score >= 80) return 'Healthy';
  if (score >= 60) return 'Moderate';
  if (score >= 40) return 'At Risk';
  return 'Critical';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let targetUserId: string | null = null;
    let targetOrgId: string | null = null;

    try {
      const body = await req.json();
      targetUserId = body.user_id || null;
      targetOrgId = body.organization_id || null;
    } catch {
      // No body provided
    }

    // Get users with active signals
    let usersQuery = supabase
      .from('operational_signals')
      .select('user_id')
      .eq('is_active', true);

    if (targetUserId) {
      usersQuery = usersQuery.eq('user_id', targetUserId);
    }

    const { data: signalUsers } = await usersQuery;
    const userIds = [...new Set((signalUsers || []).map(s => s.user_id))];

    // Also include users with active integrations but no signals (they get 100)
    if (!targetUserId) {
      const { data: integrationUsers } = await supabase
        .from('user_integrations')
        .select('user_id')
        .eq('status', 'active');

      const intUserIds = (integrationUsers || []).map(u => u.user_id);
      for (const uid of intUserIds) {
        if (!userIds.includes(uid)) userIds.push(uid);
      }
    }

    console.log(`[health-score] Processing ${userIds.length} user(s)`);

    const results: { user_id: string; score: number; label: string }[] = [];

    for (const userId of userIds) {
      try {
        // Get active signals for this user
        const { data: signals } = await supabase
          .from('operational_signals')
          .select('*')
          .eq('user_id', userId)
          .eq('is_active', true);

        // Get connected integrations for coverage assessment
        const { data: integrations } = await supabase
          .from('user_integrations')
          .select('id, status, updated_at')
          .eq('user_id', userId)
          .eq('status', 'active');

        // Calculate score starting from 100
        let score = 100;
        const breakdown: Record<string, unknown> = {
          base_score: 100,
          signal_penalties: [] as { type: string; severity: string; penalty: number }[],
          integration_coverage: 0,
          data_freshness_bonus: 0,
        };

        // Apply penalties for each active signal
        const activeSignals = signals || [];
        for (const signal of activeSignals) {
          const penalty = SEVERITY_PENALTIES[signal.severity] || 5;
          // Scale penalty by confidence
          const scaledPenalty = penalty * (signal.confidence / 100);
          score -= scaledPenalty;

          (breakdown.signal_penalties as { type: string; severity: string; penalty: number }[]).push({
            type: signal.signal_type,
            severity: signal.severity,
            penalty: Math.round(scaledPenalty * 10) / 10,
          });
        }

        // Integration coverage bonus
        const connectedCount = (integrations || []).length;
        const coverageBonus = Math.min(connectedCount * 2, 5); // Up to 5 bonus points
        score += coverageBonus;
        breakdown.integration_coverage = connectedCount;

        // Data freshness check
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const freshIntegrations = (integrations || []).filter(
          i => i.updated_at && i.updated_at > oneHourAgo
        ).length;
        const freshnessPenalty = connectedCount > 0 ? Math.max(0, (connectedCount - freshIntegrations) * 2) : 0;
        score -= freshnessPenalty;
        breakdown.data_freshness_bonus = -freshnessPenalty;

        // Clamp score to 0-100
        score = Math.max(0, Math.min(100, Math.round(score)));
        const label = getScoreLabel(score);

        // Get organization_id
        let orgId = targetOrgId;
        if (!orgId) {
          const { data: memberData } = await supabase
            .from('organization_members')
            .select('organization_id')
            .eq('user_id', userId)
            .limit(1)
            .single();
          orgId = memberData?.organization_id || null;
        }

        // Save score
        await supabase.from('operational_health_scores').insert({
          user_id: userId,
          organization_id: orgId,
          score,
          label,
          signal_count: activeSignals.length,
          score_breakdown: breakdown,
          integration_coverage: {
            connected: connectedCount,
            fresh: freshIntegrations,
          },
        });

        results.push({ user_id: userId, score, label });
        console.log(`[health-score] User ${userId}: Score ${score} (${label}), ${activeSignals.length} active signals`);
      } catch (userErr: unknown) {
        const msg = userErr instanceof Error ? userErr.message : String(userErr);
        console.error(`[health-score] Error for user ${userId}:`, msg);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      users_processed: userIds.length,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[health-score] Error:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
