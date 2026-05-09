/**
 * Shared entity hint utilities for integration poll functions.
 *
 * Usage in any poll function:
 *
 *   import { personHint, companyHint, emptyHints } from '../_shared/entity-hints.ts';
 *
 *   metadata: {
 *     ...otherMetrics,
 *     entity_hints: [
 *       companyHint({ name: metrics.portalName, domain: 'acme.com' }),
 *       personHint({ name: 'Chris Brown', email: 'chris@acme.com' }),
 *     ].filter(Boolean),
 *   }
 *
 * The entity-resolver reads these hints from integration_events.metadata.entity_hints
 * and uses them for cross-system identity resolution.
 */

export interface EntityHintInput {
  name?: string;
  email?: string;
  phone?: string;
  domain?: string;
  external_id?: string;
  raw_data?: Record<string, unknown>;
}

export interface EntityHint extends EntityHintInput {
  entity_type: 'person' | 'company';
}

/**
 * Create a person entity hint. Returns null if no identifiable data is provided.
 */
export function personHint(input: EntityHintInput): EntityHint | null {
  if (!input.name && !input.email) return null;
  return { ...input, entity_type: 'person' as const };
}

/**
 * Create a company entity hint. Returns null if no identifiable data is provided.
 */
export function companyHint(input: EntityHintInput): EntityHint | null {
  if (!input.name && !input.domain) return null;
  return { ...input, entity_type: 'company' as const };
}

/**
 * Returns an empty hints array. Use for integrations that don't expose entity data.
 */
export function emptyHints(): EntityHint[] {
  return [];
}

/**
 * Batch-create person hints from an array of records, deduplicating by a key field.
 * Useful for extracting hints from attendee lists, assignee arrays, etc.
 */
export function personHintsFromList(
  records: Array<Record<string, unknown>>,
  opts: {
    nameField?: string;
    emailField?: string;
    externalIdField?: string;
    limit?: number;
  } = {},
): EntityHint[] {
  const { nameField = 'name', emailField = 'email', externalIdField, limit = 20 } = opts;
  const seen = new Set<string>();
  const hints: EntityHint[] = [];

  for (const record of records) {
    if (hints.length >= limit) break;
    const name = record[nameField] as string | undefined;
    const email = record[emailField] as string | undefined;
    const key = email || name || '';
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const hint = personHint({
      name: name || (email ? email.split('@')[0].replace(/[._]/g, ' ') : undefined),
      email: email || undefined,
      external_id: externalIdField ? (record[externalIdField] as string | undefined) : undefined,
    });
    if (hint) hints.push(hint);
  }

  return hints;
}

/**
 * Batch-create company hints from an array of records.
 */
export function companyHintsFromList(
  records: Array<Record<string, unknown>>,
  opts: {
    nameField?: string;
    domainField?: string;
    externalIdField?: string;
    limit?: number;
  } = {},
): EntityHint[] {
  const { nameField = 'name', domainField, externalIdField, limit = 20 } = opts;
  const seen = new Set<string>();
  const hints: EntityHint[] = [];

  for (const record of records) {
    if (hints.length >= limit) break;
    const name = record[nameField] as string | undefined;
    const domain = domainField ? (record[domainField] as string | undefined) : undefined;
    const key = name || domain || '';
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const hint = companyHint({ name, domain, external_id: externalIdField ? (record[externalIdField] as string | undefined) : undefined });
    if (hint) hints.push(hint);
  }

  return hints;
}
