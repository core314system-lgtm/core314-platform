
-- ============================================================================
-- ============================================================================
CREATE TABLE IF NOT EXISTS rate_limits (
  user_id UUID NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_user_window 
  ON rate_limits(user_id, window_start DESC);

ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own rate limits"
  ON rate_limits
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can read all rate limits"
  ON rate_limits
  FOR SELECT
  TO service_role
  USING (true);

-- ============================================================================
-- ============================================================================
CREATE TABLE IF NOT EXISTS function_error_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  function_name TEXT NOT NULL,
  user_id UUID,
  status_code INTEGER NOT NULL,
  error_type TEXT,
  error_message TEXT,
  request_path TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_function_error_events_created_at 
  ON function_error_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_function_error_events_function_status 
  ON function_error_events(function_name, status_code, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_function_error_events_user 
  ON function_error_events(user_id, created_at DESC);

ALTER TABLE function_error_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own error events"
  ON function_error_events
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Service role can read all error events"
  ON function_error_events
  FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "Service role can insert error events"
  ON function_error_events
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- ============================================================================
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM rate_limits
  WHERE window_start < NOW() - INTERVAL '1 day';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

CREATE OR REPLACE FUNCTION cleanup_old_error_events()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM function_error_events
  WHERE created_at < NOW() - INTERVAL '30 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION cleanup_old_rate_limits() TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_old_error_events() TO service_role;

-- ============================================================================
-- ============================================================================
COMMENT ON TABLE rate_limits IS 'Tracks API request counts per user per time window for rate limiting (20 req/min)';
COMMENT ON TABLE function_error_events IS 'Logs errors from Edge Functions for monitoring and alerting';
COMMENT ON FUNCTION cleanup_old_rate_limits() IS 'Removes rate limit records older than 1 day';
COMMENT ON FUNCTION cleanup_old_error_events() IS 'Removes error event records older than 30 days';
