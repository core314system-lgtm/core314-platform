import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

/**
 * Entity Resolver
 *
 * Cross-system identity resolution engine that matches entities (people/companies)
 * across multiple integrations into canonical resolved_entities records.
 *
 * Matching strategy (in priority order):
 *   1. Exact email match (deterministic, confidence: 100)
 *   2. Normalized email match (deterministic, confidence: 98)
 *   3. External ID match within same integration (deterministic, confidence: 100)
 *   4. Domain match for companies (deterministic, confidence: 90)
 *   5. Fuzzy name match using trigram similarity (confidence: 70-90)
 *   6. Phone normalization match (deterministic, confidence: 95)
 *
 * Pipeline position:
 *   poll functions -> integration_events -> entity-resolver -> signal-detector
 *
 * Designed to be called by integration-scheduler after polling completes,
 * or on-demand to resolve entities for a specific user.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface EntityHint {
  name?: string;
  email?: string;
  phone?: string;
  domain?: string;
  external_id?: string;
  source_integration: string;
  entity_type: 'person' | 'company';
  raw_data?: Record<string, unknown>;
}


// ── Normalization Helpers ────────────────────────────────────────────────

function normalizeEmail(email: string): string {
  const lower = email.toLowerCase().trim();
  const [localPart, domain] = lower.split('@');
  if (!domain) return lower;
  // Remove dots and plus-addressing from Gmail-style addresses
  const isGmail = domain === 'gmail.com' || domain === 'googlemail.com';
  if (isGmail) {
    const cleanLocal = localPart.split('+')[0].replace(/\./g, '');
    return `${cleanLocal}@gmail.com`;
  }
  // For other domains, just remove plus-addressing
  const cleanLocal = localPart.split('+')[0];
  return `${cleanLocal}@${domain}`;
}

function normalizePhone(phone: string): string {
  // Strip all non-digit characters, keep leading +
  const hasPlus = phone.startsWith('+');
  const digits = phone.replace(/\D/g, '');
  // If US number without country code (10 digits), add +1
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return hasPlus ? `+${digits}` : digits;
}

function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

function extractDomain(email: string): string | null {
  const parts = email.split('@');
  if (parts.length !== 2) return null;
  const domain = parts[1].toLowerCase().trim();
  // Skip common free email providers for company domain matching
  const freeProviders = [
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
    'aol.com', 'icloud.com', 'mail.com', 'protonmail.com',
    'zoho.com', 'yandex.com', 'live.com', 'msn.com',
  ];
  if (freeProviders.includes(domain)) return null;
  return domain;
}

/**
 * Jaro-Winkler similarity for fuzzy name matching.
 * Returns a value between 0 and 1, where 1 is an exact match.
 */
function jaroWinklerSimilarity(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;
  if (s1.length === 0 || s2.length === 0) return 0.0;

  const matchDistance = Math.max(Math.floor(Math.max(s1.length, s2.length) / 2) - 1, 0);
  const s1Matches = new Array(s1.length).fill(false);
  const s2Matches = new Array(s2.length).fill(false);

  let matches = 0;
  let transpositions = 0;

  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, s2.length);
    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0.0;

  let k = 0;
  for (let i = 0; i < s1.length; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  const jaro = (matches / s1.length + matches / s2.length + (matches - transpositions / 2) / matches) / 3;

  // Winkler modification: boost for common prefix (up to 4 chars)
  let prefix = 0;
  for (let i = 0; i < Math.min(4, Math.min(s1.length, s2.length)); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
}

// ── Declarative Ontology Mapping Engine ───────────────────────────────────

interface FieldMapping {
  id: string;
  source_field_path: string;
  target_entity_type: string;
  target_field: string;
  hint_type: 'person' | 'company';
  transform_rule: string | null;
  priority: number;
}

function resolveFieldPath(obj: Record<string, unknown>, path: string): unknown[] {
  if (path.includes('[]')) {
    const [arrayPath, rest] = path.split('[]', 2);
    const arr = resolveFieldPath(obj, arrayPath.replace(/\.$/, ''));
    if (!arr || arr.length === 0) return [];
    const results: unknown[] = [];
    for (const item of arr) {
      if (Array.isArray(item)) {
        for (const el of item) {
          if (rest && rest.startsWith('.') && typeof el === 'object' && el !== null) {
            results.push(...resolveFieldPath(el as Record<string, unknown>, rest.slice(1)));
          } else {
            results.push(el);
          }
        }
      }
    }
    return results;
  }

  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return [];
    if (typeof current === 'object' && !Array.isArray(current)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return [];
    }
  }
  if (current === null || current === undefined) return [];
  return Array.isArray(current) ? current : [current];
}

