-- =====================================================================================
-- =====================================================================================


-- =====================================================================================
-- =====================================================================================

CREATE TABLE IF NOT EXISTS recovery_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  
  action_type VARCHAR(100) NOT NULL, -- 'restart_function', 'rollback_deployment', 'scale_up', 'scale_down', 'clear_cache', 'reset_connection', 'failover', 'circuit_breaker', 'rate_limit', 'alert_escalation'
  action_category VARCHAR(50) NOT NULL, -- 'restart', 'scaling', 'cache', 'network', 'deployment', 'notification'
  action_name VARCHAR(255) NOT NULL, -- Human-readable action name
  action_description TEXT, -- Detailed description of action
  
  trigger_type VARCHAR(50) NOT NULL, -- 'automatic', 'manual', 'scheduled', 'escalation'
  triggered_by_user_id UUID REFERENCES auth.users(id), -- User who triggered (if manual)
  triggered_by_anomaly_id UUID, -- Reference to anomaly_signals.id
  triggered_by_health_event_id UUID, -- Reference to system_health_events.id
  triggered_by_escalation_id UUID, -- Reference to escalation_events.id
  trigger_reason TEXT NOT NULL, -- Why this action was triggered
  
  target_component_type VARCHAR(50) NOT NULL, -- 'edge_function', 'api_endpoint', 'database', 'integration', 'cache', 'deployment'
  target_component_name VARCHAR(255) NOT NULL, -- Specific component to act on
  target_component_id VARCHAR(255), -- Component identifier (function name, endpoint path, etc.)
  target_environment VARCHAR(50) DEFAULT 'production', -- 'production', 'staging', 'development'
  
  action_config JSONB NOT NULL, -- Configuration for the action (e.g., {"replicas": 3, "timeout": 30})
  action_parameters JSONB, -- Additional parameters passed to action executor
  retry_policy JSONB, -- {"max_attempts": 3, "backoff_seconds": 5, "exponential": true}
  timeout_seconds INTEGER DEFAULT 300, -- Maximum time allowed for action execution
  
  execution_status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'failed', 'timeout', 'cancelled', 'rolled_back'
  execution_started_at TIMESTAMPTZ,
  execution_completed_at TIMESTAMPTZ,
  execution_duration_ms INTEGER, -- Time taken to execute action
  
  attempt_number INTEGER DEFAULT 1, -- Current attempt number
  max_attempts INTEGER DEFAULT 1, -- Maximum retry attempts
  last_attempt_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  
  execution_result JSONB, -- Detailed result data
  execution_output TEXT, -- Output/logs from action execution
  execution_error TEXT, -- Error message if failed
  execution_error_code VARCHAR(50), -- Error code for categorization
  success BOOLEAN, -- True if action succeeded
  
  affected_users_count INTEGER DEFAULT 0, -- Number of users affected by action
  affected_components TEXT[], -- List of components affected
  downtime_seconds INTEGER, -- Downtime caused by action (if any)
  recovery_effectiveness_score DECIMAL(5,2), -- 0-100 score of how effective the recovery was
  
  pre_action_metrics JSONB, -- Metrics before action (e.g., {"error_rate": 15.5, "latency_ms": 2500})
  post_action_metrics JSONB, -- Metrics after action (e.g., {"error_rate": 0.5, "latency_ms": 150})
  metrics_improvement_percentage DECIMAL(10,2), -- Percentage improvement in key metrics
  
  rollback_required BOOLEAN DEFAULT false, -- Whether rollback is needed
  rollback_action_id UUID, -- Reference to recovery_actions.id if this action was rolled back
  rollback_reason TEXT, -- Why rollback was needed
  rollback_completed_at TIMESTAMPTZ,
  
  requires_approval BOOLEAN DEFAULT false,
  approval_status VARCHAR(50), -- 'pending', 'approved', 'rejected'
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  approval_notes TEXT,
  
  notifications_sent JSONB, -- {"slack": true, "email": true, "pagerduty": false}
  notification_channels TEXT[], -- Channels notified
  
  executed_by VARCHAR(50) NOT NULL DEFAULT 'system', -- 'system', 'admin', 'user'
  execution_context JSONB, -- Additional context about execution environment
  
  metadata JSONB, -- Additional action-specific data
  tags TEXT[], -- Tags for filtering and grouping
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================================
-- =====================================================================================

