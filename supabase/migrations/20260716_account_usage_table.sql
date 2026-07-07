-- ============================================================================
-- Account Usage Tracking — Required for AI/API/Email rate limiting to function
-- ============================================================================
-- The rate-limiter (_shared/rate-limiter.ts) queries this table to enforce
-- per-plan usage limits. Without it, all rate limit checks silently pass.
-- ============================================================================

CREATE TABLE IF NOT EXISTS account_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('ai_call', 'email', 'api_call')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_account_usage_org_action_time
  ON account_usage(org_id, action_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_account_usage_created
  ON account_usage(created_at DESC);

ALTER TABLE account_usage ENABLE ROW LEVEL SECURITY;

-- Only service role (server-side functions) can insert/read
-- No authenticated user access needed — this is purely server-side tracking
CREATE POLICY "Service role full access on account_usage"
  ON account_usage FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Admins can read usage stats
CREATE POLICY "Admins can read account usage"
  ON account_usage FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_global_admin = true
    )
  );

-- Auto-cleanup: delete records older than 90 days (run via database-hygiene cron)
-- This keeps the table small and performant
COMMENT ON TABLE account_usage IS 'Tracks AI/API/email usage per org for rate limiting. Auto-pruned after 90 days.';
