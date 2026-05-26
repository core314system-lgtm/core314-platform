/**
 * Normalizes an integration name to a canonical key for deduplication.
 *
 * Rules:
 * - Lowercase
 * - Trim whitespace
 * - Remove spaces, dashes, underscores
 * - Remove special characters
 *
 * Examples:
 * "Quick Books" → "quickbooks"
 * "quick-books" → "quickbooks"
 * "QuickBooks"  → "quickbooks"
 * "Slack"       → "slack"
 * "HubSpot"     → "hubspot"
 */
export function normalizeIntegrationName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '');
}
