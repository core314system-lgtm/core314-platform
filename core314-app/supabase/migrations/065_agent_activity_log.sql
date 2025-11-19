
CREATE TABLE IF NOT EXISTS agent_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  rule_id UUID REFERENCES automation_rules(id) ON DELETE SET NULL,
  agent_name TEXT NOT NULL, -- e.g., 'ai_agent_dispatcher', 'fusion_optimizer', 'health_monitor'
  event_type TEXT NOT NULL, -- e.g., 'rule_triggered', 'action_executed', 'optimization_started', 'notification_sent'
  action_taken TEXT NOT NULL, -- Description of the action taken
  context JSONB DEFAULT '{}', -- Additional context (metric values, rule details, etc.)
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failed', 'pending')),
  error_message TEXT, -- Error details if status is 'failed'
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_agent_activity_log_user_id ON agent_activity_log(user_id);
CREATE INDEX idx_agent_activity_log_rule_id ON agent_activity_log(rule_id);
CREATE INDEX idx_agent_activity_log_agent_name ON agent_activity_log(agent_name);
CREATE INDEX idx_agent_activity_log_event_type ON agent_activity_log(event_type);
CREATE INDEX idx_agent_activity_log_created_at ON agent_activity_log(created_at DESC);

ALTER TABLE agent_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own agent activity logs"
  ON agent_activity_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert agent activity logs"
  ON agent_activity_log FOR INSERT
  WITH CHECK (true); -- Edge functions use service role

CREATE OR REPLACE FUNCTION cleanup_old_agent_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM agent_activity_log
  WHERE created_at < now() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE agent_activity_log IS 'Audit log for all automated agent actions. Tracks rule triggers, actions executed, and outcomes.';
COMMENT ON COLUMN agent_activity_log.agent_name IS 'Name of the agent that performed the action';
COMMENT ON COLUMN agent_activity_log.event_type IS 'Type of event: rule_triggered, action_executed, optimization_started, notification_sent, etc.';
COMMENT ON COLUMN agent_activity_log.action_taken IS 'Human-readable description of the action taken';
COMMENT ON COLUMN agent_activity_log.context IS 'JSON context with metric values, rule details, and other relevant data';
