-- ============================================================================
-- Database Scaling Hardening + Integration Content Documents System
-- Date: 2026-05-04
-- ============================================================================
--
-- Part 1: Improve archive_old_integration_events() with batch processing
--         to avoid long-running transactions at scale.
--
-- Part 2: Create integration_documents table for storing extracted content
--         from connected integrations (Google Sheets, Jira, Notion, etc.).
--
-- Part 3: Full-text search support via tsvector + GIN index.
--
-- Part 4: Storage quota tracking per organization.
-- ============================================================================

-- ============================================================================
-- PART 1: Improved Archive Functions with Batch Processing
-- ============================================================================

-- Replace archive_old_integration_events with batched version
-- Processes 5,000 rows at a time to avoid locking the table
CREATE OR REPLACE FUNCTION archive_old_integration_events()
RETURNS INTEGER AS $$
DECLARE
  v_total_archived INTEGER := 0;
  v_batch_size INTEGER := 5000;
  v_batch_count INTEGER;
BEGIN
  LOOP
    -- Archive a batch
    WITH batch AS (
      SELECT id FROM integration_events
      WHERE ingested_at < NOW() - INTERVAL '90 days'
      LIMIT v_batch_size
      FOR UPDATE SKIP LOCKED
    ),
    archived AS (
      INSERT INTO integration_events_archive
      SELECT ie.*, NOW() as archived_at
      FROM integration_events ie
      JOIN batch b ON ie.id = b.id
      ON CONFLICT DO NOTHING
      RETURNING 1
    )
    SELECT COUNT(*) INTO v_batch_count FROM archived;

    -- Delete the archived batch from main table
    DELETE FROM integration_events
    WHERE id IN (
      SELECT id FROM integration_events
      WHERE ingested_at < NOW() - INTERVAL '90 days'
      LIMIT v_batch_size
    );

    v_total_archived := v_total_archived + v_batch_count;

    -- Exit when no more rows to process
    EXIT WHEN v_batch_count = 0;

    -- Brief pause between batches to reduce lock contention
    PERFORM pg_sleep(0.1);
  END LOOP;

  RAISE NOTICE 'Archived and deleted % integration_events older than 90 days (batched)', v_total_archived;
  RETURN v_total_archived;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Replace archive_old_operational_signals with batched version
CREATE OR REPLACE FUNCTION archive_old_operational_signals()
RETURNS INTEGER AS $$
DECLARE
  v_total_archived INTEGER := 0;
  v_batch_size INTEGER := 5000;
  v_batch_count INTEGER;
BEGIN
  LOOP
    WITH batch AS (
      SELECT id FROM operational_signals
      WHERE is_active = false
      AND created_at < NOW() - INTERVAL '30 days'
      LIMIT v_batch_size
      FOR UPDATE SKIP LOCKED
    ),
    archived AS (
      INSERT INTO operational_signals_archive
      SELECT os.*, NOW() as archived_at
      FROM operational_signals os
      JOIN batch b ON os.id = b.id
      ON CONFLICT DO NOTHING
      RETURNING 1
    )
    SELECT COUNT(*) INTO v_batch_count FROM archived;

    DELETE FROM operational_signals
    WHERE id IN (
      SELECT id FROM operational_signals
      WHERE is_active = false
      AND created_at < NOW() - INTERVAL '30 days'
      LIMIT v_batch_size
    );

    v_total_archived := v_total_archived + v_batch_count;
    EXIT WHEN v_batch_count = 0;
    PERFORM pg_sleep(0.1);
  END LOOP;

  RAISE NOTICE 'Archived and deleted % inactive operational_signals older than 30 days (batched)', v_total_archived;
  RETURN v_total_archived;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add composite indexes for common query patterns used by pollers and signal-detector
