-- =====================================================
-- =====================================================

CREATE TABLE IF NOT EXISTS escalation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  
  rule_name VARCHAR(255) NOT NULL,
  rule_description TEXT,
  rule_category VARCHAR(100), -- 'failure', 'timeout', 'high_risk', 'approval_required', 'sla_breach', 'custom'
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 5, -- 1 (highest) to 10 (lowest)
  
  trigger_conditions JSONB NOT NULL DEFAULT '{}', -- Conditions that activate this rule
  
  applies_to_action_types VARCHAR(100)[] DEFAULT '{}', -- Empty = applies to all
  applies_to_integrations VARCHAR(100)[] DEFAULT '{}', -- Empty = applies to all
  applies_to_flows UUID[] DEFAULT '{}', -- Specific orchestration_flow_ids
  
  escalation_levels JSONB NOT NULL DEFAULT '[]', -- Array of escalation level objects
  
  notification_channels JSONB DEFAULT '{}', -- Channel-specific configuration
  
  auto_remediation_enabled BOOLEAN DEFAULT false,
  remediation_actions JSONB DEFAULT '[]', -- Array of automatic remediation steps
  
  sla_enabled BOOLEAN DEFAULT false,
  sla_response_time_minutes INTEGER, -- Time to acknowledge escalation
  sla_resolution_time_minutes INTEGER, -- Time to resolve issue
  sla_breach_actions JSONB DEFAULT '[]', -- Actions to take on SLA breach
  
  max_escalations_per_hour INTEGER DEFAULT 10,
  max_escalations_per_day INTEGER DEFAULT 50,
  cooldown_period_minutes INTEGER DEFAULT 5, -- Minimum time between escalations for same issue
  
  total_escalations INTEGER DEFAULT 0,
  successful_resolutions INTEGER DEFAULT 0,
  failed_resolutions INTEGER DEFAULT 0,
  avg_resolution_time_minutes DECIMAL(10,2),
  last_triggered_at TIMESTAMPTZ,
  
  tags VARCHAR(100)[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_priority CHECK (priority >= 1 AND priority <= 10),
  CONSTRAINT valid_sla_times CHECK (
    (NOT sla_enabled) OR 
    (sla_response_time_minutes IS NOT NULL AND sla_resolution_time_minutes IS NOT NULL)
  )
);

