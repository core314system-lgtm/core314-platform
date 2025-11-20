-- ============================================================================
-- ============================================================================

CREATE TABLE IF NOT EXISTS billing_activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    session_url TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_activity_log_user_id 
ON billing_activity_log(user_id);

CREATE INDEX IF NOT EXISTS idx_billing_activity_log_event_type 
ON billing_activity_log(event_type);

CREATE INDEX IF NOT EXISTS idx_billing_activity_log_created_at 
ON billing_activity_log(created_at DESC);

ALTER TABLE billing_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own billing activity"
ON billing_activity_log
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert billing activity"
ON billing_activity_log
FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Service role can view all billing activity"
ON billing_activity_log
FOR SELECT
TO service_role
USING (true);

GRANT SELECT ON billing_activity_log TO authenticated;
GRANT ALL ON billing_activity_log TO service_role;

COMMENT ON TABLE billing_activity_log IS 'Tracks all billing-related activities including portal sessions, subscription changes, and payment method updates';