function applyTransform(value: unknown, rule: string | null): string | undefined {
  if (value === null || value === undefined) return undefined;
  const str = String(value).trim();
  if (!str) return undefined;
  if (!rule) return str;

  switch (rule) {
    case 'split_email_domain': {
      const parts = str.split('@');
      return parts.length === 2 ? parts[1].toLowerCase() : undefined;
    }
    case 'split_email_local': {
      const parts = str.split('@');
      return parts.length >= 1 ? parts[0].replace(/[._]/g, ' ') : undefined;
    }
    case 'normalize_phone':
      return normalizePhone(str);
    case 'title_case':
      return str.replace(/\b\w/g, c => c.toUpperCase());
    case 'lowercase':
      return str.toLowerCase();
    default:
      return str;
  }
}

async function extractEntitiesFromMappings(
  supabase: ReturnType<typeof createClient>,
  serviceName: string,
  metadata: Record<string, unknown>,
): Promise<{ hints: EntityHint[]; mappingsApplied: number }> {
  const { data: mappings } = await supabase
    .from('integration_field_mappings')
    .select('id, source_field_path, target_entity_type, target_field, hint_type, transform_rule, priority')
    .eq('integration_service_name', serviceName)
    .eq('is_active', true)
    .order('priority', { ascending: true });

  if (!mappings || mappings.length === 0) {
    return { hints: [], mappingsApplied: 0 };
  }

  const hintMap = new Map<string, EntityHint>();
  let mappingsApplied = 0;

  for (const mapping of mappings as FieldMapping[]) {
    const values = resolveFieldPath(metadata, mapping.source_field_path);
    if (values.length === 0) continue;

    mappingsApplied++;

    for (const rawValue of values.slice(0, 20)) {
      const transformed = applyTransform(rawValue, mapping.transform_rule);
      if (!transformed) continue;

      const key = `${mapping.hint_type}:${transformed.toLowerCase()}`;
      const existing = hintMap.get(key) || {
        source_integration: serviceName,
        entity_type: mapping.hint_type,
      };

      (existing as Record<string, unknown>)[mapping.target_field] = transformed;
      hintMap.set(key, existing as EntityHint);
    }
  }

  const hints = Array.from(hintMap.values()).filter(h => h.name || h.email);
  return { hints, mappingsApplied };
}

// ── Entity Extraction from Integration Events (legacy hardcoded) ──────────

