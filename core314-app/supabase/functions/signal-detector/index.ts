import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { classifySignal } from '../_shared/signal-classification.ts';

/**
 * Signal Detector
 * 
 * Analyzes recent integration_events and generates operational_signals.
 * This is the missing bridge between raw poll data and the Signal Dashboard.
 * 
 * Detection rules:
 *   Slack:
 *     - low_communication: < 5 messages in last 7 days
 *     - communication_spike: message count jumped >2x vs previous poll
 *     - slow_response: avg response time > 30 min
 *   QuickBooks:
 *     - overdue_invoices: any overdue invoices detected
 *     - revenue_decline: payment total dropped vs previous poll
 *     - high_expense_ratio: expenses > 80% of revenue
 *     - low_collection_rate: collection rate < 70%
 *   HubSpot:
 *     - stalled_deals: deals stuck in pipeline
 *     - deal_velocity_decline: deal close rate declining
 * 
 * Designed to be called by integration-scheduler after polling completes.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface SignalCandidate {
  signal_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  description: string;
  source_integration: string;
  signal_data: Record<string, unknown>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    console.log('[signal-detector] Starting signal detection run');

    // Get all users who have active integrations
    const { data: activeUsers, error: usersError } = await supabase
      .from('user_integrations')
      .select('user_id')
      .eq('status', 'active');

    if (usersError || !activeUsers) {
      console.error('[signal-detector] Error fetching active users:', usersError);
      return new Response(JSON.stringify({ error: 'Failed to fetch active users' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Deduplicate user IDs
    const userIds = [...new Set(activeUsers.map(u => u.user_id))];
    console.log(`[signal-detector] Processing ${userIds.length} users with active integrations`);

    let totalSignalsCreated = 0;
    let totalSignalsDeactivated = 0;
    const errors: string[] = [];

    for (const userId of userIds) {
      try {
        const signals: SignalCandidate[] = [];

        // Fetch the 2 most recent events per service for comparison
        const { data: slackEvents } = await supabase
          .from('integration_events')
          .select('metadata, occurred_at')
          .eq('user_id', userId)
          .eq('event_type', 'slack.workspace_activity')
          .order('occurred_at', { ascending: false })
          .limit(2);

        const { data: qbEvents } = await supabase
          .from('integration_events')
          .select('metadata, occurred_at')
          .eq('user_id', userId)
          .eq('event_type', 'quickbooks.financial_activity')
          .order('occurred_at', { ascending: false })
          .limit(2);

        const { data: hubspotEvents } = await supabase
          .from('integration_events')
          .select('metadata, occurred_at')
          .eq('user_id', userId)
          .eq('event_type', 'hubspot.crm_activity')
          .order('occurred_at', { ascending: false })
          .limit(2);

        // --- Slack Signal Detection ---
        // Fetch Slack integration config to check channels_member and oauth_connected
        const { data: slackIntegration } = await supabase
          .from('user_integrations')
          .select('config')
          .eq('user_id', userId)
          .eq('status', 'active')
          .like('service_name', '%slack%')
          .limit(1)
          .maybeSingle();

        // If no direct match, try via integration_registry join
        let slackConfig = (slackIntegration?.config as Record<string, unknown>) || null;
        if (!slackConfig) {
          const { data: slackViaRegistry } = await supabase
            .from('user_integrations')
            .select('config, integrations_master!inner(integration_type)')
            .eq('user_id', userId)
            .eq('status', 'active')
            .eq('integrations_master.integration_type', 'slack')
            .limit(1)
            .maybeSingle();
          slackConfig = (slackViaRegistry?.config as Record<string, unknown>) || null;
        }

        const configChannelsMember = (slackConfig?.channels_member as number) ?? 0;
        const configChannelsTotal = (slackConfig?.channels_total as number) ?? 0;
        const configOauthConnected = slackConfig?.oauth_connected as boolean ?? false;

        if (slackEvents && slackEvents.length > 0) {
          const latest = slackEvents[0].metadata as Record<string, number | string | null>;
          const messageCount = (latest.message_count as number) ?? 0;
          const activeChannels = (latest.active_channels as number) ?? 0;
          const totalChannels = (latest.total_channels as number) ?? configChannelsTotal;
          const uniqueUsers = (latest.unique_users as number) ?? 0;
          const avgResponseTime = latest.avg_response_time_minutes as number | null;
          const channelsMember = activeChannels > 0 ? activeChannels : configChannelsMember;

          // Determine Slack connection validity:
          // - Valid: channels_member >= 1 (bot is in at least one channel)
          // - Issue: channels_total == 0 OR oauth_connected == false
          const isSlackConnectionValid = channelsMember >= 1 || configChannelsMember >= 1;
          const isSlackConnectionIssue = (totalChannels === 0 && configChannelsTotal === 0) || !configOauthConnected;

          // Signal: Slack connection issue (only when truly disconnected)
          if (isSlackConnectionIssue) {
            signals.push({
              signal_type: 'integration_inactive',
              severity: 'medium',
              confidence: 90,
              description: !configOauthConnected
                ? 'Slack OAuth connection is not active. Re-authorize the Slack integration to resume monitoring.'
                : 'Slack is connected but no channels are accessible. The bot may need to be invited to channels for monitoring.',
              source_integration: 'slack',
              signal_data: { category: classifySignal('integration_inactive', 'slack'), metric: 'integration_inactive', total_channels: totalChannels, oauth_connected: configOauthConnected, channels_member: channelsMember },
            });
          }

          // Signal: Low communication activity — only when connection is valid
          // If channels_member >= 1 but no recent messages, this is "active but limited" (not a connection issue)
          if (isSlackConnectionValid && !isSlackConnectionIssue && messageCount < 5 && totalChannels > 0) {
            signals.push({
              signal_type: 'low_communication',
              severity: 'low',
              confidence: 75,
              description: messageCount === 0
                ? `Slack integration is active but limited communication activity was detected in monitored channels. ${channelsMember} channel${channelsMember > 1 ? 's' : ''} monitored across ${totalChannels} total.`
                : `Only ${messageCount} Slack messages in the past 7 days across ${channelsMember} monitored channels. Communication volume is below typical thresholds.`,
              source_integration: 'slack',
              signal_data: { category: classifySignal('low_communication', 'slack'), metric: 'low_communication', message_count: messageCount, active_channels: activeChannels, total_channels: totalChannels, channels_member: channelsMember },
            });
          }

          // Signal: Communication spike (compare with previous poll)
          if (slackEvents.length > 1) {
            const prev = slackEvents[1].metadata as Record<string, number>;
            const prevMessageCount = prev.message_count ?? 0;
            if (prevMessageCount > 0 && messageCount > prevMessageCount * 2) {
              signals.push({
                signal_type: 'communication_spike',
                severity: 'medium',
                confidence: 75,
                description: `Slack message volume surged from ${prevMessageCount} to ${messageCount} — a ${Math.round((messageCount / prevMessageCount - 1) * 100)}% increase. Investigate if this reflects a critical issue or high collaboration.`,
                source_integration: 'slack',
                signal_data: { category: classifySignal('communication_spike', 'slack'), metric: 'communication_spike', current: messageCount, previous: prevMessageCount, change_pct: Math.round((messageCount / prevMessageCount - 1) * 100) },
              });
            }
          }

          // Signal: Slow response times
          if (avgResponseTime !== null && avgResponseTime > 30) {
            signals.push({
              signal_type: 'slow_response',
              severity: avgResponseTime > 60 ? 'high' : 'medium',
              confidence: 70,
              description: `Average Slack response time is ${Math.round(avgResponseTime)} minutes. Teams responding slowly may indicate capacity or engagement issues.`,
              source_integration: 'slack',
              signal_data: { category: classifySignal('slow_response', 'slack'), metric: 'slow_response', avg_response_time_minutes: avgResponseTime },
            });
          }

          // Signal: Low team engagement (zero unique users but valid connection)
          if (isSlackConnectionValid && !isSlackConnectionIssue && uniqueUsers === 0 && totalChannels > 0 && messageCount >= 5) {
            signals.push({
              signal_type: 'low_engagement',
              severity: 'medium',
              confidence: 80,
              description: `No active Slack users detected despite ${totalChannels} channels existing. Team engagement may need attention.`,
              source_integration: 'slack',
              signal_data: { category: classifySignal('low_engagement', 'slack'), metric: 'low_engagement', unique_users: uniqueUsers, total_channels: totalChannels },
            });
          }
        }

        // --- QuickBooks Signal Detection ---
        if (qbEvents && qbEvents.length > 0) {
          const latest = qbEvents[0].metadata as Record<string, unknown>;
          const overdueInvoices = (latest.overdue_invoices as number) ?? 0;
          const openInvoices = (latest.open_invoices as number) ?? 0;
          const invoiceTotal = (latest.invoice_total as number) ?? 0;
          const paymentTotal = (latest.payment_total as number) ?? 0;
          const expenseTotal = (latest.expense_total as number) ?? 0;
          const collectionRate = (latest.collection_rate as number) ?? 0;
          const overdueTotal = (latest.overdue_total as number) ?? 0;
          const invoiceCount = (latest.invoice_count as number) ?? 0;
          const invoiceAging = latest.invoice_aging as { current?: number; aging30?: number; aging60?: number; aging90Plus?: number } | null;

          // Signal: Overdue invoices
          if (overdueInvoices > 0) {
            const severity = overdueInvoices >= 5 ? 'critical' : overdueInvoices >= 3 ? 'high' : 'medium';
            signals.push({
              signal_type: 'overdue_invoices',
              severity,
              confidence: 95,
              description: `${overdueInvoices} overdue invoice${overdueInvoices > 1 ? 's' : ''} totaling $${overdueTotal.toLocaleString()}. ${invoiceAging?.aging90Plus ? `${invoiceAging.aging90Plus} are 90+ days overdue.` : 'Follow up to improve cash flow.'}`,
              source_integration: 'quickbooks',
              signal_data: { category: classifySignal('overdue_invoices', 'quickbooks'), metric: 'overdue_invoices', overdue_invoices: overdueInvoices, overdue_total: overdueTotal, invoice_aging: invoiceAging },
            });
          }

          // Signal: Low collection rate
          if (invoiceTotal > 0 && collectionRate < 70) {
            signals.push({
              signal_type: 'low_collection_rate',
              severity: collectionRate < 50 ? 'high' : 'medium',
              confidence: 85,
              description: `Collection rate is ${collectionRate}% — below the 70% healthy threshold. $${(invoiceTotal - paymentTotal).toLocaleString()} remains uncollected.`,
              source_integration: 'quickbooks',
              signal_data: { category: classifySignal('low_collection_rate', 'quickbooks'), metric: 'low_collection_rate', collection_rate: collectionRate, invoice_total: invoiceTotal, payment_total: paymentTotal },
            });
          }

          // Signal: High expense ratio
          if (paymentTotal > 0 && expenseTotal > 0 && expenseTotal > paymentTotal * 0.8) {
            signals.push({
              signal_type: 'high_expense_ratio',
              severity: expenseTotal > paymentTotal ? 'critical' : 'high',
              confidence: 80,
              description: `Expenses ($${expenseTotal.toLocaleString()}) are ${Math.round(expenseTotal / paymentTotal * 100)}% of revenue ($${paymentTotal.toLocaleString()}). Margins are tight.`,
              source_integration: 'quickbooks',
              signal_data: { category: classifySignal('high_expense_ratio', 'quickbooks'), metric: 'high_expense_ratio', expense_total: expenseTotal, payment_total: paymentTotal, ratio: Math.round(expenseTotal / paymentTotal * 100) },
            });
          }

          // Signal: Revenue decline (compare with previous poll)
          if (qbEvents.length > 1) {
            const prev = qbEvents[1].metadata as Record<string, number>;
            const prevPaymentTotal = prev.payment_total ?? 0;
            if (prevPaymentTotal > 0 && paymentTotal < prevPaymentTotal * 0.8) {
              signals.push({
                signal_type: 'revenue_decline',
                severity: 'high',
                confidence: 70,
                description: `Payment volume dropped from $${prevPaymentTotal.toLocaleString()} to $${paymentTotal.toLocaleString()} — a ${Math.round((1 - paymentTotal / prevPaymentTotal) * 100)}% decline.`,
                source_integration: 'quickbooks',
                signal_data: { category: classifySignal('revenue_decline', 'quickbooks'), metric: 'revenue_decline', current: paymentTotal, previous: prevPaymentTotal },
              });
            }
          }

          // Signal: No financial activity (connected but no data)
          if (invoiceCount === 0 && (latest.payment_count as number) === 0 && (latest.expense_count as number) === 0) {
            const accountCount = (latest.account_count as number) ?? 0;
            if (accountCount > 0) {
              signals.push({
                signal_type: 'no_financial_activity',
                severity: 'low',
                confidence: 90,
                description: `QuickBooks is connected (${accountCount} accounts) but no invoices, payments, or expenses found in the last 90 days. This may be a new or inactive account.`,
                source_integration: 'quickbooks',
                signal_data: { category: classifySignal('no_financial_activity', 'quickbooks'), metric: 'no_financial_activity', account_count: accountCount },
              });
            }
          }
        }

        // --- HubSpot Signal Detection ---
        if (hubspotEvents && hubspotEvents.length > 0) {
          const latest = hubspotEvents[0].metadata as Record<string, unknown>;
          const dealCount = (latest.deal_count as number) ?? 0;
          const stalledDeals = (latest.stalled_deals as number) ?? 0;
          const contactCount = (latest.contact_count as number) ?? 0;

          if (stalledDeals > 0) {
            signals.push({
              signal_type: 'stalled_deals',
              severity: stalledDeals >= 5 ? 'high' : 'medium',
              confidence: 85,
              description: `${stalledDeals} deal${stalledDeals > 1 ? 's' : ''} stalled in the pipeline out of ${dealCount} total. Revenue at risk — review and take action.`,
              source_integration: 'hubspot',
              signal_data: { category: classifySignal('stalled_deals', 'hubspot'), metric: 'stalled_deals', stalled_deals: stalledDeals, total_deals: dealCount },
            });
          }

          if (contactCount === 0 && dealCount === 0) {
            signals.push({
              signal_type: 'no_crm_activity',
              severity: 'low',
              confidence: 90,
              description: 'HubSpot is connected but no contacts or deals found. Add CRM data for operational intelligence.',
              source_integration: 'hubspot',
              signal_data: { category: classifySignal('no_crm_activity', 'hubspot'), metric: 'no_crm_activity', contact_count: contactCount, deal_count: dealCount },
            });
          }
        }

        // --- Persist Signals ---
        if (signals.length > 0) {
          const now = new Date().toISOString();

          // Deactivate old signals for this user that are no longer detected
          const detectedTypes = signals.map(s => `${s.source_integration}:${s.signal_type}`);
          
          // First, get existing active signals for this user
          const { data: existingSignals } = await supabase
            .from('operational_signals')
            .select('id, signal_type, source_integration')
            .eq('user_id', userId)
            .eq('is_active', true);

          if (existingSignals) {
            const toDeactivate = existingSignals.filter(
              es => !detectedTypes.includes(`${es.source_integration}:${es.signal_type}`)
            );
            if (toDeactivate.length > 0) {
              await supabase
                .from('operational_signals')
                .update({ is_active: false })
                .in('id', toDeactivate.map(s => s.id));
              totalSignalsDeactivated += toDeactivate.length;
            }
          }

          // Upsert new signals (avoid duplicates by checking signal_type + source + user)
          for (const signal of signals) {
            // Check if this exact signal type already exists and is active
            const { data: existing } = await supabase
              .from('operational_signals')
              .select('id')
              .eq('user_id', userId)
              .eq('signal_type', signal.signal_type)
              .eq('source_integration', signal.source_integration)
              .eq('is_active', true)
              .limit(1);

            if (existing && existing.length > 0) {
              // Update existing signal with fresh data
              await supabase
                .from('operational_signals')
                .update({
                  severity: signal.severity,
                  confidence: signal.confidence,
                  description: signal.description,
                  signal_data: signal.signal_data,
                  detected_at: now,
                })
                .eq('id', existing[0].id);
            } else {
              // Insert new signal
              await supabase
                .from('operational_signals')
                .insert({
                  user_id: userId,
                  signal_type: signal.signal_type,
                  severity: signal.severity,
                  confidence: signal.confidence,
                  description: signal.description,
                  source_integration: signal.source_integration,
                  signal_data: signal.signal_data,
                  detected_at: now,
                  is_active: true,
                });
              totalSignalsCreated++;
            }
          }

          console.log(`[signal-detector] User ${userId}: ${signals.length} signals detected, ${totalSignalsCreated} created`);
        } else {
          // No signals detected — deactivate all existing signals for this user
          const { data: existingSignals } = await supabase
            .from('operational_signals')
            .select('id')
            .eq('user_id', userId)
            .eq('is_active', true);

          if (existingSignals && existingSignals.length > 0) {
            await supabase
              .from('operational_signals')
              .update({ is_active: false })
              .in('id', existingSignals.map(s => s.id));
            totalSignalsDeactivated += existingSignals.length;
          }
        }
      } catch (userError: unknown) {
        const errorMessage = userError instanceof Error ? userError.message : String(userError);
        console.error(`[signal-detector] Error processing user ${userId}:`, userError);
        errors.push(`Error for user ${userId}: ${errorMessage}`);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[signal-detector] Complete in ${duration}ms: ${totalSignalsCreated} created, ${totalSignalsDeactivated} deactivated`);

    return new Response(JSON.stringify({
      success: true,
      users_processed: userIds.length,
      signals_created: totalSignalsCreated,
      signals_deactivated: totalSignalsDeactivated,
      duration_ms: duration,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[signal-detector] Fatal error:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
