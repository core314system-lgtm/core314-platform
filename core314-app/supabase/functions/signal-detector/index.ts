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
 *   Google Calendar:
 *     - meeting_overload: > 30 meetings/week or > 25 hours/week
 *     - low_meeting_activity: 0 events when calendar is connected
 *   Gmail:
 *     - email_volume_spike: > 200 messages/week
 *     - low_email_activity: 0 messages when connected
 *     - low_response_ratio: sent < 10% of received
 *   Jira:
 *     - overdue_issues: open issues older than 14 days
 *     - low_velocity: < 10% done rate
 *     - blocker_accumulation: highest/blocker priority issues present
 *   Trello:
 *     - overdue_cards: cards past due date
 *     - stalled_cards: 0 done cards from total
 *     - board_inactivity: 0 cards across boards
 *   Microsoft Teams:
 *     - low_team_activity: 0 teams/channels detected
 *     - channel_inactivity: teams exist but 0 channels
 *   Google Sheets:
 *     - stale_spreadsheets: no recently modified sheets
 *     - no_sheet_activity: 0 spreadsheets
 *   Asana:
 *     - overdue_tasks: tasks past due date
 *     - low_completion_rate: < 20% completion rate
 *     - workload_imbalance: high overdue with low completion
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
    let totalAlertsSent = 0;
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
        const configChannelsAnalyzed = (slackConfig?.channels_analyzed as number) ?? 0;
        const configOauthConnected = slackConfig?.oauth_connected as boolean ?? false;
        const configPrivateChannelsAccessible = slackConfig?.private_channels_accessible as boolean ?? false;
        const configScopeWarning = slackConfig?.scope_warning as string | null ?? null;
        // data_completeness is stored in config but read via event metadata at signal detection time

        if (slackEvents && slackEvents.length > 0) {
          const latest = slackEvents[0].metadata as Record<string, number | string | boolean | null>;
          const messageCount = (latest.message_count as number) ?? 0;
          const activeChannels = (latest.active_channels as number) ?? 0;
          const totalChannels = (latest.total_channels as number) ?? configChannelsTotal;
          const channelsAnalyzed = (latest.channels_analyzed as number) ?? configChannelsAnalyzed;
          const uniqueUsers = (latest.unique_users as number) ?? 0;
          const avgResponseTime = latest.avg_response_time_minutes as number | null;
          const channelsMember = activeChannels > 0 ? activeChannels : configChannelsMember;
          const isDataComplete = (latest.data_complete as boolean) ?? (channelsAnalyzed >= channelsMember);

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
              signal_data: {
                category: classifySignal('integration_inactive', 'slack'),
                metric: 'integration_inactive',
                total_channels: totalChannels,
                oauth_connected: configOauthConnected,
                channels_member: channelsMember,
                affected_entities: [],
                summary_metrics: { total_channels: totalChannels, channels_member: channelsMember },
              },
            });
          }

          // Signal: Low communication activity — only when connection is valid AND data is complete
          // PRODUCTION HARDENING: Do NOT emit low_communication if data is incomplete (prevents false positives)
          if (isSlackConnectionValid && !isSlackConnectionIssue && messageCount < 5 && totalChannels > 0) {
            // Reduce confidence if data is incomplete (channels_analyzed < channels_member)
            const dataConfidenceAdjustment = !isDataComplete ? -25 : 0;
            const adjustedConfidence = Math.max(40, 75 + dataConfidenceAdjustment);
            
            // Only emit signal if data is reasonably complete (>50% channels analyzed)
            const coveragePct = channelsMember > 0 ? Math.round((channelsAnalyzed / channelsMember) * 100) : 100;
            if (coveragePct >= 50) {
              // Extract per-channel activity from metadata for affected_entities
              const channelActivity = (latest.channel_activity as Array<{ name: string; messages: number; id?: string }>) ?? [];
              const lowCommEntities = channelActivity
                .filter((ch: { name: string; messages: number }) => ch.messages === 0)
                .slice(0, 10)
                .map((ch: { name: string; messages: number }) => ({
                  name: `#${ch.name}`,
                  last_activity_type: 'no messages detected',
                  last_activity_date: slackEvents[0].occurred_at || null,
                  metric_value: ch.messages,
                }));

              signals.push({
                signal_type: 'low_communication',
                severity: 'low',
                confidence: adjustedConfidence,
                description: messageCount === 0
                  ? `Slack integration is active but limited communication activity was detected in monitored channels. ${channelsAnalyzed} of ${channelsMember} channel${channelsMember > 1 ? 's' : ''} analyzed across ${totalChannels} total.${!isDataComplete ? ' Note: Not all channels were analyzed — signal confidence is reduced.' : ''}`
                  : `Only ${messageCount} Slack messages across ${channelsAnalyzed} analyzed channels (${channelsMember} monitored, ${totalChannels} total). Communication volume is below typical thresholds.${!isDataComplete ? ' Partial data — confidence adjusted.' : ''}`,
                source_integration: 'slack',
                signal_data: {
                  category: classifySignal('low_communication', 'slack'),
                  metric: 'low_communication',
                  message_count: messageCount,
                  active_channels: activeChannels,
                  total_channels: totalChannels,
                  channels_member: channelsMember,
                  channels_analyzed: channelsAnalyzed,
                  data_complete: isDataComplete,
                  coverage_pct: coveragePct,
                  affected_entities: lowCommEntities,
                  summary_metrics: {
                    message_count: messageCount,
                    active_channels: activeChannels,
                    total_channels: totalChannels,
                    channels_analyzed: channelsAnalyzed,
                    coverage_pct: coveragePct,
                  },
                },
              });
            } else {
              console.warn(`[signal-detector] Skipping low_communication signal for user ${userId}: insufficient data coverage (${coveragePct}% of channels analyzed)`);
            }
          }

          // Signal: Data completeness warning (channels detected but not all analyzed)
          if (isSlackConnectionValid && channelsMember > 0 && channelsAnalyzed < channelsMember && channelsAnalyzed > 0) {
            const gap = channelsMember - channelsAnalyzed;
            const coveragePct = Math.round((channelsAnalyzed / channelsMember) * 100);
            if (coveragePct < 80) {
              signals.push({
                signal_type: 'data_ingestion_gap',
                severity: coveragePct < 50 ? 'medium' : 'low',
                confidence: 90,
                description: `Slack data ingestion gap: ${channelsAnalyzed} of ${channelsMember} member channels analyzed (${coveragePct}% coverage). ${gap} channel${gap > 1 ? 's' : ''} not yet ingested — signals may not reflect full workspace activity.`,
                source_integration: 'slack',
                signal_data: {
                  category: classifySignal('data_ingestion_gap', 'slack'),
                  metric: 'data_ingestion_gap',
                  channels_member: channelsMember,
                  channels_analyzed: channelsAnalyzed,
                  coverage_pct: coveragePct,
                  gap,
                  affected_entities: [],
                  summary_metrics: { channels_member: channelsMember, channels_analyzed: channelsAnalyzed, coverage_pct: coveragePct, gap },
                },
              });
            }
          }

          // Signal: Private channels inaccessible (scope warning)
          if (configScopeWarning && !configPrivateChannelsAccessible) {
            signals.push({
              signal_type: 'scope_limitation',
              severity: 'low',
              confidence: 95,
              description: 'Slack bot does not have access to private channels (missing groups:read scope). Only public channels are being monitored. Re-authorize the Slack app with the groups:read scope to include private channels.',
              source_integration: 'slack',
              signal_data: {
                category: classifySignal('scope_limitation', 'slack'),
                metric: 'scope_limitation',
                private_channels_accessible: false,
                scope_warning: configScopeWarning,
                affected_entities: [],
                summary_metrics: {},
              },
            });
          }

          // Signal: Communication spike (compare with previous poll)
          if (slackEvents.length > 1) {
            const prev = slackEvents[1].metadata as Record<string, number>;
            const prevMessageCount = prev.message_count ?? 0;
            if (prevMessageCount > 0 && messageCount > prevMessageCount * 2) {
              // Extract per-channel data showing spike
              const spikeChannelActivity = (latest.channel_activity as Array<{ name: string; messages: number }>) ?? [];
              const spikeEntities = spikeChannelActivity
                .filter((ch: { name: string; messages: number }) => ch.messages > 0)
                .sort((a: { messages: number }, b: { messages: number }) => b.messages - a.messages)
                .slice(0, 10)
                .map((ch: { name: string; messages: number }) => ({
                  name: `#${ch.name}`,
                  last_activity_type: 'message activity',
                  last_activity_date: slackEvents[0].occurred_at || null,
                  metric_value: ch.messages,
                }));

              signals.push({
                signal_type: 'communication_spike',
                severity: 'medium',
                confidence: 75,
                description: `Slack message volume surged from ${prevMessageCount} to ${messageCount} — a ${Math.round((messageCount / prevMessageCount - 1) * 100)}% increase. Investigate if this reflects a critical issue or high collaboration.`,
                source_integration: 'slack',
                signal_data: {
                  category: classifySignal('communication_spike', 'slack'),
                  metric: 'communication_spike',
                  current: messageCount,
                  previous: prevMessageCount,
                  change_pct: Math.round((messageCount / prevMessageCount - 1) * 100),
                  affected_entities: spikeEntities,
                  summary_metrics: { current_messages: messageCount, previous_messages: prevMessageCount, change_pct: Math.round((messageCount / prevMessageCount - 1) * 100) },
                },
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
              signal_data: {
                category: classifySignal('slow_response', 'slack'),
                metric: 'slow_response',
                avg_response_time_minutes: avgResponseTime,
                affected_entities: [],
                summary_metrics: { avg_response_time_minutes: Math.round(avgResponseTime) },
              },
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
              signal_data: {
                category: classifySignal('low_engagement', 'slack'),
                metric: 'low_engagement',
                unique_users: uniqueUsers,
                total_channels: totalChannels,
                affected_entities: [],
                summary_metrics: { unique_users: uniqueUsers, total_channels: totalChannels },
              },
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
          // Extract individual invoice detail objects when available (injected by test-scenario or enhanced pollers)
          const overdueInvoiceDetails = (latest.overdue_invoice_details as Array<{ id: string; customer_name: string; amount: number; due_date: string; days_overdue: number; status?: string; assigned_to?: string }>) ?? [];

          // Signal: Overdue invoices
          if (overdueInvoices > 0) {
            const severity = overdueInvoices >= 5 ? 'critical' : overdueInvoices >= 3 ? 'high' : 'medium';

            // Build affected_entities: prefer individual invoice objects, fall back to aging buckets
            const overdueEntities = overdueInvoiceDetails.length > 0
              ? overdueInvoiceDetails.slice(0, 10).map((inv) => ({
                  name: `${inv.id}: ${inv.customer_name} — $${inv.amount.toLocaleString()}`,
                  entity_id: inv.id,
                  entity_type: 'invoice' as const,
                  value: inv.amount,
                  owner: inv.assigned_to || 'Owner data not available from integration',
                  status: inv.status || 'overdue',
                  last_activity_type: `${inv.days_overdue} days overdue`,
                  last_activity_date: inv.due_date,
                  days_in_current_state: inv.days_overdue,
                  metric_value: inv.amount,
                }))
              : [
                  ...(invoiceAging?.aging90Plus ? [{ name: `${invoiceAging.aging90Plus} invoices 90+ days overdue`, last_activity_type: 'overdue', metric_value: invoiceAging.aging90Plus }] : []),
                  ...(invoiceAging?.aging60 ? [{ name: `${invoiceAging.aging60} invoices 60-90 days overdue`, last_activity_type: 'overdue', metric_value: invoiceAging.aging60 }] : []),
                  ...(invoiceAging?.aging30 ? [{ name: `${invoiceAging.aging30} invoices 30-60 days overdue`, last_activity_type: 'overdue', metric_value: invoiceAging.aging30 }] : []),
                  ...(invoiceAging?.current ? [{ name: `${invoiceAging.current} invoices 0-30 days overdue`, last_activity_type: 'overdue', metric_value: invoiceAging.current }] : []),
                ];

            signals.push({
              signal_type: 'overdue_invoices',
              severity,
              confidence: 95,
              description: `${overdueInvoices} overdue invoice${overdueInvoices > 1 ? 's' : ''} totaling $${overdueTotal.toLocaleString()}. ${invoiceAging?.aging90Plus ? `${invoiceAging.aging90Plus} are 90+ days overdue.` : 'Follow up to improve cash flow.'}`,
              source_integration: 'quickbooks',
              signal_data: {
                category: classifySignal('overdue_invoices', 'quickbooks'),
                metric: 'overdue_invoices',
                overdue_invoices: overdueInvoices,
                overdue_total: overdueTotal,
                invoice_aging: invoiceAging,
                affected_entities: overdueEntities,
                summary_metrics: { overdue_count: overdueInvoices, overdue_total: overdueTotal, open_invoices: openInvoices },
              },
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
              signal_data: {
                category: classifySignal('low_collection_rate', 'quickbooks'),
                metric: 'low_collection_rate',
                collection_rate: collectionRate,
                invoice_total: invoiceTotal,
                payment_total: paymentTotal,
                affected_entities: [
                  { name: `Invoiced: $${invoiceTotal.toLocaleString()}`, last_activity_type: 'invoiced', metric_value: invoiceTotal },
                  { name: `Collected: $${paymentTotal.toLocaleString()}`, last_activity_type: 'payment', metric_value: paymentTotal },
                  { name: `Uncollected: $${(invoiceTotal - paymentTotal).toLocaleString()}`, last_activity_type: 'outstanding', metric_value: invoiceTotal - paymentTotal },
                ],
                summary_metrics: { collection_rate: collectionRate, uncollected_amount: invoiceTotal - paymentTotal },
              },
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
              signal_data: {
                category: classifySignal('high_expense_ratio', 'quickbooks'),
                metric: 'high_expense_ratio',
                expense_total: expenseTotal,
                payment_total: paymentTotal,
                ratio: Math.round(expenseTotal / paymentTotal * 100),
                affected_entities: [
                  { name: `Revenue: $${paymentTotal.toLocaleString()}`, last_activity_type: 'revenue', metric_value: paymentTotal },
                  { name: `Expenses: $${expenseTotal.toLocaleString()}`, last_activity_type: 'expense', metric_value: expenseTotal },
                ],
                summary_metrics: { expense_ratio_pct: Math.round(expenseTotal / paymentTotal * 100), margin: paymentTotal - expenseTotal },
              },
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
                signal_data: {
                  category: classifySignal('revenue_decline', 'quickbooks'),
                  metric: 'revenue_decline',
                  current: paymentTotal,
                  previous: prevPaymentTotal,
                  affected_entities: [
                    { name: `Previous period: $${prevPaymentTotal.toLocaleString()}`, last_activity_type: 'revenue', metric_value: prevPaymentTotal },
                    { name: `Current period: $${paymentTotal.toLocaleString()}`, last_activity_type: 'revenue', metric_value: paymentTotal },
                  ],
                  summary_metrics: { decline_pct: Math.round((1 - paymentTotal / prevPaymentTotal) * 100), revenue_drop: prevPaymentTotal - paymentTotal },
                },
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
                signal_data: {
                  category: classifySignal('no_financial_activity', 'quickbooks'),
                  metric: 'no_financial_activity',
                  account_count: accountCount,
                  affected_entities: [],
                  summary_metrics: { account_count: accountCount, invoices: 0, payments: 0, expenses: 0 },
                },
              });
            }
          }
        }

        // --- HubSpot Signal Detection ---
        if (hubspotEvents && hubspotEvents.length > 0) {
          const latest = hubspotEvents[0].metadata as Record<string, unknown>;
          // FIXED: field names match hubspot-poll output (total_deals, total_contacts, total_companies)
          const dealCount = (latest.total_deals as number) ?? 0;
          const _dealsAnalyzed = (latest.deals_analyzed as number) ?? dealCount; // used by UI transparency panel
          const openDeals = (latest.open_deals as number) ?? 0;
          const stalledDeals = (latest.stalled_deals as number) ?? 0;
          const contactCount = (latest.total_contacts as number) ?? 0;
          const companyCount = (latest.total_companies as number) ?? 0;
          const _pipelineCount = (latest.pipeline_count as number) ?? 0; // used by UI transparency panel
          const recentDeals7d = (latest.recent_deals_7d as number) ?? -1;
          const dealsStuckOver14d = (latest.deals_stuck_over_14d as number) ?? 0;
          const maxStageDays = (latest.max_stage_days as number) ?? 0;
          const avgDealAge = (latest.avg_deal_age_days as number) ?? 0;
          const openPipelineValue = (latest.open_pipeline_value as number) ?? 0;
          const stalledDealNames = (latest.stalled_deal_names as string[]) ?? [];
          // Extract individual deal detail objects when available (injected by test-scenario or enhanced pollers)
          const stalledDealDetails = (latest.stalled_deal_details as Array<{ id: string; name: string; value: number; stage: string; owner?: string; last_activity_date: string; days_in_stage: number }>) ?? [];

          // Signal: Stalled deals (no activity > 6 days)
          if (stalledDeals > 0) {
            const dealNamesList = stalledDealNames.length > 0 ? ` Including: ${stalledDealNames.slice(0, 3).join(', ')}.` : '';

            // Build affected_entities: prefer individual deal objects with value/stage, fall back to name-only
            const stalledEntities = stalledDealDetails.length > 0
              ? stalledDealDetails.slice(0, 10).map((deal) => ({
                  name: `${deal.name} — $${deal.value.toLocaleString()} (${deal.stage})`,
                  entity_id: deal.id,
                  entity_type: 'deal' as const,
                  value: deal.value,
                  owner: deal.owner || 'Owner data not available from integration',
                  status: deal.stage,
                  last_activity_type: `stalled ${deal.days_in_stage} days`,
                  last_activity_date: deal.last_activity_date,
                  days_in_current_state: deal.days_in_stage,
                  metric_value: deal.value,
                }))
              : stalledDealNames.slice(0, 10).map((name: string) => ({
                  name,
                  last_activity_type: 'deal stalled',
                  last_activity_date: hubspotEvents[0].occurred_at || null,
                }));

            signals.push({
              signal_type: 'stalled_deals',
              severity: stalledDeals >= 5 ? 'high' : 'medium',
              confidence: 85,
              description: `${stalledDeals} deal${stalledDeals > 1 ? 's' : ''} stalled in the pipeline out of ${dealCount} total. Revenue at risk — review and take action.${dealNamesList}`,
              source_integration: 'hubspot',
              signal_data: {
                category: classifySignal('stalled_deals', 'hubspot'),
                metric: 'stalled_deals',
                stalled_deals: stalledDeals,
                total_deals: dealCount,
                stalled_deal_names: stalledDealNames.slice(0, 5),
                affected_entities: stalledEntities,
                summary_metrics: { stalled_count: stalledDeals, total_deals: dealCount, pipeline_value: openPipelineValue },
              },
            });
          }

          // Signal: No new deals in last 7 days
          if (recentDeals7d === 0 && dealCount > 0) {
            signals.push({
              signal_type: 'no_new_deals',
              severity: 'medium',
              confidence: 80,
              description: `No new deals created in the past 7 days despite ${dealCount} existing deals. Pipeline generation may need attention.`,
              source_integration: 'hubspot',
              signal_data: {
                category: classifySignal('no_new_deals', 'hubspot'),
                metric: 'no_new_deals',
                recent_deals_7d: recentDeals7d,
                total_deals: dealCount,
                open_deals: openDeals,
                affected_entities: [],
                summary_metrics: { recent_deals_7d: 0, total_deals: dealCount, open_deals: openDeals },
              },
            });
          }

          // Signal: Deal stage delay (deals stuck > 14 days in a stage)
          if (dealsStuckOver14d > 0) {
            signals.push({
              signal_type: 'deal_stage_delay',
              severity: dealsStuckOver14d >= 3 ? 'high' : 'medium',
              confidence: 80,
              description: `${dealsStuckOver14d} deal${dealsStuckOver14d > 1 ? 's' : ''} stuck in the same stage for over 14 days (max: ${maxStageDays} days). Pipeline velocity is impaired.`,
              source_integration: 'hubspot',
              signal_data: {
                category: classifySignal('deal_stage_delay', 'hubspot'),
                metric: 'deal_stage_delay',
                deals_stuck_over_14d: dealsStuckOver14d,
                max_stage_days: maxStageDays,
                avg_deal_age: avgDealAge,
                affected_entities: [],
                summary_metrics: { stuck_count: dealsStuckOver14d, max_days_in_stage: maxStageDays, avg_deal_age_days: avgDealAge },
              },
            });
          }

          // Signal: Pipeline stagnation (compare with previous poll — open deals unchanged or declining)
          if (hubspotEvents.length > 1) {
            const prev = hubspotEvents[1].metadata as Record<string, unknown>;
            const prevOpenDeals = (prev.open_deals as number) ?? 0;
            const prevOpenValue = (prev.open_pipeline_value as number) ?? 0;
            if (prevOpenDeals > 0 && openDeals <= prevOpenDeals && prevOpenValue > 0 && openPipelineValue <= prevOpenValue * 0.9) {
              signals.push({
                signal_type: 'pipeline_stagnation',
                severity: 'medium',
                confidence: 70,
                description: `Pipeline value dropped from $${prevOpenValue.toLocaleString()} to $${openPipelineValue.toLocaleString()} with ${openDeals} open deals (was ${prevOpenDeals}). Pipeline momentum is declining.`,
                source_integration: 'hubspot',
                signal_data: {
                  category: classifySignal('pipeline_stagnation', 'hubspot'),
                  metric: 'pipeline_stagnation',
                  current_open_deals: openDeals,
                  prev_open_deals: prevOpenDeals,
                  current_value: openPipelineValue,
                  prev_value: prevOpenValue,
                  affected_entities: [
                    { name: `Previous pipeline: $${prevOpenValue.toLocaleString()} (${prevOpenDeals} deals)`, last_activity_type: 'pipeline snapshot', metric_value: prevOpenValue },
                    { name: `Current pipeline: $${openPipelineValue.toLocaleString()} (${openDeals} deals)`, last_activity_type: 'pipeline snapshot', metric_value: openPipelineValue },
                  ],
                  summary_metrics: { pipeline_change_pct: Math.round((1 - openPipelineValue / prevOpenValue) * -100), deal_change: openDeals - prevOpenDeals },
                },
              });
            }
          }

          // Signal: No CRM activity (connected but empty)
          if (contactCount === 0 && dealCount === 0) {
            signals.push({
              signal_type: 'no_crm_activity',
              severity: 'low',
              confidence: 90,
              description: 'HubSpot is connected but no contacts or deals found. Add CRM data for operational intelligence.',
              source_integration: 'hubspot',
              signal_data: {
                category: classifySignal('no_crm_activity', 'hubspot'),
                metric: 'no_crm_activity',
                total_contacts: contactCount,
                total_deals: dealCount,
                total_companies: companyCount,
                affected_entities: [],
                summary_metrics: { contacts: 0, deals: 0, companies: 0 },
              },
            });
          }

          // Signal: Low activity (has some data but very minimal)
          if (dealCount > 0 && contactCount === 0 && companyCount === 0 && openDeals === 0) {
            signals.push({
              signal_type: 'low_crm_activity',
              severity: 'low',
              confidence: 75,
              description: `HubSpot shows ${dealCount} deals but no active contacts or companies. CRM utilization is minimal.`,
              source_integration: 'hubspot',
              signal_data: {
                category: classifySignal('low_crm_activity', 'hubspot'),
                metric: 'low_crm_activity',
                total_deals: dealCount,
                total_contacts: contactCount,
                total_companies: companyCount,
                affected_entities: [],
                summary_metrics: { total_deals: dealCount, contacts: contactCount, companies: companyCount },
              },
            });
          }
        }

        // --- Google Calendar Signal Detection ---
        const { data: gcalEvents } = await supabase
          .from('integration_events')
          .select('metadata, occurred_at')
          .eq('user_id', userId)
          .eq('event_type', 'google_calendar.weekly_summary')
          .order('occurred_at', { ascending: false })
          .limit(2);

        if (gcalEvents && gcalEvents.length > 0) {
          const latest = gcalEvents[0].metadata as Record<string, unknown>;
          const totalEvents = (latest.total_events as number) ?? 0;
          const meetingsWithAttendees = (latest.meetings_with_attendees as number) ?? 0;
          const totalMeetingHours = (latest.total_meeting_hours as number) ?? 0;

          // Signal: Meeting overload (>30 meetings/week or >25 hours/week)
          if (meetingsWithAttendees > 30 || totalMeetingHours > 25) {
            signals.push({
              signal_type: 'meeting_overload',
              severity: totalMeetingHours > 35 ? 'high' : 'medium',
              confidence: 85,
              description: `${meetingsWithAttendees} meetings scheduled (${totalMeetingHours} hours) in the next 7 days. Heavy meeting load may reduce productive work time.`,
              source_integration: 'google_calendar',
              signal_data: {
                category: classifySignal('meeting_overload', 'google_calendar'),
                metric: 'meeting_overload',
                meetings: meetingsWithAttendees,
                meeting_hours: totalMeetingHours,
                total_events: totalEvents,
                affected_entities: [],
                summary_metrics: { meetings: meetingsWithAttendees, meeting_hours: totalMeetingHours, total_events: totalEvents },
              },
            });
          }

          // Signal: Low meeting activity (connected but zero events)
          if (totalEvents === 0) {
            signals.push({
              signal_type: 'low_meeting_activity',
              severity: 'low',
              confidence: 70,
              description: 'Google Calendar is connected but no events found in the next 7 days. Calendar may be empty or permissions may need adjustment.',
              source_integration: 'google_calendar',
              signal_data: {
                category: classifySignal('low_meeting_activity', 'google_calendar'),
                metric: 'low_meeting_activity',
                total_events: 0,
                affected_entities: [],
                summary_metrics: { total_events: 0 },
              },
            });
          }
        }

        // --- Gmail Signal Detection ---
        const { data: gmailEvents } = await supabase
          .from('integration_events')
          .select('metadata, occurred_at')
          .eq('user_id', userId)
          .eq('event_type', 'gmail.weekly_summary')
          .order('occurred_at', { ascending: false })
          .limit(2);

        if (gmailEvents && gmailEvents.length > 0) {
          const latest = gmailEvents[0].metadata as Record<string, unknown>;
          const totalMessages = (latest.total_messages as number) ?? 0;
          const sentCount = (latest.sent_count as number) ?? 0;
          const receivedCount = (latest.received_count as number) ?? 0;

          // Signal: Email volume spike (>200 messages/week)
          if (totalMessages > 200) {
            signals.push({
              signal_type: 'email_volume_spike',
              severity: totalMessages > 500 ? 'high' : 'medium',
              confidence: 80,
              description: `${totalMessages} emails in the past 7 days (${sentCount} sent, ${receivedCount} received). High email volume may indicate process inefficiency or urgent issues.`,
              source_integration: 'gmail',
              signal_data: {
                category: classifySignal('email_volume_spike', 'gmail'),
                metric: 'email_volume_spike',
                total_messages: totalMessages,
                sent: sentCount,
                received: receivedCount,
                affected_entities: [],
                summary_metrics: { total_messages: totalMessages, sent: sentCount, received: receivedCount },
              },
            });
          }

          // Signal: Low email activity (connected but zero messages)
          if (totalMessages === 0) {
            signals.push({
              signal_type: 'low_email_activity',
              severity: 'low',
              confidence: 70,
              description: 'Gmail is connected but no email activity detected in the past 7 days. Account may be inactive or permissions may need adjustment.',
              source_integration: 'gmail',
              signal_data: {
                category: classifySignal('low_email_activity', 'gmail'),
                metric: 'low_email_activity',
                total_messages: 0,
                affected_entities: [],
                summary_metrics: { total_messages: 0 },
              },
            });
          }

          // Signal: Low response ratio (sent < 10% of received)
          if (receivedCount > 20 && sentCount > 0 && sentCount < receivedCount * 0.1) {
            signals.push({
              signal_type: 'low_response_ratio',
              severity: 'medium',
              confidence: 70,
              description: `Only ${sentCount} sent emails vs ${receivedCount} received (${Math.round(sentCount / receivedCount * 100)}% response ratio). Low responsiveness may impact customer and partner relationships.`,
              source_integration: 'gmail',
              signal_data: {
                category: classifySignal('low_response_ratio', 'gmail'),
                metric: 'low_response_ratio',
                sent: sentCount,
                received: receivedCount,
                ratio: Math.round(sentCount / receivedCount * 100),
                affected_entities: [],
                summary_metrics: { sent: sentCount, received: receivedCount, response_ratio_pct: Math.round(sentCount / receivedCount * 100) },
              },
            });
          }
        }

        // --- Jira Signal Detection ---
        const { data: jiraEvents } = await supabase
          .from('integration_events')
          .select('metadata, occurred_at')
          .eq('user_id', userId)
          .eq('event_type', 'jira.weekly_summary')
          .order('occurred_at', { ascending: false })
          .limit(2);

        if (jiraEvents && jiraEvents.length > 0) {
          const latest = jiraEvents[0].metadata as Record<string, unknown>;
          const totalIssues = (latest.total_issues_updated as number) ?? 0;
          const doneCount = (latest.done_count as number) ?? 0;
          const inProgressCount = (latest.in_progress_count as number) ?? 0;
          const overdueCount = (latest.overdue_count as number) ?? 0;
          const stalledCount = (latest.stalled_count as number) ?? 0;
          const priorityBreakdown = (latest.priority_breakdown as Record<string, number>) ?? {};
          const overdueIssueDetails = (latest.overdue_issue_details as Array<{ id: string; key: string; name: string; project: string; assignee: string; status: string; priority: string; due_date: string | null; days_overdue: number }>) ?? [];
          const stalledIssueDetails = (latest.stalled_issue_details as Array<{ id: string; key: string; name: string; project: string; assignee: string; status: string; priority: string; last_updated: string; days_stalled: number }>) ?? [];
          const deliveryRiskProjects = (latest.delivery_risk_projects as Array<[string, number]>) ?? [];
          const workloadImbalanceRatio = (latest.workload_imbalance_ratio as number) ?? 0;
          const maxAssignee = latest.max_assignee as { name: string; count: number } | null;
          const avgTasksPerAssignee = (latest.avg_tasks_per_assignee as number) ?? 0;
          const uniqueAssignees = (latest.unique_assignees as number) ?? 0;

          // Signal 1: OVERDUE_TASKS — issues past due date or open > 14 days
          if (overdueCount > 0) {
            const severity: 'low' | 'medium' | 'high' = overdueCount >= 10 ? 'high' : overdueCount >= 5 ? 'medium' : 'low';
            const overdueEntities = overdueIssueDetails.slice(0, 10).map((issue) => ({
              name: `${issue.key}: ${issue.name} (${issue.project})`,
              entity_id: issue.key,
              entity_type: 'issue' as const,
              owner: issue.assignee,
              status: issue.status,
              last_activity_type: `${issue.days_overdue} days overdue`,
              last_activity_date: issue.due_date || undefined,
              days_in_current_state: issue.days_overdue,
              metric_value: issue.days_overdue,
            }));

            signals.push({
              signal_type: 'overdue_issues',
              severity,
              confidence: 90,
              description: `${overdueCount} Jira issue${overdueCount > 1 ? 's' : ''} overdue out of ${totalIssues} updated this week. ${inProgressCount} in progress, ${doneCount} completed.`,
              source_integration: 'jira',
              signal_data: {
                category: classifySignal('overdue_issues', 'jira'),
                metric: 'overdue_issues',
                overdue: overdueCount,
                total: totalIssues,
                done: doneCount,
                in_progress: inProgressCount,
                affected_entities: overdueEntities,
                summary_metrics: { overdue_count: overdueCount, total_issues: totalIssues, done: doneCount, in_progress: inProgressCount },
              },
            });
          }

          // Signal 2: STALLED_WORK — issues with no update > 7 days
          if (stalledCount > 0) {
            const severity: 'low' | 'medium' | 'high' = stalledCount >= 8 ? 'high' : stalledCount >= 4 ? 'medium' : 'low';
            const stalledEntities = stalledIssueDetails.slice(0, 10).map((issue) => ({
              name: `${issue.key}: ${issue.name} (${issue.project})`,
              entity_id: issue.key,
              entity_type: 'issue' as const,
              owner: issue.assignee,
              status: issue.status,
              last_activity_type: `${issue.days_stalled} days since last update`,
              last_activity_date: issue.last_updated,
              days_in_current_state: issue.days_stalled,
              metric_value: issue.days_stalled,
            }));

            signals.push({
              signal_type: 'stalled_work',
              severity,
              confidence: 85,
              description: `${stalledCount} Jira issue${stalledCount > 1 ? 's' : ''} with no update in over 7 days. These may be blocked or abandoned and require attention.`,
              source_integration: 'jira',
              signal_data: {
                category: classifySignal('stalled_work', 'jira'),
                metric: 'stalled_work',
                stalled: stalledCount,
                total: totalIssues,
                affected_entities: stalledEntities,
                summary_metrics: { stalled_count: stalledCount, total_issues: totalIssues },
              },
            });
          }

          // Signal 3: WORKLOAD_IMBALANCE — one assignee has significantly more tasks
          if (uniqueAssignees >= 2 && workloadImbalanceRatio >= 2.0 && maxAssignee) {
            const severity: 'low' | 'medium' | 'high' = workloadImbalanceRatio >= 3.0 ? 'high' : 'medium';
            signals.push({
              signal_type: 'workload_imbalance',
              severity,
              confidence: 80,
              description: `Workload imbalance detected: ${maxAssignee.name} has ${maxAssignee.count} tasks (${Math.round(workloadImbalanceRatio)}x the average of ${avgTasksPerAssignee} per person across ${uniqueAssignees} team members). This may cause burnout or delivery bottlenecks.`,
              source_integration: 'jira',
              signal_data: {
                category: classifySignal('workload_imbalance', 'jira'),
                metric: 'workload_imbalance',
                imbalance_ratio: workloadImbalanceRatio,
                max_assignee: maxAssignee.name,
                max_count: maxAssignee.count,
                avg_per_assignee: avgTasksPerAssignee,
                unique_assignees: uniqueAssignees,
                affected_entities: [{
                  name: maxAssignee.name,
                  entity_type: 'person' as const,
                  metric_value: maxAssignee.count,
                  last_activity_type: `${maxAssignee.count} tasks assigned (${Math.round(workloadImbalanceRatio)}x average)`,
                }],
                summary_metrics: { imbalance_ratio: workloadImbalanceRatio, max_assignee: maxAssignee.name, max_tasks: maxAssignee.count, avg_tasks: avgTasksPerAssignee, team_size: uniqueAssignees },
              },
            });
          }

          // Signal 4: DELIVERY_RISK — multiple overdue issues in same project
          if (deliveryRiskProjects.length > 0) {
            const totalAtRisk = deliveryRiskProjects.reduce((sum, [, count]) => sum + count, 0);
            const severity: 'low' | 'medium' | 'high' | 'critical' = totalAtRisk >= 10 ? 'critical' : totalAtRisk >= 6 ? 'high' : 'medium';
            const projectEntities = deliveryRiskProjects.slice(0, 5).map(([projectName, count]) => ({
              name: projectName,
              entity_type: 'project' as const,
              metric_value: count,
              last_activity_type: `${count} overdue issues`,
            }));

            signals.push({
              signal_type: 'delivery_risk',
              severity,
              confidence: 90,
              description: `Delivery risk in ${deliveryRiskProjects.length} project${deliveryRiskProjects.length > 1 ? 's' : ''}: ${deliveryRiskProjects.map(([name, count]) => `${name} (${count} overdue)`).join(', ')}. Multiple overdue issues in the same project indicate systemic delivery delays.`,
              source_integration: 'jira',
              signal_data: {
                category: classifySignal('delivery_risk', 'jira'),
                metric: 'delivery_risk',
                at_risk_projects: deliveryRiskProjects.length,
                total_overdue_in_projects: totalAtRisk,
                affected_entities: projectEntities,
                summary_metrics: { at_risk_projects: deliveryRiskProjects.length, total_overdue: totalAtRisk },
              },
            });
          }

          // Signal 5: Low velocity (< 10% done rate with significant issues)
          if (totalIssues >= 10 && doneCount < totalIssues * 0.1) {
            signals.push({
              signal_type: 'low_velocity',
              severity: 'medium',
              confidence: 75,
              description: `Only ${doneCount} of ${totalIssues} issues completed this week (${Math.round(doneCount / totalIssues * 100)}% done rate). Sprint velocity may be at risk.`,
              source_integration: 'jira',
              signal_data: {
                category: classifySignal('low_velocity', 'jira'),
                metric: 'low_velocity',
                done: doneCount,
                total: totalIssues,
                done_rate: Math.round(doneCount / totalIssues * 100),
                affected_entities: [],
                summary_metrics: { done_count: doneCount, total_issues: totalIssues, done_rate_pct: Math.round(doneCount / totalIssues * 100) },
              },
            });
          }

          // Signal 6: Blocker accumulation (Highest/Blocker priority issues)
          const blockerCount = (priorityBreakdown['Highest'] ?? 0) + (priorityBreakdown['Blocker'] ?? 0);
          if (blockerCount >= 3) {
            signals.push({
              signal_type: 'blocker_accumulation',
              severity: blockerCount >= 5 ? 'critical' : 'high',
              confidence: 90,
              description: `${blockerCount} blocker/highest-priority Jira issues detected. These may be blocking team progress across projects.`,
              source_integration: 'jira',
              signal_data: {
                category: classifySignal('blocker_accumulation', 'jira'),
                metric: 'blocker_accumulation',
                blockers: blockerCount,
                priority_breakdown: priorityBreakdown,
                affected_entities: [],
                summary_metrics: { blocker_count: blockerCount, priority_breakdown: priorityBreakdown },
              },
            });
          }
        }

        // --- Trello Signal Detection ---
        const { data: trelloEvents } = await supabase
          .from('integration_events')
          .select('metadata, occurred_at')
          .eq('user_id', userId)
          .eq('event_type', 'trello.board_summary')
          .order('occurred_at', { ascending: false })
          .limit(2);

        if (trelloEvents && trelloEvents.length > 0) {
          const latest = trelloEvents[0].metadata as Record<string, unknown>;
          const totalCards = (latest.total_cards as number) ?? 0;
          const doneCards = (latest.done_cards as number) ?? 0;
          const overdueCards = (latest.overdue_cards as number) ?? 0;
          const totalBoards = (latest.total_boards as number) ?? 0;
          // Extract individual card detail objects when available (injected by test-scenario or enhanced pollers)
          const overdueCardDetails = (latest.overdue_card_details as Array<{ id: string; name: string; board: string; due_date: string; days_overdue: number; list?: string; owner?: string }>) ?? [];

          // Signal: Overdue cards
          if (overdueCards > 0) {
            // Build affected_entities: prefer individual card objects, fall back to empty
            const cardEntities = overdueCardDetails.length > 0
              ? overdueCardDetails.slice(0, 10).map((card) => ({
                  name: `${card.name} (${card.board})`,
                  entity_id: card.id,
                  entity_type: 'card' as const,
                  owner: card.owner || 'Owner data not available from integration',
                  status: card.list || 'unknown',
                  last_activity_type: `${card.days_overdue} days overdue`,
                  last_activity_date: card.due_date,
                  days_in_current_state: card.days_overdue,
                  metric_value: card.days_overdue,
                }))
              : [];

            signals.push({
              signal_type: 'overdue_cards',
              severity: overdueCards >= 10 ? 'high' : overdueCards >= 5 ? 'medium' : 'low',
              confidence: 85,
              description: `${overdueCards} Trello card${overdueCards > 1 ? 's' : ''} past due date across ${totalBoards} board${totalBoards > 1 ? 's' : ''}. ${totalCards} total active cards.`,
              source_integration: 'trello',
              signal_data: {
                category: classifySignal('overdue_cards', 'trello'),
                metric: 'overdue_cards',
                overdue: overdueCards,
                total_cards: totalCards,
                boards: totalBoards,
                affected_entities: cardEntities,
                summary_metrics: { overdue_count: overdueCards, total_cards: totalCards, boards: totalBoards },
              },
            });
          }

          // Signal: Stalled cards (cards exist but none completed)
          if (totalCards >= 10 && doneCards === 0) {
            signals.push({
              signal_type: 'stalled_cards',
              severity: 'medium',
              confidence: 70,
              description: `${totalCards} active Trello cards but no cards in "Done" lists. Work may be stalled or lists need reorganization.`,
              source_integration: 'trello',
              signal_data: {
                category: classifySignal('stalled_cards', 'trello'),
                metric: 'stalled_cards',
                total_cards: totalCards,
                done_cards: 0,
                boards: totalBoards,
                affected_entities: [],
                summary_metrics: { total_cards: totalCards, done_cards: 0, boards: totalBoards },
              },
            });
          }

          // Signal: Board inactivity (connected but zero cards)
          if (totalBoards > 0 && totalCards === 0) {
            signals.push({
              signal_type: 'board_inactivity',
              severity: 'low',
              confidence: 65,
              description: `Trello is connected with ${totalBoards} board${totalBoards > 1 ? 's' : ''} but no active cards found. Boards may be empty or archived.`,
              source_integration: 'trello',
              signal_data: {
                category: classifySignal('board_inactivity', 'trello'),
                metric: 'board_inactivity',
                boards: totalBoards,
                total_cards: 0,
                affected_entities: [],
                summary_metrics: { boards: totalBoards, total_cards: 0 },
              },
            });
          }
        }

        // --- Microsoft Teams Signal Detection ---
        const { data: teamsEvents } = await supabase
          .from('integration_events')
          .select('metadata, occurred_at')
          .eq('user_id', userId)
          .eq('event_type', 'teams.workspace_summary')
          .order('occurred_at', { ascending: false })
          .limit(2);

        if (teamsEvents && teamsEvents.length > 0) {
          const latest = teamsEvents[0].metadata as Record<string, unknown>;
          const totalTeams = (latest.total_teams as number) ?? 0;
          const totalChannels = (latest.total_channels as number) ?? 0;

          // Signal: Low team activity (connected but zero teams)
          if (totalTeams === 0) {
            signals.push({
              signal_type: 'low_team_activity',
              severity: 'low',
              confidence: 70,
              description: 'Microsoft Teams is connected but no joined teams detected. The account may need team membership or permissions adjustment.',
              source_integration: 'microsoft_teams',
              signal_data: {
                category: classifySignal('low_team_activity', 'microsoft_teams'),
                metric: 'low_team_activity',
                teams: 0,
                channels: 0,
                affected_entities: [],
                summary_metrics: { teams: 0, channels: 0 },
              },
            });
          }

          // Signal: Channel inactivity (teams exist but no channels accessible)
          if (totalTeams > 0 && totalChannels === 0) {
            signals.push({
              signal_type: 'channel_inactivity',
              severity: 'medium',
              confidence: 75,
              description: `${totalTeams} Microsoft Teams team${totalTeams > 1 ? 's' : ''} found but no channels accessible. Channel permissions may need review.`,
              source_integration: 'microsoft_teams',
              signal_data: {
                category: classifySignal('channel_inactivity', 'microsoft_teams'),
                metric: 'channel_inactivity',
                teams: totalTeams,
                channels: 0,
                affected_entities: [],
                summary_metrics: { teams: totalTeams, channels: 0 },
              },
            });
          }
        }

        // --- Google Sheets Signal Detection ---
        const { data: sheetsEvents } = await supabase
          .from('integration_events')
          .select('metadata, occurred_at')
          .eq('user_id', userId)
          .eq('event_type', 'sheets.file_summary')
          .order('occurred_at', { ascending: false })
          .limit(2);

        if (sheetsEvents && sheetsEvents.length > 0) {
          const latest = sheetsEvents[0].metadata as Record<string, unknown>;
          const totalSpreadsheets = (latest.total_spreadsheets as number) ?? 0;
          const recentlyModified = (latest.recently_modified_count as number) ?? 0;

          // Signal: Stale spreadsheets (sheets exist but none modified recently)
          if (totalSpreadsheets > 0 && recentlyModified === 0) {
            signals.push({
              signal_type: 'stale_spreadsheets',
              severity: 'low',
              confidence: 65,
              description: `${totalSpreadsheets} Google Sheets spreadsheet${totalSpreadsheets > 1 ? 's' : ''} found but none modified in the past 7 days. KPI tracking data may be stale.`,
              source_integration: 'google_sheets',
              signal_data: {
                category: classifySignal('stale_spreadsheets', 'google_sheets'),
                metric: 'stale_spreadsheets',
                total: totalSpreadsheets,
                recently_modified: 0,
                affected_entities: [],
                summary_metrics: { total_spreadsheets: totalSpreadsheets, recently_modified: 0 },
              },
            });
          }

          // Signal: No sheet activity (connected but zero spreadsheets)
          if (totalSpreadsheets === 0) {
            signals.push({
              signal_type: 'no_sheet_activity',
              severity: 'low',
              confidence: 60,
              description: 'Google Sheets is connected but no spreadsheets found. Create or share spreadsheets for data tracking visibility.',
              source_integration: 'google_sheets',
              signal_data: {
                category: classifySignal('no_sheet_activity', 'google_sheets'),
                metric: 'no_sheet_activity',
                total: 0,
                affected_entities: [],
                summary_metrics: { total_spreadsheets: 0 },
              },
            });
          }
        }

        // --- Asana Signal Detection ---
        const { data: asanaEvents } = await supabase
          .from('integration_events')
          .select('metadata, occurred_at')
          .eq('user_id', userId)
          .eq('event_type', 'asana.project_summary')
          .order('occurred_at', { ascending: false })
          .limit(2);

        if (asanaEvents && asanaEvents.length > 0) {
          const latest = asanaEvents[0].metadata as Record<string, unknown>;
          const totalTasks = (latest.total_tasks as number) ?? 0;
          const completedTasks = (latest.completed_tasks as number) ?? 0;
          const overdueTasks = (latest.overdue_tasks as number) ?? 0;
          const completionRate = (latest.completion_rate as number) ?? 0;
          const totalProjects = (latest.total_projects as number) ?? 0;

          // Signal: Overdue tasks
          if (overdueTasks > 0) {
            signals.push({
              signal_type: 'overdue_tasks',
              severity: overdueTasks >= 10 ? 'high' : overdueTasks >= 5 ? 'medium' : 'low',
              confidence: 90,
              description: `${overdueTasks} Asana task${overdueTasks > 1 ? 's' : ''} past due date across ${totalProjects} project${totalProjects > 1 ? 's' : ''}. ${completedTasks} of ${totalTasks} tasks completed (${completionRate}%).`,
              source_integration: 'asana',
              signal_data: {
                category: classifySignal('overdue_tasks', 'asana'),
                metric: 'overdue_tasks',
                overdue: overdueTasks,
                total_tasks: totalTasks,
                completed: completedTasks,
                projects: totalProjects,
                affected_entities: [],
                summary_metrics: { overdue_count: overdueTasks, total_tasks: totalTasks, completion_rate: completionRate },
              },
            });
          }

          // Signal: Low completion rate (<20% with significant tasks)
          if (totalTasks >= 10 && completionRate < 20) {
            signals.push({
              signal_type: 'low_completion_rate',
              severity: 'medium',
              confidence: 75,
              description: `Only ${completionRate}% task completion rate in Asana (${completedTasks} of ${totalTasks} tasks). Project delivery may be at risk.`,
              source_integration: 'asana',
              signal_data: {
                category: classifySignal('low_completion_rate', 'asana'),
                metric: 'low_completion_rate',
                completion_rate: completionRate,
                completed: completedTasks,
                total: totalTasks,
                affected_entities: [],
                summary_metrics: { completion_rate: completionRate, completed: completedTasks, total_tasks: totalTasks },
              },
            });
          }

          // Signal: Workload imbalance (high overdue + low completion)
          if (overdueTasks >= 5 && completionRate < 30) {
            signals.push({
              signal_type: 'workload_imbalance',
              severity: 'high',
              confidence: 80,
              description: `${overdueTasks} overdue tasks with only ${completionRate}% completion rate. Team may be overloaded or tasks need reprioritization.`,
              source_integration: 'asana',
              signal_data: {
                category: classifySignal('workload_imbalance', 'asana'),
                metric: 'workload_imbalance',
                overdue: overdueTasks,
                completion_rate: completionRate,
                total_tasks: totalTasks,
                affected_entities: [],
                summary_metrics: { overdue_count: overdueTasks, completion_rate: completionRate, total_tasks: totalTasks },
              },
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

          // Dispatch Slack alerts for HIGH/CRITICAL severity signals
          const highSeveritySignals = signals.filter(
            s => s.severity === 'high' || s.severity === 'critical'
          );
          if (highSeveritySignals.length > 0) {
            const webhookUrl = Deno.env.get('SLACK_WEBHOOK_URL');
            if (webhookUrl) {
              for (const hs of highSeveritySignals) {
                // Check if alert was already sent for this signal (avoid duplicate alerts)
                const { data: existingSig } = await supabase
                  .from('operational_signals')
                  .select('id, alert_sent')
                  .eq('user_id', userId)
                  .eq('signal_type', hs.signal_type)
                  .eq('source_integration', hs.source_integration)
                  .eq('is_active', true)
                  .limit(1);

                const alreadySent = existingSig?.[0]?.alert_sent === true;
                if (alreadySent) {
                  console.log(`[signal-detector] Alert already sent for ${hs.source_integration}:${hs.signal_type}, skipping`);
                  continue;
                }

                try {
                  const severityEmoji = hs.severity === 'critical' ? '🚨' : '⚠️';
                  const slackPayload = {
                    text: `${severityEmoji} *${hs.severity.toUpperCase()} Alert* — ${hs.source_integration}\n*Signal:* ${hs.signal_type}\n*Description:* ${hs.description}\n*Confidence:* ${hs.confidence}%`,
                  };
                  const slackResp = await fetch(webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(slackPayload),
                  });
                  if (slackResp.ok) {
                    console.log(`[signal-detector] Slack alert sent for ${hs.source_integration}:${hs.signal_type}`);
                    totalAlertsSent++;
                    // Mark signal as alert_sent
                    if (existingSig?.[0]?.id) {
                      await supabase
                        .from('operational_signals')
                        .update({ alert_sent: true })
                        .eq('id', existingSig[0].id);
                    }
                  } else {
                    console.error(`[signal-detector] Slack alert failed: ${slackResp.status}`);
                  }
                } catch (alertErr) {
                  console.error(`[signal-detector] Slack alert error:`, alertErr);
                }
              }
            } else {
              console.warn('[signal-detector] SLACK_WEBHOOK_URL not set — skipping alerts');
            }
          }

          console.log(`[signal-detector] User ${userId}: ${signals.length} signals detected, ${totalSignalsCreated} created, ${totalAlertsSent} alerts sent`);
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
      alerts_sent: totalAlertsSent,
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
