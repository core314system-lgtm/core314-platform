/**
 * Signal Classification — Shared Deno Module
 *
 * Unified operational signal categories and classification helper.
 * Used by signal-detector, signal-correlator, and operational-brief-generate
 * to standardize signal metadata across all integrations.
 *
 * Backwards-compatible: returns "operations" for unrecognized signals.
 */

export const SIGNAL_CATEGORIES = {
  COMMUNICATION: 'communication',
  FINANCIAL_ACTIVITY: 'financial_activity',
  SALES_PIPELINE: 'sales_pipeline',
  CUSTOMER_ACTIVITY: 'customer_activity',
  OPERATIONS: 'operations',
  SYSTEM_HEALTH: 'system_health',
  PROJECT_DELIVERY: 'project_delivery',
  SCHEDULING: 'scheduling',
  DATA_TRACKING: 'data_tracking',
} as const;

export type SignalCategory = (typeof SIGNAL_CATEGORIES)[keyof typeof SIGNAL_CATEGORIES];

/**
 * Integration-specific signal type → category mapping.
 * Keys are `sourceIntegration::signalType` for exact matches.
 */
const EXACT_MAPPINGS: Record<string, SignalCategory> = {
  // Slack signals → COMMUNICATION
  'slack::low_communication': SIGNAL_CATEGORIES.COMMUNICATION,
  'slack::communication_spike': SIGNAL_CATEGORIES.COMMUNICATION,
  'slack::slow_response': SIGNAL_CATEGORIES.COMMUNICATION,
  'slack::low_engagement': SIGNAL_CATEGORIES.COMMUNICATION,
  'slack::message_volume_drop': SIGNAL_CATEGORIES.COMMUNICATION,
  'slack::channel_activity_drop': SIGNAL_CATEGORIES.COMMUNICATION,

  // QuickBooks signals → FINANCIAL_ACTIVITY
  'quickbooks::overdue_invoices': SIGNAL_CATEGORIES.FINANCIAL_ACTIVITY,
  'quickbooks::low_collection_rate': SIGNAL_CATEGORIES.FINANCIAL_ACTIVITY,
  'quickbooks::high_expense_ratio': SIGNAL_CATEGORIES.FINANCIAL_ACTIVITY,
  'quickbooks::revenue_decline': SIGNAL_CATEGORIES.FINANCIAL_ACTIVITY,
  'quickbooks::no_financial_activity': SIGNAL_CATEGORIES.FINANCIAL_ACTIVITY,
  'quickbooks::invoice_inactivity': SIGNAL_CATEGORIES.FINANCIAL_ACTIVITY,
  'quickbooks::payment_inactivity': SIGNAL_CATEGORIES.FINANCIAL_ACTIVITY,
  'quickbooks::expense_inactivity': SIGNAL_CATEGORIES.FINANCIAL_ACTIVITY,

  // HubSpot signals → SALES_PIPELINE
  'hubspot::stalled_deals': SIGNAL_CATEGORIES.SALES_PIPELINE,
  'hubspot::deal_velocity_decline': SIGNAL_CATEGORIES.SALES_PIPELINE,
  'hubspot::no_crm_activity': SIGNAL_CATEGORIES.SALES_PIPELINE,
  'hubspot::deal_pipeline_stall': SIGNAL_CATEGORIES.SALES_PIPELINE,
  'hubspot::lead_activity_drop': SIGNAL_CATEGORIES.SALES_PIPELINE,

  // Google Calendar signals → SCHEDULING
  'google_calendar::meeting_overload': SIGNAL_CATEGORIES.SCHEDULING,
  'google_calendar::scheduling_conflicts': SIGNAL_CATEGORIES.SCHEDULING,
  'google_calendar::low_meeting_activity': SIGNAL_CATEGORIES.SCHEDULING,
  'google_calendar::after_hours_meetings': SIGNAL_CATEGORIES.SCHEDULING,

  // Gmail signals → COMMUNICATION
  'gmail::email_volume_spike': SIGNAL_CATEGORIES.COMMUNICATION,
  'gmail::low_email_activity': SIGNAL_CATEGORIES.COMMUNICATION,
  'gmail::low_response_ratio': SIGNAL_CATEGORIES.COMMUNICATION,
  'gmail::email_backlog': SIGNAL_CATEGORIES.COMMUNICATION,

  // Jira signals → PROJECT_DELIVERY
  'jira::sprint_at_risk': SIGNAL_CATEGORIES.PROJECT_DELIVERY,
  'jira::blocker_accumulation': SIGNAL_CATEGORIES.PROJECT_DELIVERY,
  'jira::low_velocity': SIGNAL_CATEGORIES.PROJECT_DELIVERY,
  'jira::overdue_issues': SIGNAL_CATEGORIES.PROJECT_DELIVERY,
  'jira::stalled_work': SIGNAL_CATEGORIES.PROJECT_DELIVERY,
  'jira::workload_imbalance': SIGNAL_CATEGORIES.PROJECT_DELIVERY,
  'jira::delivery_risk': SIGNAL_CATEGORIES.PROJECT_DELIVERY,

  // Trello signals → PROJECT_DELIVERY
  'trello::stalled_cards': SIGNAL_CATEGORIES.PROJECT_DELIVERY,
  'trello::board_inactivity': SIGNAL_CATEGORIES.PROJECT_DELIVERY,
  'trello::overdue_cards': SIGNAL_CATEGORIES.PROJECT_DELIVERY,

  // Microsoft Teams signals → COMMUNICATION
  'microsoft_teams::low_team_activity': SIGNAL_CATEGORIES.COMMUNICATION,
  'microsoft_teams::meeting_overload': SIGNAL_CATEGORIES.SCHEDULING,
  'microsoft_teams::channel_inactivity': SIGNAL_CATEGORIES.COMMUNICATION,

  // Google Sheets signals → DATA_TRACKING
  'google_sheets::stale_spreadsheets': SIGNAL_CATEGORIES.DATA_TRACKING,
  'google_sheets::no_sheet_activity': SIGNAL_CATEGORIES.DATA_TRACKING,

  // Asana signals → PROJECT_DELIVERY
  'asana::overdue_tasks': SIGNAL_CATEGORIES.PROJECT_DELIVERY,
  'asana::low_completion_rate': SIGNAL_CATEGORIES.PROJECT_DELIVERY,
  'asana::workload_imbalance': SIGNAL_CATEGORIES.PROJECT_DELIVERY,
  'asana::milestone_at_risk': SIGNAL_CATEGORIES.PROJECT_DELIVERY,
};

