
ALTER TABLE user_integrations 
  ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS error_message TEXT;

ALTER TABLE user_integrations 
  DROP CONSTRAINT IF EXISTS user_integrations_status_check;

ALTER TABLE user_integrations 
  ADD CONSTRAINT user_integrations_status_check 
  CHECK (status IN ('active', 'inactive', 'error', 'pending'));

CREATE INDEX IF NOT EXISTS idx_user_integrations_status_verified 
  ON user_integrations(user_id, status, last_verified_at);

COMMENT ON COLUMN user_integrations.last_verified_at IS 'Timestamp of last successful credential validation';
COMMENT ON COLUMN user_integrations.error_message IS 'Error message from last validation attempt (null if successful)';
COMMENT ON COLUMN user_integrations.config IS 'Encrypted credentials and configuration (JSONB)';
