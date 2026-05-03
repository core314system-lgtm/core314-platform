/**
 * Shared Content Extraction Utilities
 *
 * Common types, helpers, and storage-quota enforcement
 * used by all content extraction edge functions.
 */

import { SupabaseClient } from 'npm:@supabase/supabase-js@2';

// ---------------------------------------------------------------------------
// Plan-based storage limits (bytes)
// ---------------------------------------------------------------------------
export const PLAN_CONTENT_LIMITS: Record<string, { maxDocuments: number; maxBytes: number }> = {
  intelligence:    { maxDocuments: 500,   maxBytes: 1 * 1024 * 1024 * 1024 },   // 1 GB
  command_center:  { maxDocuments: 5000,  maxBytes: 10 * 1024 * 1024 * 1024 },  // 10 GB
  enterprise:      { maxDocuments: 50000, maxBytes: 100 * 1024 * 1024 * 1024 }, // 100 GB
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface DocumentUpsert {
  user_id: string;
  organization_id: string | null;
  user_integration_id: string;
  service_name: string;
  source_type: string;
  external_id: string;
  external_url: string | null;
  parent_external_id: string | null;
  title: string;
  description: string | null;
  content_text: string | null;
  content_json: Record<string, unknown> | null;
  content_preview: string | null;
  mime_type: string | null;
  file_size_bytes: number;
  source_created_at: string | null;
  source_modified_at: string | null;
  extraction_status: 'complete' | 'failed' | 'skipped';
  extraction_error: string | null;
  metadata: Record<string, unknown>;
}

export interface ExtractionResult {
  documentsUpserted: number;
  documentsSkipped: number;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Truncate text to a maximum length, adding ellipsis if truncated. */
export function truncate(text: string | null | undefined, maxLen: number): string {
  if (!text) return '';
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + '...';
}

/** Estimate the byte size of a string (UTF-8). */
export function estimateBytes(text: string | null | undefined): number {
  if (!text) return 0;
  return new TextEncoder().encode(text).length;
}

/** Build a content preview from text (first 500 chars). */
export function buildPreview(text: string | null | undefined): string {
  return truncate(text, 500);
}

// ---------------------------------------------------------------------------
// Quota check
// ---------------------------------------------------------------------------

/**
 * Check if a user has remaining content storage quota.
 * Returns { allowed: true } or { allowed: false, reason }.
 */
export async function checkContentQuota(
  supabase: SupabaseClient,
  userId: string,
  plan: string,
): Promise<{ allowed: boolean; reason?: string; currentDocs?: number; currentBytes?: number }> {
  const limits = PLAN_CONTENT_LIMITS[plan] ?? PLAN_CONTENT_LIMITS['intelligence'];

  const { data: usage } = await supabase
    .from('content_storage_usage')
    .select('total_documents, total_bytes')
    .eq('user_id', userId)
    .single();

  const currentDocs = usage?.total_documents ?? 0;
  const currentBytes = (usage?.total_bytes as number) ?? 0;

  if (currentDocs >= limits.maxDocuments) {
    return {
      allowed: false,
      reason: `Document limit reached (${currentDocs}/${limits.maxDocuments}). Upgrade your plan for more capacity.`,
      currentDocs,
      currentBytes,
    };
  }

  if (currentBytes >= limits.maxBytes) {
    const usedGB = (currentBytes / (1024 * 1024 * 1024)).toFixed(1);
    const limitGB = (limits.maxBytes / (1024 * 1024 * 1024)).toFixed(0);
    return {
      allowed: false,
      reason: `Storage limit reached (${usedGB} GB / ${limitGB} GB). Upgrade your plan for more capacity.`,
      currentDocs,
      currentBytes,
    };
  }

  return { allowed: true, currentDocs, currentBytes };
}

// ---------------------------------------------------------------------------
// Upsert documents
// ---------------------------------------------------------------------------

/**
 * Upsert a batch of extracted documents into integration_documents.
 * Handles deduplication via (user_integration_id, external_id) unique constraint.
 */
export async function upsertDocuments(
  supabase: SupabaseClient,
  documents: DocumentUpsert[],
): Promise<ExtractionResult> {
  const result: ExtractionResult = { documentsUpserted: 0, documentsSkipped: 0, errors: [] };

  for (const doc of documents) {
    try {
      const { error } = await supabase
        .from('integration_documents')
        .upsert(
          {
            user_id: doc.user_id,
            organization_id: doc.organization_id,
            user_integration_id: doc.user_integration_id,
            service_name: doc.service_name,
            source_type: doc.source_type,
            external_id: doc.external_id,
            external_url: doc.external_url,
            parent_external_id: doc.parent_external_id,
            title: doc.title,
            description: doc.description,
            content_text: doc.content_text,
            content_json: doc.content_json,
            content_preview: doc.content_preview,
            mime_type: doc.mime_type,
            file_size_bytes: doc.file_size_bytes,
            source_created_at: doc.source_created_at,
            source_modified_at: doc.source_modified_at,
            extracted_at: new Date().toISOString(),
            extraction_status: doc.extraction_status,
            extraction_error: doc.extraction_error,
            metadata: doc.metadata,
          },
          { onConflict: 'user_integration_id,external_id' },
        );

      if (error) {
        result.errors.push(`${doc.external_id}: ${error.message}`);
        result.documentsSkipped++;
      } else {
        result.documentsUpserted++;
      }
    } catch (err) {
      result.errors.push(`${doc.external_id}: ${err instanceof Error ? err.message : String(err)}`);
      result.documentsSkipped++;
    }
  }

  return result;
}

/**
 * Recalculate and persist storage usage for a user.
 */
export async function updateStorageUsage(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  try {
    await supabase.rpc('recalculate_storage_usage', { p_user_id: userId });
  } catch (err) {
    console.error('[content-extraction] Failed to recalculate storage usage:', err);
  }
}
