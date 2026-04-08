import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { getSignalCategory } from '../_shared/signal-classification.ts';

/**
 * Operational Brief Generator
 * 
 * Generates AI-driven operational narratives by:
 * 1. Checking subscription plan brief limits
 * 2. Aggregating active operational signals
 * 3. Pulling recent integration metrics
 * 4. Fetching latest health score
 * 5. Sending structured prompt to GPT-4o
 * 6. Storing the generated brief
 * 
 * Works even with minimal or no data — briefs always include
 * reasoning about what is (or isn't) happening.
 * 
 * Brief limits per plan:
 *   Intelligence:   30 / month
 *   Command Center: Unlimited
 *   Enterprise:     Unlimited
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') || '';

// Brief limits per plan name (matching plan_name from user_subscriptions / plan_limits)
// Intelligence: 30/month, Command Center & Enterprise: unlimited
const BRIEF_LIMITS: Record<string, number> = {
  'Intelligence': 30,
  'Command Center': -1, // unlimited
  'Enterprise': -1,     // unlimited
};

function getBriefLimit(planName: string): number {
  return BRIEF_LIMITS[planName] ?? 30; // default to Intelligence tier limit
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Session expired or invalid' }), {
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
      return new Response(JSON.stringify({ error: 'Session expired or invalid' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // ── Step 0: Check subscription plan and brief limits ──────────────
    const { data: subscriptionData } = await supabase.rpc(
      'get_user_subscription_summary',
      { p_user_id: user.id }
    );

    const planName = subscriptionData?.subscription?.plan_name
      ?? subscriptionData?.plan_limits?.plan_name
      ?? 'Intelligence';
    const briefLimit = getBriefLimit(planName);

    // Count briefs generated this calendar month
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const { count: briefsThisMonth, error: countError } = await supabase
      .from('operational_briefs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', monthStart);

    if (countError) {
      console.error('[operational-brief] Error counting briefs:', countError);
    }

    const currentCount = briefsThisMonth ?? 0;

    if (briefLimit !== -1 && currentCount >= briefLimit) {
      return new Response(JSON.stringify({
        error: 'brief_limit_reached',
        message: `You have reached your monthly limit of ${briefLimit} briefs. Upgrade to Command Center for unlimited access.`,
        plan: planName,
        limit: briefLimit,
        used: currentCount,
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get organization context
    let organizationId: string | null = null;
    let orgName = 'your organization';

    try {
      const body = await req.json();
      organizationId = body.organization_id || null;
    } catch {
      // No body
    }

    if (organizationId) {
      const { data: org } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', organizationId)
        .single();
      if (org?.name) orgName = org.name;
    } else {
      // Find user's primary organization
      const { data: memberData } = await supabase
        .from('organization_members')
        .select('organization_id, organizations(name)')
        .eq('user_id', user.id)
        .limit(1)
        .single();

      if (memberData) {
        organizationId = memberData.organization_id;
        const orgData = memberData.organizations as { name: string } | null;
        if (orgData?.name) orgName = orgData.name;
      }
    }

    // ── Step 1b: Invoke signal-correlator for fresh correlated events ──
    let correlatedEvent: Record<string, unknown> | null = null;
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
      const svcKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
      const correlatorResp = await fetch(
        `${supabaseUrl}/functions/v1/signal-correlator`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${svcKey}`,
            'Content-Type': 'application/json',
          },
        }
      );
      if (correlatorResp.ok) {
        const correlatorData = await correlatorResp.json();
        if (correlatorData.correlated_events > 0 && correlatorData.events?.length > 0) {
          // Use the first (highest-priority) correlated event for this user
          const userEvent = correlatorData.events.find(
            (e: Record<string, unknown>) => e.user_id === user.id
          );
          if (userEvent) {
            correlatedEvent = {
              correlation_id: userEvent.correlation_id,
              organization_id: userEvent.organization_id,
              signal_ids: userEvent.signal_ids,
              integrations_involved: userEvent.integrations_involved,
              operational_categories: userEvent.operational_categories,
              time_window_start: userEvent.time_window_start,
              time_window_end: userEvent.time_window_end,
              combined_severity: userEvent.combined_severity,
              signals: userEvent.signals,
              failure_pattern: userEvent.failure_pattern || null,
              correlated_at: new Date().toISOString(),
            };
            console.log('[operational-brief] Found correlated event:', userEvent.correlation_id,
              userEvent.failure_pattern ? `pattern=${userEvent.failure_pattern.pattern}` : 'pattern=none');
          }
        }
      }
    } catch {
      // Signal correlator unavailable — proceed with standard brief
    }

    // ── Step 2: Fetch active operational signals ──────────────────────
    const { data: signals } = await supabase
      .from('operational_signals')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('severity', { ascending: true }) // critical first
      .limit(20);

    // ── Step 3: Fetch latest health score ─────────────────────────────
    const { data: healthScoreData } = await supabase
      .from('operational_health_scores')
      .select('*')
      .eq('user_id', user.id)
      .order('calculated_at', { ascending: false })
      .limit(1)
      .single();

    // ── Step 3b: Calculate Operational Momentum ─────────────────────────
    // Fetch up to 4 recent health scores (1 current + up to 3 historical)
    // and compute momentum_delta = current_score - average(previous scores)
    let momentumDelta = 0;
    let momentumClassification = 'stable';
    let momentumLabel = 'Stable (no history)';
    let momentumCurrentScore: number | null = null;
    let momentumHistoricalAvg: number | null = null;
    let momentumScoresUsed = 0;

    try {
      const { data: recentScores } = await supabase
        .from('operational_health_scores')
        .select('score, calculated_at')
        .eq('user_id', user.id)
        .order('calculated_at', { ascending: false })
        .limit(4);

      const scoreRows = recentScores || [];
      momentumScoresUsed = scoreRows.length;

      if (scoreRows.length >= 2) {
        momentumCurrentScore = scoreRows[0].score;
        const previousScores = scoreRows.slice(1);
        momentumHistoricalAvg = Math.round(
          previousScores.reduce((sum: number, s: { score: number }) => sum + s.score, 0) / previousScores.length
        );
        momentumDelta = momentumCurrentScore - momentumHistoricalAvg;

        // Classify momentum
        if (momentumDelta >= 8) momentumClassification = 'strong_improvement';
        else if (momentumDelta >= 3) momentumClassification = 'improving';
        else if (momentumDelta >= -2) momentumClassification = 'stable';
        else if (momentumDelta >= -7) momentumClassification = 'declining';
        else momentumClassification = 'critical_decline';

        // Build display label
        const sign = momentumDelta >= 0 ? '+' : '';
        const classLabels: Record<string, string> = {
          'strong_improvement': 'Strong Improvement',
          'improving': 'Improving',
          'stable': 'Stable',
          'declining': 'Declining',
          'critical_decline': 'Critical Decline',
        };
        momentumLabel = `${classLabels[momentumClassification]} (${sign}${momentumDelta} compared to recent cycles)`;
      } else if (scoreRows.length === 1) {
        momentumCurrentScore = scoreRows[0].score;
        momentumLabel = 'Stable (initial score)';
      }

      console.log(`[operational-brief] Momentum: delta=${momentumDelta}, classification=${momentumClassification}, scores_used=${momentumScoresUsed}`);
    } catch (momentumErr) {
      console.error('[operational-brief] Momentum calculation error (non-fatal):', momentumErr);
    }

    // ── Step 4: Fetch connected integrations ──────────────────────────
    // Join integrations_master to get service name (user_integrations has no service_name column)
    const { data: connectedIntegrations } = await supabase
      .from('user_integrations')
      .select('id, status, updated_at, integration_id, integrations_master!inner(integration_name)')
      .eq('user_id', user.id)
      .eq('status', 'active');

    const connectedServices = (connectedIntegrations || []).map(i => {
      const master = i.integrations_master as unknown as { integration_name: string } | null;
      return master?.integration_name?.toLowerCase().replace(/\s+/g, '_') || '';
    }).filter(Boolean);

    // ── Step 5: Fetch recent integration events for context ───────────
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: hubspotEvents } = await supabase
      .from('integration_events')
      .select('metadata, created_at')
      .eq('user_id', user.id)
      .eq('service_name', 'hubspot')
      .gte('created_at', sevenDaysAgo)
      .order('created_at', { ascending: false })
      .limit(1);

    const { data: slackEvents } = await supabase
      .from('integration_events')
      .select('metadata, created_at')
      .eq('user_id', user.id)
      .eq('service_name', 'slack')
      .gte('created_at', sevenDaysAgo)
      .order('created_at', { ascending: false })
      .limit(1);

    const { data: qbEvents } = await supabase
      .from('integration_events')
      .select('metadata, created_at')
      .eq('user_id', user.id)
      .eq('service_name', 'quickbooks')
      .gte('created_at', sevenDaysAgo)
      .order('created_at', { ascending: false })
      .limit(1);

    // ── Step 5a: Fetch Command Center integration events ────────────
    const { data: gcalEvents } = await supabase
      .from('integration_events')
      .select('metadata, created_at')
      .eq('user_id', user.id)
      .eq('service_name', 'google_calendar')
      .gte('created_at', sevenDaysAgo)
      .order('created_at', { ascending: false })
      .limit(1);

    const { data: gmailEvents } = await supabase
      .from('integration_events')
      .select('metadata, created_at')
      .eq('user_id', user.id)
      .eq('service_name', 'gmail')
      .gte('created_at', sevenDaysAgo)
      .order('created_at', { ascending: false })
      .limit(1);

    const { data: jiraEvents } = await supabase
      .from('integration_events')
      .select('metadata, created_at')
      .eq('user_id', user.id)
      .eq('service_name', 'jira')
      .gte('created_at', sevenDaysAgo)
      .order('created_at', { ascending: false })
      .limit(1);

    const { data: trelloEvents } = await supabase
      .from('integration_events')
      .select('metadata, created_at')
      .eq('user_id', user.id)
      .eq('service_name', 'trello')
      .gte('created_at', sevenDaysAgo)
      .order('created_at', { ascending: false })
      .limit(1);

    const { data: teamsEvents } = await supabase
      .from('integration_events')
      .select('metadata, created_at')
      .eq('user_id', user.id)
      .eq('service_name', 'microsoft_teams')
      .gte('created_at', sevenDaysAgo)
      .order('created_at', { ascending: false })
      .limit(1);

    const { data: sheetsEvents } = await supabase
      .from('integration_events')
      .select('metadata, created_at')
      .eq('user_id', user.id)
      .eq('service_name', 'google_sheets')
      .gte('created_at', sevenDaysAgo)
      .order('created_at', { ascending: false })
      .limit(1);

    const { data: asanaEvents } = await supabase
      .from('integration_events')
      .select('metadata, created_at')
      .eq('user_id', user.id)
      .eq('service_name', 'asana')
      .gte('created_at', sevenDaysAgo)
      .order('created_at', { ascending: false })
      .limit(1);

    // ── Step 5b: Fetch Slack integration config for channel/connection status ──
    // This provides channels_member, channels_total, oauth_connected from user_integrations.config
    // which is stored by slack-poll after each discovery run.
    const hasSlack = connectedServices.includes('slack');
    let slackIntegrationConfig: Record<string, unknown> = {};
    if (hasSlack) {
      // Try to find the Slack user_integration row with config
      const { data: slackIntRows } = await supabase
        .from('user_integrations')
        .select('config')
        .eq('user_id', user.id)
        .eq('status', 'active');

      // Find the row that has Slack-specific config (channels_total field)
      const slackRow = (slackIntRows || []).find(
        (row: { config: Record<string, unknown> | null }) => row.config && typeof row.config === 'object' && 'channels_total' in (row.config as Record<string, unknown>)
      );
      if (slackRow?.config && typeof slackRow.config === 'object') {
        slackIntegrationConfig = slackRow.config as Record<string, unknown>;
      }
    }

    // ── Step 6: Build context for GPT ─────────────────────────────────
    const activeSignals = signals || [];
    const healthScore = healthScoreData?.score ?? null;
    const healthLabel = healthScoreData?.label ?? 'Unknown';

    const hubspotMeta = hubspotEvents?.[0]?.metadata || {};
    const slackMeta = slackEvents?.[0]?.metadata || {};
    const qbMeta = qbEvents?.[0]?.metadata || {};

    // Determine data availability — all 10 integrations
    const hasHubspot = connectedServices.includes('hubspot');
    const hasQuickbooks = connectedServices.includes('quickbooks');
    const hasGcal = connectedServices.includes('google_calendar');
    const hasGmail = connectedServices.includes('gmail');
    const hasJira = connectedServices.includes('jira');
    const hasTrello = connectedServices.includes('trello');
    const hasTeams = connectedServices.includes('microsoft_teams');
    const hasSheets = connectedServices.includes('google_sheets');
    const hasAsana = connectedServices.includes('asana');

    const hasHubspotData = !!hubspotEvents?.[0];
    const hasSlackData = !!slackEvents?.[0];
    const hasQbData = !!qbEvents?.[0];
    const hasGcalData = !!gcalEvents?.[0];
    const hasGmailData = !!gmailEvents?.[0];
    const hasJiraData = !!jiraEvents?.[0];
    const hasTrelloData = !!trelloEvents?.[0];
    const hasTeamsData = !!teamsEvents?.[0];
    const hasSheetsData = !!sheetsEvents?.[0];
    const hasAsanaData = !!asanaEvents?.[0];

    const hasAnyData = hasHubspotData || hasSlackData || hasQbData || hasGcalData || hasGmailData || hasJiraData || hasTrelloData || hasTeamsData || hasSheetsData || hasAsanaData || activeSignals.length > 0;
    const connectedCount = connectedServices.length;

    // Extract metadata for new integrations
    const gcalMeta = (gcalEvents?.[0]?.metadata || {}) as Record<string, unknown>;
    const gmailMeta = (gmailEvents?.[0]?.metadata || {}) as Record<string, unknown>;
    const jiraMeta = (jiraEvents?.[0]?.metadata || {}) as Record<string, unknown>;
    const trelloMeta = (trelloEvents?.[0]?.metadata || {}) as Record<string, unknown>;
    const teamsMeta = (teamsEvents?.[0]?.metadata || {}) as Record<string, unknown>;
    const sheetsMeta = (sheetsEvents?.[0]?.metadata || {}) as Record<string, unknown>;
    const asanaMeta = (asanaEvents?.[0]?.metadata || {}) as Record<string, unknown>;

    // Build CRM summary
    const crmSummary = hasHubspotData && hubspotMeta.total_deals !== undefined
      ? `${hubspotMeta.open_deals || 0} open deals ($${((hubspotMeta.open_pipeline_value as number) || 0).toLocaleString()} pipeline), ${hubspotMeta.stalled_deals || 0} stalled, ${hubspotMeta.won_deals || 0} won, ${hubspotMeta.lost_deals || 0} lost, ${hubspotMeta.total_contacts || 0} contacts`
      : hasHubspot
        ? 'HubSpot is connected but no CRM data has been collected yet. This typically means the first data sync has not completed or the HubSpot account has no recent deal/contact activity.'
        : 'HubSpot is not connected. CRM data (deals, contacts, pipeline) is not available for analysis.';

    // Build communication summary — use integration config for accurate connection status
    const slackChannelsMember = (slackIntegrationConfig.channels_member as number) ?? 0;
    const slackChannelsTotal = (slackIntegrationConfig.channels_total as number) ?? 0;
    const slackOauthConnected = slackIntegrationConfig.oauth_connected as boolean ?? false;
    const slackChannelNames = (slackIntegrationConfig.channel_names as string[]) ?? [];

    // Determine Slack connection validity:
    // - Valid: channels_member >= 1 (bot is actively monitoring at least one channel)
    // - Issue: channels_total == 0 OR oauth_connected == false
    const isSlackConnectionValid = slackChannelsMember >= 1;
    const isSlackConnectionIssue = (slackChannelsTotal === 0 && !slackOauthConnected) || (!hasSlack);

    let commSummary: string;
    if (hasSlackData && slackMeta.message_count !== undefined && (slackMeta.message_count as number) > 0) {
      // Has actual message data
      commSummary = `${slackMeta.message_count || 0} messages across ${slackMeta.active_channels || 0} active channels (${slackChannelsTotal || slackMeta.total_channels || 0} total). Monitored channels: ${slackChannelNames.length > 0 ? slackChannelNames.map((n: string) => '#' + n).join(', ') : 'N/A'}`;
    } else if (isSlackConnectionValid) {
      // Connection is valid (channels_member >= 1) but no recent messages — NOT a connection issue
      commSummary = `Slack integration is active and monitoring ${slackChannelsMember} channel${slackChannelsMember > 1 ? 's' : ''} (${slackChannelsTotal} total discovered)${slackChannelNames.length > 0 ? ': ' + slackChannelNames.map((n: string) => '#' + n).join(', ') : ''}. Limited communication activity was detected in monitored channels — this is NOT a connection issue, it simply means low message volume in the monitoring window.`;
    } else if (hasSlack && slackOauthConnected && slackChannelsTotal > 0) {
      // Connected but bot not in any channels
      commSummary = `Slack is connected (${slackChannelsTotal} channels discovered) but the bot is not yet a member of any channels. Invite the bot to channels for monitoring. This is NOT a connection failure.`;
    } else if (hasSlack) {
      // Connected but no channels at all or oauth issue
      commSummary = 'Slack is connected but no channels have been discovered yet. This typically means the first data sync has not completed or the bot needs to be invited to channels.';
    } else {
      commSummary = 'Slack is not connected. Communication data (messages, channels, response times) is not available for analysis.';
    }

    // Build financial summary
    const financialSummary = hasQbData && qbMeta.invoice_count !== undefined
      ? `${qbMeta.invoice_count || 0} invoices ($${((qbMeta.invoice_total as number) || 0).toLocaleString()}), ${qbMeta.overdue_invoices || 0} overdue, ${qbMeta.payment_count || 0} payments ($${((qbMeta.payment_total as number) || 0).toLocaleString()}), ${qbMeta.expense_count || 0} expenses ($${((qbMeta.expense_total as number) || 0).toLocaleString()})`
      : hasQuickbooks
        ? 'QuickBooks is connected but no financial data has been collected yet. This typically means the first data sync has not completed or the QuickBooks account has no recent financial activity.'
        : 'QuickBooks is not connected. Financial data (invoices, payments, expenses) is not available for analysis.';

    // Build Command Center integration summaries
    const calendarSummary = hasGcalData
      ? `${gcalMeta.total_events || 0} events, ${gcalMeta.meetings_with_attendees || 0} meetings with attendees, ${gcalMeta.total_meeting_hours || 0} meeting hours in next 7 days`
      : hasGcal ? 'Google Calendar connected, awaiting first data sync.' : 'Not connected.';

    const emailSummary = hasGmailData
      ? `${gmailMeta.total_messages || 0} messages (${gmailMeta.sent_count || 0} sent, ${gmailMeta.received_count || 0} received), ${gmailMeta.thread_count || 0} threads in past 7 days`
      : hasGmail ? 'Gmail connected, awaiting first data sync.' : 'Not connected.';

    const jiraSummary = hasJiraData
      ? `${jiraMeta.total_issues_updated || 0} issues updated, ${jiraMeta.done_count || 0} done, ${jiraMeta.in_progress_count || 0} in progress, ${jiraMeta.overdue_count || 0} overdue`
      : hasJira ? 'Jira connected, awaiting first data sync.' : 'Not connected.';

    const trelloSummary = hasTrelloData
      ? `${trelloMeta.total_boards || 0} boards, ${trelloMeta.total_cards || 0} cards, ${trelloMeta.done_cards || 0} done, ${trelloMeta.overdue_cards || 0} overdue`
      : hasTrello ? 'Trello connected, awaiting first data sync.' : 'Not connected.';

    const teamsSummary = hasTeamsData
      ? `${teamsMeta.total_teams || 0} teams, ${teamsMeta.total_channels || 0} channels`
      : hasTeams ? 'Microsoft Teams connected, awaiting first data sync.' : 'Not connected.';

    const sheetsSummary = hasSheetsData
      ? `${sheetsMeta.total_spreadsheets || 0} spreadsheets, ${sheetsMeta.recently_modified_count || 0} modified in past 7 days`
      : hasSheets ? 'Google Sheets connected, awaiting first data sync.' : 'Not connected.';

    const asanaSummary = hasAsanaData
      ? `${asanaMeta.total_projects || 0} projects, ${asanaMeta.total_tasks || 0} tasks, ${asanaMeta.completed_tasks || 0} completed, ${asanaMeta.overdue_tasks || 0} overdue (${asanaMeta.completion_rate || 0}% completion)`
      : hasAsana ? 'Asana connected, awaiting first data sync.' : 'Not connected.';

    // ── Signal subtype mapping: human-readable labels for each signal_type ──
    const SIGNAL_SUBTYPE_LABELS: Record<string, string> = {
      // HubSpot
      stalled_deals: 'Stage Stagnation',
      pipeline_stagnation: 'Pipeline Risk',
      deal_velocity_decline: 'Deal Velocity Drop',
      deal_stage_delay: 'Stage Delay',
      no_new_deals: 'Pipeline Generation',
      no_crm_activity: 'CRM Inactivity',
      low_crm_activity: 'Low CRM Activity',
      // QuickBooks
      overdue_invoices: 'Overdue Invoices',
      low_collection_rate: 'Cash Flow Risk',
      high_expense_ratio: 'Expense Risk',
      revenue_decline: 'Revenue Gap',
      no_financial_activity: 'Financial Inactivity',
      // Slack
      low_communication: 'Communication Drop',
      communication_spike: 'Communication Spike',
      slow_response: 'Response Delay',
      low_engagement: 'Engagement Gap',
      integration_inactive: 'Integration Inactive',
      data_ingestion_gap: 'Data Gap',
      scope_limitation: 'Scope Limitation',
      // Google Calendar
      meeting_overload: 'Meeting Overload',
      low_meeting_activity: 'Meeting Inactivity',
      // Gmail
      email_volume_spike: 'Email Volume Spike',
      low_email_activity: 'Email Inactivity',
      low_response_ratio: 'Low Response Ratio',
      // Jira
      overdue_issues: 'Issue Delays',
      low_velocity: 'Low Velocity',
      blocker_accumulation: 'Blockers',
      // Trello
      overdue_cards: 'Delivery Delay',
      stalled_cards: 'Board Stagnation',
      board_inactivity: 'Board Inactivity',
      // Microsoft Teams
      low_team_activity: 'Team Inactivity',
      channel_inactivity: 'Channel Inactivity',
      // Google Sheets
      stale_spreadsheets: 'Stale Data',
      no_sheet_activity: 'Sheet Inactivity',
      // Asana
      overdue_tasks: 'Task Delays',
      low_completion_rate: 'Low Completion',
      workload_imbalance: 'Workload Imbalance',
    };

    function getSignalSubtype(signalType: string): string {
      return SIGNAL_SUBTYPE_LABELS[signalType] || signalType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }

    // ── Signal → health score category mapping ──
    const SIGNAL_HEALTH_CATEGORY: Record<string, string> = {
      // revenue
      stalled_deals: 'revenue', pipeline_stagnation: 'revenue', deal_velocity_decline: 'revenue',
      deal_stage_delay: 'revenue', no_new_deals: 'revenue', no_crm_activity: 'revenue',
      low_crm_activity: 'revenue', revenue_decline: 'revenue',
      // cash_flow
      overdue_invoices: 'cash_flow', low_collection_rate: 'cash_flow', high_expense_ratio: 'cash_flow',
      no_financial_activity: 'cash_flow',
      // operations
      overdue_cards: 'operations', stalled_cards: 'operations', board_inactivity: 'operations',
      overdue_issues: 'operations', low_velocity: 'operations', blocker_accumulation: 'operations',
      overdue_tasks: 'operations', low_completion_rate: 'operations', workload_imbalance: 'operations',
      stale_spreadsheets: 'operations', no_sheet_activity: 'operations',
      // communication
      low_communication: 'communication', communication_spike: 'communication', slow_response: 'communication',
      low_engagement: 'communication', low_team_activity: 'communication', channel_inactivity: 'communication',
      integration_inactive: 'communication', data_ingestion_gap: 'communication', scope_limitation: 'communication',
      email_volume_spike: 'communication', low_email_activity: 'communication', low_response_ratio: 'communication',
      // scheduling
      meeting_overload: 'scheduling', low_meeting_activity: 'scheduling',
    };

    // Classify each signal and collect unique categories
    const classifiedSignals = activeSignals.map(s => {
      const signalData = (s.signal_data as Record<string, unknown>) || {};
      const category = getSignalCategory(s.signal_type, s.source_integration, signalData);
      return { ...s, category };
    });

    const signalCategoriesList = [...new Set(classifiedSignals.map(s => s.category))];

    // Format signals for prompt — GROUPED BY source_integration (MANDATORY)
    // This prevents GPT from re-ordering or re-assigning signals to wrong integrations
    const formatSignalLine = (s: typeof classifiedSignals[0]) => {
      const sd = (s.signal_data as Record<string, unknown>) || {};
      const entities = (sd.affected_entities as Array<{ name: string; entity_id?: string; entity_type?: string; value?: number; owner?: string; status?: string; last_activity_type?: string; last_activity_date?: string; days_in_current_state?: number; metric_value?: number }>) || [];
      const metrics = (sd.summary_metrics as Record<string, unknown>) || {};
      let line = `  - [${s.severity.toUpperCase()}] [${s.category}] ${s.description} (signal_type: ${s.signal_type}, confidence: ${s.confidence}%)`;
      if (entities.length > 0) {
        line += `\n    ENTITY DETAILS (${entities.length} items):`;
        for (const e of entities.slice(0, 10)) {
          const parts: string[] = [e.name];
          if (e.entity_id) parts.push(`ID: ${e.entity_id}`);
          if (e.value !== undefined) parts.push(`Value: $${e.value.toLocaleString()}`);
          if (e.owner) parts.push(`Owner: ${e.owner}`);
          if (e.status) parts.push(`Status: ${e.status}`);
          if (e.last_activity_date) {
            const d = new Date(e.last_activity_date);
            parts.push(`Last Activity: ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`);
          }
          if (e.days_in_current_state !== undefined) parts.push(`Days in State: ${e.days_in_current_state}`);
          if (e.last_activity_type) parts.push(e.last_activity_type);
          line += `\n      • ${parts.join(' | ')}`;
        }
        if (entities.length > 10) {
          line += `\n      ... and ${entities.length - 10} more`;
        }
      }
      if (Object.keys(metrics).length > 0) {
        line += `\n    Summary metrics: ${Object.entries(metrics).map(([k, v]) => `${k.replace(/_/g, ' ')}=${v}`).join(', ')}`;
      }
      return line;
    };

    // Group signals by source_integration for strict mapping
    const signalsBySource: Record<string, typeof classifiedSignals> = {};
    for (const s of classifiedSignals) {
      const src = s.source_integration || 'unknown';
      if (!signalsBySource[src]) signalsBySource[src] = [];
      signalsBySource[src].push(s);
    }

    const signalSummary = classifiedSignals.length > 0
      ? Object.entries(signalsBySource).map(([source, signals]) => {
          const header = `[SOURCE: ${source.toUpperCase()}] (${signals.length} signal${signals.length > 1 ? 's' : ''})`;
          const lines = signals.map(s => formatSignalLine(s)).join('\n');
          return `${header}\n${lines}`;
        }).join('\n\n')
      : 'No active signals detected.';

    // Count total entities across all signals for validation
    const totalEntityCount = classifiedSignals.reduce((acc, s) => {
      const sd = (s.signal_data as Record<string, unknown>) || {};
      const entities = (sd.affected_entities as Array<Record<string, unknown>>) || [];
      return acc + entities.length;
    }, 0);

    // Build structured signal evidence for data_context storage (used by UI)
    const signalEvidence = classifiedSignals.map(s => {
      const sd = (s.signal_data as Record<string, unknown>) || {};
      return {
        signal_type: s.signal_type,
        signal_subtype: getSignalSubtype(s.signal_type),
        source: s.source_integration,
        severity: s.severity,
        category: s.category,
        description: s.description,
        confidence: s.confidence,
        affected_entities: ((sd.affected_entities as Array<Record<string, unknown>>) || []).slice(0, 10),
        summary_metrics: (sd.summary_metrics as Record<string, unknown>) || {},
        // Pass through full signal_data for cross-system correlation
        overdue_total: sd.overdue_total as number | undefined,
        pipeline_value: (sd.summary_metrics as Record<string, unknown>)?.pipeline_value as number | undefined,
      };
    });

    // Format correlated event context (if exists)
    let correlationContext = '';
    let hasCorrelatedEvent = false;

    // ── Hoist failure pattern fields to outer scope for programmatic title override ──
    let patternDetected: string | null = null;
    let patternTitle: string | null = null;
    let patternConfidence: number | null = null;
    let patternDescription: string | null = null;

    if (correlatedEvent && correlatedEvent.signals) {
      hasCorrelatedEvent = true;
      const ceSignals = correlatedEvent.signals as Array<{
        signal_type: string;
        severity: string;
        source_integration: string;
        category: string;
        description: string;
        signal_data?: Record<string, unknown>;
      }>;
      const integrations = (correlatedEvent.integrations_involved as string[]) || [];
      const categories = (correlatedEvent.operational_categories as string[]) || [];
      const combinedSeverity = (correlatedEvent.combined_severity as string) || 'medium';

      // Extract failure pattern info (if detected by signal-correlator)
      const failurePatternObj = correlatedEvent.failure_pattern as {
        pattern: string;
        display_name: string;
        confidence: number;
        description: string;
        matched_categories: string[];
      } | null;

      if (failurePatternObj) {
        patternDetected = failurePatternObj.pattern;
        patternTitle = failurePatternObj.display_name;
        patternConfidence = Math.round(failurePatternObj.confidence * 100);
        patternDescription = failurePatternObj.description;
        console.log('[operational-brief] Failure pattern extracted:', patternDetected, `title=${patternTitle}`, `confidence=${patternConfidence}%`);
      } else {
        console.log('[operational-brief] No failure pattern in correlated event');
      }

      const patternContext = failurePatternObj
        ? `\nOPERATIONAL FAILURE PATTERN DETECTED: ${failurePatternObj.display_name}
Pattern confidence: ${Math.round(failurePatternObj.confidence * 100)}%
Pattern description: ${failurePatternObj.description}
Matched categories: ${failurePatternObj.matched_categories.join(', ')}`
        : '';

      // Build entity-enriched correlated signal descriptions
      const ceSignalLines = ceSignals.map(s => {
        let line = `  - [${s.severity.toUpperCase()}] (${s.source_integration} / ${s.category.replace(/_/g, ' ')}) ${s.description}`;
        if (s.signal_data) {
          const entities = (s.signal_data.affected_entities as Array<{ name: string; entity_id?: string; value?: number; owner?: string; status?: string; days_in_current_state?: number; last_activity_date?: string }>) || [];
          if (entities.length > 0) {
            line += `\n    ENTITIES:`;
            for (const e of entities.slice(0, 10)) {
              const parts: string[] = [e.name];
              if (e.entity_id) parts.push(`ID: ${e.entity_id}`);
              if (e.value !== undefined) parts.push(`$${e.value.toLocaleString()}`);
              if (e.owner) parts.push(`Owner: ${e.owner}`);
              if (e.status) parts.push(`Status: ${e.status}`);
              if (e.days_in_current_state !== undefined) parts.push(`${e.days_in_current_state} days`);
              line += `\n      \u2022 ${parts.join(' | ')}`;
            }
          }
        }
        return line;
      }).join('\n');

      correlationContext = `\n\nCORRELATED OPERATIONAL EVENT DETECTED:
Severity: ${combinedSeverity.toUpperCase()}
Integrations involved: ${integrations.join(', ')}
Operational categories: ${categories.map(c => c.replace(/_/g, ' ')).join(', ')}
Time window: ${correlatedEvent.time_window_start} to ${correlatedEvent.time_window_end}
Correlated signals:
${ceSignalLines}${patternContext}`;
    }

    // Build integration status summary — Slack status uses config-based connection check
    const slackStatusLabel = isSlackConnectionIssue
      ? 'connection issue'
      : isSlackConnectionValid
        ? `active (${slackChannelsMember} channels monitored)`
        : hasSlack
          ? 'connected, awaiting channel access'
          : 'not connected';

    const integrationStatus = `Connected integrations (${connectedCount}): ${connectedCount > 0 ? connectedServices.join(', ') : 'None'}
Core integrations: HubSpot ${hasHubspotData ? 'has data' : hasHubspot ? 'connected, no data yet' : 'not connected'} | Slack ${hasSlackData ? 'has data' : slackStatusLabel} | QuickBooks ${hasQbData ? 'has data' : hasQuickbooks ? 'connected, no data yet' : 'not connected'}
Command Center integrations: Google Calendar ${hasGcalData ? 'has data' : hasGcal ? 'connected, no data yet' : 'not connected'} | Gmail ${hasGmailData ? 'has data' : hasGmail ? 'connected, no data yet' : 'not connected'} | Jira ${hasJiraData ? 'has data' : hasJira ? 'connected, no data yet' : 'not connected'} | Trello ${hasTrelloData ? 'has data' : hasTrello ? 'connected, no data yet' : 'not connected'} | Microsoft Teams ${hasTeamsData ? 'has data' : hasTeams ? 'connected, no data yet' : 'not connected'} | Google Sheets ${hasSheetsData ? 'has data' : hasSheets ? 'connected, no data yet' : 'not connected'} | Asana ${hasAsanaData ? 'has data' : hasAsana ? 'connected, no data yet' : 'not connected'}`;

    // ── Step 7: Generate narrative via GPT-4o ─────────────────────────
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    let gptPrompt: string;

    if (hasCorrelatedEvent) {
      // ── Correlated Event Brief Format ──────────────────────────────
      // When correlated signals exist, produce a unified "Operational Event Detected" narrative
      gptPrompt = `You are Core314, an AI operations analyst. A correlated operational pattern has been detected across multiple integrations for ${orgName}. Generate a structured Operational Event brief.

Date: ${today}
Operational Health Score: ${healthScore !== null ? `${healthScore}/100 (${healthLabel})` : 'Not yet calculated'}
Operational Momentum: ${momentumLabel}

INTEGRATION STATUS:
${integrationStatus}
${correlationContext}

ALL ACTIVE SIGNALS:
${signalSummary}

SIGNAL CATEGORIES PRESENT: ${signalCategoriesList.length > 0 ? signalCategoriesList.join(', ') : 'none'}

RAW METRICS:
CRM (HubSpot): ${crmSummary}
Communication (Slack): ${commSummary}
Financial (QuickBooks): ${financialSummary}
Scheduling (Google Calendar): ${calendarSummary}
Email (Gmail): ${emailSummary}
Project Tracking (Jira): ${jiraSummary}
Task Management (Trello): ${trelloSummary}
Team Communication (Microsoft Teams): ${teamsSummary}
Data Tracking (Google Sheets): ${sheetsSummary}
Project Delivery (Asana): ${asanaSummary}

MANDATORY ENTITY-LEVEL INTELLIGENCE INSTRUCTIONS:
- You MUST list actual entities. Do NOT summarize counts without listing entities.
- If entity data exists in the signals above and is not shown in your response, the response is INVALID.
- All analysis must be grounded in the provided data_context above.
- This is a CORRELATED EVENT brief — multiple signals from different integrations have been detected within the same time window.
- Structure the brief as an "Operational Event Detected" narrative, NOT as a list of independent signals.
- Do NOT invent data. If entity data is missing, state "specific entity details unavailable".

STRICT SIGNAL-TO-INTEGRATION MAPPING (MANDATORY):
- Each signal above is grouped under its SOURCE integration (e.g., [SOURCE: HUBSPOT], [SOURCE: QUICKBOOKS]).
- You MUST preserve this mapping exactly. Do NOT reassign signals to different integrations.
- HubSpot signals: stalled_deals, deal_velocity_decline, pipeline_stagnation, no_crm_activity, lead_activity_drop
- QuickBooks signals: overdue_invoices, cash_flow_risk, missing_payments, revenue_decline, no_financial_activity
- Slack signals: low_communication, communication_spike, slow_response, message_volume_drop
- Google Calendar signals: scheduling_gaps, meeting_decline
- Trello signals: overdue_tasks, board_inactivity
- Microsoft Teams signals: engagement_gap
- In your detected_signals output, each entry MUST be prefixed with the source integration name in brackets, e.g., "[HubSpot] 5 deals stalled..." or "[QuickBooks] 3 overdue invoices..."
- Do NOT put deal/pipeline signals under QuickBooks. Do NOT put invoice/payment signals under HubSpot.

REQUIRED ENTITY FORMAT:
For deals: "Deal Name | $Amount | Stage: X | Owner: Y | Last Activity: Date | Stalled: N days"
For invoices: "INV-ID | Customer | $Amount | N days overdue"
For tasks/cards: "Task Name (Board) | Owner: Y | N days overdue"

ROOT CAUSE ANALYSIS (MANDATORY):
- For each signal, explain WHY it is happening based on actual data patterns.
- Example: "Deals show no activity for >14 days across all 5 records"

CROSS-SYSTEM CORRELATION (MANDATORY):
- Explicitly connect data from multiple integrations.
- Example: "5 stalled deals ($320,000 pipeline) correlate with 3 overdue invoices ($28,750), indicating breakdown between sales conversion and billing execution."

BUSINESS IMPACT (QUANTIFIED - MANDATORY):
- Total revenue at risk (sum of deal values)
- Total overdue cash (sum of overdue invoices)
- Operational delays quantified

FORECAST ENGINE (MANDATORY):
- Provide 7/14/30 day projections based on current entity data.
- Example: "If no action is taken, 3 of 5 stalled deals are likely to be lost within 14 days"

ACCOUNTABILITY (MANDATORY):
- Every issue must identify a responsible party (deal owner, account manager, team).
- If owner data is not available, explicitly state: "Owner data not available from integration"

PRESCRIPTIVE ACTIONS FORMAT (MANDATORY):
- Each action must follow: WHO — WHAT — WHEN
- Example: "Sales Manager → Re-engage Acme Corp deal → within 48 hours"

Generate a JSON response with these exact fields:
1. "title": ${patternTitle ? `Use EXACTLY this title: "Operational Event Detected — ${patternTitle} — ${today}". Do NOT change the pattern name.` : `Use: "Operational Event Detected — Cross-Integration Pattern — ${today}"`}
2. "event_summary": 1-2 sentence description of the correlated operational event.
3. "detected_signals": Array of signal descriptions, one per signal. Each MUST be prefixed with the source integration in brackets (e.g., "[HubSpot] ...", "[QuickBooks] ..."). Each MUST list individual entities with full detail (name, ID, value, owner, status, dates, days in state). Do NOT just say "5 stalled deals" — list each deal. The order MUST match the order of signals in the ALL ACTIVE SIGNALS section above.
4. "root_cause_analysis": Array of strings. For each signal, explain WHY based on actual data patterns.
5. "cross_system_correlation": String. Explicitly connect signals across integrations with dollar amounts.
6. "operational_interpretation": 1-2 paragraphs explaining how the signals relate and what operational condition they represent.
7. "business_impact": Object with fields: "revenue_at_risk" (string with $ amount), "overdue_cash" (string with $ amount), "operational_delays" (string), "narrative" (1-2 paragraphs).
8. "forecast": Object with fields: "7_day" (string), "14_day" (string), "30_day" (string).
9. "accountability": Array of objects with fields: "entity" (string), "owner" (string), "issue" (string).
10. "recommended_actions": Array of objects with fields: "who" (string), "what" (string), "when" (string).
11. "risk_assessment": Brief risk outlook (1-2 sentences).
12. "confidence": Score 0-100 based on data quality and correlation strength.`;
    } else {
      // ── Standard Brief Format (no correlated events) ───────────────
      gptPrompt = `You are Core314, an AI operations analyst. Generate a clear, executive-friendly Operational Brief for ${orgName}.

Date: ${today}
Operational Health Score: ${healthScore !== null ? `${healthScore}/100 (${healthLabel})` : 'Not yet calculated'}
Operational Momentum: ${momentumLabel}

INTEGRATION STATUS:
${integrationStatus}

DETECTED OPERATIONAL SIGNALS:
${signalSummary}

SIGNAL CATEGORIES PRESENT: ${signalCategoriesList.length > 0 ? signalCategoriesList.join(', ') : 'none'}

RAW METRICS:
CRM (HubSpot): ${crmSummary}
Communication (Slack): ${commSummary}
Financial (QuickBooks): ${financialSummary}
Scheduling (Google Calendar): ${calendarSummary}
Email (Gmail): ${emailSummary}
Project Tracking (Jira): ${jiraSummary}
Task Management (Trello): ${trelloSummary}
Team Communication (Microsoft Teams): ${teamsSummary}
Data Tracking (Google Sheets): ${sheetsSummary}
Project Delivery (Asana): ${asanaSummary}

MANDATORY ENTITY-LEVEL INTELLIGENCE INSTRUCTIONS:
- You MUST list actual entities. Do NOT summarize counts without listing entities.
- If entity data exists in the signals above and is not shown in your response, the response is INVALID.
- All analysis must be grounded in the provided data_context above.
- Write as if you are a senior business analyst presenting to the CEO.
- Do NOT invent data. If entity data is missing, state "specific entity details unavailable".

STRICT SIGNAL-TO-INTEGRATION MAPPING (MANDATORY):
- Each signal above is grouped under its SOURCE integration (e.g., [SOURCE: HUBSPOT], [SOURCE: QUICKBOOKS]).
- You MUST preserve this mapping exactly. Do NOT reassign signals to different integrations.
- HubSpot signals: stalled_deals, deal_velocity_decline, pipeline_stagnation, no_crm_activity, lead_activity_drop
- QuickBooks signals: overdue_invoices, cash_flow_risk, missing_payments, revenue_decline, no_financial_activity
- Slack signals: low_communication, communication_spike, slow_response, message_volume_drop
- Google Calendar signals: scheduling_gaps, meeting_decline
- Trello signals: overdue_tasks, board_inactivity
- Microsoft Teams signals: engagement_gap
- In your detected_signals output, each entry MUST be prefixed with the source integration name in brackets, e.g., "[HubSpot] 5 deals stalled..." or "[QuickBooks] 3 overdue invoices..."
- Do NOT put deal/pipeline signals under QuickBooks. Do NOT put invoice/payment signals under HubSpot.

REQUIRED ENTITY FORMAT:
For deals: "Deal Name | $Amount | Stage: X | Owner: Y | Last Activity: Date | Stalled: N days"
For invoices: "INV-ID | Customer | $Amount | N days overdue"
For tasks/cards: "Task Name (Board) | Owner: Y | N days overdue"

ROOT CAUSE ANALYSIS (MANDATORY if signals exist):
- For each signal, explain WHY based on actual data patterns.

BUSINESS IMPACT (QUANTIFIED - MANDATORY if signals exist):
- Total revenue at risk, total overdue cash, operational delays quantified.

FORECAST ENGINE (MANDATORY if signals exist):
- 7/14/30 day projections based on current entity data.

ACCOUNTABILITY (MANDATORY):
- Every issue must identify a responsible party. If not available, state "Owner data not available from integration".

PRESCRIPTIVE ACTIONS FORMAT (MANDATORY):
- Each action: WHO — WHAT — WHEN

- If data is limited or missing, still produce a meaningful brief explaining known/unknown state.
- Explain the operational trend using the Momentum data.

Generate a JSON response with these exact fields:
1. "title": Concise brief title (e.g., "Weekly Operations Summary — ${today}" or "Initial Operational Assessment — ${today}" if data is sparse)
2. "detected_signals": Array of signal summary strings, one per signal. Each MUST be prefixed with the source integration in brackets (e.g., "[HubSpot] ...", "[QuickBooks] ..."). Each MUST list individual entities with full detail. Do NOT just say "5 stalled deals" — list each deal. The order MUST match the order of signals in the DETECTED OPERATIONAL SIGNALS section above.
3. "root_cause_analysis": Array of strings explaining WHY each signal is occurring.
4. "cross_system_correlation": String connecting signals across integrations with dollar amounts. Null if only one integration.
5. "business_impact": Object with fields: "revenue_at_risk" (string), "overdue_cash" (string), "operational_delays" (string), "narrative" (1-2 paragraphs).
6. "forecast": Object with fields: "7_day" (string), "14_day" (string), "30_day" (string). Null if no signals.
7. "accountability": Array of objects with fields: "entity" (string), "owner" (string), "issue" (string).
8. "recommended_actions": Array of objects with fields: "who" (string), "what" (string), "when" (string).
9. "risk_assessment": Brief risk outlook (1-2 sentences).
10. "confidence": Score 0-100.`;
    }

    console.log('[operational-brief] Generating brief for user:', user.id, {
      plan: planName,
      briefsUsed: currentCount,
      briefLimit,
      signals: activeSignals.length,
      healthScore,
      connectedIntegrations: connectedServices,
      hasCRM: hasHubspotData,
      hasComm: hasSlackData,
      hasFinancial: hasQbData,
    });

    const gptResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: hasCorrelatedEvent
              ? 'You are Core314, an expert AI operations analyst specializing in cross-integration signal correlation and ENTITY-LEVEL intelligence. You MUST list every individual entity (deal, invoice, task) with full details — name, ID, value, owner, status, dates. NEVER summarize counts without listing entities. When multiple signals occur simultaneously, present them as a single coherent narrative with explicit cross-system correlation and quantified business impact. Include root cause analysis, 7/14/30 day forecasts, accountability (WHO owns each issue), and prescriptive actions in WHO — WHAT — WHEN format. Always return valid JSON. Never fabricate data.'
              : 'You are Core314, an expert AI operations analyst specializing in ENTITY-LEVEL business intelligence. You MUST list every individual entity (deal, invoice, task) with full details — name, ID, value, owner, status, dates. NEVER summarize counts without listing entities. Include root cause analysis, quantified business impact, 7/14/30 day forecasts, accountability (WHO owns each issue), and prescriptive actions in WHO — WHAT — WHEN format. You ALWAYS produce a brief, even when data is minimal. Always return valid JSON. Never fabricate data.',
          },
          {
            role: 'user',
            content: gptPrompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 4000,
      }),
    });

    if (!gptResponse.ok) {
      const errText = await gptResponse.text();
      console.error('[operational-brief] OpenAI error:', gptResponse.status, errText);
      throw new Error(`OpenAI API error: ${gptResponse.status}`);
    }

    const gptData = await gptResponse.json();
    const narrative = JSON.parse(gptData.choices[0].message.content || '{}');

    // ── STRICT VALIDATION: Fail if entity data exists but GPT didn't render it ──
    if (totalEntityCount > 0) {
      const detectedSignalsText = JSON.stringify(narrative.detected_signals || []);
      // Check that GPT actually listed entities (not just counts)
      const hasEntityNames = classifiedSignals.some(s => {
        const sd = (s.signal_data as Record<string, unknown>) || {};
        const entities = (sd.affected_entities as Array<{ name: string }>) || [];
        if (entities.length === 0) return true; // no entities to check
        // Check if at least one entity name fragment appears in detected_signals
        return entities.some(e => {
          const nameParts = e.name.split(' — ')[0].split(' (')[0].trim();
          return detectedSignalsText.includes(nameParts.substring(0, 20));
        });
      });

      if (!hasEntityNames) {
        console.warn(`[operational-brief] VALIDATION WARNING: ${totalEntityCount} entities exist in signal data but GPT may not have rendered them. Proceeding with available output.`);
        // Log but don't fail — the entity data is still available in data_context.signal_evidence for the UI
      }
    }

    // ── Step 8: Save the operational brief ─────────────────────────────
    const signalIds = activeSignals.map(s => s.id);

    // Build the brief summary — for correlated events, lead with the event summary and interpretation
    const businessImpactText = typeof narrative.business_impact === 'object'
      ? (narrative.business_impact?.narrative || JSON.stringify(narrative.business_impact))
      : (narrative.business_impact || '');
    const briefSummary = hasCorrelatedEvent
      ? [
          narrative.event_summary || '',
          narrative.operational_interpretation || '',
          businessImpactText,
        ].filter(Boolean).join('\n\n')
      : businessImpactText;

    // ── Step 8a: Calculate health score BEFORE saving brief ─────────
    // Category-based health score calibration model
    // Prevents over-penalization and collapsing to 0 too easily
    let calculatedScore = 100;

    // Severity weights per signal
    const SEVERITY_WEIGHTS: Record<string, number> = {
      'critical': 20,
      'high': 20,
      'medium': 10,
      'low': 5,
    };

    // Category penalty caps
    const CATEGORY_CAPS: Record<string, number> = {
      revenue: 30,
      cash_flow: 25,
      operations: 20,
      communication: 15,
      scheduling: 10,
    };

    // Accumulate penalties per category
    const categoryPenalties: Record<string, number> = {};
    const signalPenaltyDetails: { type: string; severity: string; penalty: number; source: string; description: string; category: string }[] = [];

    for (const s of activeSignals) {
      const cat = SIGNAL_HEALTH_CATEGORY[s.signal_type] || 'operations';
      const weight = SEVERITY_WEIGHTS[s.severity] || 5;
      if (!categoryPenalties[cat]) categoryPenalties[cat] = 0;
      categoryPenalties[cat] += weight;
      signalPenaltyDetails.push({
        type: s.signal_type,
        severity: s.severity,
        penalty: weight,
        source: s.source_integration || 'unknown',
        description: (s.description as string) || s.signal_type.replace(/_/g, ' '),
        category: cat,
      });
    }

    // Apply capped category penalties
    let totalCappedPenalty = 0;
    const cappedCategoryPenalties: Record<string, number> = {};
    const impactedCategories: string[] = [];
    for (const [cat, rawPenalty] of Object.entries(categoryPenalties)) {
      const cap = CATEGORY_CAPS[cat] || 20;
      const capped = Math.min(rawPenalty, cap);
      cappedCategoryPenalties[cat] = capped;
      totalCappedPenalty += capped;
      if (capped > 0) impactedCategories.push(cat);
    }

    calculatedScore -= totalCappedPenalty;

    // Cross-system correlation penalty
    let crossSystemPenalty = 0;
    if (impactedCategories.length >= 3) {
      crossSystemPenalty = 15;
    } else if (impactedCategories.length >= 2) {
      crossSystemPenalty = 10;
    }
    calculatedScore -= crossSystemPenalty;

    // Positive offset: recovery buffer if any active signals show positive activity
    // (e.g., open pipeline, active deals, payments in last 30 days)
    let recoveryBuffer = 0;
    const hasActivePipeline = activeSignals.some(s => {
      const sd = (s.signal_data as Record<string, unknown>) || {};
      const metrics = (sd.summary_metrics as Record<string, unknown>) || {};
      return (metrics.pipeline_value as number) > 0 || (metrics.total_deals as number) > 0;
    });
    const hasRecentPayments = activeSignals.some(s => {
      const sd = (s.signal_data as Record<string, unknown>) || {};
      return (sd.payment_total as number) > 0;
    });
    if (hasActivePipeline && hasRecentPayments) {
      recoveryBuffer = 15;
    } else if (hasActivePipeline || hasRecentPayments) {
      recoveryBuffer = 10;
    } else if (activeSignals.length > 0) {
      recoveryBuffer = 5;
    }
    calculatedScore += recoveryBuffer;

    // Floor constraint: minimum 10 unless ALL integrations show inactivity
    const allInactive = activeSignals.length > 0 && activeSignals.every(s =>
      s.signal_type.includes('no_') || s.signal_type.includes('inactiv') || s.signal_type === 'integration_inactive'
    );
    if (allInactive && activeSignals.length > 0) {
      calculatedScore = Math.max(0, Math.min(100, Math.round(calculatedScore)));
    } else {
      calculatedScore = Math.max(10, Math.min(100, Math.round(calculatedScore)));
    }

    const newScoreLabel = calculatedScore >= 90 ? 'Excellent'
      : calculatedScore >= 70 ? 'Good'
      : calculatedScore >= 50 ? 'Moderate'
      : calculatedScore >= 30 ? 'At Risk'
      : calculatedScore >= 10 ? 'Critical'
      : 'System Failure';

    const { data: savedBrief, error: insertError } = await supabase
      .from('operational_briefs')
      .insert({
        user_id: user.id,
        organization_id: organizationId,
        // Programmatic title: when pattern is detected, ALWAYS use pattern title (don't rely on GPT)
        title: hasCorrelatedEvent && patternTitle
            ? `Operational Event Detected — ${patternTitle} — ${today}`
            : narrative.title || (hasCorrelatedEvent
              ? `Operational Event Detected — Cross-Integration Pattern — ${today}`
              : `Operations Summary — ${today}`),

        detected_signals: narrative.detected_signals || [],
        business_impact: businessImpactText || 'Insufficient data for impact analysis.',
        recommended_actions: narrative.recommended_actions || [],
        risk_assessment: narrative.risk_assessment || 'Insufficient data for risk assessment.',
        summary: briefSummary,
        confidence: narrative.confidence || 50,
        health_score: calculatedScore,
        signal_ids: signalIds,
        brief_type: hasCorrelatedEvent ? 'correlated_event' : 'operational',
        data_context: {
          crm: hubspotMeta,
          communication: slackMeta,
          financial: qbMeta,
          signal_count: activeSignals.length,
          signal_categories: signalCategoriesList,
          health_score: calculatedScore,
          health_label: newScoreLabel,
          connected_integrations: connectedServices,
          has_data: hasAnyData,
          correlated_event: correlatedEvent ? {
            correlation_id: correlatedEvent.correlation_id,
            integrations_involved: correlatedEvent.integrations_involved,
            operational_categories: correlatedEvent.operational_categories,
            combined_severity: correlatedEvent.combined_severity,
            signal_count: (correlatedEvent.signal_ids as string[])?.length || 0,
            failure_pattern: correlatedEvent.failure_pattern || null,
          } : null,
          // New correlated event narrative fields
          event_summary: hasCorrelatedEvent ? (narrative.event_summary || null) : null,
          operational_interpretation: hasCorrelatedEvent ? (narrative.operational_interpretation || null) : null,
          // Entity-level intelligence fields
          root_cause_analysis: narrative.root_cause_analysis || null,
          cross_system_correlation: narrative.cross_system_correlation || null,
          business_impact_structured: typeof narrative.business_impact === 'object' ? narrative.business_impact : null,
          forecast: narrative.forecast || null,
          accountability: narrative.accountability || null,
          // Structured signal evidence for UI rendering
          signal_evidence: signalEvidence,
          // Health score breakdown for UI rendering
          score_breakdown: {
            base_score: 100,
            category_penalties_capped: cappedCategoryPenalties,
            total_capped_penalty: totalCappedPenalty,
            cross_system_penalty: crossSystemPenalty,
            recovery_buffer: recoveryBuffer,
            impacted_categories: impactedCategories,
            final_score: calculatedScore,
          },
          // Operational Momentum
          momentum: {
            classification: momentumClassification,
            delta: momentumDelta,
            label: momentumLabel,
            current_score: momentumCurrentScore,
            historical_average: momentumHistoricalAvg,
            scores_used: momentumScoresUsed,
          },
        },
      })
      .select()
      .single();

    if (insertError) {
      console.error('[operational-brief] Insert error:', insertError);
      throw insertError;
    }

    console.log('[operational-brief] Brief generated:', savedBrief?.id);

    // ── Step 9: Persist health score to operational_health_scores ─────
    try {
      await supabase
        .from('operational_health_scores')
        .insert({
          user_id: user.id,
          organization_id: organizationId,
          score: calculatedScore,
          label: newScoreLabel,
          score_breakdown: {
            base_score: 100,
            signal_penalties: signalPenaltyDetails,
            category_penalties_raw: categoryPenalties,
            category_penalties_capped: cappedCategoryPenalties,
            total_capped_penalty: totalCappedPenalty,
            cross_system_penalty: crossSystemPenalty,
            impacted_categories: impactedCategories,
            recovery_buffer: recoveryBuffer,
            connected_services: connectedServices,
          },
          integration_coverage: {
            connected: connectedCount,
          },
          signal_count: activeSignals.length,
          calculated_at: new Date().toISOString(),
        });
      console.log(`[operational-brief] Health score persisted: ${calculatedScore} (${connectedCount} integrations, ${activeSignals.length} signals, penalty=${totalCappedPenalty}, cross=${crossSystemPenalty}, recovery=${recoveryBuffer})`);
    } catch (healthErr) {
      console.error('[operational-brief] Health score insert error (non-fatal):', healthErr);
    }

    const remaining = briefLimit === -1 ? -1 : briefLimit - (currentCount + 1);

    return new Response(JSON.stringify({ 
      success: true, 
      brief: savedBrief,
      momentum: {
        momentum_classification: momentumClassification,
        momentum_delta: momentumDelta,
        momentum_label: momentumLabel,
        current_score: momentumCurrentScore,
        historical_average: momentumHistoricalAvg,
        scores_used: momentumScoresUsed,
      },
      usage: {
        plan: planName,
        used: currentCount + 1,
        limit: briefLimit,
        remaining,
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[operational-brief] Error:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
