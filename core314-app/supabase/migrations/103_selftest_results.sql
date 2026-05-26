-- =====================================================================================
-- =====================================================================================


-- =====================================================================================
-- =====================================================================================

CREATE TABLE IF NOT EXISTS selftest_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  
  test_name VARCHAR(255) NOT NULL, -- Name of the self-test
  test_category VARCHAR(50) NOT NULL, -- 'connectivity', 'performance', 'security', 'data_integrity', 'integration', 'functionality'
  test_type VARCHAR(50) NOT NULL, -- 'smoke', 'health_check', 'integration', 'load', 'security_scan', 'data_validation'
  test_description TEXT, -- Detailed description of what the test does
  test_version VARCHAR(50), -- Version of the test suite
  
  execution_mode VARCHAR(50) NOT NULL DEFAULT 'scheduled', -- 'scheduled', 'manual', 'triggered', 'continuous'
  scheduled_by VARCHAR(50), -- 'system', 'admin', 'user'
  triggered_by_user_id UUID REFERENCES auth.users(id),
  trigger_reason TEXT, -- Why the test was triggered (if not scheduled)
  
  target_component_type VARCHAR(50), -- 'edge_function', 'api_endpoint', 'database', 'integration', 'frontend', 'system'
  target_component_name VARCHAR(255), -- Specific component tested
  target_environment VARCHAR(50) DEFAULT 'production', -- 'production', 'staging', 'development'
  
  execution_status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed', 'timeout', 'cancelled'
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  execution_duration_ms INTEGER, -- Time taken to run test
  timeout_seconds INTEGER DEFAULT 300, -- Maximum allowed execution time
  
  test_result VARCHAR(50) NOT NULL, -- 'pass', 'fail', 'warning', 'error', 'skipped'
  success BOOLEAN, -- True if test passed
  pass_count INTEGER DEFAULT 0, -- Number of assertions that passed
  fail_count INTEGER DEFAULT 0, -- Number of assertions that failed
  warning_count INTEGER DEFAULT 0, -- Number of warnings
  skip_count INTEGER DEFAULT 0, -- Number of skipped tests
  total_assertions INTEGER DEFAULT 0, -- Total number of assertions
  
  test_output TEXT, -- Full test output/logs
  test_summary TEXT, -- Summary of test results
  failure_reason TEXT, -- Reason for failure (if failed)
  error_message TEXT, -- Error message (if error)
  error_stack_trace TEXT, -- Stack trace (if error)
  
  response_time_ms INTEGER, -- Response time for tested component
  throughput_per_second DECIMAL(10,2), -- Throughput achieved
  error_rate DECIMAL(5,2), -- Error rate during test
  cpu_usage_percent DECIMAL(5,2), -- CPU usage during test
  memory_usage_mb INTEGER, -- Memory usage during test
  
  assertions_passed JSONB, -- Array of passed assertions with details
  assertions_failed JSONB, -- Array of failed assertions with details
  assertions_warnings JSONB, -- Array of warnings with details
  
  baseline_test_id UUID, -- Reference to previous test for comparison
  baseline_deviation_percentage DECIMAL(10,2), -- Deviation from baseline
  regression_detected BOOLEAN DEFAULT false, -- True if performance regression detected
  improvement_detected BOOLEAN DEFAULT false, -- True if performance improvement detected
  
  health_score DECIMAL(5,2), -- Overall health score (0-100)
  reliability_score DECIMAL(5,2), -- Reliability score (0-100)
  performance_score DECIMAL(5,2), -- Performance score (0-100)
  security_score DECIMAL(5,2), -- Security score (0-100)
  
  recommendations JSONB, -- Array of recommended actions based on test results
  action_required BOOLEAN DEFAULT false, -- True if immediate action required
  severity VARCHAR(50), -- 'info', 'low', 'medium', 'high', 'critical'
  
  notifications_sent JSONB, -- {"slack": true, "email": false}
  notification_channels TEXT[], -- Channels notified
  alerted_users UUID[], -- Users who were alerted
  
  test_config JSONB, -- Configuration used for the test
  test_parameters JSONB, -- Parameters passed to the test
  
  metadata JSONB, -- Additional test-specific data
  tags TEXT[], -- Tags for filtering and grouping
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================================
-- =====================================================================================

CREATE INDEX idx_selftest_results_user_id ON selftest_results(user_id);
CREATE INDEX idx_selftest_results_organization_id ON selftest_results(organization_id);
CREATE INDEX idx_selftest_results_test_name ON selftest_results(test_name);
CREATE INDEX idx_selftest_results_test_category ON selftest_results(test_category);
CREATE INDEX idx_selftest_results_test_result ON selftest_results(test_result);

CREATE INDEX idx_selftest_results_created_at ON selftest_results(created_at DESC);
CREATE INDEX idx_selftest_results_started_at ON selftest_results(started_at DESC) WHERE started_at IS NOT NULL;
CREATE INDEX idx_selftest_results_completed_at ON selftest_results(completed_at DESC) WHERE completed_at IS NOT NULL;

