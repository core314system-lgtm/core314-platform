
CREATE TABLE IF NOT EXISTS automation_reliability_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_run_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  action_type TEXT NOT NULL CHECK (action_type IN ('alert', 'notify', 'optimize')),
  channel TEXT NOT NULL CHECK (channel IN ('slack', 'teams', 'email', 'in-app')),
  latency_ms INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
  error_message TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  correlation_id TEXT,
  is_test BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_automation_reliability_log_created_at 
  ON automation_reliability_log(created_at DESC);

CREATE INDEX idx_automation_reliability_log_channel_created_at 
  ON automation_reliability_log(channel, created_at DESC);

CREATE INDEX idx_automation_reliability_log_action_type_created_at 
  ON automation_reliability_log(action_type, created_at DESC);

CREATE INDEX idx_automation_reliability_log_status_created_at 
  ON automation_reliability_log(status, created_at DESC);

CREATE INDEX idx_automation_reliability_log_test_run_id 
  ON automation_reliability_log(test_run_id);

CREATE INDEX idx_automation_reliability_log_failures 
  ON automation_reliability_log(created_at DESC) 
  WHERE status = 'failed';

ALTER TABLE automation_reliability_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role has full access to automation_reliability_log"
  ON automation_reliability_log
  FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Admins can read all automation_reliability_log"
  ON automation_reliability_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can read their own automation_reliability_log"
  ON automation_reliability_log
  FOR SELECT
  USING (user_id = auth.uid());

COMMENT ON TABLE automation_reliability_log IS 'Tracks automated self-test results for Smart Agent reliability monitoring. Used by ai_agent_selftest Edge Function to log test execution metrics.';

COMMENT ON COLUMN automation_reliability_log.test_run_id IS 'Correlates the 3 actions (alert, notify, optimize) run together in a single selftest execution';
COMMENT ON COLUMN automation_reliability_log.latency_ms IS 'End-to-end HTTP call duration for the action execution in milliseconds';
COMMENT ON COLUMN automation_reliability_log.channel IS 'Delivery channel used (slack, teams, email, or in-app)';
COMMENT ON COLUMN automation_reliability_log.is_test IS 'Marks this as a test record to exclude from production analytics';
COMMENT ON COLUMN automation_reliability_log.correlation_id IS 'Optional correlation ID for tracing across systems and Sentry';
