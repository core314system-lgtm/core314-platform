/**
 * Failure Pattern Definitions
 *
 * Defines higher-level operational failure conditions that are detected
 * by analyzing combinations of signal categories. Each pattern specifies
 * the categories that must ALL be present for the pattern to match.
 *
 * Used by detectFailurePattern() after signal correlation.
 */

export interface FailurePattern {
  /** Unique machine-readable pattern name */
  name: string;
  /** Human-readable display label for brief titles */
  display_name: string;
  /** Signal categories that must ALL be present to trigger this pattern */
  categories: string[];
  /** Description of the operational failure condition */
  description: string;
  /** Base confidence weight (0-1) — higher = more specific pattern */
  base_confidence: number;
}

export const FAILURE_PATTERNS: FailurePattern[] = [
  {
    name: 'revenue_pipeline_stagnation',
    display_name: 'Revenue Pipeline Stagnation',
    categories: ['sales_pipeline', 'financial_activity'],
    description: 'Revenue generation activity appears stalled across sales and financial systems.',
    base_confidence: 0.82,
  },
  {
    name: 'revenue_pipeline_stagnation',
    display_name: 'Revenue Pipeline Stagnation',
    categories: ['communication', 'financial_activity'],
    description: 'Communication decline paired with financial inactivity suggests revenue pipeline stagnation.',
    base_confidence: 0.78,
  },
  {
    name: 'sales_coordination_breakdown',
    display_name: 'Sales Coordination Breakdown',
    categories: ['communication', 'sales_pipeline'],
    description: 'Sales activity and internal communication are declining simultaneously.',
    base_confidence: 0.78,
  },
  {
    name: 'business_activity_slowdown',
    display_name: 'Business Activity Slowdown',
    categories: ['communication', 'financial_activity', 'operations'],
    description: 'Multiple operational systems show reduced activity.',
    base_confidence: 0.85,
  },
  {
    name: 'operational_silence',
    display_name: 'Operational Silence',
    categories: ['communication', 'operations'],
    description: 'Operational communication and execution signals are minimal.',
    base_confidence: 0.72,
  },
  {
    name: 'customer_activity_drop',
    display_name: 'Customer Activity Drop',
    categories: ['customer_activity', 'sales_pipeline'],
    description: 'Customer engagement and pipeline activity are declining.',
    base_confidence: 0.80,
  },
  {
    name: 'delivery_pipeline_breakdown',
    display_name: 'Delivery Pipeline Breakdown',
    categories: ['project_delivery', 'communication'],
    description: 'Project delivery is stalling while team communication is declining, indicating coordination failure.',
    base_confidence: 0.82,
  },
  {
    name: 'scheduling_overload',
    display_name: 'Scheduling Overload',
    categories: ['scheduling', 'project_delivery'],
    description: 'Meeting overload combined with delivery delays suggests team capacity is consumed by coordination overhead.',
    base_confidence: 0.80,
  },
  {
    name: 'cross_platform_communication_decline',
    display_name: 'Cross-Platform Communication Decline',
    categories: ['communication', 'scheduling'],
    description: 'Both real-time communication and scheduled meetings are declining, indicating organizational disengagement.',
    base_confidence: 0.78,
  },
  {
    name: 'operational_data_gap',
    display_name: 'Operational Data Gap',
    categories: ['data_tracking', 'operations'],
    description: 'Key operational data sources are stale or inactive, reducing visibility into business performance.',
    base_confidence: 0.75,
  },
  {
    name: 'full_operational_slowdown',
    display_name: 'Full Operational Slowdown',
    categories: ['communication', 'project_delivery', 'financial_activity'],
    description: 'Communication, project delivery, and financial activity are all declining simultaneously.',
    base_confidence: 0.90,
  },
  {
    name: 'delivery_revenue_disconnect',
    display_name: 'Delivery-Revenue Disconnect',
    categories: ['project_delivery', 'financial_activity'],
    description: 'Project delivery issues paired with financial anomalies suggest deliverables are not converting to revenue.',
    base_confidence: 0.82,
  },
];