CREATE INDEX idx_selftest_results_target_component ON selftest_results(target_component_type, target_component_name);
CREATE INDEX idx_selftest_results_target_environment ON selftest_results(target_environment);

CREATE INDEX idx_selftest_results_execution_status ON selftest_results(execution_status);
CREATE INDEX idx_selftest_results_failed ON selftest_results(test_result, created_at DESC) WHERE test_result IN ('fail', 'error');
CREATE INDEX idx_selftest_results_passed ON selftest_results(test_result, created_at DESC) WHERE test_result = 'pass';

CREATE INDEX idx_selftest_results_health_score ON selftest_results(health_score DESC) WHERE health_score IS NOT NULL;
CREATE INDEX idx_selftest_results_low_health ON selftest_results(health_score ASC) WHERE health_score < 70.0;

CREATE INDEX idx_selftest_results_regression ON selftest_results(regression_detected, created_at DESC) WHERE regression_detected = true;
CREATE INDEX idx_selftest_results_action_required ON selftest_results(action_required, severity, created_at DESC) WHERE action_required = true;

CREATE INDEX idx_selftest_results_baseline ON selftest_results(baseline_test_id) WHERE baseline_test_id IS NOT NULL;

CREATE INDEX idx_selftest_results_user_test_time ON selftest_results(user_id, test_name, created_at DESC);
CREATE INDEX idx_selftest_results_component_result_time ON selftest_results(target_component_type, target_component_name, test_result, created_at DESC);

CREATE INDEX idx_selftest_results_assertions_passed ON selftest_results USING GIN(assertions_passed);
CREATE INDEX idx_selftest_results_assertions_failed ON selftest_results USING GIN(assertions_failed);
CREATE INDEX idx_selftest_results_recommendations ON selftest_results USING GIN(recommendations);
CREATE INDEX idx_selftest_results_metadata ON selftest_results USING GIN(metadata);
CREATE INDEX idx_selftest_results_tags ON selftest_results USING GIN(tags);

-- =====================================================================================
-- =====================================================================================

ALTER TABLE selftest_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY selftest_results_select_own ON selftest_results
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY selftest_results_select_admin ON selftest_results
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY selftest_results_insert_system ON selftest_results
  FOR INSERT
  WITH CHECK (true); -- Service role bypasses RLS

CREATE POLICY selftest_results_update_system ON selftest_results
  FOR UPDATE
  USING (true); -- Service role bypasses RLS

CREATE POLICY selftest_results_delete_admin ON selftest_results
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- =====================================================================================
-- =====================================================================================

