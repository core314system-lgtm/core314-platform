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
];