CREATE INDEX idx_recovery_actions_user_id ON recovery_actions(user_id);
CREATE INDEX idx_recovery_actions_organization_id ON recovery_actions(organization_id);
CREATE INDEX idx_recovery_actions_action_type ON recovery_actions(action_type);
CREATE INDEX idx_recovery_actions_execution_status ON recovery_actions(execution_status);

CREATE INDEX idx_recovery_actions_created_at ON recovery_actions(created_at DESC);
CREATE INDEX idx_recovery_actions_execution_started ON recovery_actions(execution_started_at DESC) WHERE execution_started_at IS NOT NULL;
CREATE INDEX idx_recovery_actions_execution_completed ON recovery_actions(execution_completed_at DESC) WHERE execution_completed_at IS NOT NULL;

CREATE INDEX idx_recovery_actions_trigger_type ON recovery_actions(trigger_type);
CREATE INDEX idx_recovery_actions_anomaly_id ON recovery_actions(triggered_by_anomaly_id) WHERE triggered_by_anomaly_id IS NOT NULL;
CREATE INDEX idx_recovery_actions_health_event_id ON recovery_actions(triggered_by_health_event_id) WHERE triggered_by_health_event_id IS NOT NULL;

CREATE INDEX idx_recovery_actions_target_component ON recovery_actions(target_component_type, target_component_name);
CREATE INDEX idx_recovery_actions_target_environment ON recovery_actions(target_environment);

CREATE INDEX idx_recovery_actions_pending ON recovery_actions(execution_status, created_at DESC) WHERE execution_status IN ('pending', 'in_progress');
CREATE INDEX idx_recovery_actions_failed ON recovery_actions(execution_status, created_at DESC) WHERE execution_status IN ('failed', 'timeout');
CREATE INDEX idx_recovery_actions_success ON recovery_actions(success, created_at DESC) WHERE success = true;

CREATE INDEX idx_recovery_actions_pending_approval ON recovery_actions(approval_status, created_at DESC) WHERE requires_approval = true AND approval_status = 'pending';

CREATE INDEX idx_recovery_actions_next_retry ON recovery_actions(next_retry_at ASC) WHERE next_retry_at IS NOT NULL AND execution_status = 'pending';

CREATE INDEX idx_recovery_actions_user_status_time ON recovery_actions(user_id, execution_status, created_at DESC);
CREATE INDEX idx_recovery_actions_type_success_time ON recovery_actions(action_type, success, created_at DESC);

CREATE INDEX idx_recovery_actions_action_config ON recovery_actions USING GIN(action_config);
CREATE INDEX idx_recovery_actions_execution_result ON recovery_actions USING GIN(execution_result);
CREATE INDEX idx_recovery_actions_affected_components ON recovery_actions USING GIN(affected_components);
CREATE INDEX idx_recovery_actions_metadata ON recovery_actions USING GIN(metadata);
CREATE INDEX idx_recovery_actions_tags ON recovery_actions USING GIN(tags);

-- =====================================================================================
-- =====================================================================================

ALTER TABLE recovery_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY recovery_actions_select_own ON recovery_actions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY recovery_actions_select_admin ON recovery_actions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY recovery_actions_insert_system ON recovery_actions
  FOR INSERT
  WITH CHECK (true); -- Service role bypasses RLS

CREATE POLICY recovery_actions_update_admin ON recovery_actions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY recovery_actions_update_system ON recovery_actions
  FOR UPDATE
  USING (true); -- Service role bypasses RLS

-- =====================================================================================
-- =====================================================================================