CREATE OR REPLACE FUNCTION get_latest_selftest_results(
  p_user_id UUID DEFAULT NULL,
  p_test_category VARCHAR DEFAULT NULL,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  test_name VARCHAR,
  test_category VARCHAR,
  test_result VARCHAR,
  health_score DECIMAL,
  execution_duration_ms INTEGER,
  failure_reason TEXT,
  action_required BOOLEAN,
  severity VARCHAR,
  completed_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    st.id,
    st.test_name,
    st.test_category,
    st.test_result,
    st.health_score,
    st.execution_duration_ms,
    st.failure_reason,
    st.action_required,
    st.severity,
    st.completed_at
  FROM selftest_results st
  WHERE (p_user_id IS NULL OR st.user_id = p_user_id)
    AND (p_test_category IS NULL OR st.test_category = p_test_category)
    AND st.execution_status = 'completed'
  ORDER BY st.completed_at DESC NULLS LAST
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_selftest_statistics(
  p_user_id UUID DEFAULT NULL,
  p_time_window_hours INTEGER DEFAULT 24
)
RETURNS TABLE (
  total_tests BIGINT,
  passed_tests BIGINT,
  failed_tests BIGINT,
  warning_tests BIGINT,
  avg_health_score DECIMAL,
  avg_execution_duration_ms DECIMAL,
  tests_requiring_action BIGINT,
  regressions_detected BIGINT,
  pass_rate DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT AS total_tests,
    COUNT(*) FILTER (WHERE test_result = 'pass')::BIGINT AS passed_tests,
    COUNT(*) FILTER (WHERE test_result IN ('fail', 'error'))::BIGINT AS failed_tests,
    COUNT(*) FILTER (WHERE test_result = 'warning')::BIGINT AS warning_tests,
    AVG(health_score)::DECIMAL AS avg_health_score,
    AVG(execution_duration_ms)::DECIMAL AS avg_execution_duration_ms,
    COUNT(*) FILTER (WHERE action_required = true)::BIGINT AS tests_requiring_action,
    COUNT(*) FILTER (WHERE regression_detected = true)::BIGINT AS regressions_detected,
    (COUNT(*) FILTER (WHERE test_result = 'pass')::DECIMAL / NULLIF(COUNT(*), 0) * 100)::DECIMAL AS pass_rate
  FROM selftest_results
  WHERE (p_user_id IS NULL OR user_id = p_user_id)
    AND created_at >= NOW() - (p_time_window_hours || ' hours')::INTERVAL
    AND execution_status = 'completed';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_selftest_trends(
  p_user_id UUID DEFAULT NULL,
  p_test_name VARCHAR DEFAULT NULL,
  p_time_window_days INTEGER DEFAULT 7,
  p_bucket_hours INTEGER DEFAULT 24
)
RETURNS TABLE (
  time_bucket TIMESTAMPTZ,
  total_tests BIGINT,
  passed_tests BIGINT,
  failed_tests BIGINT,
  avg_health_score DECIMAL,
  avg_execution_duration_ms DECIMAL,
  pass_rate DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE_TRUNC('day', st.completed_at) + 
      (FLOOR(EXTRACT(HOUR FROM st.completed_at) / p_bucket_hours) * p_bucket_hours || ' hours')::INTERVAL AS time_bucket,
    COUNT(*)::BIGINT AS total_tests,
    COUNT(*) FILTER (WHERE st.test_result = 'pass')::BIGINT AS passed_tests,
    COUNT(*) FILTER (WHERE st.test_result IN ('fail', 'error'))::BIGINT AS failed_tests,
    AVG(st.health_score)::DECIMAL AS avg_health_score,
    AVG(st.execution_duration_ms)::DECIMAL AS avg_execution_duration_ms,
    (COUNT(*) FILTER (WHERE st.test_result = 'pass')::DECIMAL / NULLIF(COUNT(*), 0) * 100)::DECIMAL AS pass_rate
  FROM selftest_results st
  WHERE (p_user_id IS NULL OR st.user_id = p_user_id)
    AND (p_test_name IS NULL OR st.test_name = p_test_name)
    AND st.completed_at >= NOW() - (p_time_window_days || ' days')::INTERVAL
    AND st.execution_status = 'completed'
  GROUP BY time_bucket
  ORDER BY time_bucket DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION compare_with_baseline(
  p_test_id UUID
)
RETURNS TABLE (
  current_health_score DECIMAL,
  baseline_health_score DECIMAL,
  health_score_change DECIMAL,
  current_duration_ms INTEGER,
  baseline_duration_ms INTEGER,
  duration_change_percent DECIMAL,
  regression_detected BOOLEAN,
  improvement_detected BOOLEAN
) AS $$
DECLARE
  v_current_test RECORD;
  v_baseline_test RECORD;
BEGIN
  SELECT * INTO v_current_test
  FROM selftest_results
  WHERE id = p_test_id;
  
  SELECT * INTO v_baseline_test
  FROM selftest_results
  WHERE test_name = v_current_test.test_name
    AND user_id = v_current_test.user_id
    AND test_result = 'pass'
    AND completed_at < v_current_test.completed_at
  ORDER BY completed_at DESC
  LIMIT 1;
  
  RETURN QUERY
  SELECT
    v_current_test.health_score AS current_health_score,
    v_baseline_test.health_score AS baseline_health_score,
    (v_current_test.health_score - v_baseline_test.health_score)::DECIMAL AS health_score_change,
    v_current_test.execution_duration_ms AS current_duration_ms,
    v_baseline_test.execution_duration_ms AS baseline_duration_ms,
    (((v_current_test.execution_duration_ms - v_baseline_test.execution_duration_ms)::DECIMAL / NULLIF(v_baseline_test.execution_duration_ms, 0)) * 100)::DECIMAL AS duration_change_percent,
    (v_current_test.health_score < v_baseline_test.health_score - 10 OR v_current_test.execution_duration_ms > v_baseline_test.execution_duration_ms * 1.5)::BOOLEAN AS regression_detected,
    (v_current_test.health_score > v_baseline_test.health_score + 10 OR v_current_test.execution_duration_ms < v_baseline_test.execution_duration_ms * 0.8)::BOOLEAN AS improvement_detected;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================================================
-- =====================================================================================

CREATE TRIGGER update_selftest_results_updated_at
  BEFORE UPDATE ON selftest_results
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================================================
-- =====================================================================================

COMMENT ON TABLE selftest_results IS 'Records results of scheduled self-diagnostic tests for proactive issue detection';
COMMENT ON COLUMN selftest_results.test_category IS 'Category of test (connectivity, performance, security, data_integrity, integration, functionality)';
COMMENT ON COLUMN selftest_results.health_score IS 'Overall health score (0-100) calculated from test results';
COMMENT ON COLUMN selftest_results.regression_detected IS 'True if performance regression detected compared to baseline';
COMMENT ON COLUMN selftest_results.recommendations IS 'JSONB array of recommended actions based on test results';
COMMENT ON COLUMN selftest_results.baseline_test_id IS 'Reference to previous test for performance comparison';

-- =====================================================================================
-- =====================================================================================
