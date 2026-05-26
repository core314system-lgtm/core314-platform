/**
 * Failure Pattern Detection Helper
 *
 * Compares detected signal categories against known failure pattern
 * definitions and returns the highest-confidence matching pattern.
 *
 * Runs after signal correlation and before brief generation.
 * Backwards compatible: returns null if no pattern matches.
 */

import { FAILURE_PATTERNS, type FailurePattern } from './failure-patterns.ts';

export interface DetectedPattern {
  /** Machine-readable pattern name */
  pattern: string;
  /** Human-readable display name for brief titles */
  display_name: string;
  /** Confidence score 0-1 */
  confidence: number;
  /** Description of the failure condition */
  description: string;
  /** Categories that matched this pattern */
  matched_categories: string[];
}

/**
 * Normalize category names to canonical form.
 * Handles common variants that may appear in signal_data or from
 * older versions of the classification layer.
 */
const CATEGORY_ALIASES: Record<string, string> = {
  // Exact canonical names (identity mapping for validation)
  'communication': 'communication',
  'financial_activity': 'financial_activity',
  'sales_pipeline': 'sales_pipeline',
  'customer_activity': 'customer_activity',
  'operations': 'operations',
  'system_health': 'system_health',
  // Common variants / typos
  'communication_activity': 'communication',
  'comm': 'communication',
  'finance_activity': 'financial_activity',
  'finance': 'financial_activity',
  'financial': 'financial_activity',
  'sales': 'sales_pipeline',
  'pipeline': 'sales_pipeline',
  'customer': 'customer_activity',
  'system': 'system_health',
  'health': 'system_health',
};

function normalizeCategory(category: string): string {
  const lower = category.trim().toLowerCase();
  return CATEGORY_ALIASES[lower] || lower;
}

/**
 * Detect the highest-confidence failure pattern from a list of signal categories.
 *
 * Logic:
 * 1. Normalize all category names to canonical form.
 * 2. For each defined pattern, check if ALL required categories exist in the signal list.
 * 3. Compute confidence = base_confidence * coverage_ratio * category_bonus.
 *    - coverage_ratio: how many pattern categories matched vs total signal categories
 *    - category_bonus: patterns requiring more categories score slightly higher
 * 4. Return the highest confidence match, or null if no pattern matches.
 *
 * @param signalCategories - Array of unique signal category strings
 * @returns The detected pattern with confidence, or null
 */
export function detectFailurePattern(signalCategories: string[]): DetectedPattern | null {
  console.log(`[detectFailurePattern] Raw input categories: [${signalCategories?.join(', ') || 'empty'}]`);

  // Normalize categories before matching
  const normalized = (signalCategories || []).map(c => normalizeCategory(c));
  const hadChanges = signalCategories?.some((c, i) => c !== normalized[i]);
  if (hadChanges) {
    console.log(`[detectFailurePattern] Normalized categories: [${normalized.join(', ')}]`);
  }

  if (!normalized || normalized.length === 0) {
    console.log('[detectFailurePattern] No categories provided, returning null');
    return null;
  }

  // Deduplicate after normalization (different raw names may normalize to the same canonical name)
  const uniqueNormalized = [...new Set(normalized)];
  const categorySet = new Set(uniqueNormalized);
  console.log(`[detectFailurePattern] Matching against ${FAILURE_PATTERNS.length} pattern definitions with categories: [${uniqueNormalized.join(', ')}]`);

  const matches: Array<{ pattern: FailurePattern; confidence: number }> = [];

  for (const pattern of FAILURE_PATTERNS) {
    // Check if ALL required categories are present
    const allPresent = pattern.categories.every(c => categorySet.has(c));
    const missing = pattern.categories.filter(c => !categorySet.has(c));
    console.log(`[detectFailurePattern] Pattern "${pattern.name}" [${pattern.categories.join(', ')}] → ${allPresent ? 'MATCH ✓' : `no match (missing: ${missing.join(', ')})`}`);
    if (!allPresent) continue;

    // Compute confidence
    // - Start with base_confidence
    // - Bonus for patterns that require more categories (more specific = higher value)
    const categoryBonus = Math.min(1.0, 0.9 + pattern.categories.length * 0.03);
    // - Coverage ratio: what fraction of detected categories does this pattern explain
    const coverageRatio = pattern.categories.length / uniqueNormalized.length;
    const confidence = Math.min(1.0, pattern.base_confidence * categoryBonus * (0.7 + 0.3 * coverageRatio));

    matches.push({ pattern, confidence });
  }

  console.log(`[detectFailurePattern] Total matches: ${matches.length}`);

  if (matches.length === 0) {
    console.log(`[detectFailurePattern] No patterns matched for [${uniqueNormalized.join(', ')}]. Available patterns: ${FAILURE_PATTERNS.map(p => `${p.name}=[${p.categories.join(',')}]`).join('; ')}`);
    return null;
  }

  // Sort by confidence descending, return the best match
  matches.sort((a, b) => b.confidence - a.confidence);
  const best = matches[0];

  const result = {
    pattern: best.pattern.name,
    display_name: best.pattern.display_name,
    confidence: Math.round(best.confidence * 100) / 100,
    description: best.pattern.description,
    matched_categories: best.pattern.categories,
  };
  console.log(`[detectFailurePattern] Best match: pattern=${result.pattern}, display_name=${result.display_name}, confidence=${result.confidence}`);
  return result;
}
