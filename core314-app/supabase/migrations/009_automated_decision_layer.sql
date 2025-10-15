-- ============================================================
-- ============================================================

CREATE TABLE IF NOT EXISTS fusion_automation_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rule_name TEXT NOT NULL,
  integration_name TEXT NOT NULL,
  condition_type TEXT NOT NULL CHECK (condition_type IN ('anomaly', 'trend', 'prediction', 'summary')),
  condition_operator TEXT NOT NULL CHECK (condition_operator IN ('>', '<', '=', 'contains')),
  condition_value TEXT NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('notify_slack', 'notify_email', 'adjust_weight', 'trigger_function')),
  action_target TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fusion_automation_rules_enabled ON fusion_automation_rules(enabled);
CREATE INDEX IF NOT EXISTS idx_fusion_automation_rules_integration ON fusion_automation_rules(integration_name);

CREATE TABLE IF NOT EXISTS fusion_action_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rule_id UUID REFERENCES fusion_automation_rules(id) ON DELETE CASCADE,
  integration_name TEXT NOT NULL,
  insight_id UUID REFERENCES fusion_insights(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  action_result TEXT,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fusion_action_log_created_at ON fusion_action_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fusion_action_log_rule_id ON fusion_action_log(rule_id);
CREATE INDEX IF NOT EXISTS idx_fusion_action_log_status ON fusion_action_log(status);

ALTER TABLE fusion_automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE fusion_action_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can manage automation rules" ON fusion_automation_rules;
CREATE POLICY "Admin can manage automation rules"
ON fusion_automation_rules FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.uid() = auth.users.id
    AND auth.users.raw_user_meta_data->>'role' = 'admin'
  )
);

DROP POLICY IF EXISTS "Admin can view action logs" ON fusion_action_log;
CREATE POLICY "Admin can view action logs"
ON fusion_action_log FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.uid() = auth.users.id
    AND auth.users.raw_user_meta_data->>'role' = 'admin'
  )
);

DROP POLICY IF EXISTS "Service role can insert action logs" ON fusion_action_log;
CREATE POLICY "Service role can insert action logs"
ON fusion_action_log FOR INSERT
WITH CHECK (true);

GRANT ALL ON fusion_automation_rules TO service_role;
GRANT SELECT ON fusion_automation_rules TO authenticated;
GRANT ALL ON fusion_action_log TO service_role;
GRANT SELECT ON fusion_action_log TO authenticated;

COMMENT ON TABLE fusion_automation_rules IS 'Stores automation rules that trigger actions based on fusion insights';
COMMENT ON TABLE fusion_action_log IS 'Logs all automated actions executed by the Automated Decision Layer';
