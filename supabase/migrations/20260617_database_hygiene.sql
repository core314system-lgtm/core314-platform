-- Database Hygiene System
-- Adds health scoring, archival, engagement tracking, and suppression list

-- Add hygiene columns to master_subcontractors
ALTER TABLE master_subcontractors
  ADD COLUMN IF NOT EXISTS data_health_score INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archive_reason TEXT,
  ADD COLUMN IF NOT EXISTS soft_bounce_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_bounce_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_engagement_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS domain_checked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS engagement_open_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS engagement_click_count INTEGER NOT NULL DEFAULT 0;

-- Index for fast filtering by archived status + health score
CREATE INDEX IF NOT EXISTS idx_master_sub_archived ON master_subcontractors(archived);
CREATE INDEX IF NOT EXISTS idx_master_sub_health_score ON master_subcontractors(data_health_score);
CREATE INDEX IF NOT EXISTS idx_master_sub_archived_health ON master_subcontractors(archived, data_health_score) WHERE archived = false;
CREATE INDEX IF NOT EXISTS idx_master_sub_last_engagement ON master_subcontractors(last_engagement_at);

-- Email Suppression List — permanently blocked emails
CREATE TABLE IF NOT EXISTS email_suppression_list (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  reason TEXT NOT NULL, -- spam_complaint, hard_bounce, manual, etc.
  suppressed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_suppression_email ON email_suppression_list(email);

-- Database Hygiene Log — audit trail of all automated actions
CREATE TABLE IF NOT EXISTS database_hygiene_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  master_sub_id TEXT,
  email TEXT,
  action TEXT NOT NULL, -- hard_bounce_delete, spam_complaint_delete, dead_domain_delete, auto_archive, engagement_decay_archive
  reason TEXT,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hygiene_log_action ON database_hygiene_log(action);
CREATE INDEX IF NOT EXISTS idx_hygiene_log_performed ON database_hygiene_log(performed_at);

-- RPC function to increment engagement counters atomically
CREATE OR REPLACE FUNCTION increment_master_sub_field(row_id UUID, field_name TEXT)
RETURNS void AS $$
BEGIN
  EXECUTE format('UPDATE master_subcontractors SET %I = COALESCE(%I, 0) + 1 WHERE id = $1', field_name, field_name)
  USING row_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies
ALTER TABLE email_suppression_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE database_hygiene_log ENABLE ROW LEVEL SECURITY;

-- Service role has full access (for webhook functions)
CREATE POLICY "Service role full access suppression" ON email_suppression_list
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access hygiene log" ON database_hygiene_log
  FOR ALL USING (true) WITH CHECK (true);
