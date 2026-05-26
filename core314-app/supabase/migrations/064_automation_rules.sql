
CREATE TABLE IF NOT EXISTS automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rule_name TEXT NOT NULL,
  description TEXT,
  metric_type TEXT NOT NULL, -- e.g., 'fusion_score', 'efficiency_index', 'integration_health', 'anomaly_count'
  condition_operator TEXT NOT NULL CHECK (condition_operator IN ('>', '<', '>=', '<=', '=', '!=')),
  threshold_value NUMERIC NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('notify', 'optimize', 'adjust', 'alert', 'log')),
  action_config JSONB DEFAULT '{}', -- Configuration for the action (e.g., notification channels, optimization parameters)
  target_integration TEXT, -- Optional: specific integration to target
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'disabled')),
  last_triggered_at TIMESTAMPTZ,
  trigger_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_automation_rules_user_id ON automation_rules(user_id);
CREATE INDEX idx_automation_rules_status ON automation_rules(status);
CREATE INDEX idx_automation_rules_metric_type ON automation_rules(metric_type);

ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own automation rules"
  ON automation_rules FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own automation rules"
  ON automation_rules FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own automation rules"
  ON automation_rules FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own automation rules"
  ON automation_rules FOR DELETE
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION update_automation_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER automation_rules_updated_at
  BEFORE UPDATE ON automation_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_automation_rules_updated_at();

COMMENT ON TABLE automation_rules IS 'Stores user-defined automation rules for Smart Agent system. Rules define conditions and actions to be executed automatically.';
COMMENT ON COLUMN automation_rules.metric_type IS 'Type of metric to monitor: fusion_score, efficiency_index, integration_health, anomaly_count, etc.';
COMMENT ON COLUMN automation_rules.condition_operator IS 'Comparison operator: >, <, >=, <=, =, !=';
COMMENT ON COLUMN automation_rules.threshold_value IS 'Numeric threshold value that triggers the rule';
COMMENT ON COLUMN automation_rules.action_type IS 'Type of action to execute: notify, optimize, adjust, alert, log';
COMMENT ON COLUMN automation_rules.action_config IS 'JSON configuration for the action (e.g., {"channel": "slack", "webhook_url": "..."})';
