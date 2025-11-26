-- =====================================================================================
-- =====================================================================================


-- =====================================================================================
-- =====================================================================================

CREATE TABLE IF NOT EXISTS anomaly_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  
  anomaly_type VARCHAR(100) NOT NULL, -- 'latency_spike', 'error_rate_increase', 'resource_exhaustion', 'integration_failure', 'pattern_deviation', 'security_threat'
  anomaly_category VARCHAR(50) NOT NULL, -- 'performance', 'reliability', 'security', 'capacity', 'integration'
  severity VARCHAR(50) NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
  confidence_score DECIMAL(5,2) NOT NULL, -- 0.00 to 100.00 - confidence in anomaly detection
  
  source_type VARCHAR(50) NOT NULL, -- 'system_health_event', 'execution_log', 'decision_audit_log', 'external_monitor', 'user_report'
  source_id UUID, -- Reference to source record (system_health_events.id, execution_log.id, etc.)
  source_component_type VARCHAR(50), -- Component type from source
  source_component_name VARCHAR(255), -- Component name from source
  
  anomaly_description TEXT NOT NULL, -- Human-readable description
  anomaly_summary TEXT, -- AI-generated summary from GPT-4o
  root_cause_analysis TEXT, -- AI-generated root cause analysis from GPT-4o
  recommended_actions JSONB, -- ["restart_function", "scale_up", "clear_cache", "notify_admin"]
  
  baseline_value DECIMAL(15,2), -- Normal/expected value
  observed_value DECIMAL(15,2), -- Actual observed value
  deviation_percentage DECIMAL(10,2), -- Percentage deviation from baseline
  threshold_exceeded VARCHAR(100), -- Which threshold was exceeded
  
  pattern_type VARCHAR(100), -- 'sudden_spike', 'gradual_increase', 'oscillation', 'flatline', 'irregular'
  pattern_duration_seconds INTEGER, -- How long the pattern has been observed
  pattern_frequency INTEGER, -- How often the pattern occurs (per hour)
  historical_occurrences INTEGER DEFAULT 0, -- Number of times this pattern has occurred before
  
  affected_users_count INTEGER DEFAULT 0, -- Number of users affected
  affected_components TEXT[], -- List of affected components
  business_impact VARCHAR(50), -- 'none', 'low', 'medium', 'high', 'critical'
  estimated_cost_impact DECIMAL(10,2), -- Estimated cost impact in USD
  
  detection_method VARCHAR(100) NOT NULL, -- 'statistical_analysis', 'ml_model', 'rule_based', 'gpt4o_analysis', 'manual'
  detection_algorithm VARCHAR(100), -- Specific algorithm used (e.g., 'z_score', 'isolation_forest', 'gpt4o_anomaly_detector')
  detection_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  status VARCHAR(50) NOT NULL DEFAULT 'detected', -- 'detected', 'investigating', 'confirmed', 'false_positive', 'resolved', 'ignored'
  acknowledged_by UUID REFERENCES auth.users(id),
  acknowledged_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  resolution_duration_minutes INTEGER,
  
  related_anomaly_ids UUID[], -- Related anomaly signals (for correlation)
  triggered_recovery_action_id UUID, -- Reference to recovery_actions.id if auto-recovery triggered
  escalation_event_id UUID, -- Reference to escalation_events.id if escalated
  
  gpt4o_prompt TEXT, -- Prompt sent to GPT-4o for analysis
  gpt4o_response TEXT, -- Full response from GPT-4o
  gpt4o_model VARCHAR(50), -- GPT model version used
  gpt4o_tokens_used INTEGER, -- Tokens consumed for analysis
  gpt4o_analysis_duration_ms INTEGER, -- Time taken for GPT-4o analysis
  
  metadata JSONB, -- Additional context-specific data
  tags TEXT[], -- Tags for filtering and grouping
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================================
-- =====================================================================================

CREATE INDEX idx_anomaly_signals_user_id ON anomaly_signals(user_id);
CREATE INDEX idx_anomaly_signals_organization_id ON anomaly_signals(organization_id);
CREATE INDEX idx_anomaly_signals_anomaly_type ON anomaly_signals(anomaly_type);
CREATE INDEX idx_anomaly_signals_severity ON anomaly_signals(severity);
CREATE INDEX idx_anomaly_signals_status ON anomaly_signals(status);

CREATE INDEX idx_anomaly_signals_created_at ON anomaly_signals(created_at DESC);
CREATE INDEX idx_anomaly_signals_detection_timestamp ON anomaly_signals(detection_timestamp DESC);