function extractEntitiesFromEvent(
  eventType: string,
  metadata: Record<string, unknown>,
  serviceName: string
): EntityHint[] {
  const hints: EntityHint[] = [];

  switch (serviceName) {
    case 'hubspot': {
      // Extract from stalled deal names, contact names
      const stalledDealNames = metadata.stalled_deal_names as string[] | undefined;
      if (stalledDealNames) {
        for (const name of stalledDealNames) {
          if (name && name.trim()) {
            hints.push({ name: name.trim(), source_integration: 'hubspot', entity_type: 'company', external_id: undefined });
          }
        }
      }
      const portalName = metadata.portal_name as string | undefined;
      if (portalName) {
        hints.push({ name: portalName, source_integration: 'hubspot', entity_type: 'company', domain: undefined });
      }
      break;
    }

    case 'slack': {
      // Slack provides workspace info and user IDs
      const teamName = (metadata.workspace_name || (metadata.workspace_info as Record<string, unknown>)?.teamName) as string | undefined;
      if (teamName) {
        hints.push({ name: teamName, source_integration: 'slack', entity_type: 'company' });
      }
      break;
    }

    case 'jira': {
      // Extract assignees and reporters from Jira issues
      const overdueIssues = metadata.overdue_issues as Array<Record<string, unknown>> | undefined;
      if (overdueIssues) {
        for (const issue of overdueIssues) {
          const assignee = issue.assignee as string | undefined;
          const assigneeEmail = issue.assignee_email as string | undefined;
          if (assignee) {
            hints.push({
              name: assignee,
              email: assigneeEmail || undefined,
              source_integration: 'jira',
              entity_type: 'person',
              external_id: issue.assignee_id as string | undefined,
            });
          }
        }
      }
      const projectName = metadata.project_name as string | undefined;
      if (projectName) {
        hints.push({ name: projectName, source_integration: 'jira', entity_type: 'company' });
      }
      break;
    }

    case 'salesforce': {
      // Extract from opportunities, accounts, contacts
      const accounts = metadata.accounts as Array<Record<string, unknown>> | undefined;
      if (accounts) {
        for (const account of accounts) {
          const name = account.name as string | undefined;
          const domain = account.website as string | undefined;
          if (name) {
            hints.push({ name, domain, source_integration: 'salesforce', entity_type: 'company', external_id: account.id as string | undefined });
          }
        }
      }
      const contacts = metadata.contacts as Array<Record<string, unknown>> | undefined;
      if (contacts) {
        for (const contact of contacts) {
          const name = contact.name as string | undefined;
          const email = contact.email as string | undefined;
          if (name || email) {
            hints.push({ name: name || email || '', email, source_integration: 'salesforce', entity_type: 'person', external_id: contact.id as string | undefined });
          }
        }
      }
      break;
    }

    case 'asana': {
      // Extract task assignees
      const assignees = metadata.assignees as Array<Record<string, unknown>> | undefined;
      if (assignees) {
        for (const assignee of assignees) {
          const name = assignee.name as string | undefined;
          const email = assignee.email as string | undefined;
          if (name || email) {
            hints.push({ name: name || '', email, source_integration: 'asana', entity_type: 'person', external_id: assignee.gid as string | undefined });
          }
        }
      }
      break;
    }

    case 'github': {
      // Extract from contributors, assignees
      const contributors = metadata.contributors as Array<Record<string, unknown>> | undefined;
      if (contributors) {
        for (const contributor of contributors) {
          const name = (contributor.name || contributor.login) as string | undefined;
          const email = contributor.email as string | undefined;
          if (name) {
            hints.push({ name, email, source_integration: 'github', entity_type: 'person', external_id: contributor.login as string | undefined });
          }
        }
      }
      break;
    }

    case 'zendesk': {
      // Extract from ticket requesters
      const requesters = metadata.requesters as Array<Record<string, unknown>> | undefined;
      if (requesters) {
        for (const requester of requesters) {
          const name = requester.name as string | undefined;
          const email = requester.email as string | undefined;
          if (name || email) {
            hints.push({ name: name || '', email, source_integration: 'zendesk', entity_type: 'person', external_id: requester.id as string | undefined });
          }
        }
      }
      break;
    }

    case 'quickbooks': {
      // Extract from customers, vendors
      const customers = metadata.customers as Array<Record<string, unknown>> | undefined;
      if (customers) {
        for (const customer of customers) {
          const name = customer.name as string | undefined;
          const email = customer.email as string | undefined;
          if (name) {
            hints.push({ name, email, source_integration: 'quickbooks', entity_type: 'company', external_id: customer.id as string | undefined });
          }
        }
      }
      break;
    }

    case 'notion': {
      const workspaceName = metadata.workspace_name as string | undefined;
      if (workspaceName) {
        hints.push({ name: workspaceName, source_integration: 'notion', entity_type: 'company' });
      }
      break;
    }

    case 'monday': {
      const boardOwners = metadata.board_owners as Array<Record<string, unknown>> | undefined;
      if (boardOwners) {
        for (const owner of boardOwners) {
          const name = owner.name as string | undefined;
          const email = owner.email as string | undefined;
          if (name || email) {
            hints.push({ name: name || '', email, source_integration: 'monday', entity_type: 'person', external_id: owner.id as string | undefined });
          }
        }
      }
      break;
    }

    default:
      break;
  }

  // Also check for generic entity_hints field that poll functions can populate
  const entityHints = metadata.entity_hints as Array<Record<string, unknown>> | undefined;
  if (entityHints) {
    for (const hint of entityHints) {
      hints.push({
        name: hint.name as string | undefined,
        email: hint.email as string | undefined,
        phone: hint.phone as string | undefined,
        domain: hint.domain as string | undefined,
        external_id: hint.external_id as string | undefined,
        source_integration: serviceName,
        entity_type: (hint.entity_type as 'person' | 'company') || 'person',
        raw_data: hint.raw_data as Record<string, unknown> | undefined,
      });
    }
  }

  return hints.filter(h => h.name || h.email);
}

