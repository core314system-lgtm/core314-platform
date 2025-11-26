-- =====================================================
-- =====================================================

CREATE TABLE IF NOT EXISTS orchestration_flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  
  flow_name VARCHAR(255) NOT NULL,
  flow_description TEXT,
  flow_category VARCHAR(100), -- 'notification', 'data_sync', 'approval', 'escalation', 'custom'
  flow_version INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  is_template BOOLEAN DEFAULT false,
  
  trigger_type VARCHAR(100) NOT NULL, -- 'decision_approved', 'recommendation_created', 'threshold_exceeded', 'scheduled', 'manual', 'webhook'
  trigger_config JSONB DEFAULT '{}', -- Trigger-specific configuration (schedule, conditions, filters)
  
  flow_steps JSONB NOT NULL DEFAULT '[]', -- Array of step objects: [{id, type, config, position, connections}]
  
  execution_mode VARCHAR(50) DEFAULT 'sequential', -- 'sequential', 'parallel', 'mixed'
  max_execution_time_seconds INTEGER DEFAULT 300, -- 5 minutes default timeout
  retry_policy JSONB DEFAULT '{"max_attempts": 3, "backoff_seconds": [10, 30, 60]}',
  requires_approval BOOLEAN DEFAULT false,
  approval_threshold DECIMAL(3,2), -- Confidence threshold for auto-approval (0.0-1.0)
  
  conditions JSONB DEFAULT '[]', -- Array of condition objects for flow execution
  input_schema JSONB, -- Expected input data structure
  output_schema JSONB, -- Expected output data structure
  
  on_error_action VARCHAR(100) DEFAULT 'escalate', -- 'escalate', 'retry', 'skip', 'abort', 'fallback'
  fallback_flow_id UUID REFERENCES orchestration_flows(id) ON DELETE SET NULL,
  error_notification_channels JSONB DEFAULT '[]', -- ['email', 'slack', 'teams']
  
  avg_execution_time_ms INTEGER,
  success_rate DECIMAL(5,2), -- Percentage (0.00-100.00)
  total_executions INTEGER DEFAULT 0,
  successful_executions INTEGER DEFAULT 0,
  failed_executions INTEGER DEFAULT 0,
  last_executed_at TIMESTAMPTZ,
  
  tags VARCHAR(100)[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_execution_mode CHECK (execution_mode IN ('sequential', 'parallel', 'mixed')),
  CONSTRAINT valid_on_error_action CHECK (on_error_action IN ('escalate', 'retry', 'skip', 'abort', 'fallback')),
  CONSTRAINT valid_approval_threshold CHECK (approval_threshold IS NULL OR (approval_threshold >= 0 AND approval_threshold <= 1)),
  CONSTRAINT valid_success_rate CHECK (success_rate IS NULL OR (success_rate >= 0 AND success_rate <= 100))
);

