/**
 * Partner Payout Generate Edge Function - PRODUCTION SYSTEM
 * 
 * Implements Part 11 of the Partner Program - Payout Preparation:
 * - Generates partner payout statements monthly
 * - No automatic payouts required at launch
 * - Ledger is auditable and exportable
 * - Refunds adjust next cycle automatically
 * 
 * This function aggregates revenue ledger entries and generates
 * monthly payout statements for each partner.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface PayoutSummary {
  partner_id: string;
  partner_name: string;
  period_key: string;
  total_gross_revenue: number;
  total_net_revenue: number;
  total_partner_share: number;
  refund_adjustments: number;
  final_payout_amount: number;
  currency: string;
  customer_count: number;
  invoice_count: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  try {
    const body = await req.json();
    const { year, month } = body;

    if (!year || !month) {
      return new Response(JSON.stringify({ error: 'Validation failed', details: ['year and month are required'] }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const periodKey = `${year}-${String(month).padStart(2, '0')}`;
    const periodStart = new Date(year, month - 1, 1);
    const periodEnd = new Date(year, month, 0, 23, 59, 59);

    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    // Check if statements already exist for this period
    const { data: existingStatements } = await supabase
      .from('partner_payout_statements')
      .select('id')
      .eq('period_key', periodKey)
      .limit(1);

    if (existingStatements && existingStatements.length > 0) {
      return new Response(JSON.stringify({ 
        error: 'Statements already exist', 
        details: [`Payout statements for ${periodKey} have already been generated. Use force=true to regenerate.`] 
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Fetch all revenue ledger entries for the period
    const { data: ledgerEntries, error: ledgerError } = await supabase
      .from('partner_revenue_ledger')
      .select('*')
      .eq('period_key', periodKey)
      .eq('status', 'calculated');

    if (ledgerError) {
      console.error('Failed to fetch ledger entries:', ledgerError);
      return new Response(JSON.stringify({ error: 'Failed to fetch revenue data', details: ledgerError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!ledgerEntries || ledgerEntries.length === 0) {
      return new Response(JSON.stringify({ 
        success: true,
        message: `No revenue entries found for ${periodKey}. No statements generated.`,
        period_key: periodKey,
        statements_generated: 0,
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Fetch partner registry for names
    const { data: partners } = await supabase
      .from('partner_registry')
      .select('partner_id, legal_name');

    const partnerNames = new Map<string, string>();
    if (partners) {
      for (const p of partners) {
        partnerNames.set(p.partner_id, p.legal_name);
      }
    }

    // Aggregate by partner
    const partnerAggregates = new Map<string, PayoutSummary>();

    for (const entry of ledgerEntries) {
      const existing = partnerAggregates.get(entry.partner_id);
      
      if (existing) {
        existing.total_gross_revenue += entry.gross_revenue || 0;
        existing.total_net_revenue += entry.net_revenue || 0;
        existing.total_partner_share += entry.partner_share || 0;
        existing.invoice_count += 1;
        // Track unique customers
        if (!existing.customer_count) existing.customer_count = 0;
      } else {
        partnerAggregates.set(entry.partner_id, {
          partner_id: entry.partner_id,
          partner_name: partnerNames.get(entry.partner_id) || 'Unknown',
          period_key: periodKey,
          total_gross_revenue: entry.gross_revenue || 0,
          total_net_revenue: entry.net_revenue || 0,
          total_partner_share: entry.partner_share || 0,
          refund_adjustments: 0, // Will be calculated from refunds
          final_payout_amount: 0, // Calculated after adjustments
          currency: entry.currency || 'USD',
          customer_count: 1,
          invoice_count: 1,
        });
      }
    }

    // Calculate unique customers per partner
    const customersByPartner = new Map<string, Set<string>>();
    for (const entry of ledgerEntries) {
      if (!customersByPartner.has(entry.partner_id)) {
        customersByPartner.set(entry.partner_id, new Set());
      }
      customersByPartner.get(entry.partner_id)!.add(entry.customer_domain);
    }

    // Fetch any refund adjustments from previous periods
    // (Refunds from current period would adjust next cycle)
    const previousPeriodKey = month === 1 
      ? `${year - 1}-12` 
      : `${year}-${String(month - 1).padStart(2, '0')}`;

    const { data: refunds } = await supabase
      .from('partner_revenue_ledger')
      .select('partner_id, partner_share')
      .eq('period_key', previousPeriodKey)
      .eq('status', 'refunded');

    const refundsByPartner = new Map<string, number>();
    if (refunds) {
      for (const refund of refunds) {
        const current = refundsByPartner.get(refund.partner_id) || 0;
        refundsByPartner.set(refund.partner_id, current + (refund.partner_share || 0));
      }
    }

    // Generate payout statements
    const statements: Array<{
      partner_id: string;
      period_key: string;
      period_start: string;
      period_end: string;
      total_gross_revenue: number;
      total_net_revenue: number;
      total_partner_share: number;
      refund_adjustments: number;
      final_payout_amount: number;
      currency: string;
      customer_count: number;
      invoice_count: number;
      status: string;
      generated_at: string;
    }> = [];

    for (const [partnerId, summary] of partnerAggregates) {
      const refundAdjustment = refundsByPartner.get(partnerId) || 0;
      const finalPayout = Math.max(0, summary.total_partner_share - refundAdjustment);
      const customerCount = customersByPartner.get(partnerId)?.size || 0;

      statements.push({
        partner_id: partnerId,
        period_key: periodKey,
        period_start: periodStart.toISOString(),
        period_end: periodEnd.toISOString(),
        total_gross_revenue: summary.total_gross_revenue,
        total_net_revenue: summary.total_net_revenue,
        total_partner_share: summary.total_partner_share,
        refund_adjustments: refundAdjustment,
        final_payout_amount: finalPayout,
        currency: summary.currency,
        customer_count: customerCount,
        invoice_count: summary.invoice_count,
        status: 'pending_review',
        generated_at: new Date().toISOString(),
      });
    }

    // Insert payout statements
    if (statements.length > 0) {
      const { error: insertError } = await supabase
        .from('partner_payout_statements')
        .insert(statements);

      if (insertError) {
        console.error('Failed to insert payout statements:', insertError);
        return new Response(JSON.stringify({ error: 'Failed to save payout statements', details: insertError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Update ledger entries to 'statement_generated'
      await supabase
        .from('partner_revenue_ledger')
        .update({ status: 'statement_generated' })
        .eq('period_key', periodKey)
        .eq('status', 'calculated');
    }

    // Calculate totals for response
    const totalPayout = statements.reduce((sum, s) => sum + s.final_payout_amount, 0);
    const totalGross = statements.reduce((sum, s) => sum + s.total_gross_revenue, 0);

    // Audit log
    await supabase.from('partner_audit_log').insert({
      entity_type: 'payout_generation',
      entity_id: periodKey,
      action: 'payouts_generated',
      actor_type: 'system',
      actor_id: 'partner-payout-generate',
      inputs: { year, month, period_key: periodKey },
      outputs: {
        statements_generated: statements.length,
        total_payout_amount: totalPayout,
        total_gross_revenue: totalGross,
      },
      decision: 'Payout statements generated',
      reason: `Generated ${statements.length} payout statements for ${periodKey}`,
    });

    return new Response(JSON.stringify({
      success: true,
      message: `Payout statements generated for ${periodKey}`,
      period_key: periodKey,
      summary: {
        statements_generated: statements.length,
        total_gross_revenue: totalGross,
        total_payout_amount: totalPayout,
        partners: statements.map(s => ({
          partner_id: s.partner_id,
          final_payout: s.final_payout_amount,
          customer_count: s.customer_count,
          invoice_count: s.invoice_count,
        })),
      },
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Partner payout generation error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