// ── Core Resolution Logic ────────────────────────────────────────────────

async function resolveEntity(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  hint: EntityHint,
): Promise<{ entityId: string; matchMethod: string; confidence: number; isNew: boolean }> {
  // 1. Try exact email match
  if (hint.email) {
    const normalizedEmail = normalizeEmail(hint.email);

    // Check existing resolved entities by email
    const { data: emailMatch } = await supabase
      .from('resolved_entities')
      .select('id')
      .eq('user_id', userId)
      .eq('canonical_email', normalizedEmail)
      .limit(1)
      .maybeSingle();

    if (emailMatch) {
      return { entityId: emailMatch.id, matchMethod: 'exact_email', confidence: 100, isNew: false };
    }

    // Check source records for normalized email match
    const { data: sourceEmailMatch } = await supabase
      .from('entity_source_records')
      .select('resolved_entity_id')
      .eq('user_id', userId)
      .eq('source_email', normalizedEmail)
      .limit(1)
      .maybeSingle();

    if (sourceEmailMatch) {
      return { entityId: sourceEmailMatch.resolved_entity_id, matchMethod: 'normalized_email', confidence: 98, isNew: false };
    }
  }

  // 2. Try external ID match (same integration)
  if (hint.external_id) {
    const { data: extIdMatch } = await supabase
      .from('entity_source_records')
      .select('resolved_entity_id')
      .eq('user_id', userId)
      .eq('source_integration', hint.source_integration)
      .eq('external_id', hint.external_id)
      .limit(1)
      .maybeSingle();

    if (extIdMatch) {
      return { entityId: extIdMatch.resolved_entity_id, matchMethod: 'external_id', confidence: 100, isNew: false };
    }
  }

  // 3. Try phone match
  if (hint.phone) {
    const normalizedPhone = normalizePhone(hint.phone);
    const { data: phoneMatch } = await supabase
      .from('resolved_entities')
      .select('id')
      .eq('user_id', userId)
      .eq('canonical_phone', normalizedPhone)
      .limit(1)
      .maybeSingle();

    if (phoneMatch) {
      return { entityId: phoneMatch.id, matchMethod: 'phone', confidence: 95, isNew: false };
    }
  }

  // 4. Try domain match for companies
  if (hint.entity_type === 'company' && hint.domain) {
    const { data: domainMatch } = await supabase
      .from('resolved_entities')
      .select('id')
      .eq('user_id', userId)
      .eq('entity_type', 'company')
      .eq('canonical_domain', hint.domain.toLowerCase())
      .limit(1)
      .maybeSingle();

    if (domainMatch) {
      return { entityId: domainMatch.id, matchMethod: 'domain', confidence: 90, isNew: false };
    }
  }

  // 5. Try fuzzy name match
  if (hint.name) {
    const normalized = normalizeName(hint.name);
    // Fetch candidates of same entity_type for this user
    const { data: candidates } = await supabase
      .from('resolved_entities')
      .select('id, canonical_name')
      .eq('user_id', userId)
      .eq('entity_type', hint.entity_type)
      .limit(100);

    if (candidates && candidates.length > 0) {
      let bestMatch: { id: string; score: number } | null = null;

      for (const candidate of candidates) {
        const candidateNormalized = normalizeName(candidate.canonical_name);
        const score = jaroWinklerSimilarity(normalized, candidateNormalized);

        if (score >= 0.88 && (!bestMatch || score > bestMatch.score)) {
          bestMatch = { id: candidate.id, score };
        }
      }

      if (bestMatch) {
        const confidence = Math.round(bestMatch.score * 100);
        return { entityId: bestMatch.id, matchMethod: 'fuzzy_name', confidence, isNew: false };
      }
    }
  }

  // 6. No match found — create new resolved entity
  const domain = hint.email ? extractDomain(hint.email) : hint.domain || null;
  const canonicalEmail = hint.email ? normalizeEmail(hint.email) : null;
  const canonicalPhone = hint.phone ? normalizePhone(hint.phone) : null;

  const { data: newEntity, error: createError } = await supabase
    .from('resolved_entities')
    .insert({
      user_id: userId,
      entity_type: hint.entity_type,
      canonical_name: hint.name || hint.email || 'Unknown',
      canonical_email: canonicalEmail,
      canonical_domain: domain,
      canonical_phone: canonicalPhone,
      metadata: { first_source: hint.source_integration },
      source_count: 1,
    })
    .select('id')
    .single();

  if (createError || !newEntity) {
    console.error('[entity-resolver] Failed to create entity:', createError);
    throw new Error(`Failed to create entity: ${createError?.message}`);
  }

  return { entityId: newEntity.id, matchMethod: 'new_entity', confidence: 100, isNew: true };
}