/**
 * Fallback pattern-based rules when no exact mapping is found.
 * Checked in order; first match wins.
 */
const PATTERN_RULES: Array<{ pattern: RegExp; category: SignalCategory }> = [
  { pattern: /communication|message|chat|channel|slack|response_time/i, category: SIGNAL_CATEGORIES.COMMUNICATION },
  { pattern: /invoice|payment|expense|collection|financial|revenue|overdue|billing/i, category: SIGNAL_CATEGORIES.FINANCIAL_ACTIVITY },
  { pattern: /deal|pipeline|sales|opportunity|stalled|velocity|lead|crm/i, category: SIGNAL_CATEGORIES.SALES_PIPELINE },
  { pattern: /customer|contact|ticket|support|churn/i, category: SIGNAL_CATEGORIES.CUSTOMER_ACTIVITY },
  { pattern: /health|uptime|error|failure|outage|integration_inactive|connection|oauth|token/i, category: SIGNAL_CATEGORIES.SYSTEM_HEALTH },
  { pattern: /sprint|velocity|blocker|overdue_issue|jira|delivery|milestone/i, category: SIGNAL_CATEGORIES.PROJECT_DELIVERY },
  { pattern: /meeting|calendar|schedule|conflict|after_hours/i, category: SIGNAL_CATEGORIES.SCHEDULING },
  { pattern: /spreadsheet|sheet|stale|data_tracking/i, category: SIGNAL_CATEGORIES.DATA_TRACKING },
];

/**
 * Classify a signal into a unified operational category.
 *
 * @param signalType - The signal_type string (e.g. "overdue_invoices")
 * @param sourceIntegration - The source_integration string (e.g. "quickbooks")
 * @returns The classified SignalCategory (defaults to "operations")
 */
export function classifySignal(signalType: string, sourceIntegration: string): SignalCategory {
  // 1. Try exact mapping
  const key = `${sourceIntegration}::${signalType}`;
  if (key in EXACT_MAPPINGS) {
    return EXACT_MAPPINGS[key];
  }

  // 2. Try pattern-based rules against signal_type
  for (const { pattern, category } of PATTERN_RULES) {
    if (pattern.test(signalType)) {
      return category;
    }
  }

  // 3. Default fallback
  return SIGNAL_CATEGORIES.OPERATIONS;
}

/**
 * Extract category from signal_data if it was previously classified,
 * or classify it now. This provides backwards compatibility — older
 * signals without a category field will be classified on the fly.
 *
 * @param signalType - The signal_type string
 * @param sourceIntegration - The source_integration string
 * @param signalData - The signal_data JSON object
 * @returns The signal category
 */
export function getSignalCategory(
  signalType: string,
  sourceIntegration: string,
  signalData: Record<string, unknown>,
): SignalCategory {
  // If signal_data already has a category, use it
  const existingCategory = signalData?.category as string | undefined;
  if (existingCategory && Object.values(SIGNAL_CATEGORIES).includes(existingCategory as SignalCategory)) {
    return existingCategory as SignalCategory;
  }

  // Otherwise classify on the fly
  return classifySignal(signalType, sourceIntegration);
}
