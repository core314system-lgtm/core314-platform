import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

/**
 * Signal Detection Engine
 * 
 * Analyzes integration_events to detect operational patterns and creates
 * structured signals in the operational_signals table.
 * 
 * Detection categories:
 * - CRM: stalled deals, pipeline slowdown, deal velocity changes
 * - Communication: message volume spikes, cross-team activity
 * - Financial: invoice delays, revenue changes, expense anomalies
 * 
 * Runs after polling cycles or on-demand via API call.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface DetectedSignal {
  signal_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  description: string;
  source_integration: string;
  signal_data: Record<string, unknown>;
}

interface IntegrationEvent {
  id: string;
  user_id: string;
  service_name: string;
  event_type: string;
  metadata: Record<string, unknown>;
  occurred_at: string;
  created_at: string;
}

// ============================================================
// DETECTION RULES
// ============================================================

function detectHubSpotSignals(events: IntegrationEvent[]): DetectedSignal[] {
  const signals: DetectedSignal[] = [];
  if (events.length === 0) return signals;

  const latest = events[0];
  const meta = latest.metadata;

  // 1. Stalled deals detection
  const stalledDeals = (meta.stalled_deals as number) || 0;
  const openDeals = (meta.open_deals as number) || 0;

  if (stalledDeals > 0) {
    const stalledPercent = openDeals > 0 ? (stalledDeals / openDeals) * 100 : 0;
    const severity: DetectedSignal['severity'] = 
      stalledDeals >= 10 || stalledPercent > 50 ? 'high' : 
      stalledDeals >= 5 || stalledPercent > 25 ? 'medium' : 'low';
    
    signals.push({
      signal_type: 'stalled_deals',
      severity,
      confidence: 85,
      description: `${stalledDeals} open deal${stalledDeals > 1 ? 's have' : ' has'} not received follow-up in over 6 days${openDeals > 0 ? ` (${stalledPercent.toFixed(0)}% of pipeline)` : ''}.`,
      source_integration: 'hubspot',
      signal_data: {
        stalled_count: stalledDeals,
        open_deals: openDeals,
        stalled_percent: stalledPercent,
        stalled_deal_ids: meta.stalled_deal_ids || [],
      },
    });
  }

  // 2. Pipeline value change (compare with previous event)
  if (events.length >= 2) {
    const prevMeta = events[1].metadata;
    const currentPipeline = (meta.open_pipeline_value as number) || 0;
    const prevPipeline = (prevMeta.open_pipeline_value as number) || 0;

    if (prevPipeline > 0) {
      const pipelineChange = ((currentPipeline - prevPipeline) / prevPipeline) * 100;

      if (Math.abs(pipelineChange) > 15) {
        const isDecline = pipelineChange < 0;
        signals.push({
          signal_type: isDecline ? 'pipeline_decline' : 'pipeline_growth',
          severity: Math.abs(pipelineChange) > 30 ? 'high' : 'medium',
          confidence: 75,
          description: `Pipeline value ${isDecline ? 'declined' : 'increased'} ${Math.abs(pipelineChange).toFixed(0)}% (from $${prevPipeline.toLocaleString()} to $${currentPipeline.toLocaleString()}).`,
          source_integration: 'hubspot',
          signal_data: {
            current_value: currentPipeline,
            previous_value: prevPipeline,
            change_percent: pipelineChange,
          },
        });
      }
    }
  }

  // 3. High average deal age
  const avgDealAge = (meta.avg_deal_age_days as number) || 0;
  if (avgDealAge > 30) {
    signals.push({
      signal_type: 'slow_deal_velocity',
      severity: avgDealAge > 60 ? 'high' : 'medium',
      confidence: 70,
      description: `Average open deal age is ${avgDealAge} days, indicating slow deal velocity.`,
      source_integration: 'hubspot',
      signal_data: { avg_deal_age_days: avgDealAge, open_deals: openDeals },
    });
  }

  // 4. Win rate analysis
  const wonDeals = (meta.won_deals as number) || 0;
  const lostDeals = (meta.lost_deals as number) || 0;
  const totalClosed = wonDeals + lostDeals;
  if (totalClosed >= 5) {
    const winRate = (wonDeals / totalClosed) * 100;
    if (winRate < 30) {
      signals.push({
        signal_type: 'low_win_rate',
        severity: winRate < 15 ? 'high' : 'medium',
        confidence: 70,
        description: `Deal win rate is ${winRate.toFixed(0)}% (${wonDeals} won / ${totalClosed} closed), which may indicate pipeline quality issues.`,
        source_integration: 'hubspot',
        signal_data: { win_rate: winRate, won_deals: wonDeals, lost_deals: lostDeals },
      });
    }
  }

  return signals;
}

function detectSlackSignals(events: IntegrationEvent[]): DetectedSignal[] {
  const signals: DetectedSignal[] = [];
  if (events.length === 0) return signals;

  const latest = events[0];
  const meta = latest.metadata;

  // 1. Message volume change (compare with baseline)
  if (events.length >= 2) {
    const currentMessages = (meta.message_count as number) || 0;
    // Calculate baseline from older events
    const olderEvents = events.slice(1);
    const baseline = olderEvents.reduce((sum, e) => sum + ((e.metadata.message_count as number) || 0), 0) / olderEvents.length;

    if (baseline > 0) {
      const changePercent = ((currentMessages - baseline) / baseline) * 100;

      if (Math.abs(changePercent) > 20) {
        const isIncrease = changePercent > 0;
        signals.push({
          signal_type: isIncrease ? 'communication_spike' : 'communication_drop',
          severity: Math.abs(changePercent) > 50 ? 'high' : 'medium',
          confidence: 72,
          description: `Slack communication ${isIncrease ? 'increased' : 'decreased'} ${Math.abs(changePercent).toFixed(0)}% compared to recent average.`,
          source_integration: 'slack',
          signal_data: {
            current_messages: currentMessages,
            baseline_messages: Math.round(baseline),
            change_percent: changePercent,
          },
        });
      }
    }
  }

  // 2. Channel activity anomaly
  const activeChannels = (meta.active_channels as number) || 0;
  const totalChannels = (meta.total_channels as number) || 0;

  if (totalChannels > 0) {
    const activeRatio = (activeChannels / totalChannels) * 100;
    if (activeRatio < 20 && totalChannels > 5) {
      signals.push({
        signal_type: 'low_channel_engagement',
        severity: 'low',
        confidence: 60,
        description: `Only ${activeRatio.toFixed(0)}% of Slack channels (${activeChannels}/${totalChannels}) show recent activity.`,
        source_integration: 'slack',
        signal_data: { active_channels: activeChannels, total_channels: totalChannels, active_ratio: activeRatio },
      });
    }
  }

  return signals;
}

function detectQuickBooksSignals(events: IntegrationEvent[]): DetectedSignal[] {
  const signals: DetectedSignal[] = [];
  if (events.length === 0) return signals;

  const latest = events[0];
  const meta = latest.metadata;

  // 1. Overdue invoices
  const overdueInvoices = (meta.overdue_invoices as number) || 0;
  const openInvoices = (meta.open_invoices as number) || 0;
  const invoiceTotal = (meta.invoice_total as number) || 0;

  if (overdueInvoices > 0) {
    const overduePercent = openInvoices > 0 ? (overdueInvoices / openInvoices) * 100 : 0;
    signals.push({
      signal_type: 'overdue_invoices',
      severity: overdueInvoices >= 10 || overduePercent > 50 ? 'high' : 
               overdueInvoices >= 5 || overduePercent > 25 ? 'medium' : 'low',
      confidence: 90,
      description: `${overdueInvoices} invoice${overdueInvoices > 1 ? 's are' : ' is'} overdue${openInvoices > 0 ? ` (${overduePercent.toFixed(0)}% of open invoices)` : ''}.`,
      source_integration: 'quickbooks',
      signal_data: { overdue_invoices: overdueInvoices, open_invoices: openInvoices, overdue_percent: overduePercent },
    });
  }

  // 2. Revenue trend (compare with previous)
  if (events.length >= 2) {
    const prevMeta = events[1].metadata;
    const currentPayments = (meta.payment_total as number) || 0;
    const prevPayments = (prevMeta.payment_total as number) || 0;

    if (prevPayments > 0) {
      const revenueChange = ((currentPayments - prevPayments) / prevPayments) * 100;
      if (Math.abs(revenueChange) > 20) {
        const isDecline = revenueChange < 0;
        signals.push({
          signal_type: isDecline ? 'revenue_decline' : 'revenue_growth',
          severity: Math.abs(revenueChange) > 40 ? 'high' : 'medium',
          confidence: 75,
          description: `Payment revenue ${isDecline ? 'declined' : 'increased'} ${Math.abs(revenueChange).toFixed(0)}% compared to previous period.`,
          source_integration: 'quickbooks',
          signal_data: { current_payments: currentPayments, previous_payments: prevPayments, change_percent: revenueChange },
        });
      }
    }
  }

  // 3. Expense anomaly
  if (events.length >= 2) {
    const prevMeta = events[1].metadata;
    const currentExpenses = (meta.expense_total as number) || 0;
    const prevExpenses = (prevMeta.expense_total as number) || 0;

    if (prevExpenses > 0) {
      const expenseChange = ((currentExpenses - prevExpenses) / prevExpenses) * 100;
      if (expenseChange > 25) {
        signals.push({
          signal_type: 'expense_spike',
          severity: expenseChange > 50 ? 'high' : 'medium',
          confidence: 70,
          description: `Expenses increased ${expenseChange.toFixed(0)}% compared to previous period ($${currentExpenses.toLocaleString()} vs $${prevExpenses.toLocaleString()}).`,
          source_integration: 'quickbooks',
          signal_data: { current_expenses: currentExpenses, previous_expenses: prevExpenses, change_percent: expenseChange },
        });
      }
    }
  }

  // 4. Cash flow risk (high invoices, low payments)
  const paymentTotal = (meta.payment_total as number) || 0;
  if (invoiceTotal > 0 && paymentTotal > 0) {
    const collectionRate = (paymentTotal / invoiceTotal) * 100;
    if (collectionRate < 50) {
      signals.push({
        signal_type: 'low_collection_rate',
        severity: collectionRate < 30 ? 'high' : 'medium',
        confidence: 65,
        description: `Collection rate is ${collectionRate.toFixed(0)}% — payments received ($${paymentTotal.toLocaleString()}) are significantly lower than invoiced amount ($${invoiceTotal.toLocaleString()}).`,
        source_integration: 'quickbooks',
        signal_data: { payment_total: paymentTotal, invoice_total: invoiceTotal, collection_rate: collectionRate },
      });
    }
  }

  return signals;
}

// ============================================================
// MAIN HANDLER
// ============================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse request - can target specific user or process all
    let targetUserId: string | null = null;
    let targetOrgId: string | null = null;

    try {
      const body = await req.json();
      targetUserId = body.user_id || null;
      targetOrgId = body.organization_id || null;
    } catch {
      // No body = process all users with recent events
    }

    // Get distinct users with recent integration events (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    let usersQuery = supabase
      .from('integration_events')
      .select('user_id')
      .gte('created_at', oneDayAgo);

    if (targetUserId) {
      usersQuery = usersQuery.eq('user_id', targetUserId);
    }

    const { data: userEvents, error: userError } = await usersQuery;

    if (userError) {
      console.error('[signal-detection] Error fetching users:', userError);
      return new Response(JSON.stringify({ error: 'Failed to fetch user events' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get distinct user IDs
    const userIds = [...new Set((userEvents || []).map(e => e.user_id))];
    console.log(`[signal-detection] Processing ${userIds.length} user(s)`);

    let totalSignals = 0;
    const results: { user_id: string; signals_detected: number }[] = [];

    for (const userId of userIds) {
      try {
        // Expire old signals for this user
        await supabase
          .from('operational_signals')
          .update({ is_active: false })
          .eq('user_id', userId)
          .lt('detected_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

        // Fetch recent events per integration (last 7 days, up to 10 per service)
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

        const { data: hubspotEvents } = await supabase
          .from('integration_events')
          .select('*')
          .eq('user_id', userId)
          .eq('service_name', 'hubspot')
          .gte('created_at', sevenDaysAgo)
          .order('created_at', { ascending: false })
          .limit(10);

        const { data: slackEvents } = await supabase
          .from('integration_events')
          .select('*')
          .eq('user_id', userId)
          .eq('service_name', 'slack')
          .gte('created_at', sevenDaysAgo)
          .order('created_at', { ascending: false })
          .limit(10);

        const { data: qbEvents } = await supabase
          .from('integration_events')
          .select('*')
          .eq('user_id', userId)
          .eq('service_name', 'quickbooks')
          .gte('created_at', sevenDaysAgo)
          .order('created_at', { ascending: false })
          .limit(10);

        // Run detection rules
        const detectedSignals: DetectedSignal[] = [
          ...detectHubSpotSignals((hubspotEvents || []) as IntegrationEvent[]),
          ...detectSlackSignals((slackEvents || []) as IntegrationEvent[]),
          ...detectQuickBooksSignals((qbEvents || []) as IntegrationEvent[]),
        ];

        // Deactivate previous active signals for this user to avoid duplicates
        if (detectedSignals.length > 0) {
          const signalTypes = detectedSignals.map(s => s.signal_type);
          await supabase
            .from('operational_signals')
            .update({ is_active: false })
            .eq('user_id', userId)
            .eq('is_active', true)
            .in('signal_type', signalTypes);
        }

        // Get organization_id for this user
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

        // Insert new signals
        for (const signal of detectedSignals) {
          await supabase.from('operational_signals').insert({
            user_id: userId,
            organization_id: orgId,
            signal_type: signal.signal_type,
            severity: signal.severity,
            confidence: signal.confidence,
            description: signal.description,
            source_integration: signal.source_integration,
            signal_data: signal.signal_data,
            is_active: true,
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          });
        }

        totalSignals += detectedSignals.length;
        results.push({ user_id: userId, signals_detected: detectedSignals.length });

        console.log(`[signal-detection] User ${userId}: ${detectedSignals.length} signals detected`, 
          detectedSignals.map(s => `${s.signal_type} (${s.severity})`));
      } catch (userProcessError: unknown) {
        const msg = userProcessError instanceof Error ? userProcessError.message : String(userProcessError);
        console.error(`[signal-detection] Error processing user ${userId}:`, msg);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      users_processed: userIds.length,
      total_signals_detected: totalSignals,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[signal-detection] Error:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
