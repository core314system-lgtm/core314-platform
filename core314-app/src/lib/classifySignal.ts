/**
 * Signal Classification Helper
 *
 * Maps signal_type + source_integration to a unified operational category.
 * Used by signal-detector to enrich signal_data with a `category` field
 * and by the brief generator to provide GPT with category context.
 *
 * Backwards-compatible: returns "operations" for unrecognized signals.
 */

import { SIGNAL_CATEGORIES, type SignalCategory } from './signalCategories';

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