CREATE INDEX idx_anomaly_signals_source_type ON anomaly_signals(source_type);
CREATE INDEX idx_anomaly_signals_source_id ON anomaly_signals(source_id) WHERE source_id IS NOT NULL;
CREATE INDEX idx_anomaly_signals_source_component ON anomaly_signals(source_component_type, source_component_name);

CREATE INDEX idx_anomaly_signals_high_severity ON anomaly_signals(severity, created_at DESC) WHERE severity IN ('high', 'critical');
CREATE INDEX idx_anomaly_signals_business_impact ON anomaly_signals(business_impact) WHERE business_impact IN ('high', 'critical');
CREATE INDEX idx_anomaly_signals_confidence ON anomaly_signals(confidence_score DESC) WHERE confidence_score >= 80.0;

CREATE INDEX idx_anomaly_signals_unresolved ON anomaly_signals(status, created_at DESC) WHERE status IN ('detected', 'investigating', 'confirmed');
CREATE INDEX idx_anomaly_signals_acknowledged ON anomaly_signals(acknowledged_at DESC) WHERE acknowledged_at IS NOT NULL;
CREATE INDEX idx_anomaly_signals_resolved ON anomaly_signals(resolved_at DESC) WHERE resolved_at IS NOT NULL;

CREATE INDEX idx_anomaly_signals_user_status_time ON anomaly_signals(user_id, status, created_at DESC);
CREATE INDEX idx_anomaly_signals_type_severity_time ON anomaly_signals(anomaly_type, severity, created_at DESC);

CREATE INDEX idx_anomaly_signals_recommended_actions ON anomaly_signals USING GIN(recommended_actions);
CREATE INDEX idx_anomaly_signals_affected_components ON anomaly_signals USING GIN(affected_components);
CREATE INDEX idx_anomaly_signals_related_anomalies ON anomaly_signals USING GIN(related_anomaly_ids);
CREATE INDEX idx_anomaly_signals_metadata ON anomaly_signals USING GIN(metadata);
CREATE INDEX idx_anomaly_signals_tags ON anomaly_signals USING GIN(tags);

-- =====================================================================================
-- =====================================================================================

ALTER TABLE anomaly_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY anomaly_signals_select_own ON anomaly_signals
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY anomaly_signals_select_admin ON anomaly_signals
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY anomaly_signals_insert_system ON anomaly_signals
  FOR INSERT
  WITH CHECK (true); -- Service role bypasses RLS

CREATE POLICY anomaly_signals_update_own ON anomaly_signals
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY anomaly_signals_update_admin ON anomaly_signals
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- =====================================================================================
-- =====================================================================================