CREATE INDEX idx_escalation_rules_user_id ON escalation_rules(user_id);
CREATE INDEX idx_escalation_rules_organization_id ON escalation_rules(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX idx_escalation_rules_is_active ON escalation_rules(is_active) WHERE is_active = true;
CREATE INDEX idx_escalation_rules_priority ON escalation_rules(priority);
CREATE INDEX idx_escalation_rules_category ON escalation_rules(rule_category);
CREATE INDEX idx_escalation_rules_tags ON escalation_rules USING GIN(tags);
CREATE INDEX idx_escalation_rules_trigger_conditions ON escalation_rules USING GIN(trigger_conditions);
CREATE INDEX idx_escalation_rules_applies_to_flows ON escalation_rules USING GIN(applies_to_flows);

ALTER TABLE escalation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY escalation_rules_select_policy ON escalation_rules
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY escalation_rules_insert_policy ON escalation_rules
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY escalation_rules_update_policy ON escalation_rules
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY escalation_rules_delete_policy ON escalation_rules
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_escalation_rules_updated_at
  BEFORE UPDATE ON escalation_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS escalation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  
  escalation_rule_id UUID NOT NULL REFERENCES escalation_rules(id) ON DELETE CASCADE,
  execution_queue_id UUID REFERENCES execution_queue(id) ON DELETE SET NULL,
  execution_log_id UUID REFERENCES execution_log(id) ON DELETE SET NULL,
  orchestration_flow_id UUID REFERENCES orchestration_flows(id) ON DELETE SET NULL,
  
  escalation_level INTEGER NOT NULL,
  escalation_reason TEXT NOT NULL,
  trigger_conditions_met JSONB NOT NULL,
  
  status VARCHAR(50) DEFAULT 'triggered', -- 'triggered', 'acknowledged', 'in_progress', 'resolved', 'failed', 'cancelled'
  acknowledged_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  acknowledged_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  
  actions_performed JSONB DEFAULT '[]', -- Array of actions executed
  notifications_sent JSONB DEFAULT '[]', -- Array of notifications sent
  remediation_attempted BOOLEAN DEFAULT false,
  remediation_successful BOOLEAN,
  
  sla_response_deadline TIMESTAMPTZ,
  sla_resolution_deadline TIMESTAMPTZ,
  sla_response_breached BOOLEAN DEFAULT false,
  sla_resolution_breached BOOLEAN DEFAULT false,
  
  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  resolution_duration_minutes INTEGER,
  
  context_data JSONB DEFAULT '{}',
  tags VARCHAR(100)[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_status CHECK (status IN ('triggered', 'acknowledged', 'in_progress', 'resolved', 'failed', 'cancelled')),
  CONSTRAINT valid_escalation_level CHECK (escalation_level >= 1)
);

CREATE INDEX idx_escalation_events_user_id ON escalation_events(user_id);
CREATE INDEX idx_escalation_events_rule_id ON escalation_events(escalation_rule_id);
CREATE INDEX idx_escalation_events_status ON escalation_events(status);
CREATE INDEX idx_escalation_events_triggered_at ON escalation_events(triggered_at DESC);
CREATE INDEX idx_escalation_events_sla_breach ON escalation_events(sla_response_breached, sla_resolution_breached) 
  WHERE sla_response_breached = true OR sla_resolution_breached = true;

ALTER TABLE escalation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY escalation_events_select_policy ON escalation_events
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY escalation_events_insert_policy ON escalation_events
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY escalation_events_update_policy ON escalation_events
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY escalation_events_delete_policy ON escalation_events
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_escalation_events_updated_at
  BEFORE UPDATE ON escalation_events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION find_matching_escalation_rules(
  p_user_id UUID,
  p_execution_queue_id UUID,
  p_trigger_context JSONB
)
RETURNS TABLE (
  rule_id UUID,
  rule_name VARCHAR(255),
  escalation_levels JSONB,
  notification_channels JSONB,
  auto_remediation_enabled BOOLEAN,
  remediation_actions JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    id,
    escalation_rules.rule_name,
    escalation_rules.escalation_levels,
    escalation_rules.notification_channels,
    escalation_rules.auto_remediation_enabled,
    escalation_rules.remediation_actions
  FROM escalation_rules
  WHERE user_id = p_user_id
    AND is_active = true
    AND check_escalation_conditions(trigger_conditions, p_trigger_context)
  ORDER BY priority ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION check_escalation_conditions(
  p_rule_conditions JSONB,
  p_actual_context JSONB
)
RETURNS BOOLEAN AS $$
DECLARE
  v_condition_key TEXT;
  v_condition_value JSONB;
  v_actual_value JSONB;
BEGIN
  FOR v_condition_key, v_condition_value IN SELECT * FROM jsonb_each(p_rule_conditions)
  LOOP
    v_actual_value := p_actual_context -> v_condition_key;
    
    IF jsonb_typeof(v_condition_value) != 'object' THEN
      IF v_actual_value IS NULL OR v_actual_value != v_condition_value THEN
        RETURN false;
      END IF;
    ELSE
      IF v_actual_value IS NULL THEN
        RETURN false;
      END IF;
    END IF;
  END LOOP;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION trigger_escalation(
  p_user_id UUID,
  p_escalation_rule_id UUID,
  p_execution_queue_id UUID,
  p_escalation_reason TEXT,
  p_trigger_conditions_met JSONB
)
RETURNS UUID AS $$
DECLARE
  v_event_id UUID;
  v_escalation_levels JSONB;
  v_first_level JSONB;
  v_sla_response_minutes INTEGER;
  v_sla_resolution_minutes INTEGER;
BEGIN
  SELECT 
    escalation_levels,
    sla_response_time_minutes,
    sla_resolution_time_minutes
  INTO v_escalation_levels, v_sla_response_minutes, v_sla_resolution_minutes
  FROM escalation_rules
  WHERE id = p_escalation_rule_id;
  
  v_first_level := v_escalation_levels -> 0;
  
  INSERT INTO escalation_events (
    user_id,
    escalation_rule_id,
    execution_queue_id,
    escalation_level,
    escalation_reason,
    trigger_conditions_met,
    sla_response_deadline,
    sla_resolution_deadline
  ) VALUES (
    p_user_id,
    p_escalation_rule_id,
    p_execution_queue_id,
    (v_first_level ->> 'level')::INTEGER,
    p_escalation_reason,
    p_trigger_conditions_met,
    CASE WHEN v_sla_response_minutes IS NOT NULL 
      THEN NOW() + (v_sla_response_minutes || ' minutes')::INTERVAL 
      ELSE NULL END,
    CASE WHEN v_sla_resolution_minutes IS NOT NULL 
      THEN NOW() + (v_sla_resolution_minutes || ' minutes')::INTERVAL 
      ELSE NULL END
  ) RETURNING id INTO v_event_id;
  
  UPDATE escalation_rules
  SET 
    total_escalations = total_escalations + 1,
    last_triggered_at = NOW(),
    updated_at = NOW()
  WHERE id = p_escalation_rule_id;
  
  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_active_escalations(
  p_user_id UUID
)
RETURNS TABLE (
  event_id UUID,
  rule_name VARCHAR(255),
  escalation_level INTEGER,
  escalation_reason TEXT,
  status VARCHAR(50),
  triggered_at TIMESTAMPTZ,
  sla_response_breached BOOLEAN,
  sla_resolution_breached BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    r.rule_name,
    e.escalation_level,
    e.escalation_reason,
    e.status,
    e.triggered_at,
    e.sla_response_breached,
    e.sla_resolution_breached
  FROM escalation_events e
  JOIN escalation_rules r ON e.escalation_rule_id = r.id
  WHERE e.user_id = p_user_id
    AND e.status IN ('triggered', 'acknowledged', 'in_progress')
  ORDER BY e.triggered_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION check_sla_breaches()
RETURNS INTEGER AS $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  UPDATE escalation_events
  SET 
    sla_response_breached = true,
    updated_at = NOW()
  WHERE status = 'triggered'
    AND sla_response_deadline IS NOT NULL
    AND sla_response_deadline < NOW()
    AND sla_response_breached = false;
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  UPDATE escalation_events
  SET 
    sla_resolution_breached = true,
    updated_at = NOW()
  WHERE status IN ('triggered', 'acknowledged', 'in_progress')
    AND sla_resolution_deadline IS NOT NULL
    AND sla_resolution_deadline < NOW()
    AND sla_resolution_breached = false;
  
  GET DIAGNOSTICS v_updated_count = v_updated_count + ROW_COUNT;
  
  RETURN v_updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE escalation_rules IS 'Phase 6: Defines fallback logic for failed or high-risk executions with multi-level escalation';
COMMENT ON COLUMN escalation_rules.trigger_conditions IS 'JSONB conditions that activate this rule (execution_status, error_code, risk_level, etc.)';
COMMENT ON COLUMN escalation_rules.escalation_levels IS 'Array of escalation tiers with delays and actions: [{level, delay_minutes, actions, notify_channels}]';
COMMENT ON COLUMN escalation_rules.notification_channels IS 'Channel-specific configuration for email, Slack, Teams, PagerDuty, etc.';
COMMENT ON COLUMN escalation_rules.remediation_actions IS 'Array of automatic remediation steps to attempt before escalating';
COMMENT ON TABLE escalation_events IS 'Phase 6: Tracks individual escalation occurrences with SLA tracking and resolution status';
