import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

/**
 * Test Scenario Inject
 *
 * Injects synthetic integration_events into the database for controlled
 * intelligence engine validation. Data passes through the FULL pipeline:
 *   inject → signal-detector → signal-correlator → brief-generate
 *
 * NO bypass logic. Synthetic data matches real poller output format exactly.
 *
 * Scenarios:
 *   1. revenue_slowdown  — HubSpot stalled deals, QB overdue invoices, Slack drop, Calendar gaps
 *   2. cash_flow_risk    — 10 overdue invoices, no new deals, low communication
 *   3. operational_breakdown — Trello overdue, Teams inactivity, Calendar gaps, CRM inactivity
 *
 * After injection, triggers signal-detector and signal-correlator automatically.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ────────────────────────────────────────────────────────────────────────────
// Scenario data generators — output matches real poller metadata exactly
// ────────────────────────────────────────────────────────────────────────────

function generateRevenueSlowdown(now: string) {
  const stalledDealNames = [
    'Acme Corp - Enterprise License',
    'GlobalTech - Platform Migration',
    'Nexus Industries - Annual Renewal',
    'Summit Partners - Implementation',
    'Apex Solutions - Expansion Deal',
  ];

  // Individual deal objects with full entity detail for pipeline propagation
  const stalledDealDetails = [
    { id: 'deal-001', name: 'Acme Corp - Enterprise License', value: 85000, stage: 'Qualified to Buy', last_activity_date: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString(), days_in_stage: 28 },
    { id: 'deal-002', name: 'GlobalTech - Platform Migration', value: 120000, stage: 'Presentation Scheduled', last_activity_date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(), days_in_stage: 21 },
    { id: 'deal-003', name: 'Nexus Industries - Annual Renewal', value: 45000, stage: 'Qualified to Buy', last_activity_date: new Date(Date.now() - 22 * 24 * 60 * 60 * 1000).toISOString(), days_in_stage: 22 },
    { id: 'deal-004', name: 'Summit Partners - Implementation', value: 38000, stage: 'Decision Maker Bought-In', last_activity_date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), days_in_stage: 15 },
    { id: 'deal-005', name: 'Apex Solutions - Expansion Deal', value: 32000, stage: 'Appointment Scheduled', last_activity_date: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(), days_in_stage: 25 },
  ];

  const hubspotEvent = {
    service_name: 'hubspot',
    event_type: 'hubspot.crm_activity',
    source: 'test_scenario_inject',
    metadata: {
      total_deals: 12,
      deals_analyzed: 12,
      open_deals: 8,
      won_deals: 2,
      lost_deals: 2,
      stalled_deals: 5,
      stalled_deal_names: stalledDealNames,
      stalled_deal_details: stalledDealDetails,
      recent_deals_7d: 0,
      deals_stuck_over_14d: 3,
      max_stage_days: 28,
      total_pipeline_value: 485000,
      open_pipeline_value: 320000,
      avg_deal_age_days: 45,
      deals_by_stage: { 'appointmentscheduled': 2, 'qualifiedtobuy': 3, 'presentationscheduled': 2, 'decisionmakerboughtin': 1 },
      deals_by_stage_label: { 'Appointment Scheduled': 2, 'Qualified to Buy': 3, 'Presentation Scheduled': 2, 'Decision Maker Bought-In': 1 },
      total_contacts: 156,
      recent_contacts_7d: 2,
      total_companies: 34,
      pipeline_count: 1,
      pipeline_names: ['Sales Pipeline'],
      last_deal_activity: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString(),
      portal_name: 'Test Corp HubSpot',
      portal_id: 'test-scenario-001',
      poll_timestamp: now,
    },
  };

  // Individual invoice objects with full entity detail
  const overdueInvoiceDetails = [
    { id: 'INV-1042', customer_name: 'Acme Corp', amount: 12500, due_date: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString(), days_overdue: 35, status: 'overdue' },
    { id: 'INV-1038', customer_name: 'GlobalTech', amount: 8750, due_date: new Date(Date.now() - 52 * 24 * 60 * 60 * 1000).toISOString(), days_overdue: 52, status: 'overdue' },
    { id: 'INV-1035', customer_name: 'Nexus Industries', amount: 7500, due_date: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString(), days_overdue: 28, status: 'overdue' },
  ];

  const qbEvent = {
    service_name: 'quickbooks',
    event_type: 'quickbooks.financial_activity',
    source: 'test_scenario_inject',
    metadata: {
      invoice_count: 24,
      invoice_total: 187500,
      open_invoices: 8,
      paid_invoices: 16,
      overdue_invoices: 3,
      overdue_invoice_details: overdueInvoiceDetails,
      payment_count: 16,
      payment_total: 142000,
      expense_count: 38,
      expense_total: 95000,
      account_count: 12,
      bank_accounts: 3,
      credit_card_accounts: 2,
      company_name: 'Test Corp QuickBooks',
      invoice_aging: { current: 1, aging30: 1, aging60: 1, aging90Plus: 0 },
      overdue_total: 28750,
      collection_rate: 75.7,
      avg_days_to_payment: 34.2,
      data_range_days: 90,
      poll_timestamp: now,
    },
  };

  const slackEvent = {
    service_name: 'slack',
    event_type: 'slack.workspace_activity',
    source: 'test_scenario_inject',
    metadata: {
      message_count: 3,
      active_channels: 4,
      total_channels: 8,
      channels_analyzed: 4,
      unique_users: 2,
      avg_response_time_minutes: 45.2,
      channel_activity: [
        { name: 'general', id: 'C-TEST-001', messages: 1 },
        { name: 'sales', id: 'C-TEST-002', messages: 1 },
        { name: 'support', id: 'C-TEST-003', messages: 1 },
        { name: 'engineering', id: 'C-TEST-004', messages: 0 },
      ],
      team_id: 'T-TEST-001',
      team_name: 'Test Corp Slack',
      channels_sampled: 4,
      ingestion_window_days: 90,
      private_channels_accessible: false,
      scope_warning: null,
      data_complete: true,
      poll_timestamp: now,
    },
  };

  const gcalEvent = {
    service_name: 'google_calendar',
    event_type: 'google_calendar.weekly_summary',
    source: 'test_scenario_inject',
    metadata: {
      total_events: 2,
      meetings_with_attendees: 1,
      total_meeting_hours: 1.5,
      solo_events: 1,
      all_day_events: 0,
      poll_timestamp: now,
    },
  };

  return [hubspotEvent, qbEvent, slackEvent, gcalEvent];
}

function generateCashFlowRisk(now: string) {
  const stalledDealDetails = [
    { id: 'deal-010', name: 'Meridian Group - Pilot', value: 65000, stage: 'Qualified to Buy', last_activity_date: new Date(Date.now() - 22 * 24 * 60 * 60 * 1000).toISOString(), days_in_stage: 35 },
    { id: 'deal-011', name: 'DataFlow Inc - Integration', value: 55000, stage: 'Presentation Scheduled', last_activity_date: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString(), days_in_stage: 28 },
    { id: 'deal-012', name: 'CloudBase - Setup', value: 45000, stage: 'Qualified to Buy', last_activity_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), days_in_stage: 30 },
  ];

  const hubspotEvent = {
    service_name: 'hubspot',
    event_type: 'hubspot.crm_activity',
    source: 'test_scenario_inject',
    metadata: {
      total_deals: 6,
      deals_analyzed: 6,
      open_deals: 4,
      won_deals: 1,
      lost_deals: 1,
      stalled_deals: 3,
      stalled_deal_names: ['Meridian Group - Pilot', 'DataFlow Inc - Integration', 'CloudBase - Setup'],
      stalled_deal_details: stalledDealDetails,
      recent_deals_7d: 0,
      deals_stuck_over_14d: 2,
      max_stage_days: 35,
      total_pipeline_value: 210000,
      open_pipeline_value: 165000,
      avg_deal_age_days: 52,
      deals_by_stage: { 'qualifiedtobuy': 2, 'presentationscheduled': 1, 'decisionmakerboughtin': 1 },
      deals_by_stage_label: { 'Qualified to Buy': 2, 'Presentation Scheduled': 1, 'Decision Maker Bought-In': 1 },
      total_contacts: 89,
      recent_contacts_7d: 0,
      total_companies: 18,
      pipeline_count: 1,
      pipeline_names: ['Sales Pipeline'],
      last_deal_activity: new Date(Date.now() - 22 * 24 * 60 * 60 * 1000).toISOString(),
      portal_name: 'Test Corp HubSpot',
      portal_id: 'test-scenario-002',
      poll_timestamp: now,
    },
  };

  const overdueInvoiceDetails = [
    { id: 'INV-2001', customer_name: 'Meridian Group', amount: 15000, due_date: new Date(Date.now() - 95 * 24 * 60 * 60 * 1000).toISOString(), days_overdue: 95, status: 'overdue' },
    { id: 'INV-2003', customer_name: 'DataFlow Inc', amount: 12000, due_date: new Date(Date.now() - 92 * 24 * 60 * 60 * 1000).toISOString(), days_overdue: 92, status: 'overdue' },
    { id: 'INV-2008', customer_name: 'CloudBase', amount: 9500, due_date: new Date(Date.now() - 68 * 24 * 60 * 60 * 1000).toISOString(), days_overdue: 68, status: 'overdue' },
    { id: 'INV-2012', customer_name: 'Vertex Solutions', amount: 8200, due_date: new Date(Date.now() - 55 * 24 * 60 * 60 * 1000).toISOString(), days_overdue: 55, status: 'overdue' },
    { id: 'INV-2015', customer_name: 'Quantum Labs', amount: 7800, due_date: new Date(Date.now() - 48 * 24 * 60 * 60 * 1000).toISOString(), days_overdue: 48, status: 'overdue' },
    { id: 'INV-2019', customer_name: 'Atlas Corp', amount: 6500, due_date: new Date(Date.now() - 42 * 24 * 60 * 60 * 1000).toISOString(), days_overdue: 42, status: 'overdue' },
    { id: 'INV-2022', customer_name: 'Pinnacle Tech', amount: 8000, due_date: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString(), days_overdue: 35, status: 'overdue' },
    { id: 'INV-2025', customer_name: 'Nova Systems', amount: 5500, due_date: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString(), days_overdue: 28, status: 'overdue' },
    { id: 'INV-2028', customer_name: 'Crestline Partners', amount: 9000, due_date: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString(), days_overdue: 18, status: 'overdue' },
    { id: 'INV-2031', customer_name: 'Horizon Dynamics', amount: 6000, due_date: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(), days_overdue: 12, status: 'overdue' },
  ];

  const qbEvent = {
    service_name: 'quickbooks',
    event_type: 'quickbooks.financial_activity',
    source: 'test_scenario_inject',
    metadata: {
      invoice_count: 35,
      invoice_total: 312000,
      open_invoices: 18,
      paid_invoices: 17,
      overdue_invoices: 10,
      overdue_invoice_details: overdueInvoiceDetails,
      payment_count: 17,
      payment_total: 156000,
      expense_count: 52,
      expense_total: 134000,
      account_count: 10,
      bank_accounts: 2,
      credit_card_accounts: 3,
      company_name: 'Test Corp QuickBooks',
      invoice_aging: { current: 3, aging30: 3, aging60: 2, aging90Plus: 2 },
      overdue_total: 87500,
      collection_rate: 50.0,
      avg_days_to_payment: 48.5,
      data_range_days: 90,
      poll_timestamp: now,
    },
  };

  const slackEvent = {
    service_name: 'slack',
    event_type: 'slack.workspace_activity',
    source: 'test_scenario_inject',
    metadata: {
      message_count: 2,
      active_channels: 3,
      total_channels: 6,
      channels_analyzed: 3,
      unique_users: 1,
      avg_response_time_minutes: 62.8,
      channel_activity: [
        { name: 'general', id: 'C-TEST-010', messages: 1 },
        { name: 'finance', id: 'C-TEST-011', messages: 1 },
        { name: 'operations', id: 'C-TEST-012', messages: 0 },
      ],
      team_id: 'T-TEST-002',
      team_name: 'Test Corp Slack',
      channels_sampled: 3,
      ingestion_window_days: 90,
      private_channels_accessible: false,
      scope_warning: null,
      data_complete: true,
      poll_timestamp: now,
    },
  };

  return [hubspotEvent, qbEvent, slackEvent];
}

function generateOperationalBreakdown(now: string) {
  const overdueCardDetails = [
    { id: 'card-001', name: 'Q2 Feature Release', board: 'Product Roadmap', due_date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(), days_overdue: 14, list: 'Doing' },
    { id: 'card-002', name: 'API Documentation Update', board: 'Engineering Sprint', due_date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), days_overdue: 10, list: 'Doing' },
    { id: 'card-003', name: 'Customer Onboarding Flow', board: 'Product Roadmap', due_date: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(), days_overdue: 8, list: 'Todo' },
    { id: 'card-004', name: 'Email Campaign Launch', board: 'Marketing Campaigns', due_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), days_overdue: 7, list: 'Doing' },
    { id: 'card-005', name: 'Security Audit Remediation', board: 'Engineering Sprint', due_date: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(), days_overdue: 12, list: 'Doing' },
    { id: 'card-006', name: 'Partner Integration Testing', board: 'Engineering Sprint', due_date: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(), days_overdue: 6, list: 'Todo' },
    { id: 'card-007', name: 'Quarterly Business Review Prep', board: 'Operations', due_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), days_overdue: 5, list: 'Todo' },
    { id: 'card-008', name: 'Social Media Content Calendar', board: 'Marketing Campaigns', due_date: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(), days_overdue: 9, list: 'Todo' },
  ];

  const trelloEvent = {
    service_name: 'trello',
    event_type: 'trello.board_summary',
    source: 'test_scenario_inject',
    metadata: {
      total_boards: 4,
      total_cards: 42,
      done_cards: 0,
      overdue_cards: 15,
      overdue_card_details: overdueCardDetails,
      lists_by_board: {
        'Product Roadmap': { todo: 8, doing: 5, done: 0 },
        'Marketing Campaigns': { todo: 6, doing: 3, done: 0 },
        'Engineering Sprint': { todo: 10, doing: 6, done: 0 },
        'Operations': { todo: 2, doing: 2, done: 0 },
      },
      poll_timestamp: now,
    },
  };

  const teamsEvent = {
    service_name: 'microsoft_teams',
    event_type: 'teams.workspace_summary',
    source: 'test_scenario_inject',
    metadata: {
      total_teams: 3,
      total_channels: 0,
      team_names: ['Engineering', 'Sales', 'Operations'],
      poll_timestamp: now,
    },
  };

  const gcalEvent = {
    service_name: 'google_calendar',
    event_type: 'google_calendar.weekly_summary',
    source: 'test_scenario_inject',
    metadata: {
      total_events: 0,
      meetings_with_attendees: 0,
      total_meeting_hours: 0,
      solo_events: 0,
      all_day_events: 0,
      poll_timestamp: now,
    },
  };

  const hubspotEvent = {
    service_name: 'hubspot',
    event_type: 'hubspot.crm_activity',
    source: 'test_scenario_inject',
    metadata: {
      total_deals: 3,
      deals_analyzed: 3,
      open_deals: 2,
      won_deals: 0,
      lost_deals: 1,
      stalled_deals: 2,
      stalled_deal_names: ['Legacy Client - Support Contract', 'New Prospect - Discovery'],
      stalled_deal_details: [
        { id: 'deal-020', name: 'Legacy Client - Support Contract', value: 25000, stage: 'Appointment Scheduled', last_activity_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), days_in_stage: 42 },
        { id: 'deal-021', name: 'New Prospect - Discovery', value: 30000, stage: 'Qualified to Buy', last_activity_date: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString(), days_in_stage: 35 },
      ],
      recent_deals_7d: 0,
      deals_stuck_over_14d: 2,
      max_stage_days: 42,
      total_pipeline_value: 75000,
      open_pipeline_value: 55000,
      avg_deal_age_days: 60,
      deals_by_stage: { 'appointmentscheduled': 1, 'qualifiedtobuy': 1 },
      deals_by_stage_label: { 'Appointment Scheduled': 1, 'Qualified to Buy': 1 },
      total_contacts: 45,
      recent_contacts_7d: 0,
      total_companies: 12,
      pipeline_count: 1,
      pipeline_names: ['Sales Pipeline'],
      last_deal_activity: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      portal_name: 'Test Corp HubSpot',
      portal_id: 'test-scenario-003',
      poll_timestamp: now,
    },
  };

  return [trelloEvent, teamsEvent, gcalEvent, hubspotEvent];
}

// ────────────────────────────────────────────────────────────────────────────
// Main handler
// ────────────────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth: require valid user session
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
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

    // Parse request body
    let scenario = 'revenue_slowdown';
    try {
      const body = await req.json();
      if (body.scenario) scenario = body.scenario;
    } catch {
      // default scenario
    }

    const validScenarios = ['revenue_slowdown', 'cash_flow_risk', 'operational_breakdown'];
    if (!validScenarios.includes(scenario)) {
      return new Response(JSON.stringify({
        error: `Invalid scenario: ${scenario}. Valid: ${validScenarios.join(', ')}`,
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log(`[test-scenario-inject] Injecting scenario: ${scenario} for user: ${user.id}`);

    const now = new Date().toISOString();

    // Generate scenario events
    let events: ReturnType<typeof generateRevenueSlowdown> = [];
    switch (scenario) {
      case 'revenue_slowdown':
        events = generateRevenueSlowdown(now);
        break;
      case 'cash_flow_risk':
        events = generateCashFlowRisk(now);
        break;
      case 'operational_breakdown':
        events = generateOperationalBreakdown(now);
        break;
    }

    // Clean up previous test scenario data for this user (to avoid stacking)
    const { error: cleanupError } = await supabase
      .from('integration_events')
      .delete()
      .eq('user_id', user.id)
      .eq('source', 'test_scenario_inject');

    if (cleanupError) {
      console.warn('[test-scenario-inject] Cleanup warning:', cleanupError.message);
    }

    // Also deactivate any previous test signals
    const { error: signalCleanupError } = await supabase
      .from('operational_signals')
      .update({ is_active: false })
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (signalCleanupError) {
      console.warn('[test-scenario-inject] Signal cleanup warning:', signalCleanupError.message);
    }

    // We need a user_integration_id and integration_registry_id for each service.
    // For test mode, we create placeholder user_integrations if they don't exist.
    // First, get the integration registry entries
    const { data: registryEntries } = await supabase
      .from('integrations_master')
      .select('id, integration_type, integration_name');

    const registryMap: Record<string, string> = {};
    for (const entry of (registryEntries || [])) {
      const key = (entry.integration_type as string).toLowerCase();
      registryMap[key] = entry.id as string;
    }

    // Get or create user_integrations for each service in the scenario
    const serviceNames = [...new Set(events.map(e => e.service_name))];
    const userIntegrationMap: Record<string, string> = {};
    const registryIdMap: Record<string, string> = {};

    for (const serviceName of serviceNames) {
      // Map service_name to integration_type
      const intType = serviceName === 'microsoft_teams' ? 'microsoft_teams'
        : serviceName === 'google_calendar' ? 'google_calendar'
        : serviceName;

      const registryId = registryMap[intType];
      if (!registryId) {
        console.warn(`[test-scenario-inject] No registry entry for ${intType}, skipping`);
        continue;
      }

      registryIdMap[serviceName] = registryId;

      // Check if user already has this integration
      const { data: existing } = await supabase
        .from('user_integrations')
        .select('id')
        .eq('user_id', user.id)
        .eq('integration_id', registryId)
        .eq('status', 'active')
        .limit(1);

      if (existing && existing.length > 0) {
        userIntegrationMap[serviceName] = existing[0].id;
      } else {
        // Create a temporary test integration entry
        const { data: newInt, error: createError } = await supabase
          .from('user_integrations')
          .insert({
            user_id: user.id,
            integration_id: registryId,
            provider_id: `test-scenario-${serviceName}`,
            status: 'active',
            config: { test_mode: true, scenario },
          })
          .select('id')
          .single();

        if (createError || !newInt) {
          console.error(`[test-scenario-inject] Error creating integration for ${serviceName}:`, createError);
          continue;
        }
        userIntegrationMap[serviceName] = newInt.id;
      }
    }

    // Insert synthetic integration_events
    let eventsInserted = 0;
    const insertErrors: string[] = [];

    for (const event of events) {
      const userIntId = userIntegrationMap[event.service_name];
      const regId = registryIdMap[event.service_name];

      if (!userIntId || !regId) {
        insertErrors.push(`Missing integration mapping for ${event.service_name}`);
        continue;
      }

      const { error: insertError } = await supabase
        .from('integration_events')
        .insert({
          user_id: user.id,
          user_integration_id: userIntId,
          integration_registry_id: regId,
          service_name: event.service_name,
          event_type: event.event_type,
          occurred_at: now,
          source: event.source,
          metadata: event.metadata,
        });

      if (insertError) {
        console.error(`[test-scenario-inject] Insert error for ${event.service_name}:`, insertError);
        insertErrors.push(`${event.service_name}: ${insertError.message}`);
      } else {
        eventsInserted++;
      }
    }

    console.log(`[test-scenario-inject] Inserted ${eventsInserted} events for scenario: ${scenario}`);

    // ── Step 2: Trigger signal-detector through the full pipeline ──────
    let signalsCreated = 0;
    let signalsDeactivated = 0;
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
      const svcKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

      const detectorResp = await fetch(
        `${supabaseUrl}/functions/v1/signal-detector`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${svcKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (detectorResp.ok) {
        const detectorResult = await detectorResp.json();
        signalsCreated = detectorResult.signals_created ?? 0;
        signalsDeactivated = detectorResult.signals_deactivated ?? 0;
        console.log('[test-scenario-inject] Signal detector result:', detectorResult);
      } else {
        console.error('[test-scenario-inject] Signal detector failed:', detectorResp.status);
      }
    } catch (detectorErr) {
      console.error('[test-scenario-inject] Signal detector error:', detectorErr);
    }

    // ── Step 3: Trigger signal-correlator ────────────────────────────
    let correlatedEvents = 0;
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
        const correlatorResult = await correlatorResp.json();
        correlatedEvents = correlatorResult.correlated_events ?? 0;
        console.log('[test-scenario-inject] Signal correlator result:', correlatorResult);
      } else {
        console.error('[test-scenario-inject] Signal correlator failed:', correlatorResp.status);
      }
    } catch (correlatorErr) {
      console.error('[test-scenario-inject] Signal correlator error:', correlatorErr);
    }

    // Store test mode flag in user's most recent brief context
    // This allows the UI to detect test mode
    await supabase
      .from('user_integrations')
      .update({
        config: { test_mode: true, scenario, injected_at: now },
      })
      .eq('user_id', user.id)
      .eq('provider_id', `test-scenario-${serviceNames[0] || 'hubspot'}`);

    return new Response(JSON.stringify({
      success: true,
      scenario,
      events_injected: eventsInserted,
      signals_created: signalsCreated,
      signals_deactivated: signalsDeactivated,
      correlated_events: correlatedEvents,
      services: serviceNames,
      insert_errors: insertErrors.length > 0 ? insertErrors : undefined,
      message: `Scenario "${scenario}" injected. ${eventsInserted} events → ${signalsCreated} signals → ${correlatedEvents} correlations. Generate a brief to see the full intelligence output.`,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[test-scenario-inject] Fatal error:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
