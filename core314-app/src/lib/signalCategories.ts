/**
 * Signal Classification Categories
 *
 * Unified operational signal categories shared across all integrations.
 * Used by classifySignal() to standardize signal metadata before
 * storage, correlation, and brief generation.
 */

export const SIGNAL_CATEGORIES = {
  COMMUNICATION: 'communication',
  FINANCIAL_ACTIVITY: 'financial_activity',
  SALES_PIPELINE: 'sales_pipeline',
  CUSTOMER_ACTIVITY: 'customer_activity',
  OPERATIONS: 'operations',
  SYSTEM_HEALTH: 'system_health',
} as const;

export type SignalCategory = (typeof SIGNAL_CATEGORIES)[keyof typeof SIGNAL_CATEGORIES];
