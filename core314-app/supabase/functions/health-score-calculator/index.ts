import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

/**
 * Operational Health Score Calculator (Calibrated)
 * 
 * Calculates a composite score (0-100) reflecting overall operational health.
 * 
 * Scoring Model:
 * - Base: 100
 * - Signal penalties: severity-weighted, confidence-scaled, category-amplified
 * - Multi-signal amplification: compounding penalty for 3+ / 5+ active signals
 * - Integration coverage bonus: max +3 (capped to prevent offsetting issues)
 * - Data freshness penalty: -2 per stale integration
 * 
 * Severity Weights (calibrated):
 * - Low: 6 base points
 * - Medium: 12 base points  
 * - High: 20 base points
 * - Critical: 30 base points
 * 
 * Category Amplification:
 * - Business-critical signals (financial inactivity, empty CRM) get 1.8x multiplier
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Calibrated severity penalty weights
const SEVERITY_PENALTIES: Record<string, number> = {
  'low': 6,
  'medium': 12,
  'high': 20,
  'critical': 30,
};

// Signal types that are business-critical and get amplified penalties
const CRITICAL_BUSINESS_SIGNALS = new Set([
  'no_financial_activity',
  'no_crm_activity',
  'revenue_pipeline_stagnation',
  'financial_inactivity',
  'overdue_invoices',
]);

// Category amplification multiplier for business-critical signals
const CATEGORY_AMPLIFICATION = 1.5;

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
        // Join integrations_master to get service names for UI transparency
        const { data: integrations } = await supabase
          .from('user_integrations')
          .select('id, status, updated_at, integrations_master!inner(integration_name)')
          .eq('user_id', userId)
          .eq('status', 'active');

        // Calculate score starting from 100
        let score = 100;
        const connectedServiceNames = (integrations || []).map(i => {
          const master = i.integrations_master as unknown as { integration_name: string } | null;
          return master?.integration_name?.toLowerCase().replace(/\s+/g, '_') || '';
        }).filter(Boolean);

        const breakdown: Record<string, unknown> = {
          base_score: 100,
          signal_penalties: [] as { type: string; severity: string; penalty: number; source: string; description: string; amplified: boolean }[],
          total_signal_deductions: 0,
          multi_signal_penalty: 0,
          integration_coverage: 0,
          coverage_bonus: 0,
          data_freshness_bonus: 0,
          fresh_integrations: 0,
          connected_services: connectedServiceNames,
        };

        // Apply penalties for each active signal with category amplification
        const activeSignals = signals || [];
        let rawSignalDeductions = 0;

        for (const signal of activeSignals) {
          const basePenalty = SEVERITY_PENALTIES[signal.severity] || 6;
          const confidence = (signal.confidence as number) || 100;

          // Apply category amplification for business-critical signals
          const isCriticalBusiness = CRITICAL_BUSINESS_SIGNALS.has(signal.signal_type);
          const amplifier = isCriticalBusiness ? CATEGORY_AMPLIFICATION : 1.0;

          const scaledPenalty = Math.round((basePenalty * amplifier * (confidence / 100)) * 10) / 10;
          score -= scaledPenalty;
          rawSignalDeductions += scaledPenalty;

          (breakdown.signal_penalties as { type: string; severity: string; penalty: number; source: string; description: string; amplified: boolean }[]).push({
            type: signal.signal_type,
            severity: signal.severity,
            penalty: scaledPenalty,
            source: signal.source_integration || 'unknown',
            description: signal.description || signal.signal_type.replace(/_/g, ' '),
            amplified: isCriticalBusiness,
          });
        }

        // Multi-signal amplification penalty
        let multiSignalPenalty = 0;
        if (activeSignals.length >= 5) {
          multiSignalPenalty = 10;
        } else if (activeSignals.length >= 3) {
          multiSignalPenalty = 5;
        }
        score -= multiSignalPenalty;
        breakdown.multi_signal_penalty = multiSignalPenalty;

        const totalDeductions = rawSignalDeductions + multiSignalPenalty;
        breakdown.total_signal_deductions = Math.round(totalDeductions * 10) / 10;

        // Integration coverage bonus (capped at +3 to prevent offsetting major issues)
        const connectedCount = (integrations || []).length;
        const coverageBonus = Math.min(connectedCount, 3);
        score += coverageBonus;
        breakdown.integration_coverage = connectedCount;
        breakdown.coverage_bonus = coverageBonus;

        // Data freshness check
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const freshIntegrations = (integrations || []).filter(
          i => i.updated_at && i.updated_at > oneHourAgo
        ).length;
        const freshnessPenalty = connectedCount > 0 ? Math.max(0, (connectedCount - freshIntegrations) * 2) : 0;
        score -= freshnessPenalty;
        breakdown.data_freshness_bonus = -freshnessPenalty;
        breakdown.fresh_integrations = freshIntegrations;

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
        console.log(`[health-score] User ${userId}: Score ${score} (${label}), ${activeSignals.length} active signals, deductions=${Math.round(totalDeductions * 10) / 10}`);
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
