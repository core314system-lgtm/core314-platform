-- =====================================================
-- =====================================================

CREATE TABLE IF NOT EXISTS execution_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  
  execution_queue_id UUID REFERENCES execution_queue(id) ON DELETE SET NULL,
  orchestration_flow_id UUID REFERENCES orchestration_flows(id) ON DELETE SET NULL,
  decision_event_id UUID REFERENCES decision_events(id) ON DELETE SET NULL,
  recommendation_id UUID REFERENCES recommendation_queue(id) ON DELETE SET NULL,
  
  action_type VARCHAR(100) NOT NULL,
  action_target VARCHAR(255) NOT NULL,
  action_payload JSONB NOT NULL DEFAULT '{}',
  action_config JSONB DEFAULT '{}',
  
  execution_status VARCHAR(50) NOT NULL, -- 'completed', 'failed', 'cancelled', 'timeout'
  execution_result JSONB, -- Result data from successful execution
  execution_error TEXT, -- Error message if failed
  execution_error_code VARCHAR(100), -- Standardized error code
  execution_error_details JSONB, -- Detailed error information
  
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL,
  execution_duration_ms INTEGER NOT NULL,
  queue_wait_time_ms INTEGER, -- Time spent in queue before execution
  retry_attempt INTEGER DEFAULT 0,
  
  http_status_code INTEGER,
  http_response_time_ms INTEGER,
  http_request_size_bytes INTEGER,
  http_response_size_bytes INTEGER,
  
  integration_name VARCHAR(100), -- 'slack', 'teams', 'sendgrid', 'custom_api'
  integration_endpoint VARCHAR(500),
  integration_method VARCHAR(10), -- 'GET', 'POST', 'PUT', 'DELETE', 'PATCH'
  
  context_data JSONB DEFAULT '{}',
  environment VARCHAR(50) DEFAULT 'production', -- 'production', 'staging', 'development'
  triggered_by VARCHAR(100), -- 'user', 'system', 'ai', 'automation', 'schedule'
  
  success BOOLEAN NOT NULL,
  partial_success BOOLEAN DEFAULT false, -- Some parts succeeded, some failed
  requires_review BOOLEAN DEFAULT false,
  review_notes TEXT,
  
  compliance_flags VARCHAR(100)[] DEFAULT '{}',
  security_level VARCHAR(50) DEFAULT 'standard', -- 'low', 'standard', 'high', 'critical'
  data_classification VARCHAR(50), -- 'public', 'internal', 'confidential', 'restricted'
  
  tags VARCHAR(100)[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_execution_status CHECK (execution_status IN ('completed', 'failed', 'cancelled', 'timeout')),
  CONSTRAINT valid_execution_duration CHECK (execution_duration_ms >= 0),
  CONSTRAINT valid_http_status CHECK (http_status_code IS NULL OR (http_status_code >= 100 AND http_status_code < 600)),
  CONSTRAINT valid_security_level CHECK (security_level IN ('low', 'standard', 'high', 'critical')),
  CONSTRAINT valid_data_classification CHECK (data_classification IS NULL OR data_classification IN ('public', 'internal', 'confidential', 'restricted'))
);

CREATE INDEX idx_execution_log_user_id ON execution_log(user_id);
CREATE INDEX idx_execution_log_organization_id ON execution_log(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX idx_execution_log_queue_id ON execution_log(execution_queue_id) WHERE execution_queue_id IS NOT NULL;
CREATE INDEX idx_execution_log_flow_id ON execution_log(orchestration_flow_id) WHERE orchestration_flow_id IS NOT NULL;
CREATE INDEX idx_execution_log_decision_id ON execution_log(decision_event_id) WHERE decision_event_id IS NOT NULL;
CREATE INDEX idx_execution_log_status ON execution_log(execution_status);
CREATE INDEX idx_execution_log_success ON execution_log(success);
CREATE INDEX idx_execution_log_action_type ON execution_log(action_type);
CREATE INDEX idx_execution_log_action_target ON execution_log(action_target);
CREATE INDEX idx_execution_log_created_at ON execution_log(created_at DESC);
CREATE INDEX idx_execution_log_duration ON execution_log(execution_duration_ms);
CREATE INDEX idx_execution_log_integration ON execution_log(integration_name) WHERE integration_name IS NOT NULL;
CREATE INDEX idx_execution_log_tags ON execution_log USING GIN(tags);
CREATE INDEX idx_execution_log_requires_review ON execution_log(requires_review) WHERE requires_review = true;

CREATE INDEX idx_execution_log_analytics ON execution_log(
  user_id,
  action_type,
  success,
  created_at DESC
);

ALTER TABLE execution_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY execution_log_select_policy ON execution_log
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY execution_log_insert_policy ON execution_log
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);