// ── Main Handler ─────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Parse optional request body for targeting specific user
    let targetUserId: string | null = null;
    let lookbackMinutes = 60;
    try {
      const body = await req.json();
      targetUserId = body.user_id || null;
      lookbackMinutes = body.lookback_minutes || 60;
    } catch {
      // No body — process all recent events
    }

    console.log('[entity-resolver] Starting resolution run', {
      target_user: targetUserId || 'all',
      lookback_minutes: lookbackMinutes,
    });

    // Fetch recent integration_events
    const cutoff = new Date(Date.now() - lookbackMinutes * 60 * 1000).toISOString();
    let query = supabase
      .from('integration_events')
      .select('id, user_id, event_type, metadata, service_name, occurred_at')
      .gte('occurred_at', cutoff)
      .order('occurred_at', { ascending: false })
      .limit(500);

    if (targetUserId) {
      query = query.eq('user_id', targetUserId);
    }

    const { data: events, error: eventsError } = await query;

    if (eventsError) {
      console.error('[entity-resolver] Error fetching events:', eventsError);
      return new Response(JSON.stringify({ error: 'Failed to fetch events' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!events || events.length === 0) {
      console.log('[entity-resolver] No recent events to process');
      return new Response(JSON.stringify({
        success: true,
        events_processed: 0,
        entities_resolved: 0,
        new_entities: 0,
        duration_ms: Date.now() - startTime,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[entity-resolver] Processing ${events.length} events`);

    let entitiesResolved = 0;
    let newEntities = 0;
    let sourceRecordsCreated = 0;
    const errors: string[] = [];

    for (const event of events) {
      try {
        const metadata = (event.metadata as Record<string, unknown>) || {};

        // Try declarative ontology mappings first
        const { hints: ontologyHints, mappingsApplied } = await extractEntitiesFromMappings(
          supabase, event.service_name, metadata
        );

        // Fall back to hardcoded extraction + generic entity_hints
        const legacyHints = extractEntitiesFromEvent(event.event_type, metadata, event.service_name);

        // Merge: ontology hints take priority, then legacy, deduplicated by name+email
        const seen = new Set<string>();
        const hints: EntityHint[] = [];
        for (const h of [...ontologyHints, ...legacyHints]) {
          const key = `${h.entity_type}:${(h.email || h.name || '').toLowerCase()}`;
          if (!seen.has(key)) {
            seen.add(key);
            hints.push(h);
          }
        }

        // Log ontology processing
        if (mappingsApplied > 0) {
          await supabase.from('ontology_processing_log').insert({
            user_id: event.user_id,
            integration_event_id: event.id,
            integration_service_name: event.service_name,
            mappings_applied: mappingsApplied,
            entities_extracted: ontologyHints.length,
            processing_time_ms: 0,
            details: { ontology_hints: ontologyHints.length, legacy_hints: legacyHints.length },
          }).then(() => {}).catch(() => {});
        }

        if (hints.length === 0) continue;

        for (const hint of hints) {
          try {
            const result = await resolveEntity(supabase, event.user_id, hint);
            entitiesResolved++;

            if (result.isNew) {
              newEntities++;
            } else {
              // Update last_seen_at and source_count on existing entity
              await supabase
                .from('resolved_entities')
                .update({
                  last_seen_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                })
                .eq('id', result.entityId);
            }

            // Create source record (upsert to avoid duplicates)
            const sourceEmail = hint.email ? normalizeEmail(hint.email) : null;
            const { data: existingSource } = await supabase
              .from('entity_source_records')
              .select('id')
              .eq('resolved_entity_id', result.entityId)
              .eq('source_integration', hint.source_integration)
              .eq('user_id', event.user_id)
              .or(
                hint.external_id
                  ? `external_id.eq.${hint.external_id}`
                  : sourceEmail
                    ? `source_email.eq.${sourceEmail}`
                    : `source_name.eq.${hint.name || ''}`
              )
              .limit(1)
              .maybeSingle();

            if (!existingSource) {
              const { error: srcError } = await supabase
                .from('entity_source_records')
                .insert({
                  resolved_entity_id: result.entityId,
                  user_id: event.user_id,
                  source_integration: hint.source_integration,
                  external_id: hint.external_id || null,
                  source_name: hint.name || null,
                  source_email: sourceEmail,
                  source_phone: hint.phone ? normalizePhone(hint.phone) : null,
                  source_domain: hint.domain || (hint.email ? extractDomain(hint.email) : null),
                  raw_data: hint.raw_data || {},
                  match_method: result.matchMethod === 'new_entity' ? 'exact_email' : result.matchMethod,
                  match_confidence: result.confidence,
                });

              if (!srcError) {
                sourceRecordsCreated++;
                // Update source_count on the resolved entity
                const { data: countData } = await supabase
                  .from('entity_source_records')
                  .select('id', { count: 'exact', head: true })
                  .eq('resolved_entity_id', result.entityId);

                if (countData !== null) {
                  await supabase
                    .from('resolved_entities')
                    .update({ source_count: countData })
                    .eq('id', result.entityId);
                }
              }
            } else {
              // Update last_seen_at on existing source record
              await supabase
                .from('entity_source_records')
                .update({ last_seen_at: new Date().toISOString() })
                .eq('id', existingSource.id);
            }

            // Log match decision (only for non-trivial matches)
            if (result.matchMethod !== 'new_entity' && result.matchMethod !== 'exact_email') {
              await supabase.from('entity_match_log').insert({
                user_id: event.user_id,
                resolved_entity_id: result.entityId,
                match_method: result.matchMethod,
                match_confidence: result.confidence,
                match_details: {
                  hint_name: hint.name,
                  hint_email: hint.email,
                  hint_integration: hint.source_integration,
                  event_id: event.id,
                },
              });
            }
          } catch (hintError) {
            const msg = hintError instanceof Error ? hintError.message : String(hintError);
            errors.push(`Hint error (${hint.source_integration}): ${msg}`);
          }
        }
      } catch (eventError) {
        const msg = eventError instanceof Error ? eventError.message : String(eventError);
        errors.push(`Event error (${event.id}): ${msg}`);
      }
    }

    const duration = Date.now() - startTime;
    console.log(
      `[entity-resolver] Complete in ${duration}ms: ` +
      `${events.length} events processed, ${entitiesResolved} entities resolved, ` +
      `${newEntities} new, ${sourceRecordsCreated} source records created`
    );

    if (errors.length > 0) {
      console.warn('[entity-resolver] Errors:', errors.slice(0, 10));
    }

    return new Response(JSON.stringify({
      success: true,
      events_processed: events.length,
      entities_resolved: entitiesResolved,
      new_entities: newEntities,
      source_records_created: sourceRecordsCreated,
      errors: errors.slice(0, 10),
      duration_ms: duration,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[entity-resolver] Fatal error:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
