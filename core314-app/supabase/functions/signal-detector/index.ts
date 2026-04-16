import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { classifySignal, SIGNAL_DATA_STATES } from '../_shared/signal-classification.ts';

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
    const errors: string[] = [];

    for (const userId of userIds) {
      try {
        const signals: SignalCandidate[] = [];

        // Fetch integration ages to determine recently connected integrations
        // Integrations connected < 14 days ago with zero data → NO_DATA (not negative)
        const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
        const nowMs = Date.now();
        const { data: userIntegrationRows } = await supabase
          .from('user_integrations')
          .select('created_at, integrations_master!inner(integration_name)')
          .eq('user_id', userId)
          .eq('status', 'active');

        const integrationAgeMs: Record<string, number> = {};
        for (const ui of userIntegrationRows || []) {
          const master = ui.integrations_master as unknown as { integration_name: string };
          const name = master?.integration_name?.toLowerCase().replace(/\s+/g, '_') || '';
          if (name) {
            integrationAgeMs[name] = nowMs - new Date(ui.created_at).getTime();
          }
        }

        const isRecentlyConnected = (serviceName: string): boolean => {
          const age = integrationAgeMs[serviceName];
          return age !== undefined && age < FOURTEEN_DAYS_MS;
        };

        // Fetch the 2 most recent REAL events per service for comparison
        // IMPORTANT: Exclude synthetic test data (source='test_scenario_inject')
        // so synthetic events never contaminate real signal detection.
        const { data: slackEvents } = await supabase
          .from('integration_events')
          .select('metadata, occurred_at')
          .eq('user_id', userId)
          .eq('event_type', 'slack.workspace_activity')
          .neq('source', 'test_scenario_inject')
          .order('occurred_at', { ascending: false })
          .limit(2);

        const { data: qbEvents } = await supabase
          .from('integration_events')
          .select('metadata, occurred_at')
          .eq('user_id', userId)
          .eq('event_type', 'quickbooks.financial_activity')
          .neq('source', 'test_scenario_inject')
          .order('occurred_at', { ascending: false })
          .limit(2);

        const { data: hubspotEvents } = await supabase
          .from('integration_events')
          .select('metadata, occurred_at')
          .eq('user_id', userId)
          .eq('event_type', 'hubspot.crm_activity')
          .neq('source', 'test_scenario_inject')
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

          // Signal: No financial activity (connected but no data) — classified as NO_DATA
          if (invoiceCount === 0 && (latest.payment_count as number) === 0 && (latest.expense_count as number) === 0) {
            const accountCount = (latest.account_count as number) ?? 0;
            if (accountCount > 0) {
              const recentQb = isRecentlyConnected('quickbooks');
              signals.push({
                signal_type: 'no_financial_activity',
                severity: 'low',
                confidence: 90,
                description: recentQb
                  ? `QuickBooks recently connected (${accountCount} accounts). No data available yet — the system is collecting initial financial data. This is not a negative signal.`
                  : `QuickBooks is connected (${accountCount} accounts) but no invoices, payments, or expenses found in the last 90 days. No data available or system not yet active.`,
                source_integration: 'quickbooks',
                signal_data: {
                  category: classifySignal('no_financial_activity', 'quickbooks'),
                  metric: 'no_financial_activity',
                  data_state: SIGNAL_DATA_STATES.NO_DATA,
                  account_count: accountCount,
                  recently_connected: recentQb,
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

          // Signal: No CRM activity (connected but empty) — classified as NO_DATA
          if (contactCount === 0 && dealCount === 0) {
            const recentHs = isRecentlyConnected('hubspot');
            signals.push({
              signal_type: 'no_crm_activity',
              severity: 'low',
              confidence: 90,
              description: recentHs
                ? 'HubSpot recently connected. No data available yet — the system is collecting initial CRM data. This is not a negative signal.'
                : 'HubSpot is connected but no contacts or deals found. No data available or system not yet active.',
              source_integration: 'hubspot',
              signal_data: {
                category: classifySignal('no_crm_activity', 'hubspot'),
                metric: 'no_crm_activity',
                data_state: SIGNAL_DATA_STATES.NO_DATA,
                recently_connected: recentHs,
                total_contacts: contactCount,
                total_deals: dealCount,
                total_companies: companyCount,
                affected_entities: [],
                summary_metrics: { contacts: 0, deals: 0, companies: 0 },
              },
            });
          }

          // Signal: Low CRM activity (has some data but very minimal) — classified as NO_DATA
          if (dealCount > 0 && contactCount === 0 && companyCount === 0 && openDeals === 0) {
            const recentHs = isRecentlyConnected('hubspot');
            signals.push({
              signal_type: 'low_crm_activity',
              severity: 'low',
              confidence: 75,
              description: recentHs
                ? `HubSpot recently connected with ${dealCount} deals found. Insufficient data for baseline comparison — collecting more data.`
                : `HubSpot shows ${dealCount} deals but no active contacts or companies. No data available or system not yet active.`,
              source_integration: 'hubspot',
              signal_data: {
                category: classifySignal('low_crm_activity', 'hubspot'),
                metric: 'low_crm_activity',
                data_state: recentHs ? SIGNAL_DATA_STATES.INSUFFICIENT_DATA : SIGNAL_DATA_STATES.NO_DATA,
                recently_connected: recentHs,
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
          .neq('source', 'test_scenario_inject')
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

          // Signal: Low meeting activity (connected but zero events) — classified as NO_DATA
          if (totalEvents === 0) {
            const recentGcal = isRecentlyConnected('google_calendar');
            signals.push({
              signal_type: 'low_meeting_activity',
              severity: 'low',
              confidence: 70,
              description: recentGcal
                ? 'Google Calendar recently connected. No data available yet — the system is collecting initial calendar data. This is not a negative signal.'
                : 'Google Calendar is connected but no events found in the next 7 days. No data available or system not yet active.',
              source_integration: 'google_calendar',
              signal_data: {
                category: classifySignal('low_meeting_activity', 'google_calendar'),
                metric: 'low_meeting_activity',
                data_state: SIGNAL_DATA_STATES.NO_DATA,
                recently_connected: recentGcal,
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
          .neq('source', 'test_scenario_inject')
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

          // Signal: Low email activity (connected but zero messages) — classified as NO_DATA
          if (totalMessages === 0) {
            const recentGmail = isRecentlyConnected('gmail');
            signals.push({
              signal_type: 'low_email_activity',
              severity: 'low',
              confidence: 70,
              description: recentGmail
                ? 'Gmail recently connected. No data available yet — the system is collecting initial email data. This is not a negative signal.'
                : 'Gmail is connected but no email activity detected in the past 7 days. No data available or system not yet active.',
              source_integration: 'gmail',
              signal_data: {
                category: classifySignal('low_email_activity', 'gmail'),
                metric: 'low_email_activity',
                data_state: SIGNAL_DATA_STATES.NO_DATA,
                recently_connected: recentGmail,
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

          // Signal: Normal email activity (1-200 messages, ensures Gmail always appears in brief)
          if (totalMessages > 0 && totalMessages <= 200) {
            signals.push({
              signal_type: 'email_activity_normal',
              severity: 'low',
              confidence: 80,
              description: `${totalMessages} emails in the past 7 days (${sentCount} sent, ${receivedCount} received). Email activity is within normal range.`,
              source_integration: 'gmail',
              signal_data: {
                category: classifySignal('email_activity_normal', 'gmail'),
                metric: 'email_activity_normal',
                total_messages: totalMessages,
                sent: sentCount,
                received: receivedCount,
                affected_entities: [],
                summary_metrics: { total_messages: totalMessages, sent: sentCount, received: receivedCount },
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
          .neq('source', 'test_scenario_inject')
          .order('occurred_at', { ascending: false })
          .limit(2);

        if (jiraEvents && jiraEvents.length > 0) {
          const latest = jiraEvents[0].metadata as Record<string, unknown>;
          const totalIssues = (latest.total_issues_updated as number) ?? 0;
          const doneCount = (latest.done_count as number) ?? 0;
          const inProgressCount = (latest.in_progress_count as number) ?? 0;
          const overdueCount = (latest.overdue_count as number) ?? 0;
          const priorityBreakdown = (latest.priority_breakdown as Record<string, number>) ?? {};

          // Signal: Overdue issues
          if (overdueCount > 0) {
            const severity = overdueCount >= 10 ? 'high' : overdueCount >= 5 ? 'medium' : 'low';
            signals.push({
              signal_type: 'overdue_issues',
              severity,
              confidence: 90,
              description: `${overdueCount} Jira issue${overdueCount > 1 ? 's' : ''} overdue (open > 14 days) out of ${totalIssues} updated this week. ${inProgressCount} in progress, ${doneCount} completed.`,
              source_integration: 'jira',
              signal_data: {
                category: classifySignal('overdue_issues', 'jira'),
                metric: 'overdue_issues',
                overdue: overdueCount,
                total: totalIssues,
                done: doneCount,
                in_progress: inProgressCount,
                affected_entities: [],
                summary_metrics: { overdue_count: overdueCount, total_issues: totalIssues, done: doneCount, in_progress: inProgressCount },
              },
            });
          }

          // Signal: Low velocity (< 10% done rate with significant issues)
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

          // Signal: Blocker accumulation (Highest/Blocker priority issues)
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
          .neq('source', 'test_scenario_inject')
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

          // Signal: Board inactivity (connected but zero cards) — classified as NO_DATA
          if (totalBoards > 0 && totalCards === 0) {
            const recentTrello = isRecentlyConnected('trello');
            signals.push({
              signal_type: 'board_inactivity',
              severity: 'low',
              confidence: 65,
              description: recentTrello
                ? `Trello recently connected with ${totalBoards} board${totalBoards > 1 ? 's' : ''}. No data available yet — the system is collecting initial board data. This is not a negative signal.`
                : `Trello is connected with ${totalBoards} board${totalBoards > 1 ? 's' : ''} but no active cards found. No data available or system not yet active.`,
              source_integration: 'trello',
              signal_data: {
                category: classifySignal('board_inactivity', 'trello'),
                metric: 'board_inactivity',
                data_state: SIGNAL_DATA_STATES.NO_DATA,
                recently_connected: recentTrello,
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
          .neq('source', 'test_scenario_inject')
          .order('occurred_at', { ascending: false })
          .limit(2);

        if (teamsEvents && teamsEvents.length > 0) {
          const latest = teamsEvents[0].metadata as Record<string, unknown>;
          const totalTeams = (latest.total_teams as number) ?? 0;
          const totalChannels = (latest.total_channels as number) ?? 0;

          // Signal: Low team activity (connected but zero teams) — classified as NO_DATA
          if (totalTeams === 0) {
            const recentTeams = isRecentlyConnected('microsoft_teams');
            signals.push({
              signal_type: 'low_team_activity',
              severity: 'low',
              confidence: 70,
              description: recentTeams
                ? 'Microsoft Teams recently connected. No data available yet — the system is collecting initial team data. This is not a negative signal.'
                : 'Microsoft Teams is connected but no joined teams detected. No data available or system not yet active.',
              source_integration: 'microsoft_teams',
              signal_data: {
                category: classifySignal('low_team_activity', 'microsoft_teams'),
                metric: 'low_team_activity',
                data_state: SIGNAL_DATA_STATES.NO_DATA,
                recently_connected: recentTeams,
                teams: 0,
                channels: 0,
                affected_entities: [],
                summary_metrics: { teams: 0, channels: 0 },
              },
            });
          }

          // Signal: Channel inactivity (teams exist but no channels accessible) — classified as NO_DATA
          if (totalTeams > 0 && totalChannels === 0) {
            const recentTeams = isRecentlyConnected('microsoft_teams');
            signals.push({
              signal_type: 'channel_inactivity',
              severity: 'low',
              confidence: 75,
              description: recentTeams
                ? `Microsoft Teams recently connected with ${totalTeams} team${totalTeams > 1 ? 's' : ''}. Channel data not yet available — the system is collecting initial data. This is not a negative signal.`
                : `${totalTeams} Microsoft Teams team${totalTeams > 1 ? 's' : ''} found but no channels accessible. No data available or system not yet active.`,
              source_integration: 'microsoft_teams',
              signal_data: {
                category: classifySignal('channel_inactivity', 'microsoft_teams'),
                metric: 'channel_inactivity',
                data_state: SIGNAL_DATA_STATES.NO_DATA,
                recently_connected: recentTeams,
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
          .neq('source', 'test_scenario_inject')
          .order('occurred_at', { ascending: false })
          .limit(2);

        if (sheetsEvents && sheetsEvents.length > 0) {
          const latest = sheetsEvents[0].metadata as Record<string, unknown>;
          const totalSpreadsheets = (latest.total_spreadsheets as number) ?? 0;
          const recentlyModified = (latest.recently_modified_count as number) ?? 0;

          // Signal: Stale spreadsheets (sheets exist but none modified recently) — classified as NO_DATA
          if (totalSpreadsheets > 0 && recentlyModified === 0) {
            const recentSheets = isRecentlyConnected('google_sheets');
            signals.push({
              signal_type: 'stale_spreadsheets',
              severity: 'low',
              confidence: 65,
              description: recentSheets
                ? `Google Sheets recently connected with ${totalSpreadsheets} spreadsheet${totalSpreadsheets > 1 ? 's' : ''}. Collecting initial data — this is not a negative signal.`
                : `${totalSpreadsheets} Google Sheets spreadsheet${totalSpreadsheets > 1 ? 's' : ''} found but none modified in the past 7 days. No data available or system not yet active.`,
              source_integration: 'google_sheets',
              signal_data: {
                category: classifySignal('stale_spreadsheets', 'google_sheets'),
                metric: 'stale_spreadsheets',
                data_state: SIGNAL_DATA_STATES.NO_DATA,
                recently_connected: recentSheets,
                total: totalSpreadsheets,
                recently_modified: 0,
                affected_entities: [],
                summary_metrics: { total_spreadsheets: totalSpreadsheets, recently_modified: 0 },
              },
            });
          }

          // Signal: No sheet activity (connected but zero spreadsheets) — classified as NO_DATA
          if (totalSpreadsheets === 0) {
            const recentSheets = isRecentlyConnected('google_sheets');
            signals.push({
              signal_type: 'no_sheet_activity',
              severity: 'low',
              confidence: 60,
              description: recentSheets
                ? 'Google Sheets recently connected. No data available yet — the system is collecting initial data. This is not a negative signal.'
                : 'Google Sheets is connected but no spreadsheets found. No data available or system not yet active.',
              source_integration: 'google_sheets',
              signal_data: {
                category: classifySignal('no_sheet_activity', 'google_sheets'),
                metric: 'no_sheet_activity',
                data_state: SIGNAL_DATA_STATES.NO_DATA,
                recently_connected: recentSheets,
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
          .neq('source', 'test_scenario_inject')
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

        // --- Salesforce Signal Detection ---
        const { data: salesforceEvents } = await supabase
          .from('integration_events')
          .select('metadata, occurred_at')
          .eq('user_id', userId)
          .eq('event_type', 'salesforce.crm_activity')
          .neq('source', 'test_scenario_inject')
          .order('occurred_at', { ascending: false })
          .limit(2);

        if (salesforceEvents && salesforceEvents.length > 0) {
          const latest = salesforceEvents[0].metadata as Record<string, unknown>;
          const openDeals = (latest.open_deals as number) ?? 0;
          const winRate = (latest.win_rate as number) ?? 0;
          const pipelineValue = (latest.pipeline_value as number) ?? 0;
          const openCases = (latest.open_cases as number) ?? 0;
          const totalOpportunities = (latest.total_opportunities as number) ?? 0;
          const leadConversionRate = (latest.lead_conversion_rate as number) ?? 0;

          // Signal: Low win rate (<30% with sufficient deals)
          if (totalOpportunities >= 5 && winRate < 30) {
            signals.push({
              signal_type: 'low_win_rate',
              severity: winRate < 15 ? 'high' : 'medium',
              confidence: 80,
              description: `Salesforce win rate is ${winRate}% across ${totalOpportunities} opportunities. Pipeline health may need attention.`,
              source_integration: 'salesforce',
              signal_data: {
                category: classifySignal('low_win_rate', 'salesforce'),
                metric: 'low_win_rate',
                win_rate: winRate,
                total_opportunities: totalOpportunities,
                open_deals: openDeals,
                pipeline_value: pipelineValue,
                affected_entities: [],
                summary_metrics: { win_rate: winRate, total_opportunities: totalOpportunities, pipeline_value: pipelineValue },
              },
            });
          }

          // Signal: High open case volume
          if (openCases >= 20) {
            signals.push({
              signal_type: 'high_support_volume',
              severity: openCases >= 50 ? 'high' : 'medium',
              confidence: 85,
              description: `${openCases} open support cases in Salesforce. Customer support load is elevated.`,
              source_integration: 'salesforce',
              signal_data: {
                category: classifySignal('high_support_volume', 'salesforce'),
                metric: 'high_support_volume',
                open_cases: openCases,
                affected_entities: [],
                summary_metrics: { open_cases: openCases },
              },
            });
          }

          // Signal: Low lead conversion
          if ((latest.total_leads as number) >= 10 && leadConversionRate < 10) {
            signals.push({
              signal_type: 'low_lead_conversion',
              severity: 'medium',
              confidence: 75,
              description: `Lead conversion rate is only ${leadConversionRate}% (${latest.converted_leads} of ${latest.total_leads} leads). Sales funnel may need optimization.`,
              source_integration: 'salesforce',
              signal_data: {
                category: classifySignal('low_lead_conversion', 'salesforce'),
                metric: 'low_lead_conversion',
                conversion_rate: leadConversionRate,
                total_leads: latest.total_leads,
                converted_leads: latest.converted_leads,
                affected_entities: [],
                summary_metrics: { conversion_rate: leadConversionRate, total_leads: latest.total_leads },
              },
            });
          }
        }

        // --- Zoom Signal Detection ---
        const { data: zoomEvents } = await supabase
          .from('integration_events')
          .select('metadata, occurred_at')
          .eq('user_id', userId)
          .eq('event_type', 'zoom.meeting_activity')
          .neq('source', 'test_scenario_inject')
          .order('occurred_at', { ascending: false })
          .limit(2);

        if (zoomEvents && zoomEvents.length > 0) {
          const latest = zoomEvents[0].metadata as Record<string, unknown>;
          const upcomingMeetings = (latest.upcoming_meetings as number) ?? 0;
          const weeklyRate = (latest.weekly_meeting_rate as number) ?? 0;
          const scheduledMinutes = (latest.scheduled_minutes as number) ?? 0;

          // Signal: Meeting overload (>25 upcoming or >20 hours scheduled)
          if (upcomingMeetings > 25 || scheduledMinutes > 1200) {
            signals.push({
              signal_type: 'meeting_overload',
              severity: upcomingMeetings > 40 ? 'high' : 'medium',
              confidence: 80,
              description: `${upcomingMeetings} upcoming Zoom meetings (${Math.round(scheduledMinutes / 60)} hours scheduled). Meeting load may impact productivity.`,
              source_integration: 'zoom',
              signal_data: {
                category: classifySignal('meeting_overload', 'zoom'),
                metric: 'meeting_overload',
                upcoming_meetings: upcomingMeetings,
                scheduled_minutes: scheduledMinutes,
                weekly_rate: weeklyRate,
                affected_entities: [],
                summary_metrics: { upcoming_meetings: upcomingMeetings, scheduled_hours: Math.round(scheduledMinutes / 60) },
              },
            });
          }

          // Signal: Low meeting activity (0 meetings when connected)
          if (upcomingMeetings === 0 && (latest.past_meetings_30d as number) === 0) {
            const recentZoom = isRecentlyConnected('zoom');
            signals.push({
              signal_type: 'low_meeting_activity',
              severity: 'low',
              confidence: recentZoom ? 60 : 75,
              description: recentZoom
                ? 'Zoom is recently connected — no meeting data available yet. Data will populate after scheduled meetings occur.'
                : 'No Zoom meetings detected in the past 30 days. The integration may need re-authorization or meetings are scheduled elsewhere.',
              source_integration: 'zoom',
              signal_data: {
                category: classifySignal('low_meeting_activity', 'zoom'),
                metric: 'low_meeting_activity',
                data_state: recentZoom ? SIGNAL_DATA_STATES.NO_DATA : 'inactive',
                recently_connected: recentZoom,
                affected_entities: [],
                summary_metrics: { upcoming_meetings: 0, past_meetings_30d: 0 },
              },
            });
          }
        }

        // --- GitHub Signal Detection ---
        const { data: githubEvents } = await supabase
          .from('integration_events')
          .select('metadata, occurred_at')
          .eq('user_id', userId)
          .eq('event_type', 'github.dev_activity')
          .neq('source', 'test_scenario_inject')
          .order('occurred_at', { ascending: false })
          .limit(2);

        if (githubEvents && githubEvents.length > 0) {
          const latest = githubEvents[0].metadata as Record<string, unknown>;
          const openPRs = (latest.open_prs as number) ?? 0;
          const stalePRs = (latest.stale_prs as number) ?? 0;
          const openIssues = (latest.open_issues as number) ?? 0;
          const recentCommits = (latest.recent_commits_7d as number) ?? 0;

          // Signal: Stale PRs (>3 PRs open for >7 days)
          if (stalePRs >= 3) {
            signals.push({
              signal_type: 'stale_pull_requests',
              severity: stalePRs >= 10 ? 'high' : 'medium',
              confidence: 85,
              description: `${stalePRs} GitHub pull requests have been open for over 7 days. Code review bottleneck may be slowing delivery.`,
              source_integration: 'github',
              signal_data: {
                category: classifySignal('stale_pull_requests', 'github'),
                metric: 'stale_pull_requests',
                stale_prs: stalePRs,
                open_prs: openPRs,
                affected_entities: [],
                summary_metrics: { stale_prs: stalePRs, open_prs: openPRs },
              },
            });
          }

          // Signal: High open issue count
          if (openIssues >= 25) {
            signals.push({
              signal_type: 'high_issue_backlog',
              severity: openIssues >= 50 ? 'high' : 'medium',
              confidence: 80,
              description: `${openIssues} open GitHub issues assigned. Engineering backlog is growing — prioritization may be needed.`,
              source_integration: 'github',
              signal_data: {
                category: classifySignal('high_issue_backlog', 'github'),
                metric: 'high_issue_backlog',
                open_issues: openIssues,
                affected_entities: [],
                summary_metrics: { open_issues: openIssues },
              },
            });
          }

          // Signal: Low development activity
          if (recentCommits === 0 && openPRs === 0) {
            const recentGH = isRecentlyConnected('github');
            if (!recentGH) {
              signals.push({
                signal_type: 'low_dev_activity',
                severity: 'low',
                confidence: 70,
                description: 'No GitHub commits or pull requests in the past 7 days. Development velocity may be stalled.',
                source_integration: 'github',
                signal_data: {
                  category: classifySignal('low_dev_activity', 'github'),
                  metric: 'low_dev_activity',
                  recent_commits_7d: recentCommits,
                  open_prs: openPRs,
                  affected_entities: [],
                  summary_metrics: { recent_commits_7d: 0, open_prs: 0 },
                },
              });
            }
          }
        }

        // --- Zendesk Signal Detection ---
        const { data: zendeskEvents } = await supabase
          .from('integration_events')
          .select('metadata, occurred_at')
          .eq('user_id', userId)
          .eq('event_type', 'zendesk.support_activity')
          .neq('source', 'test_scenario_inject')
          .order('occurred_at', { ascending: false })
          .limit(2);

        if (zendeskEvents && zendeskEvents.length > 0) {
          const latest = zendeskEvents[0].metadata as Record<string, unknown>;
          const openTickets = (latest.open_tickets as number) ?? 0;
          const urgentTickets = (latest.urgent_tickets as number) ?? 0;
          const resolutionRate = (latest.resolution_rate as number) ?? 0;
          const satisfactionScore = (latest.satisfaction_score as number) ?? 0;
          const totalTickets = (latest.total_tickets as number) ?? 0;

          // Signal: Urgent ticket accumulation
          if (urgentTickets >= 3) {
            signals.push({
              signal_type: 'urgent_tickets',
              severity: urgentTickets >= 10 ? 'critical' : 'high',
              confidence: 90,
              description: `${urgentTickets} urgent Zendesk tickets require immediate attention. Customer escalations are accumulating.`,
              source_integration: 'zendesk',
              signal_data: {
                category: classifySignal('urgent_tickets', 'zendesk'),
                metric: 'urgent_tickets',
                urgent_tickets: urgentTickets,
                open_tickets: openTickets,
                affected_entities: [],
                summary_metrics: { urgent_tickets: urgentTickets, open_tickets: openTickets },
              },
            });
          }

          // Signal: Low resolution rate
          if (totalTickets >= 10 && resolutionRate < 40) {
            signals.push({
              signal_type: 'low_resolution_rate',
              severity: resolutionRate < 20 ? 'high' : 'medium',
              confidence: 80,
              description: `Zendesk ticket resolution rate is ${resolutionRate}% (${totalTickets} total tickets). Support backlog is growing.`,
              source_integration: 'zendesk',
              signal_data: {
                category: classifySignal('low_resolution_rate', 'zendesk'),
                metric: 'low_resolution_rate',
                resolution_rate: resolutionRate,
                total_tickets: totalTickets,
                open_tickets: openTickets,
                affected_entities: [],
                summary_metrics: { resolution_rate: resolutionRate, total_tickets: totalTickets },
              },
            });
          }

          // Signal: Low customer satisfaction
          if ((latest.total_ratings as number) >= 5 && satisfactionScore < 60) {
            signals.push({
              signal_type: 'low_satisfaction',
              severity: satisfactionScore < 40 ? 'high' : 'medium',
              confidence: 75,
              description: `Zendesk customer satisfaction score is ${satisfactionScore}%. Customer experience needs attention.`,
              source_integration: 'zendesk',
              signal_data: {
                category: classifySignal('low_satisfaction', 'zendesk'),
                metric: 'low_satisfaction',
                satisfaction_score: satisfactionScore,
                total_ratings: latest.total_ratings,
                affected_entities: [],
                summary_metrics: { satisfaction_score: satisfactionScore, total_ratings: latest.total_ratings },
              },
            });
          }

          // Signal: High ticket volume
          if (openTickets >= 30) {
            signals.push({
              signal_type: 'high_ticket_volume',
              severity: openTickets >= 75 ? 'high' : 'medium',
              confidence: 80,
              description: `${openTickets} open Zendesk tickets. Support team may be overwhelmed — consider resource allocation.`,
              source_integration: 'zendesk',
              signal_data: {
                category: classifySignal('high_ticket_volume', 'zendesk'),
                metric: 'high_ticket_volume',
                open_tickets: openTickets,
                total_tickets: totalTickets,
                affected_entities: [],
                summary_metrics: { open_tickets: openTickets, total_tickets: totalTickets },
              },
            });
          }
        }

        // --- Notion Signal Detection ---
        const { data: notionEvents } = await supabase
          .from('integration_events')
          .select('metadata, occurred_at')
          .eq('user_id', userId)
          .eq('event_type', 'notion.workspace_activity')
          .neq('source', 'test_scenario_inject')
          .order('occurred_at', { ascending: false })
          .limit(2);

        if (notionEvents && notionEvents.length > 0) {
          const latest = notionEvents[0].metadata as Record<string, unknown>;
          const totalPages = (latest.total_pages as number) ?? 0;
          const recentlyEdited = (latest.recently_edited_pages_7d as number) ?? 0;
          const stalePages = (latest.stale_pages_30d as number) ?? 0;
          const totalDatabases = (latest.total_databases as number) ?? 0;

          // Signal: Stale workspace (many pages not edited in 30+ days)
          if (totalPages >= 10 && stalePages > totalPages * 0.7) {
            signals.push({
              signal_type: 'stale_workspace',
              severity: stalePages > totalPages * 0.9 ? 'high' : 'medium',
              confidence: 75,
              description: `${stalePages} of ${totalPages} Notion pages haven't been updated in 30+ days. Knowledge base may be going stale.`,
              source_integration: 'notion',
              signal_data: {
                category: classifySignal('stale_workspace', 'notion'),
                metric: 'stale_workspace',
                stale_pages: stalePages,
                total_pages: totalPages,
                recently_edited_7d: recentlyEdited,
                affected_entities: [],
                summary_metrics: { stale_pages: stalePages, total_pages: totalPages, recently_edited_7d: recentlyEdited },
              },
            });
          }

          // Signal: Low page activity (0 edits in 7 days with pages present)
          if (totalPages >= 5 && recentlyEdited === 0) {
            signals.push({
              signal_type: 'low_page_activity',
              severity: 'low',
              confidence: 70,
              description: `No Notion pages edited in the past 7 days across ${totalPages} pages and ${totalDatabases} databases. Team may not be actively using Notion.`,
              source_integration: 'notion',
              signal_data: {
                category: classifySignal('low_page_activity', 'notion'),
                metric: 'low_page_activity',
                total_pages: totalPages,
                recently_edited_7d: 0,
                databases: totalDatabases,
                affected_entities: [],
                summary_metrics: { total_pages: totalPages, recently_edited_7d: 0, databases: totalDatabases },
              },
            });
          }

          // Signal: No workspace activity (0 pages found)
          if (totalPages === 0 && totalDatabases === 0) {
            const recentNotion = isRecentlyConnected('notion');
            signals.push({
              signal_type: 'no_workspace_activity',
              severity: 'info',
              confidence: 60,
              description: recentNotion
                ? 'Notion recently connected. No data available yet — the system is collecting initial data.'
                : 'Notion is connected but no pages or databases found. Workspace may be empty or access is restricted.',
              source_integration: 'notion',
              signal_data: {
                category: classifySignal('no_workspace_activity', 'notion'),
                metric: 'no_workspace_activity',
                data_state: SIGNAL_DATA_STATES.NO_DATA,
                recently_connected: recentNotion,
                affected_entities: [],
                summary_metrics: { total_pages: 0, total_databases: 0 },
              },
            });
          }
        }

        // --- Monday.com Signal Detection ---
        const { data: mondayEvents } = await supabase
          .from('integration_events')
          .select('metadata, occurred_at')
          .eq('user_id', userId)
          .eq('event_type', 'monday.board_activity')
          .neq('source', 'test_scenario_inject')
          .order('occurred_at', { ascending: false })
          .limit(2);

        if (mondayEvents && mondayEvents.length > 0) {
          const latest = mondayEvents[0].metadata as Record<string, unknown>;
          const totalBoards = (latest.total_boards as number) ?? 0;
          const totalItems = (latest.total_items as number) ?? 0;
          const overdueItems = (latest.overdue_items as number) ?? 0;
          const stuckItems = (latest.stuck_items as number) ?? 0;
          const doneItems = (latest.done_items as number) ?? 0;
          const completionRate = (latest.completion_rate as number) ?? 0;

          // Signal: Overdue items
          if (overdueItems > 0) {
            signals.push({
              signal_type: 'overdue_items',
              severity: overdueItems >= 10 ? 'high' : overdueItems >= 5 ? 'medium' : 'low',
              confidence: 85,
              description: `${overdueItems} overdue item${overdueItems > 1 ? 's' : ''} on Monday.com across ${totalBoards} board${totalBoards > 1 ? 's' : ''}. ${doneItems} of ${totalItems} items completed (${completionRate}%).`,
              source_integration: 'monday',
              signal_data: {
                category: classifySignal('overdue_items', 'monday'),
                metric: 'overdue_items',
                overdue: overdueItems,
                total_items: totalItems,
                done: doneItems,
                boards: totalBoards,
                affected_entities: [],
                summary_metrics: { overdue_count: overdueItems, total_items: totalItems, completion_rate: completionRate },
              },
            });
          }

          // Signal: Stuck items (blocked work)
          if (stuckItems >= 3) {
            signals.push({
              signal_type: 'stuck_items',
              severity: stuckItems >= 10 ? 'high' : 'medium',
              confidence: 80,
              description: `${stuckItems} stuck/blocked item${stuckItems > 1 ? 's' : ''} on Monday.com. Work may be blocked and needs attention.`,
              source_integration: 'monday',
              signal_data: {
                category: classifySignal('stuck_items', 'monday'),
                metric: 'stuck_items',
                stuck: stuckItems,
                total_items: totalItems,
                affected_entities: [],
                summary_metrics: { stuck_count: stuckItems, total_items: totalItems },
              },
            });
          }

          // Signal: Low completion rate (<20% with significant items)
          if (totalItems >= 10 && completionRate < 20) {
            signals.push({
              signal_type: 'low_completion_rate',
              severity: 'medium',
              confidence: 75,
              description: `Only ${completionRate}% completion rate on Monday.com (${doneItems} of ${totalItems} items). Project delivery may be at risk.`,
              source_integration: 'monday',
              signal_data: {
                category: classifySignal('low_completion_rate', 'monday'),
                metric: 'low_completion_rate',
                completion_rate: completionRate,
                done: doneItems,
                total: totalItems,
                affected_entities: [],
                summary_metrics: { completion_rate: completionRate, done: doneItems, total_items: totalItems },
              },
            });
          }

          // Signal: No board activity (0 boards/items)
          if (totalBoards === 0 || totalItems === 0) {
            const recentMonday = isRecentlyConnected('monday');
            signals.push({
              signal_type: 'no_board_activity',
              severity: 'info',
              confidence: 60,
              description: recentMonday
                ? 'Monday.com recently connected. No data available yet — the system is collecting initial data.'
                : 'Monday.com is connected but no boards or items found. Workspace may be empty or access is restricted.',
              source_integration: 'monday',
              signal_data: {
                category: classifySignal('no_board_activity', 'monday'),
                metric: 'no_board_activity',
                data_state: SIGNAL_DATA_STATES.NO_DATA,
                recently_connected: recentMonday,
                affected_entities: [],
                summary_metrics: { total_boards: totalBoards, total_items: totalItems },
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
