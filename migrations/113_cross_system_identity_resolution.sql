-- Migration: Cross-System Identity Resolution (Phase 1)
-- Adds tables for resolving entities (people/companies) across multiple integrations

-- 1. resolved_entities: Canonical entity records
CREATE TABLE IF NOT EXISTS resolved_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('person', 'company')),
  canonical_name TEXT NOT NULL,
  canonical_email TEXT,
  canonical_domain TEXT,
  canonical_phone TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  source_count INTEGER DEFAULT 1,
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resolved_entities_user_id ON resolved_entities(user_id);
CREATE INDEX IF NOT EXISTS idx_resolved_entities_email ON resolved_entities(canonical_email) WHERE canonical_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_resolved_entities_domain ON resolved_entities(canonical_domain) WHERE canonical_domain IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_resolved_entities_name_trgm ON resolved_entities USING gin (canonical_name gin_trgm_ops);

-- 2. entity_source_records: Links source records from integrations to resolved entities
CREATE TABLE IF NOT EXISTS entity_source_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resolved_entity_id UUID NOT NULL REFERENCES resolved_entities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_integration TEXT NOT NULL,
  external_id TEXT,
  source_name TEXT,
  source_email TEXT,
  source_phone TEXT,
  source_domain TEXT,
  raw_data JSONB DEFAULT '{}'::jsonb,
  match_method TEXT NOT NULL CHECK (match_method IN ('exact_email', 'normalized_email', 'domain', 'external_id', 'fuzzy_name', 'phone', 'manual')),
  match_confidence NUMERIC(5,2) DEFAULT 100.00,
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_entity_source_records_resolved ON entity_source_records(resolved_entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_source_records_user ON entity_source_records(user_id);
CREATE INDEX IF NOT EXISTS idx_entity_source_records_integration ON entity_source_records(source_integration);
CREATE INDEX IF NOT EXISTS idx_entity_source_records_email ON entity_source_records(source_email) WHERE source_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_entity_source_records_external ON entity_source_records(source_integration, external_id) WHERE external_id IS NOT NULL;

-- 3. entity_match_log: Audit trail for match decisions
CREATE TABLE IF NOT EXISTS entity_match_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  resolved_entity_id UUID NOT NULL REFERENCES resolved_entities(id) ON DELETE CASCADE,
  source_record_id UUID REFERENCES entity_source_records(id) ON DELETE SET NULL,
  match_method TEXT NOT NULL,
  match_confidence NUMERIC(5,2) NOT NULL,
  match_details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_entity_match_log_entity ON entity_match_log(resolved_entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_match_log_user ON entity_match_log(user_id);

-- 4. Enable pg_trgm extension for fuzzy name matching (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 5. Add resolved_entity_ids array to operational_signals (if not already present)
-- PR #530 already added resolved_entity_ids column, but verify it exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'operational_signals' AND column_name = 'resolved_entity_ids'
  ) THEN
    ALTER TABLE operational_signals ADD COLUMN resolved_entity_ids UUID[] DEFAULT '{}';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_operational_signals_entity_ids ON operational_signals USING gin (resolved_entity_ids) WHERE resolved_entity_ids IS NOT NULL AND resolved_entity_ids != '{}';

-- 6. RLS policies
ALTER TABLE resolved_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_source_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_match_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own resolved entities"
  ON resolved_entities FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage resolved entities"
  ON resolved_entities FOR ALL USING (
    (SELECT current_setting('request.jwt.claims', true)::jsonb->>'role') = 'service_role'
  );

CREATE POLICY "Users can view their own entity source records"
  ON entity_source_records FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage entity source records"
  ON entity_source_records FOR ALL USING (
    (SELECT current_setting('request.jwt.claims', true)::jsonb->>'role') = 'service_role'
  );

CREATE POLICY "Users can view their own entity match log"
  ON entity_match_log FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage entity match log"
  ON entity_match_log FOR ALL USING (
    (SELECT current_setting('request.jwt.claims', true)::jsonb->>'role') = 'service_role'
  );
