-- Account Usage table for rate limiting
-- Run this in the Supabase SQL editor: https://supabase.com/dashboard/project/psmicdfnvgwsjkhkwoub/sql/new

CREATE TABLE IF NOT EXISTS account_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Index for fast rate limit lookups
CREATE INDEX IF NOT EXISTS idx_account_usage_org_action_time
  ON account_usage (org_id, action_type, created_at DESC);

-- Enable RLS
ALTER TABLE account_usage ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (functions use service role key)
CREATE POLICY "service_role_all" ON account_usage
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Auto-cleanup: delete records older than 24 hours (optional, reduces table bloat)
-- Run periodically via cron or Supabase scheduled function
-- DELETE FROM account_usage WHERE created_at < now() - INTERVAL '24 hours';
