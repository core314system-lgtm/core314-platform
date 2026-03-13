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
 * Detect the highest-confidence failure pattern from a list of signal categories.
 *
 * Logic:
 * 1. For each defined pattern, check if ALL required categories exist in the signal list.
 * 2. Compute confidence = base_confidence * coverage_ratio * category_bonus.
 *    - coverage_ratio: how many pattern categories matched vs total signal categories
 *    - category_bonus: patterns requiring more categories score slightly higher
 * 3. Return the highest confidence match, or null if no pattern matches.
 *
 * @param signalCategories - Array of unique signal category strings
 * @returns The detected pattern with confidence, or null
 */
export function detectFailurePattern(signalCategories: string[]): DetectedPattern | null {
  if (!signalCategories || signalCategories.length === 0) {
    return null;
  }

  const categorySet = new Set(signalCategories);
  const matches: Array<{ pattern: FailurePattern; confidence: number }> = [];

  for (const pattern of FAILURE_PATTERNS) {
    // Check if ALL required categories are present
    const allPresent = pattern.categories.every(c => categorySet.has(c));
    if (!allPresent) continue;

    // Compute confidence
    // - Start with base_confidence
    // - Bonus for patterns that require more categories (more specific = higher value)
    const categoryBonus = Math.min(1.0, 0.9 + pattern.categories.length * 0.03);
    // - Coverage ratio: what fraction of detected categories does this pattern explain
    const coverageRatio = pattern.categories.length / signalCategories.length;
    const confidence = Math.min(1.0, pattern.base_confidence * categoryBonus * (0.7 + 0.3 * coverageRatio));

    matches.push({ pattern, confidence });
  }

  if (matches.length === 0) {
    return null;
  }

  // Sort by confidence descending, return the best match
  matches.sort((a, b) => b.confidence - a.confidence);
  const best = matches[0];

  return {
    pattern: best.pattern.name,
    display_name: best.pattern.display_name,
    confidence: Math.round(best.confidence * 100) / 100,
    description: best.pattern.description,
    matched_categories: best.pattern.categories,
  };
}