CREATE OR REPLACE FUNCTION get_execution_statistics(
  p_user_id UUID,
  p_time_range_hours INTEGER DEFAULT 24
)
RETURNS TABLE (
  total_executions BIGINT,
  successful_executions BIGINT,
  failed_executions BIGINT,
  success_rate DECIMAL(5,2),
  avg_duration_ms DECIMAL(10,2),
  p50_duration_ms INTEGER,
  p95_duration_ms INTEGER,
  p99_duration_ms INTEGER,
  total_actions_by_type JSONB
) AS $$
DECLARE
  v_time_threshold TIMESTAMPTZ;
BEGIN
  v_time_threshold := NOW() - (p_time_range_hours || ' hours')::INTERVAL;
  
  RETURN QUERY
  WITH stats AS (
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE success = true) as successful,
      COUNT(*) FILTER (WHERE success = false) as failed,
      AVG(execution_duration_ms) as avg_duration,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY execution_duration_ms) as p50,
      PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY execution_duration_ms) as p95,
      PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY execution_duration_ms) as p99
    FROM execution_log
    WHERE user_id = p_user_id
      AND created_at >= v_time_threshold
  ),
  actions_by_type AS (
    SELECT jsonb_object_agg(action_type, count) as actions
    FROM (
      SELECT action_type, COUNT(*) as count
      FROM execution_log
      WHERE user_id = p_user_id
        AND created_at >= v_time_threshold
      GROUP BY action_type
    ) sub
  )
  SELECT 
    s.total,
    s.successful,
    s.failed,
    CASE WHEN s.total > 0 THEN (s.successful::DECIMAL / s.total::DECIMAL) * 100 ELSE 0 END,
    s.avg_duration,
    s.p50::INTEGER,
    s.p95::INTEGER,
    s.p99::INTEGER,
    COALESCE(a.actions, '{}'::jsonb)
  FROM stats s
  CROSS JOIN actions_by_type a;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_failed_executions(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  log_id UUID,
  action_type VARCHAR(100),
  action_target VARCHAR(255),
  execution_error TEXT,
  execution_error_code VARCHAR(100),
  execution_duration_ms INTEGER,
  retry_attempt INTEGER,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    id,
    execution_log.action_type,
    execution_log.action_target,
    execution_log.execution_error,
    execution_log.execution_error_code,
    execution_log.execution_duration_ms,
    execution_log.retry_attempt,
    execution_log.created_at
  FROM execution_log
  WHERE user_id = p_user_id
    AND success = false
  ORDER BY created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_execution_timeline(
  p_user_id UUID,
  p_hours INTEGER DEFAULT 24,
  p_interval_minutes INTEGER DEFAULT 60
)
RETURNS TABLE (
  time_bucket TIMESTAMPTZ,
  total_executions BIGINT,
  successful_executions BIGINT,
  failed_executions BIGINT,
  avg_duration_ms DECIMAL(10,2)
) AS $$
DECLARE
  v_time_threshold TIMESTAMPTZ;
BEGIN
  v_time_threshold := NOW() - (p_hours || ' hours')::INTERVAL;
  
  RETURN QUERY
  SELECT 
    date_trunc('hour', created_at) + 
      (EXTRACT(MINUTE FROM created_at)::INTEGER / p_interval_minutes) * 
      (p_interval_minutes || ' minutes')::INTERVAL as bucket,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE success = true) as successful,
    COUNT(*) FILTER (WHERE success = false) as failed,
    AVG(execution_duration_ms) as avg_duration
  FROM execution_log
  WHERE user_id = p_user_id
    AND created_at >= v_time_threshold
  GROUP BY bucket
  ORDER BY bucket DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_slowest_executions(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  log_id UUID,
  action_type VARCHAR(100),
  action_target VARCHAR(255),
  execution_duration_ms INTEGER,
  success BOOLEAN,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    id,
    execution_log.action_type,
    execution_log.action_target,
    execution_log.execution_duration_ms,
    execution_log.success,
    execution_log.created_at
  FROM execution_log
  WHERE user_id = p_user_id
  ORDER BY execution_duration_ms DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE execution_log IS 'Phase 6: Immutable audit trail of all completed actions with performance metrics';
COMMENT ON COLUMN execution_log.execution_duration_ms IS 'Total execution time in milliseconds';
COMMENT ON COLUMN execution_log.queue_wait_time_ms IS 'Time spent waiting in queue before execution';
COMMENT ON COLUMN execution_log.partial_success IS 'Indicates some parts of multi-step action succeeded while others failed';
COMMENT ON COLUMN execution_log.compliance_flags IS 'Array of compliance-related tags for regulatory tracking';