CREATE INDEX IF NOT EXISTS idx_integration_events_user_service_occurred
  ON integration_events(user_id, service_name, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_integration_events_user_event_type
  ON integration_events(user_id, event_type, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_integration_events_ingested_at_for_archive
  ON integration_events(ingested_at);

CREATE INDEX IF NOT EXISTS idx_operational_signals_inactive_old
  ON operational_signals(is_active, created_at)
  WHERE is_active = false;

-- ============================================================================
-- PART 2: Integration Content Documents Table
-- ============================================================================

-- Stores extracted content from connected integrations
-- Examples: Google Sheets cell data, Jira issue attachments/descriptions,
--           Notion page content, Slack shared files
CREATE TABLE IF NOT EXISTS integration_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Ownership
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID,

  -- Source integration
  user_integration_id UUID NOT NULL,
  service_name TEXT NOT NULL,            -- e.g. 'google_sheets', 'jira', 'notion'
  source_type TEXT NOT NULL,             -- e.g. 'spreadsheet', 'attachment', 'page', 'file'

  -- Document identity (for deduplication / updates)
  external_id TEXT NOT NULL,             -- ID in the source system (spreadsheet ID, page ID, etc.)
  external_url TEXT,                     -- Direct link to the source document
  parent_external_id TEXT,               -- Parent container (e.g. Jira issue key for an attachment)

  -- Content
  title TEXT NOT NULL,
  description TEXT,
  content_text TEXT,                     -- Extracted plain text content
  content_json JSONB,                    -- Structured content (spreadsheet cells, page blocks, etc.)
  content_preview TEXT,                  -- First ~500 chars for display
  mime_type TEXT,                        -- e.g. 'application/vnd.google-apps.spreadsheet'
  file_size_bytes BIGINT DEFAULT 0,

  -- Full-text search
  search_vector TSVECTOR,

  -- Metadata
  source_created_at TIMESTAMPTZ,         -- When the doc was created in the source system
  source_modified_at TIMESTAMPTZ,        -- When the doc was last modified in source
  extracted_at TIMESTAMPTZ DEFAULT NOW(),-- When we extracted it
  extraction_version INTEGER DEFAULT 1,  -- Schema version of the extraction
  extraction_status TEXT DEFAULT 'complete' CHECK (extraction_status IN ('pending', 'extracting', 'complete', 'failed', 'skipped')),
  extraction_error TEXT,                 -- Error message if extraction failed
  metadata JSONB DEFAULT '{}',           -- Additional source-specific metadata

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Deduplicate: one row per external document per user integration
  UNIQUE(user_integration_id, external_id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON integration_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_org_id ON integration_documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_documents_service ON integration_documents(service_name);
CREATE INDEX IF NOT EXISTS idx_documents_source_type ON integration_documents(source_type);
CREATE INDEX IF NOT EXISTS idx_documents_user_service ON integration_documents(user_id, service_name);
CREATE INDEX IF NOT EXISTS idx_documents_external_id ON integration_documents(external_id);
CREATE INDEX IF NOT EXISTS idx_documents_source_modified ON integration_documents(source_modified_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_extracted_at ON integration_documents(extracted_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_extraction_status ON integration_documents(extraction_status);

-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_documents_search ON integration_documents USING GIN(search_vector);

-- Auto-update search_vector on insert/update
CREATE OR REPLACE FUNCTION update_document_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    COALESCE(NEW.title, '') || ' ' ||
    COALESCE(NEW.description, '') || ' ' ||
    COALESCE(NEW.content_preview, '') || ' ' ||
    COALESCE(NEW.service_name, '') || ' ' ||
    COALESCE(NEW.source_type, '')
  );
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_document_search_vector ON integration_documents;
CREATE TRIGGER trg_document_search_vector
  BEFORE INSERT OR UPDATE OF title, description, content_preview, service_name, source_type
  ON integration_documents
  FOR EACH ROW EXECUTE FUNCTION update_document_search_vector();

-- RLS policies
ALTER TABLE integration_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own documents"
  ON integration_documents FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all documents"
  ON integration_documents FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT ALL ON integration_documents TO service_role;
GRANT SELECT ON integration_documents TO authenticated;

-- ============================================================================
-- PART 3: Full-Text Search RPC Function
-- ============================================================================

-- Search integration documents with full-text search
CREATE OR REPLACE FUNCTION search_integration_documents(
  p_user_id UUID,
  p_query TEXT,
  p_service_name TEXT DEFAULT NULL,
  p_source_type TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  content_preview TEXT,
  service_name TEXT,
  source_type TEXT,
  external_url TEXT,
  source_modified_at TIMESTAMPTZ,
  extracted_at TIMESTAMPTZ,
  mime_type TEXT,
  file_size_bytes BIGINT,
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.title,
    d.description,
    d.content_preview,
    d.service_name,
    d.source_type,
    d.external_url,
    d.source_modified_at,
    d.extracted_at,
    d.mime_type,
    d.file_size_bytes,
    ts_rank(d.search_vector, websearch_to_tsquery('english', p_query)) AS rank
  FROM integration_documents d
  WHERE d.user_id = p_user_id
    AND d.extraction_status = 'complete'
    AND (p_service_name IS NULL OR d.service_name = p_service_name)
    AND (p_source_type IS NULL OR d.source_type = p_source_type)
    AND (
      p_query IS NULL
      OR p_query = ''
      OR d.search_vector @@ websearch_to_tsquery('english', p_query)
    )
  ORDER BY
    CASE WHEN p_query IS NOT NULL AND p_query != '' THEN
      ts_rank(d.search_vector, websearch_to_tsquery('english', p_query))
    ELSE 0 END DESC,
    d.source_modified_at DESC NULLS LAST
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION search_integration_documents TO authenticated;
GRANT EXECUTE ON FUNCTION search_integration_documents TO service_role;

-- ============================================================================
-- PART 4: Storage Quota Tracking
-- ============================================================================

-- Track content storage usage per organization
CREATE TABLE IF NOT EXISTS content_storage_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_documents INTEGER DEFAULT 0,
  total_bytes BIGINT DEFAULT 0,
  last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

ALTER TABLE content_storage_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own storage usage"
  ON content_storage_usage FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage storage usage"
  ON content_storage_usage FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT ALL ON content_storage_usage TO service_role;
GRANT SELECT ON content_storage_usage TO authenticated;

-- Function to recalculate storage usage for a user
CREATE OR REPLACE FUNCTION recalculate_storage_usage(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  v_total_docs INTEGER;
  v_total_bytes BIGINT;
  v_org_id UUID;
BEGIN
  SELECT COUNT(*), COALESCE(SUM(file_size_bytes), 0)
  INTO v_total_docs, v_total_bytes
  FROM integration_documents
  WHERE user_id = p_user_id AND extraction_status = 'complete';

  -- Get user's organization
  SELECT organization_id INTO v_org_id
  FROM organization_members
  WHERE user_id = p_user_id
  LIMIT 1;

  INSERT INTO content_storage_usage (user_id, organization_id, total_documents, total_bytes, last_calculated_at, updated_at)
  VALUES (p_user_id, v_org_id, v_total_docs, v_total_bytes, NOW(), NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    total_documents = EXCLUDED.total_documents,
    total_bytes = EXCLUDED.total_bytes,
    last_calculated_at = NOW(),
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION recalculate_storage_usage TO service_role;

-- ============================================================================
-- PART 5: Archive old integration_documents (content older than 180 days)
-- ============================================================================

CREATE TABLE IF NOT EXISTS integration_documents_archive (
  LIKE integration_documents INCLUDING ALL
);

ALTER TABLE integration_documents_archive DROP CONSTRAINT IF EXISTS integration_documents_archive_pkey;
ALTER TABLE integration_documents_archive DROP CONSTRAINT IF EXISTS integration_documents_archive_user_integration_id_external_id_key;
ALTER TABLE integration_documents_archive ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE integration_documents_archive ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view archived documents"
  ON integration_documents_archive FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Service role can manage archived documents"
  ON integration_documents_archive FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Batched archive function for old documents
CREATE OR REPLACE FUNCTION archive_old_integration_documents()
RETURNS INTEGER AS $$
DECLARE
  v_total_archived INTEGER := 0;
  v_batch_size INTEGER := 2000;
  v_batch_count INTEGER;
BEGIN
  LOOP
    WITH batch AS (
      SELECT id FROM integration_documents
      WHERE extracted_at < NOW() - INTERVAL '180 days'
      LIMIT v_batch_size
      FOR UPDATE SKIP LOCKED
    ),
    archived AS (
      INSERT INTO integration_documents_archive
      SELECT d.*, NOW() as archived_at
      FROM integration_documents d
      JOIN batch b ON d.id = b.id
      ON CONFLICT DO NOTHING
      RETURNING 1
    )
    SELECT COUNT(*) INTO v_batch_count FROM archived;

    DELETE FROM integration_documents
    WHERE id IN (
      SELECT id FROM integration_documents
      WHERE extracted_at < NOW() - INTERVAL '180 days'
      LIMIT v_batch_size
    );

    v_total_archived := v_total_archived + v_batch_count;
    EXIT WHEN v_batch_count = 0;
    PERFORM pg_sleep(0.1);
  END LOOP;

  RAISE NOTICE 'Archived and deleted % integration_documents older than 180 days', v_total_archived;
  RETURN v_total_archived;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule document archival daily at 3:30 AM UTC
SELECT cron.schedule(
  'archive-integration-documents-daily',
  '30 3 * * *',
  $$SELECT archive_old_integration_documents()$$
);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE integration_documents IS
  'Stores extracted content from connected integrations (Google Sheets, Jira, Notion, etc.) for full-text search and content-based signals.';

COMMENT ON TABLE content_storage_usage IS
  'Tracks per-user content storage usage for plan limit enforcement.';

COMMENT ON TABLE integration_documents_archive IS
  'Archive of integration_documents older than 180 days.';

COMMENT ON FUNCTION archive_old_integration_events() IS
  'Batched archival of integration_events older than 90 days. Processes 5,000 rows at a time to avoid lock contention.';

COMMENT ON FUNCTION archive_old_operational_signals() IS
  'Batched archival of inactive operational_signals older than 30 days.';

COMMENT ON FUNCTION search_integration_documents IS
  'Full-text search over extracted integration documents with service/type filtering.';

COMMENT ON FUNCTION recalculate_storage_usage IS
  'Recalculates content storage usage for a user from integration_documents.';

COMMENT ON FUNCTION archive_old_integration_documents IS
  'Batched archival of integration_documents older than 180 days.';