CREATE INDEX idx_orchestration_flows_user_id ON orchestration_flows(user_id);
CREATE INDEX idx_orchestration_flows_organization_id ON orchestration_flows(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX idx_orchestration_flows_is_active ON orchestration_flows(is_active) WHERE is_active = true;
CREATE INDEX idx_orchestration_flows_trigger_type ON orchestration_flows(trigger_type);
CREATE INDEX idx_orchestration_flows_flow_category ON orchestration_flows(flow_category);
CREATE INDEX idx_orchestration_flows_created_at ON orchestration_flows(created_at DESC);
CREATE INDEX idx_orchestration_flows_last_executed ON orchestration_flows(last_executed_at DESC) WHERE last_executed_at IS NOT NULL;
CREATE INDEX idx_orchestration_flows_success_rate ON orchestration_flows(success_rate DESC) WHERE success_rate IS NOT NULL;
CREATE INDEX idx_orchestration_flows_tags ON orchestration_flows USING GIN(tags);
CREATE INDEX idx_orchestration_flows_flow_steps ON orchestration_flows USING GIN(flow_steps);

ALTER TABLE orchestration_flows ENABLE ROW LEVEL SECURITY;

CREATE POLICY orchestration_flows_select_policy ON orchestration_flows
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY orchestration_flows_insert_policy ON orchestration_flows
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY orchestration_flows_update_policy ON orchestration_flows
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY orchestration_flows_delete_policy ON orchestration_flows
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_orchestration_flows_updated_at
  BEFORE UPDATE ON orchestration_flows
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION get_active_flows_by_trigger(
  p_user_id UUID,
  p_trigger_type VARCHAR(100)
)
RETURNS TABLE (
  flow_id UUID,
  flow_name VARCHAR(255),
  flow_steps JSONB,
  execution_mode VARCHAR(50),
  requires_approval BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    id,
    orchestration_flows.flow_name,
    orchestration_flows.flow_steps,
    orchestration_flows.execution_mode,
    orchestration_flows.requires_approval
  FROM orchestration_flows
  WHERE user_id = p_user_id
    AND trigger_type = p_trigger_type
    AND is_active = true
  ORDER BY created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION update_flow_execution_stats(
  p_flow_id UUID,
  p_execution_time_ms INTEGER,
  p_success BOOLEAN
)
RETURNS VOID AS $$
DECLARE
  v_total INTEGER;
  v_successful INTEGER;
  v_failed INTEGER;
  v_avg_time INTEGER;
BEGIN
  SELECT 
    total_executions,
    successful_executions,
    failed_executions,
    avg_execution_time_ms
  INTO v_total, v_successful, v_failed, v_avg_time
  FROM orchestration_flows
  WHERE id = p_flow_id;
  
  v_total := v_total + 1;
  IF p_success THEN
    v_successful := v_successful + 1;
  ELSE
    v_failed := v_failed + 1;
  END IF;
  
  IF v_avg_time IS NULL THEN
    v_avg_time := p_execution_time_ms;
  ELSE
    v_avg_time := ((v_avg_time * (v_total - 1)) + p_execution_time_ms) / v_total;
  END IF;
  
  UPDATE orchestration_flows
  SET 
    total_executions = v_total,
    successful_executions = v_successful,
    failed_executions = v_failed,
    success_rate = (v_successful::DECIMAL / v_total::DECIMAL) * 100,
    avg_execution_time_ms = v_avg_time,
    last_executed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_flow_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION clone_orchestration_flow(
  p_flow_id UUID,
  p_new_version INTEGER DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_new_flow_id UUID;
  v_new_version INTEGER;
BEGIN
  IF p_new_version IS NULL THEN
    SELECT COALESCE(MAX(flow_version), 0) + 1
    INTO v_new_version
    FROM orchestration_flows
    WHERE flow_name = (SELECT flow_name FROM orchestration_flows WHERE id = p_flow_id);
  ELSE
    v_new_version := p_new_version;
  END IF;
  
  INSERT INTO orchestration_flows (
    user_id, organization_id, flow_name, flow_description, flow_category,
    flow_version, is_active, trigger_type, trigger_config, flow_steps,
    execution_mode, max_execution_time_seconds, retry_policy,
    requires_approval, approval_threshold, conditions, input_schema,
    output_schema, on_error_action, fallback_flow_id,
    error_notification_channels, tags, metadata, created_by
  )
  SELECT 
    user_id, organization_id, flow_name, flow_description, flow_category,
    v_new_version, false, trigger_type, trigger_config, flow_steps,
    execution_mode, max_execution_time_seconds, retry_policy,
    requires_approval, approval_threshold, conditions, input_schema,
    output_schema, on_error_action, fallback_flow_id,
    error_notification_channels, tags, metadata, user_id
  FROM orchestration_flows
  WHERE id = p_flow_id
  RETURNING id INTO v_new_flow_id;
  
  RETURN v_new_flow_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE orchestration_flows IS 'Phase 6: Stores multi-step automation sequences with visual flow builder support';
COMMENT ON COLUMN orchestration_flows.flow_steps IS 'Array of step objects for visual flow builder: [{id, type, config, position, connections}]';
COMMENT ON COLUMN orchestration_flows.trigger_config IS 'Trigger-specific configuration (schedule, conditions, filters)';
COMMENT ON COLUMN orchestration_flows.retry_policy IS 'Retry configuration: {"max_attempts": 3, "backoff_seconds": [10, 30, 60]}';
COMMENT ON COLUMN orchestration_flows.conditions IS 'Array of condition objects for flow execution gating';
COMMENT ON COLUMN orchestration_flows.success_rate IS 'Percentage of successful executions (0.00-100.00)';