CREATE OR REPLACE FUNCTION get_active_anomalies(
  p_user_id UUID DEFAULT NULL,
  p_severity VARCHAR DEFAULT NULL,
  p_time_window_hours INTEGER DEFAULT 24
)
RETURNS TABLE (
  id UUID,
  anomaly_type VARCHAR,
  severity VARCHAR,
  confidence_score DECIMAL,
  anomaly_description TEXT,
  anomaly_summary TEXT,
  affected_users_count INTEGER,
  business_impact VARCHAR,
  detection_timestamp TIMESTAMPTZ,
  status VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.anomaly_type,
    a.severity,
    a.confidence_score,
    a.anomaly_description,
    a.anomaly_summary,
    a.affected_users_count,
    a.business_impact,
    a.detection_timestamp,
    a.status
  FROM anomaly_signals a
  WHERE (p_user_id IS NULL OR a.user_id = p_user_id)
    AND (p_severity IS NULL OR a.severity = p_severity)
    AND a.status IN ('detected', 'investigating', 'confirmed')
    AND a.created_at >= NOW() - (p_time_window_hours || ' hours')::INTERVAL
  ORDER BY a.severity DESC, a.confidence_score DESC, a.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_anomaly_statistics(
  p_user_id UUID DEFAULT NULL,
  p_time_window_hours INTEGER DEFAULT 24
)
RETURNS TABLE (
  total_anomalies BIGINT,
  critical_anomalies BIGINT,
  high_anomalies BIGINT,
  medium_anomalies BIGINT,
  low_anomalies BIGINT,
  resolved_anomalies BIGINT,
  false_positives BIGINT,
  avg_resolution_time_minutes DECIMAL,
  avg_confidence_score DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT AS total_anomalies,
    COUNT(*) FILTER (WHERE severity = 'critical')::BIGINT AS critical_anomalies,
    COUNT(*) FILTER (WHERE severity = 'high')::BIGINT AS high_anomalies,
    COUNT(*) FILTER (WHERE severity = 'medium')::BIGINT AS medium_anomalies,
    COUNT(*) FILTER (WHERE severity = 'low')::BIGINT AS low_anomalies,
    COUNT(*) FILTER (WHERE status = 'resolved')::BIGINT AS resolved_anomalies,
    COUNT(*) FILTER (WHERE status = 'false_positive')::BIGINT AS false_positives,
    AVG(resolution_duration_minutes)::DECIMAL AS avg_resolution_time_minutes,
    AVG(confidence_score)::DECIMAL AS avg_confidence_score
  FROM anomaly_signals
  WHERE (p_user_id IS NULL OR user_id = p_user_id)
    AND created_at >= NOW() - (p_time_window_hours || ' hours')::INTERVAL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION find_correlated_anomalies(
  p_anomaly_id UUID,
  p_time_window_minutes INTEGER DEFAULT 30,
  p_max_results INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  anomaly_type VARCHAR,
  severity VARCHAR,
  source_component_name VARCHAR,
  detection_timestamp TIMESTAMPTZ,
  correlation_score DECIMAL
) AS $$
DECLARE
  v_detection_time TIMESTAMPTZ;
  v_component_name VARCHAR;
  v_anomaly_type VARCHAR;
BEGIN
  SELECT detection_timestamp, source_component_name, anomaly_type
  INTO v_detection_time, v_component_name, v_anomaly_type
  FROM anomaly_signals
  WHERE anomaly_signals.id = p_anomaly_id;
  
  RETURN QUERY
  SELECT
    a.id,
    a.anomaly_type,
    a.severity,
    a.source_component_name,
    a.detection_timestamp,
    (
      CASE
        WHEN a.source_component_name = v_component_name THEN 100.0
        WHEN a.anomaly_type = v_anomaly_type THEN 75.0
        WHEN ABS(EXTRACT(EPOCH FROM (a.detection_timestamp - v_detection_time))) < 60 THEN 50.0
        ELSE 25.0
      END
    )::DECIMAL AS correlation_score
  FROM anomaly_signals a
  WHERE a.id != p_anomaly_id
    AND a.detection_timestamp BETWEEN 
      v_detection_time - (p_time_window_minutes || ' minutes')::INTERVAL AND
      v_detection_time + (p_time_window_minutes || ' minutes')::INTERVAL
  ORDER BY correlation_score DESC, a.detection_timestamp DESC
  LIMIT p_max_results;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION update_anomaly_status(
  p_anomaly_id UUID,
  p_new_status VARCHAR,
  p_user_id UUID,
  p_resolution_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_detection_time TIMESTAMPTZ;
  v_resolution_duration INTEGER;
BEGIN
  SELECT detection_timestamp INTO v_detection_time
  FROM anomaly_signals
  WHERE id = p_anomaly_id;
  
  IF p_new_status IN ('resolved', 'false_positive', 'ignored') THEN
    v_resolution_duration := EXTRACT(EPOCH FROM (NOW() - v_detection_time)) / 60;
  END IF;
  
  UPDATE anomaly_signals
  SET
    status = p_new_status,
    acknowledged_by = CASE WHEN p_new_status IN ('investigating', 'confirmed') THEN p_user_id ELSE acknowledged_by END,
    acknowledged_at = CASE WHEN p_new_status IN ('investigating', 'confirmed') AND acknowledged_at IS NULL THEN NOW() ELSE acknowledged_at END,
    resolved_by = CASE WHEN p_new_status IN ('resolved', 'false_positive', 'ignored') THEN p_user_id ELSE resolved_by END,
    resolved_at = CASE WHEN p_new_status IN ('resolved', 'false_positive', 'ignored') THEN NOW() ELSE resolved_at END,
    resolution_duration_minutes = v_resolution_duration,
    resolution_notes = COALESCE(p_resolution_notes, resolution_notes),
    updated_at = NOW()
  WHERE id = p_anomaly_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================================================
-- =====================================================================================

CREATE TRIGGER update_anomaly_signals_updated_at
  BEFORE UPDATE ON anomaly_signals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================================================
-- =====================================================================================

COMMENT ON TABLE anomaly_signals IS 'Captures detected anomalies from system monitoring with AI-powered root cause analysis';
COMMENT ON COLUMN anomaly_signals.confidence_score IS 'Confidence in anomaly detection (0-100), higher is more confident';
COMMENT ON COLUMN anomaly_signals.root_cause_analysis IS 'AI-generated root cause analysis from GPT-4o';
COMMENT ON COLUMN anomaly_signals.recommended_actions IS 'JSONB array of recommended recovery actions';
COMMENT ON COLUMN anomaly_signals.pattern_type IS 'Type of anomaly pattern detected (spike, gradual, oscillation, etc.)';
COMMENT ON COLUMN anomaly_signals.business_impact IS 'Estimated business impact level';

-- =====================================================================================
-- =====================================================================================
