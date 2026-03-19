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

    // Classify each signal and collect unique categories
    const classifiedSignals = activeSignals.map(s => {
      const signalData = (s.signal_data as Record<string, unknown>) || {};
      const category = getSignalCategory(s.signal_type, s.source_integration, signalData);
      return { ...s, category };
    });

    const signalCategoriesList = [...new Set(classifiedSignals.map(s => s.category))];

    // Format signals for prompt — now includes category
    const signalSummary = classifiedSignals.length > 0
      ? classifiedSignals.map(s => `- [${s.severity.toUpperCase()}] [${s.category}] ${s.description} (source: ${s.source_integration}, confidence: ${s.confidence}%)`).join('\n')
      : 'No active signals detected.';

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

      correlationContext = `\n\nCORRELATED OPERATIONAL EVENT DETECTED:
Severity: ${combinedSeverity.toUpperCase()}
Integrations involved: ${integrations.join(', ')}
Operational categories: ${categories.map(c => c.replace(/_/g, ' ')).join(', ')}
Time window: ${correlatedEvent.time_window_start} to ${correlatedEvent.time_window_end}
Correlated signals:
${ceSignals.map(s => `  - [${s.severity.toUpperCase()}] (${s.source_integration} / ${s.category.replace(/_/g, ' ')}) ${s.description}`).join('\n')}${patternContext}`;
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

INSTRUCTIONS:
- This is a CORRELATED EVENT brief — multiple signals from different integrations have been detected within the same time window
- You MUST structure the brief as an "Operational Event Detected" narrative, NOT as a list of independent signals
- Begin by describing the correlated pattern: what signals were detected, from which integrations, and what they mean together
- Explain the RELATIONSHIP between the signals — why they likely represent a single underlying operational condition
- Write as if you are a senior business analyst presenting to the CEO
- Be specific — use exact numbers from the data when available
- Do NOT invent data that isn't provided above
- Include the operational momentum trend in your interpretation — explain whether the situation is improving, stable, or worsening based on the momentum data

