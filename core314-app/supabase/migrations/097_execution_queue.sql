-- =====================================================
-- =====================================================

CREATE TABLE IF NOT EXISTS execution_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  
  orchestration_flow_id UUID REFERENCES orchestration_flows(id) ON DELETE CASCADE,
  decision_event_id UUID REFERENCES decision_events(id) ON DELETE SET NULL,
  recommendation_id UUID REFERENCES recommendation_queue(id) ON DELETE SET NULL,
  parent_execution_id UUID REFERENCES execution_queue(id) ON DELETE CASCADE, -- For multi-step flows
  
  action_type VARCHAR(100) NOT NULL, -- 'send_notification', 'api_call', 'data_sync', 'create_task', 'update_record', 'trigger_webhook'
  action_target VARCHAR(255) NOT NULL, -- Target system/channel (e.g., 'slack', 'teams', 'email', 'api_endpoint')
  action_payload JSONB NOT NULL DEFAULT '{}', -- Action-specific data
  action_config JSONB DEFAULT '{}', -- Configuration (headers, auth, formatting)
  
  execution_status VARCHAR(50) DEFAULT 'queued', -- 'queued', 'scheduled', 'in_progress', 'completed', 'failed', 'cancelled', 'expired'
  priority INTEGER DEFAULT 5, -- 1 (highest) to 10 (lowest)
  urgency VARCHAR(50) DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
  
  scheduled_for TIMESTAMPTZ, -- NULL = execute immediately
  execute_after TIMESTAMPTZ, -- Earliest execution time
  expires_at TIMESTAMPTZ, -- Action expires if not executed by this time
  
  requires_approval BOOLEAN DEFAULT false,
  approval_status VARCHAR(50), -- 'pending', 'approved', 'rejected', 'auto_approved'
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  approval_notes TEXT,
  
  max_retry_attempts INTEGER DEFAULT 3,
  current_retry_attempt INTEGER DEFAULT 0,
  retry_backoff_seconds INTEGER[] DEFAULT ARRAY[10, 30, 60],
  last_retry_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  execution_duration_ms INTEGER,
  execution_result JSONB, -- Result data from action execution
  execution_error TEXT,
  execution_error_code VARCHAR(100),
  
  depends_on UUID[] DEFAULT '{}', -- Array of execution_queue IDs that must complete first
  dependency_mode VARCHAR(50) DEFAULT 'all', -- 'all' (wait for all), 'any' (wait for any one)
  
  context_data JSONB DEFAULT '{}',
  tags VARCHAR(100)[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_execution_status CHECK (execution_status IN ('queued', 'scheduled', 'in_progress', 'completed', 'failed', 'cancelled', 'expired')),
  CONSTRAINT valid_priority CHECK (priority >= 1 AND priority <= 10),
  CONSTRAINT valid_urgency CHECK (urgency IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT valid_approval_status CHECK (approval_status IS NULL OR approval_status IN ('pending', 'approved', 'rejected', 'auto_approved')),
  CONSTRAINT valid_dependency_mode CHECK (dependency_mode IN ('all', 'any')),
  CONSTRAINT valid_retry_attempt CHECK (current_retry_attempt <= max_retry_attempts)
);

CREATE INDEX idx_execution_queue_user_id ON execution_queue(user_id);
CREATE INDEX idx_execution_queue_organization_id ON execution_queue(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX idx_execution_queue_flow_id ON execution_queue(orchestration_flow_id) WHERE orchestration_flow_id IS NOT NULL;
CREATE INDEX idx_execution_queue_decision_id ON execution_queue(decision_event_id) WHERE decision_event_id IS NOT NULL;
CREATE INDEX idx_execution_queue_recommendation_id ON execution_queue(recommendation_id) WHERE recommendation_id IS NOT NULL;
CREATE INDEX idx_execution_queue_status ON execution_queue(execution_status);
CREATE INDEX idx_execution_queue_priority ON execution_queue(priority, created_at);
CREATE INDEX idx_execution_queue_scheduled ON execution_queue(scheduled_for) WHERE scheduled_for IS NOT NULL;
CREATE INDEX idx_execution_queue_expires ON execution_queue(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_execution_queue_approval ON execution_queue(requires_approval, approval_status) WHERE requires_approval = true;
CREATE INDEX idx_execution_queue_retry ON execution_queue(next_retry_at) WHERE next_retry_at IS NOT NULL;
CREATE INDEX idx_execution_queue_tags ON execution_queue USING GIN(tags);
CREATE INDEX idx_execution_queue_depends_on ON execution_queue USING GIN(depends_on);

CREATE INDEX idx_execution_queue_processing ON execution_queue(
  execution_status, 
  priority, 
  created_at
) WHERE execution_status IN ('queued', 'scheduled');

ALTER TABLE execution_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY execution_queue_select_policy ON execution_queue
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY execution_queue_insert_policy ON execution_queue
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY execution_queue_update_policy ON execution_queue
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY execution_queue_delete_policy ON execution_queue
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_execution_queue_updated_at
  BEFORE UPDATE ON execution_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION get_next_execution(
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  execution_id UUID,
  action_type VARCHAR(100),
  action_target VARCHAR(255),
  action_payload JSONB,
  action_config JSONB,
  priority INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    id,
    execution_queue.action_type,
    execution_queue.action_target,
    execution_queue.action_payload,
    execution_queue.action_config,
    execution_queue.priority
  FROM execution_queue
  WHERE 
    (p_user_id IS NULL OR user_id = p_user_id)
    AND execution_status = 'queued'
    AND (scheduled_for IS NULL OR scheduled_for <= NOW())
    AND (execute_after IS NULL OR execute_after <= NOW())
    AND (expires_at IS NULL OR expires_at > NOW())
    AND (NOT requires_approval OR approval_status = 'approved' OR approval_status = 'auto_approved')
    AND (depends_on IS NULL OR depends_on = '{}' OR check_dependencies_met(id))
  ORDER BY priority ASC, created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION check_dependencies_met(
  p_execution_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_depends_on UUID[];
  v_dependency_mode VARCHAR(50);
  v_completed_count INTEGER;
  v_total_count INTEGER;
BEGIN
  SELECT depends_on, dependency_mode
  INTO v_depends_on, v_dependency_mode
  FROM execution_queue
  WHERE id = p_execution_id;
  
  IF v_depends_on IS NULL OR array_length(v_depends_on, 1) IS NULL THEN
    RETURN true;
  END IF;
  
  v_total_count := array_length(v_depends_on, 1);
  
  SELECT COUNT(*)
  INTO v_completed_count
  FROM execution_queue
  WHERE id = ANY(v_depends_on)
    AND execution_status = 'completed';
  
  IF v_dependency_mode = 'all' THEN
    RETURN v_completed_count = v_total_count;
  ELSIF v_dependency_mode = 'any' THEN
    RETURN v_completed_count > 0;
  ELSE
    RETURN false;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION expire_old_executions()
RETURNS INTEGER AS $$
DECLARE
  v_expired_count INTEGER;
BEGIN
  UPDATE execution_queue
  SET 
    execution_status = 'expired',
    updated_at = NOW()
  WHERE execution_status IN ('queued', 'scheduled')
    AND expires_at IS NOT NULL
    AND expires_at < NOW();
  
  GET DIAGNOSTICS v_expired_count = ROW_COUNT;
  RETURN v_expired_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_pending_approvals(
  p_user_id UUID
)
RETURNS TABLE (
  execution_id UUID,
  action_type VARCHAR(100),
  action_target VARCHAR(255),
  action_payload JSONB,
  priority INTEGER,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    id,
    execution_queue.action_type,
    execution_queue.action_target,
    execution_queue.action_payload,
    execution_queue.priority,
    execution_queue.created_at
  FROM execution_queue
  WHERE user_id = p_user_id
    AND requires_approval = true
    AND approval_status = 'pending'
    AND execution_status = 'queued'
  ORDER BY priority ASC, created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION schedule_retry(
  p_execution_id UUID
)
RETURNS TIMESTAMPTZ AS $$
DECLARE
  v_current_attempt INTEGER;
  v_max_attempts INTEGER;
  v_backoff_seconds INTEGER[];
  v_backoff_delay INTEGER;
  v_next_retry TIMESTAMPTZ;
BEGIN
  SELECT 
    current_retry_attempt,
    max_retry_attempts,
    retry_backoff_seconds
  INTO v_current_attempt, v_max_attempts, v_backoff_seconds
  FROM execution_queue
  WHERE id = p_execution_id;
  
  IF v_current_attempt >= v_max_attempts THEN
    RETURN NULL;
  END IF;
  
  IF v_current_attempt + 1 <= array_length(v_backoff_seconds, 1) THEN
    v_backoff_delay := v_backoff_seconds[v_current_attempt + 1];
  ELSE
    v_backoff_delay := v_backoff_seconds[array_length(v_backoff_seconds, 1)];
  END IF;
  
  v_next_retry := NOW() + (v_backoff_delay || ' seconds')::INTERVAL;
  
  UPDATE execution_queue
  SET 
    execution_status = 'queued',
    current_retry_attempt = current_retry_attempt + 1,
    last_retry_at = NOW(),
    next_retry_at = v_next_retry,
    updated_at = NOW()
  WHERE id = p_execution_id;
  
  RETURN v_next_retry;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE execution_queue IS 'Phase 6: Pending actions awaiting dispatch with priority queue and scheduling';
COMMENT ON COLUMN execution_queue.action_payload IS 'Action-specific data (message content, API parameters, etc.)';
COMMENT ON COLUMN execution_queue.depends_on IS 'Array of execution_queue IDs that must complete before this action';
COMMENT ON COLUMN execution_queue.retry_backoff_seconds IS 'Array of backoff delays for each retry attempt';
COMMENT ON COLUMN execution_queue.execution_result IS 'Result data returned from action execution';