CREATE OR REPLACE FUNCTION get_pending_recovery_actions(
  p_user_id UUID DEFAULT NULL,
  p_target_component_type VARCHAR DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  action_type VARCHAR,
  action_name VARCHAR,
  target_component_name VARCHAR,
  trigger_reason TEXT,
  execution_status VARCHAR,
  attempt_number INTEGER,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ra.id,
    ra.action_type,
    ra.action_name,
    ra.target_component_name,
    ra.trigger_reason,
    ra.execution_status,
    ra.attempt_number,
    ra.created_at
  FROM recovery_actions ra
  WHERE (p_user_id IS NULL OR ra.user_id = p_user_id)
    AND (p_target_component_type IS NULL OR ra.target_component_type = p_target_component_type)
    AND ra.execution_status IN ('pending', 'in_progress')
  ORDER BY ra.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_recovery_action_statistics(
  p_user_id UUID DEFAULT NULL,
  p_time_window_hours INTEGER DEFAULT 24
)
RETURNS TABLE (
  total_actions BIGINT,
  successful_actions BIGINT,
  failed_actions BIGINT,
  pending_actions BIGINT,
  avg_execution_duration_ms DECIMAL,
  avg_effectiveness_score DECIMAL,
  total_downtime_seconds INTEGER,
  success_rate DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT AS total_actions,
    COUNT(*) FILTER (WHERE success = true)::BIGINT AS successful_actions,
    COUNT(*) FILTER (WHERE execution_status IN ('failed', 'timeout'))::BIGINT AS failed_actions,
    COUNT(*) FILTER (WHERE execution_status IN ('pending', 'in_progress'))::BIGINT AS pending_actions,
    AVG(execution_duration_ms)::DECIMAL AS avg_execution_duration_ms,
    AVG(recovery_effectiveness_score)::DECIMAL AS avg_effectiveness_score,
    SUM(downtime_seconds)::INTEGER AS total_downtime_seconds,
    (COUNT(*) FILTER (WHERE success = true)::DECIMAL / NULLIF(COUNT(*), 0) * 100)::DECIMAL AS success_rate
  FROM recovery_actions
  WHERE (p_user_id IS NULL OR user_id = p_user_id)
    AND created_at >= NOW() - (p_time_window_hours || ' hours')::INTERVAL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION execute_recovery_action(
  p_action_id UUID,
  p_execution_result JSONB DEFAULT NULL,
  p_execution_output TEXT DEFAULT NULL,
  p_success BOOLEAN DEFAULT true,
  p_error_message TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_started_at TIMESTAMPTZ;
  v_duration_ms INTEGER;
BEGIN
  SELECT execution_started_at INTO v_started_at
  FROM recovery_actions
  WHERE id = p_action_id;
  
  IF v_started_at IS NOT NULL THEN
    v_duration_ms := EXTRACT(EPOCH FROM (NOW() - v_started_at)) * 1000;
  END IF;
  
  UPDATE recovery_actions
  SET
    execution_status = CASE WHEN p_success THEN 'completed' ELSE 'failed' END,
    execution_completed_at = NOW(),
    execution_duration_ms = v_duration_ms,
    execution_result = p_execution_result,
    execution_output = p_execution_output,
    execution_error = p_error_message,
    success = p_success,
    updated_at = NOW()
  WHERE id = p_action_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION schedule_recovery_action_retry(
  p_action_id UUID,
  p_backoff_seconds INTEGER DEFAULT 60
)
RETURNS BOOLEAN AS $$
DECLARE
  v_attempt INTEGER;
  v_max_attempts INTEGER;
BEGIN
  SELECT attempt_number, max_attempts
  INTO v_attempt, v_max_attempts
  FROM recovery_actions
  WHERE id = p_action_id;
  
  IF v_attempt >= v_max_attempts THEN
    RETURN false;
  END IF;
  
  UPDATE recovery_actions
  SET
    execution_status = 'pending',
    attempt_number = attempt_number + 1,
    last_attempt_at = NOW(),
    next_retry_at = NOW() + (p_backoff_seconds || ' seconds')::INTERVAL,
    updated_at = NOW()
  WHERE id = p_action_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================================================
-- =====================================================================================

CREATE TRIGGER update_recovery_actions_updated_at
  BEFORE UPDATE ON recovery_actions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================================================
-- =====================================================================================

COMMENT ON TABLE recovery_actions IS 'Stores triggered recovery and rollback operations executed by the self-healing engine';
COMMENT ON COLUMN recovery_actions.action_type IS 'Type of recovery action (restart, rollback, scale, cache, network, etc.)';
COMMENT ON COLUMN recovery_actions.recovery_effectiveness_score IS 'Score (0-100) measuring how effective the recovery action was';
COMMENT ON COLUMN recovery_actions.pre_action_metrics IS 'JSONB snapshot of metrics before action execution';
COMMENT ON COLUMN recovery_actions.post_action_metrics IS 'JSONB snapshot of metrics after action execution';
COMMENT ON COLUMN recovery_actions.rollback_action_id IS 'Reference to another recovery_actions record if this action was rolled back';

-- =====================================================================================
-- =====================================================================================