Generate a JSON response with these exact fields:
1. "title": ${patternTitle ? `Use EXACTLY this title: "Operational Event Detected — ${patternTitle} — ${today}". Do NOT change the pattern name.` : `Use: "Operational Event Detected — Cross-Integration Pattern — ${today}"`}
2. "event_summary": 1-2 sentence description of the correlated operational event (e.g., "A correlated operational pattern has been detected across Slack and QuickBooks, indicating potential operational disruption affecting both communication and financial workflows.")
3. "detected_signals": Array of signal descriptions in plain business English. Each entry should name the integration and the operational category (e.g., "Slack communication activity drop detected — limited message volume across monitored channels")
4. "operational_interpretation": 1-2 paragraphs explaining how the signals relate to each other and what operational condition they likely represent. This is the core analytical value — connect the dots across integrations.
5. "business_impact": 1-2 paragraphs describing the potential operational impact on the business. Be specific about what could happen if the condition persists.
6. "recommended_actions": Array of 3-5 specific, prioritized corrective recommendations. Each should address a specific aspect of the correlated event.
7. "risk_assessment": Brief risk outlook (1-2 sentences) based on the combined severity of the correlated signals.
8. "confidence": Score 0-100 based on data quality and correlation strength.`;
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

INSTRUCTIONS:
- Write as if you are a senior business analyst presenting to the CEO
- Be specific — use exact numbers from the data when available
- Do NOT invent data that isn't provided above
- IMPORTANT: If data is limited or missing, you MUST still produce a meaningful brief:
  - Explain what data sources ARE connected and what they show (even if it's minimal)
  - Explain what data sources are NOT connected and what visibility that costs the business
  - Provide reasoning about what the current state means (e.g., "No signals detected could mean operations are stable, or it could mean we lack sufficient data coverage")
  - Recommend specific next steps to improve data coverage and operational visibility
- Focus on what the data MEANS for the business, not just what the numbers are
- Explain the operational trend using the Momentum data — whether health is improving, stable, or declining compared to recent cycles
- Identify patterns across data sources when possible
- If this is a first brief with minimal data, frame it as an "Initial Operational Assessment" and focus on onboarding recommendations

Generate a JSON response with these exact fields:
1. "title": Concise brief title (e.g., "Weekly Operations Summary — ${today}" or "Initial Operational Assessment — ${today}" if data is sparse)
2. "detected_signals": Array of signal summary strings in plain business English. If no signals, include at least one entry explaining why (e.g., "No operational anomalies detected — monitoring is active across N connected systems")
3. "business_impact": 1-2 paragraph analysis of what the current operational state means for the business. Always provide reasoning, even with minimal data.
4. "recommended_actions": Array of 3-5 specific, actionable recommendations. Include data coverage improvements if integrations are missing.
5. "risk_assessment": Brief risk outlook (1-2 sentences). If data is sparse, note that limited visibility is itself a risk.
6. "confidence": Score 0-100 based on data quality and coverage. Lower if data sources are missing (e.g., 20-30 with no data, 40-60 with partial data, 70-90 with full data).`;
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
              ? 'You are Core314, an expert AI operations analyst specializing in cross-integration signal correlation. When multiple operational signals from different systems occur simultaneously, you identify the unified operational event they represent and present it as a single coherent narrative — not as independent items. Your briefs begin with "Operational Event Detected" and explain the relationship between signals before providing impact analysis and recommendations. Always return valid JSON. Never fabricate data.'
              : 'You are Core314, an expert AI operations analyst specializing in business intelligence. You produce clear, data-driven operational briefs that help leadership understand what is happening in their business. You ALWAYS produce a brief, even when data is minimal — in those cases you explain what is known, what is unknown, and what that means for the business. Always return valid JSON. Never fabricate data.',
          },
          {
            role: 'user',
            content: gptPrompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!gptResponse.ok) {
      const errText = await gptResponse.text();
      console.error('[operational-brief] OpenAI error:', gptResponse.status, errText);
      throw new Error(`OpenAI API error: ${gptResponse.status}`);
    }

    const gptData = await gptResponse.json();
    const narrative = JSON.parse(gptData.choices[0].message.content || '{}');

    // ── Step 8: Save the operational brief ─────────────────────────────
    const signalIds = activeSignals.map(s => s.id);

    // Build the brief summary — for correlated events, lead with the event summary and interpretation
    const briefSummary = hasCorrelatedEvent
      ? [
          narrative.event_summary || '',
          narrative.operational_interpretation || '',
          narrative.business_impact || '',
        ].filter(Boolean).join('\n\n')
      : narrative.business_impact || '';

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
        business_impact: narrative.business_impact || 'Insufficient data for impact analysis.',
        recommended_actions: narrative.recommended_actions || [],
        risk_assessment: narrative.risk_assessment || 'Insufficient data for risk assessment.',
        summary: briefSummary,
        confidence: narrative.confidence || 50,
        health_score: healthScore,
        signal_ids: signalIds,
        brief_type: hasCorrelatedEvent ? 'correlated_event' : 'operational',
        data_context: {
          crm: hubspotMeta,
          communication: slackMeta,
          financial: qbMeta,
          signal_count: activeSignals.length,
          signal_categories: signalCategoriesList,
          health_score: healthScore,
          health_label: healthLabel,
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
    // Calculate a health score based on available data and signal severity
    const baseScore = 100;

    // Build per-signal penalty breakdown for UI transparency
    // Calibrated severity weights aligned with real-world business conditions
    const SEVERITY_WEIGHTS: Record<string, number> = {
      'critical': 30,
      'high': 20,
      'medium': 12,
      'low': 6,
    };

    // Business-critical signal types get amplified penalties (1.8x)
    const CRITICAL_BUSINESS_SIGNALS = new Set([
      'no_financial_activity',
      'no_crm_activity',
      'revenue_pipeline_stagnation',
      'financial_inactivity',
      'overdue_invoices',
    ]);
    const CATEGORY_AMPLIFICATION = 1.5;

    const signalPenaltyDetails: { type: string; severity: string; penalty: number; source: string; description: string; amplified: boolean }[] = [];
    let rawSignalPenalties = 0;
    for (const s of activeSignals) {
      const basePenalty = SEVERITY_WEIGHTS[s.severity] || 6;
      const confidence = (s.confidence as number) || 100;
      const isCriticalBusiness = CRITICAL_BUSINESS_SIGNALS.has(s.signal_type);
      const amplifier = isCriticalBusiness ? CATEGORY_AMPLIFICATION : 1.0;
      const scaledPenalty = Math.round((basePenalty * amplifier * (confidence / 100)) * 10) / 10;
      rawSignalPenalties += scaledPenalty;
      signalPenaltyDetails.push({
        type: s.signal_type,
        severity: s.severity,
        penalty: scaledPenalty,
        source: s.source_integration || 'unknown',
        description: (s.description as string) || s.signal_type.replace(/_/g, ' '),
        amplified: isCriticalBusiness,
      });
    }

    // Multi-signal amplification: compounding penalty for widespread issues
    let multiSignalPenalty = 0;
    if (activeSignals.length >= 5) {
      multiSignalPenalty = 10;
    } else if (activeSignals.length >= 3) {
      multiSignalPenalty = 5;
    }
    const totalSignalPenalties = rawSignalPenalties + multiSignalPenalty;

    // Integration coverage: bonus capped at +3 (prevents offsetting major issues)
    const coverageBonus = Math.min(connectedCount, 3);

    // Data freshness: check how many integrations were updated within last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const freshIntegrations = (connectedIntegrations || []).filter(
      i => i.updated_at && i.updated_at > oneHourAgo
    ).length;
    const freshnessPenalty = connectedCount > 0 ? Math.max(0, (connectedCount - freshIntegrations) * 2) : 0;

    const calculatedScore = Math.max(0, Math.min(100, Math.round(
      baseScore - totalSignalPenalties + coverageBonus - freshnessPenalty
    )));
    const scoreLabel = calculatedScore >= 80 ? 'Healthy' : calculatedScore >= 60 ? 'Moderate' : calculatedScore >= 40 ? 'At Risk' : 'Critical';

    try {
      await supabase
        .from('operational_health_scores')
        .insert({
          user_id: user.id,
          organization_id: organizationId,
          score: calculatedScore,
          label: scoreLabel,
          score_breakdown: {
            base_score: baseScore,
            signal_penalties: signalPenaltyDetails,
            total_signal_deductions: Math.round(totalSignalPenalties * 10) / 10,
            multi_signal_penalty: multiSignalPenalty,
            integration_coverage: connectedCount,
            coverage_bonus: coverageBonus,
            data_freshness_bonus: -freshnessPenalty,
            fresh_integrations: freshIntegrations,
            connected_services: connectedServices,
          },
          integration_coverage: {
            connected: connectedCount,
            fresh: freshIntegrations,
          },
          signal_count: activeSignals.length,
          calculated_at: new Date().toISOString(),
        });
      console.log(`[operational-brief] Health score persisted: ${calculatedScore} (${connectedCount} integrations, ${activeSignals.length} signals, penalties=${Math.round(totalSignalPenalties * 10) / 10})`);
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
