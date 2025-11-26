-- =====================================================================================
-- =====================================================================================
--
--
-- =====================================================================================

BEGIN;

-- =====================================================================================
-- =====================================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================================
-- =====================================================================================

CREATE TABLE IF NOT EXISTS decision_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  decision_type TEXT NOT NULL, -- 'optimization', 'alert', 'recommendation', 'automation'
  trigger_source TEXT NOT NULL, -- 'manual', 'scheduled', 'threshold', 'insight'
  context_data JSONB NOT NULL DEFAULT '{}', -- Input data, metrics, thresholds
  
  reasoning_model TEXT NOT NULL DEFAULT 'gpt-4o', -- AI model used
  reasoning_prompt TEXT, -- Prompt sent to AI
  reasoning_response TEXT, -- Full AI response
  reasoning_tokens INTEGER, -- Token count for cost tracking
  
  factors_analyzed JSONB NOT NULL DEFAULT '[]', -- Array of {factor_name, weight, value, score}
  total_confidence_score DECIMAL(5,4) NOT NULL CHECK (total_confidence_score >= 0 AND total_confidence_score <= 1),
  
  recommended_action TEXT NOT NULL, -- 'approve', 'reject', 'escalate', 'automate'
  action_details JSONB NOT NULL DEFAULT '{}', -- Specific action parameters
  expected_impact TEXT, -- Predicted outcome
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'executed', 'failed', 'expired')),
  executed_at TIMESTAMPTZ,
  executed_by UUID REFERENCES auth.users(id),
  execution_result JSONB,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ, -- Auto-expire pending decisions
  
  tags TEXT[] DEFAULT '{}',
  priority INTEGER DEFAULT 0 CHECK (priority >= 0 AND priority <= 10),
  requires_approval BOOLEAN DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_decision_events_user_id ON decision_events(user_id);
CREATE INDEX IF NOT EXISTS idx_decision_events_decision_type ON decision_events(decision_type);
CREATE INDEX IF NOT EXISTS idx_decision_events_status ON decision_events(status);
CREATE INDEX IF NOT EXISTS idx_decision_events_created_at ON decision_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_decision_events_risk_level ON decision_events(risk_level);
CREATE INDEX IF NOT EXISTS idx_decision_events_expires_at ON decision_events(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_decision_events_user_status ON decision_events(user_id, status);
CREATE INDEX IF NOT EXISTS idx_decision_events_context_data ON decision_events USING GIN(context_data);
CREATE INDEX IF NOT EXISTS idx_decision_events_tags ON decision_events USING GIN(tags);

ALTER TABLE decision_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'decision_events' AND policyname = 'decision_events_select_policy') THEN
    CREATE POLICY decision_events_select_policy ON decision_events FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'decision_events' AND policyname = 'decision_events_insert_policy') THEN
    CREATE POLICY decision_events_insert_policy ON decision_events FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'decision_events' AND policyname = 'decision_events_update_policy') THEN
    CREATE POLICY decision_events_update_policy ON decision_events FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'decision_events' AND policyname = 'decision_events_delete_policy') THEN
    CREATE POLICY decision_events_delete_policy ON decision_events FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

DROP TRIGGER IF EXISTS decision_events_updated_at_trigger ON decision_events;
CREATE TRIGGER decision_events_updated_at_trigger
  BEFORE UPDATE ON decision_events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION expire_old_decision_events()
RETURNS void AS $$
BEGIN
  UPDATE decision_events
  SET status = 'expired',
      updated_at = NOW()
  WHERE status = 'pending'
    AND expires_at IS NOT NULL
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- =====================================================================================
-- =====================================================================================

CREATE TABLE IF NOT EXISTS system_health_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  
  component_type VARCHAR(50) NOT NULL,
  component_name VARCHAR(255) NOT NULL,
  component_version VARCHAR(50),
  environment VARCHAR(50) DEFAULT 'production',
  
  status VARCHAR(50) NOT NULL DEFAULT 'healthy',
  uptime_percentage DECIMAL(5,2),
  availability_percentage DECIMAL(5,2),
  
  latency_ms INTEGER,
  latency_p50_ms INTEGER,
  latency_p95_ms INTEGER,
  latency_p99_ms INTEGER,
  throughput_per_minute INTEGER,
  
  error_count INTEGER DEFAULT 0,
  error_rate DECIMAL(5,2),
  error_types JSONB,
  last_error_message TEXT,
  last_error_timestamp TIMESTAMPTZ,
  
  cpu_usage_percent DECIMAL(5,2),
  memory_usage_mb INTEGER,
  memory_usage_percent DECIMAL(5,2),
  disk_usage_mb INTEGER,
  disk_usage_percent DECIMAL(5,2),
  network_in_mbps DECIMAL(10,2),
  network_out_mbps DECIMAL(10,2),
  
  db_connection_count INTEGER,
  db_query_count INTEGER,
  db_slow_query_count INTEGER,
  db_deadlock_count INTEGER,
  db_cache_hit_rate DECIMAL(5,2),
  
  integration_name VARCHAR(100),
  integration_success_rate DECIMAL(5,2),
  integration_retry_count INTEGER,
  integration_timeout_count INTEGER,
  
  measurement_window_start TIMESTAMPTZ NOT NULL,
  measurement_window_end TIMESTAMPTZ NOT NULL,
  measurement_window_seconds INTEGER,
  
  metadata JSONB,
  tags TEXT[],
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_health_events_user_id ON system_health_events(user_id);
CREATE INDEX IF NOT EXISTS idx_system_health_events_organization_id ON system_health_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_system_health_events_component_type ON system_health_events(component_type);
CREATE INDEX IF NOT EXISTS idx_system_health_events_component_name ON system_health_events(component_name);
CREATE INDEX IF NOT EXISTS idx_system_health_events_status ON system_health_events(status);
CREATE INDEX IF NOT EXISTS idx_system_health_events_created_at ON system_health_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_health_events_measurement_window ON system_health_events(measurement_window_start DESC, measurement_window_end DESC);
CREATE INDEX IF NOT EXISTS idx_system_health_events_latency ON system_health_events(latency_ms DESC) WHERE latency_ms IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_system_health_events_error_rate ON system_health_events(error_rate DESC) WHERE error_rate > 0;
CREATE INDEX IF NOT EXISTS idx_system_health_events_availability ON system_health_events(availability_percentage ASC) WHERE availability_percentage < 99.0;
CREATE INDEX IF NOT EXISTS idx_system_health_events_cpu_usage ON system_health_events(cpu_usage_percent DESC) WHERE cpu_usage_percent > 80;
CREATE INDEX IF NOT EXISTS idx_system_health_events_memory_usage ON system_health_events(memory_usage_percent DESC) WHERE memory_usage_percent > 80;
CREATE INDEX IF NOT EXISTS idx_system_health_events_integration ON system_health_events(integration_name) WHERE integration_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_system_health_events_component_status_time ON system_health_events(component_type, component_name, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_health_events_user_component_time ON system_health_events(user_id, component_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_health_events_error_types ON system_health_events USING GIN(error_types);
CREATE INDEX IF NOT EXISTS idx_system_health_events_metadata ON system_health_events USING GIN(metadata);
CREATE INDEX IF NOT EXISTS idx_system_health_events_tags ON system_health_events USING GIN(tags);

ALTER TABLE system_health_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'system_health_events' AND policyname = 'system_health_events_select_own') THEN
    CREATE POLICY system_health_events_select_own ON system_health_events FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'system_health_events' AND policyname = 'system_health_events_select_admin') THEN
    CREATE POLICY system_health_events_select_admin ON system_health_events FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
      )
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'system_health_events' AND policyname = 'system_health_events_insert_system') THEN
    CREATE POLICY system_health_events_insert_system ON system_health_events FOR INSERT WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'system_health_events' AND policyname = 'system_health_events_update_system') THEN
    CREATE POLICY system_health_events_update_system ON system_health_events FOR UPDATE USING (true);
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_system_health_events_updated_at ON system_health_events;
CREATE TRIGGER update_system_health_events_updated_at
  BEFORE UPDATE ON system_health_events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================================================
-- =====================================================================================

CREATE TABLE IF NOT EXISTS anomaly_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  
  anomaly_type VARCHAR(100) NOT NULL,
  anomaly_category VARCHAR(50) NOT NULL,
  severity VARCHAR(50) NOT NULL DEFAULT 'medium',
  confidence_score DECIMAL(5,2) NOT NULL,
  
  source_type VARCHAR(50) NOT NULL,
  source_id UUID,
  source_component_type VARCHAR(50),
  source_component_name VARCHAR(255),
  
  anomaly_description TEXT NOT NULL,
  anomaly_summary TEXT,
  root_cause_analysis TEXT,
  recommended_actions JSONB,
  
  baseline_value DECIMAL(15,2),
  observed_value DECIMAL(15,2),
  deviation_percentage DECIMAL(10,2),
  threshold_exceeded VARCHAR(100),
  
  pattern_type VARCHAR(100),
  pattern_duration_seconds INTEGER,
  pattern_frequency INTEGER,
  historical_occurrences INTEGER DEFAULT 0,
  
  affected_users_count INTEGER DEFAULT 0,
  affected_components TEXT[],
  business_impact VARCHAR(50),
  estimated_cost_impact DECIMAL(10,2),
  
  detection_method VARCHAR(100) NOT NULL,
  detection_algorithm VARCHAR(100),
  detection_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  status VARCHAR(50) NOT NULL DEFAULT 'detected',
  acknowledged_by UUID REFERENCES auth.users(id),
  acknowledged_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  resolution_duration_minutes INTEGER,
  
  related_anomaly_ids UUID[],
  triggered_recovery_action_id UUID,
  escalation_event_id UUID,
  
  gpt4o_prompt TEXT,
  gpt4o_response TEXT,
  gpt4o_model VARCHAR(50),
  gpt4o_tokens_used INTEGER,
  gpt4o_analysis_duration_ms INTEGER,
  
  metadata JSONB,
  tags TEXT[],
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_anomaly_signals_user_id ON anomaly_signals(user_id);
CREATE INDEX IF NOT EXISTS idx_anomaly_signals_organization_id ON anomaly_signals(organization_id);
CREATE INDEX IF NOT EXISTS idx_anomaly_signals_anomaly_type ON anomaly_signals(anomaly_type);
CREATE INDEX IF NOT EXISTS idx_anomaly_signals_severity ON anomaly_signals(severity);
CREATE INDEX IF NOT EXISTS idx_anomaly_signals_status ON anomaly_signals(status);
CREATE INDEX IF NOT EXISTS idx_anomaly_signals_created_at ON anomaly_signals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_anomaly_signals_detection_timestamp ON anomaly_signals(detection_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_anomaly_signals_source_type ON anomaly_signals(source_type);
CREATE INDEX IF NOT EXISTS idx_anomaly_signals_source_id ON anomaly_signals(source_id) WHERE source_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_anomaly_signals_source_component ON anomaly_signals(source_component_type, source_component_name);
CREATE INDEX IF NOT EXISTS idx_anomaly_signals_high_severity ON anomaly_signals(severity, created_at DESC) WHERE severity IN ('high', 'critical');
CREATE INDEX IF NOT EXISTS idx_anomaly_signals_business_impact ON anomaly_signals(business_impact) WHERE business_impact IN ('high', 'critical');
CREATE INDEX IF NOT EXISTS idx_anomaly_signals_confidence ON anomaly_signals(confidence_score DESC) WHERE confidence_score >= 80.0;
CREATE INDEX IF NOT EXISTS idx_anomaly_signals_unresolved ON anomaly_signals(status, created_at DESC) WHERE status IN ('detected', 'investigating', 'confirmed');
CREATE INDEX IF NOT EXISTS idx_anomaly_signals_acknowledged ON anomaly_signals(acknowledged_at DESC) WHERE acknowledged_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_anomaly_signals_resolved ON anomaly_signals(resolved_at DESC) WHERE resolved_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_anomaly_signals_user_status_time ON anomaly_signals(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_anomaly_signals_type_severity_time ON anomaly_signals(anomaly_type, severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_anomaly_signals_recommended_actions ON anomaly_signals USING GIN(recommended_actions);
CREATE INDEX IF NOT EXISTS idx_anomaly_signals_affected_components ON anomaly_signals USING GIN(affected_components);
CREATE INDEX IF NOT EXISTS idx_anomaly_signals_related_anomalies ON anomaly_signals USING GIN(related_anomaly_ids);
CREATE INDEX IF NOT EXISTS idx_anomaly_signals_metadata ON anomaly_signals USING GIN(metadata);
CREATE INDEX IF NOT EXISTS idx_anomaly_signals_tags ON anomaly_signals USING GIN(tags);

ALTER TABLE anomaly_signals ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'anomaly_signals' AND policyname = 'anomaly_signals_select_own') THEN
    CREATE POLICY anomaly_signals_select_own ON anomaly_signals FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'anomaly_signals' AND policyname = 'anomaly_signals_select_admin') THEN
    CREATE POLICY anomaly_signals_select_admin ON anomaly_signals FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
      )
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'anomaly_signals' AND policyname = 'anomaly_signals_insert_system') THEN
    CREATE POLICY anomaly_signals_insert_system ON anomaly_signals FOR INSERT WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'anomaly_signals' AND policyname = 'anomaly_signals_update_own') THEN
    CREATE POLICY anomaly_signals_update_own ON anomaly_signals FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'anomaly_signals' AND policyname = 'anomaly_signals_update_admin') THEN
    CREATE POLICY anomaly_signals_update_admin ON anomaly_signals FOR UPDATE USING (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
      )
    );
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_anomaly_signals_updated_at ON anomaly_signals;
CREATE TRIGGER update_anomaly_signals_updated_at
  BEFORE UPDATE ON anomaly_signals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================================================
-- =====================================================================================

CREATE TABLE IF NOT EXISTS recovery_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  
  action_type VARCHAR(100) NOT NULL,
  action_category VARCHAR(50) NOT NULL,
  action_name VARCHAR(255) NOT NULL,
  action_description TEXT,
  
  trigger_type VARCHAR(50) NOT NULL,
  triggered_by_user_id UUID REFERENCES auth.users(id),
  triggered_by_anomaly_id UUID,
  triggered_by_health_event_id UUID,
  triggered_by_escalation_id UUID,
  trigger_reason TEXT NOT NULL,
  
  target_component_type VARCHAR(50) NOT NULL,
  target_component_name VARCHAR(255) NOT NULL,
  target_component_id VARCHAR(255),
  target_environment VARCHAR(50) DEFAULT 'production',
  
  action_config JSONB NOT NULL,
  action_parameters JSONB,
  retry_policy JSONB,
  timeout_seconds INTEGER DEFAULT 300,
  
  execution_status VARCHAR(50) NOT NULL DEFAULT 'pending',
  execution_started_at TIMESTAMPTZ,
  execution_completed_at TIMESTAMPTZ,
  execution_duration_ms INTEGER,
  
  attempt_number INTEGER DEFAULT 1,
  max_attempts INTEGER DEFAULT 1,
  last_attempt_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  
  execution_result JSONB,
  execution_output TEXT,
  execution_error TEXT,
  execution_error_code VARCHAR(50),
  success BOOLEAN,
  
  affected_users_count INTEGER DEFAULT 0,
  affected_components TEXT[],
  downtime_seconds INTEGER,
  recovery_effectiveness_score DECIMAL(5,2),
  
  pre_action_metrics JSONB,
  post_action_metrics JSONB,
  metrics_improvement_percentage DECIMAL(10,2),
  
  rollback_required BOOLEAN DEFAULT false,
  rollback_action_id UUID,
  rollback_reason TEXT,
  rollback_completed_at TIMESTAMPTZ,
  
  requires_approval BOOLEAN DEFAULT false,
  approval_status VARCHAR(50),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  approval_notes TEXT,
  
  notifications_sent JSONB,
  notification_channels TEXT[],
  
  executed_by VARCHAR(50) NOT NULL DEFAULT 'system',
  execution_context JSONB,
  
  metadata JSONB,
  tags TEXT[],
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recovery_actions_user_id ON recovery_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_recovery_actions_organization_id ON recovery_actions(organization_id);
CREATE INDEX IF NOT EXISTS idx_recovery_actions_action_type ON recovery_actions(action_type);
CREATE INDEX IF NOT EXISTS idx_recovery_actions_execution_status ON recovery_actions(execution_status);
CREATE INDEX IF NOT EXISTS idx_recovery_actions_created_at ON recovery_actions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recovery_actions_execution_started ON recovery_actions(execution_started_at DESC) WHERE execution_started_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_recovery_actions_execution_completed ON recovery_actions(execution_completed_at DESC) WHERE execution_completed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_recovery_actions_trigger_type ON recovery_actions(trigger_type);
CREATE INDEX IF NOT EXISTS idx_recovery_actions_anomaly_id ON recovery_actions(triggered_by_anomaly_id) WHERE triggered_by_anomaly_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_recovery_actions_health_event_id ON recovery_actions(triggered_by_health_event_id) WHERE triggered_by_health_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_recovery_actions_target_component ON recovery_actions(target_component_type, target_component_name);
CREATE INDEX IF NOT EXISTS idx_recovery_actions_target_environment ON recovery_actions(target_environment);
CREATE INDEX IF NOT EXISTS idx_recovery_actions_pending ON recovery_actions(execution_status, created_at DESC) WHERE execution_status IN ('pending', 'in_progress');
CREATE INDEX IF NOT EXISTS idx_recovery_actions_failed ON recovery_actions(execution_status, created_at DESC) WHERE execution_status IN ('failed', 'timeout');
CREATE INDEX IF NOT EXISTS idx_recovery_actions_success ON recovery_actions(success, created_at DESC) WHERE success = true;
CREATE INDEX IF NOT EXISTS idx_recovery_actions_pending_approval ON recovery_actions(approval_status, created_at DESC) WHERE requires_approval = true AND approval_status = 'pending';
CREATE INDEX IF NOT EXISTS idx_recovery_actions_next_retry ON recovery_actions(next_retry_at ASC) WHERE next_retry_at IS NOT NULL AND execution_status = 'pending';
CREATE INDEX IF NOT EXISTS idx_recovery_actions_user_status_time ON recovery_actions(user_id, execution_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recovery_actions_type_success_time ON recovery_actions(action_type, success, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recovery_actions_action_config ON recovery_actions USING GIN(action_config);
CREATE INDEX IF NOT EXISTS idx_recovery_actions_execution_result ON recovery_actions USING GIN(execution_result);
CREATE INDEX IF NOT EXISTS idx_recovery_actions_affected_components ON recovery_actions USING GIN(affected_components);
CREATE INDEX IF NOT EXISTS idx_recovery_actions_metadata ON recovery_actions USING GIN(metadata);
CREATE INDEX IF NOT EXISTS idx_recovery_actions_tags ON recovery_actions USING GIN(tags);

ALTER TABLE recovery_actions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'recovery_actions' AND policyname = 'recovery_actions_select_own') THEN
    CREATE POLICY recovery_actions_select_own ON recovery_actions FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'recovery_actions' AND policyname = 'recovery_actions_select_admin') THEN
    CREATE POLICY recovery_actions_select_admin ON recovery_actions FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
      )
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'recovery_actions' AND policyname = 'recovery_actions_insert_system') THEN
    CREATE POLICY recovery_actions_insert_system ON recovery_actions FOR INSERT WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'recovery_actions' AND policyname = 'recovery_actions_update_admin') THEN
    CREATE POLICY recovery_actions_update_admin ON recovery_actions FOR UPDATE USING (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
      )
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'recovery_actions' AND policyname = 'recovery_actions_update_system') THEN
    CREATE POLICY recovery_actions_update_system ON recovery_actions FOR UPDATE USING (true);
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_recovery_actions_updated_at ON recovery_actions;
CREATE TRIGGER update_recovery_actions_updated_at
  BEFORE UPDATE ON recovery_actions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================================================
-- =====================================================================================

CREATE TABLE IF NOT EXISTS selftest_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  
  test_name VARCHAR(255) NOT NULL,
  test_category VARCHAR(50) NOT NULL,
  test_type VARCHAR(50) NOT NULL,
  test_description TEXT,
  test_version VARCHAR(50),
  
  execution_mode VARCHAR(50) NOT NULL DEFAULT 'scheduled',
  scheduled_by VARCHAR(50),
  triggered_by_user_id UUID REFERENCES auth.users(id),
  trigger_reason TEXT,
  
  target_component_type VARCHAR(50),
  target_component_name VARCHAR(255),
  target_environment VARCHAR(50) DEFAULT 'production',
  
  execution_status VARCHAR(50) NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  execution_duration_ms INTEGER,
  timeout_seconds INTEGER DEFAULT 300,
  
  test_result VARCHAR(50) NOT NULL,
  success BOOLEAN,
  pass_count INTEGER DEFAULT 0,
  fail_count INTEGER DEFAULT 0,
  warning_count INTEGER DEFAULT 0,
  skip_count INTEGER DEFAULT 0,
  total_assertions INTEGER DEFAULT 0,
  
  test_output TEXT,
  test_summary TEXT,
  failure_reason TEXT,
  error_message TEXT,
  error_stack_trace TEXT,
  
  response_time_ms INTEGER,
  throughput_per_second DECIMAL(10,2),
  error_rate DECIMAL(5,2),
  cpu_usage_percent DECIMAL(5,2),
  memory_usage_mb INTEGER,
  
  assertions_passed JSONB,
  assertions_failed JSONB,
  assertions_warnings JSONB,
  
  baseline_test_id UUID,
  baseline_deviation_percentage DECIMAL(10,2),
  regression_detected BOOLEAN DEFAULT false,
  improvement_detected BOOLEAN DEFAULT false,
  
  health_score DECIMAL(5,2),
  reliability_score DECIMAL(5,2),
  performance_score DECIMAL(5,2),
  security_score DECIMAL(5,2),
  
  recommendations JSONB,
  action_required BOOLEAN DEFAULT false,
  severity VARCHAR(50),
  
  notifications_sent JSONB,
  notification_channels TEXT[],
  alerted_users UUID[],
  
  test_config JSONB,
  test_parameters JSONB,
  
  metadata JSONB,
  tags TEXT[],
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_selftest_results_user_id ON selftest_results(user_id);
CREATE INDEX IF NOT EXISTS idx_selftest_results_organization_id ON selftest_results(organization_id);
CREATE INDEX IF NOT EXISTS idx_selftest_results_test_name ON selftest_results(test_name);
CREATE INDEX IF NOT EXISTS idx_selftest_results_test_category ON selftest_results(test_category);
CREATE INDEX IF NOT EXISTS idx_selftest_results_test_result ON selftest_results(test_result);
CREATE INDEX IF NOT EXISTS idx_selftest_results_created_at ON selftest_results(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_selftest_results_started_at ON selftest_results(started_at DESC) WHERE started_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_selftest_results_completed_at ON selftest_results(completed_at DESC) WHERE completed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_selftest_results_target_component ON selftest_results(target_component_type, target_component_name);
CREATE INDEX IF NOT EXISTS idx_selftest_results_target_environment ON selftest_results(target_environment);
CREATE INDEX IF NOT EXISTS idx_selftest_results_execution_status ON selftest_results(execution_status);
CREATE INDEX IF NOT EXISTS idx_selftest_results_failed ON selftest_results(test_result, created_at DESC) WHERE test_result IN ('fail', 'error');
CREATE INDEX IF NOT EXISTS idx_selftest_results_passed ON selftest_results(test_result, created_at DESC) WHERE test_result = 'pass';
CREATE INDEX IF NOT EXISTS idx_selftest_results_health_score ON selftest_results(health_score DESC) WHERE health_score IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_selftest_results_low_health ON selftest_results(health_score ASC) WHERE health_score < 70.0;
CREATE INDEX IF NOT EXISTS idx_selftest_results_regression ON selftest_results(regression_detected, created_at DESC) WHERE regression_detected = true;
CREATE INDEX IF NOT EXISTS idx_selftest_results_action_required ON selftest_results(action_required, severity, created_at DESC) WHERE action_required = true;
CREATE INDEX IF NOT EXISTS idx_selftest_results_baseline ON selftest_results(baseline_test_id) WHERE baseline_test_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_selftest_results_user_test_time ON selftest_results(user_id, test_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_selftest_results_component_result_time ON selftest_results(target_component_type, target_component_name, test_result, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_selftest_results_assertions_passed ON selftest_results USING GIN(assertions_passed);
CREATE INDEX IF NOT EXISTS idx_selftest_results_assertions_failed ON selftest_results USING GIN(assertions_failed);
CREATE INDEX IF NOT EXISTS idx_selftest_results_recommendations ON selftest_results USING GIN(recommendations);
CREATE INDEX IF NOT EXISTS idx_selftest_results_metadata ON selftest_results USING GIN(metadata);
CREATE INDEX IF NOT EXISTS idx_selftest_results_tags ON selftest_results USING GIN(tags);

ALTER TABLE selftest_results ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'selftest_results' AND policyname = 'selftest_results_select_own') THEN
    CREATE POLICY selftest_results_select_own ON selftest_results FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'selftest_results' AND policyname = 'selftest_results_select_admin') THEN
    CREATE POLICY selftest_results_select_admin ON selftest_results FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
      )
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'selftest_results' AND policyname = 'selftest_results_insert_system') THEN
    CREATE POLICY selftest_results_insert_system ON selftest_results FOR INSERT WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'selftest_results' AND policyname = 'selftest_results_update_system') THEN
    CREATE POLICY selftest_results_update_system ON selftest_results FOR UPDATE USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'selftest_results' AND policyname = 'selftest_results_delete_admin') THEN
    CREATE POLICY selftest_results_delete_admin ON selftest_results FOR DELETE USING (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
      )
    );
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_selftest_results_updated_at ON selftest_results;
CREATE TRIGGER update_selftest_results_updated_at
  BEFORE UPDATE ON selftest_results
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================================================
-- =====================================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'decision_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE decision_events;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'system_health_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE system_health_events;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'anomaly_signals'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE anomaly_signals;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'recovery_actions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE recovery_actions;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'selftest_results'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE selftest_results;
  END IF;
END $$;

-- =====================================================================================
-- =====================================================================================

-- Insert sample decision events for test users
INSERT INTO decision_events (
  user_id,
  decision_type,
  trigger_source,
  context_data,
  reasoning_model,
  reasoning_response,
  factors_analyzed,
  total_confidence_score,
  recommended_action,
  action_details,
  expected_impact,
  risk_level,
  status,
  priority,
  tags
) VALUES
  (
    COALESCE(
      (SELECT id FROM auth.users WHERE email = 'e2e_starter_test@core314test.com' LIMIT 1),
      (SELECT id FROM auth.users WHERE email = 'admin_test@core314test.com' LIMIT 1),
      (SELECT id FROM auth.users WHERE email LIKE '%test%' LIMIT 1),
      (SELECT id FROM auth.users LIMIT 1)
    ),
    'optimization',
    'scheduled',
    '{"metric": "response_time", "current_value": 250, "threshold": 200}',
    'gpt-4o',
    'Based on current response time metrics, I recommend scaling up resources to maintain optimal performance.',
    '[{"factor_name": "response_time", "weight": 0.8, "value": 250, "score": 0.75}, {"factor_name": "error_rate", "weight": 0.2, "value": 0.5, "score": 0.95}]',
    0.8250,
    'approve',
    '{"action": "scale_up", "target_replicas": 3}',
    'Improved response time by 30%',
    'low',
    'pending',
    5,
    ARRAY['performance', 'optimization', 'automated']
  ),
  (
    COALESCE(
      (SELECT id FROM auth.users WHERE email = 'e2e_starter_test@core314test.com' LIMIT 1),
      (SELECT id FROM auth.users WHERE email = 'admin_test@core314test.com' LIMIT 1),
      (SELECT id FROM auth.users WHERE email LIKE '%test%' LIMIT 1),
      (SELECT id FROM auth.users LIMIT 1)
    ),
    'alert',
    'threshold',
    '{"metric": "error_rate", "current_value": 5.2, "threshold": 5.0}',
    'gpt-4o',
    'Error rate has exceeded threshold. Recommend investigating recent deployments.',
    '[{"factor_name": "error_rate", "weight": 0.9, "value": 5.2, "score": 0.60}, {"factor_name": "deployment_time", "weight": 0.1, "value": 1, "score": 0.80}]',
    0.6200,
    'escalate',
    '{"action": "investigate", "priority": "high"}',
    'Prevent service degradation',
    'medium',
    'pending',
    8,
    ARRAY['reliability', 'alert', 'threshold_breach']
  )
ON CONFLICT DO NOTHING;

-- Insert sample system health events for test users
INSERT INTO system_health_events (
  user_id,
  organization_id,
  component_type,
  component_name,
  environment,
  status,
  availability_percentage,
  latency_ms,
  latency_p50_ms,
  latency_p95_ms,
  latency_p99_ms,
  throughput_per_minute,
  error_count,
  error_rate,
  cpu_usage_percent,
  memory_usage_percent,
  measurement_window_start,
  measurement_window_end,
  measurement_window_seconds,
  tags
) VALUES
  (
    COALESCE(
      (SELECT id FROM auth.users WHERE email = 'e2e_starter_test@core314test.com' LIMIT 1),
      (SELECT id FROM auth.users WHERE email = 'admin_test@core314test.com' LIMIT 1),
      (SELECT id FROM auth.users WHERE email LIKE '%test%' LIMIT 1),
      (SELECT id FROM auth.users LIMIT 1)
    ),
    NULL,
    'edge_function',
    'fusion-analyze',
    'production',
    'healthy',
    99.5,
    150,
    120,
    180,
    250,
    45,
    2,
    0.5,
    35.2,
    42.8,
    NOW() - INTERVAL '5 minutes',
    NOW(),
    300,
    ARRAY['edge_function', 'automated_collection']
  ),
  (
    COALESCE(
      (SELECT id FROM auth.users WHERE email = 'e2e_starter_test@core314test.com' LIMIT 1),
      (SELECT id FROM auth.users WHERE email = 'admin_test@core314test.com' LIMIT 1),
      (SELECT id FROM auth.users WHERE email LIKE '%test%' LIMIT 1),
      (SELECT id FROM auth.users LIMIT 1)
    ),
    NULL,
    'database_query',
    'supabase_postgres',
    'production',
    'healthy',
    99.8,
    45,
    35,
    60,
    85,
    120,
    1,
    0.2,
    28.5,
    38.2,
    NOW() - INTERVAL '5 minutes',
    NOW(),
    300,
    ARRAY['database', 'automated_collection']
  ),
  (
    COALESCE(
      (SELECT id FROM auth.users WHERE email = 'e2e_starter_test@core314test.com' LIMIT 1),
      (SELECT id FROM auth.users WHERE email = 'admin_test@core314test.com' LIMIT 1),
      (SELECT id FROM auth.users WHERE email LIKE '%test%' LIMIT 1),
      (SELECT id FROM auth.users LIMIT 1)
    ),
    NULL,
    'integration',
    'slack',
    'production',
    'healthy',
    98.5,
    320,
    280,
    450,
    600,
    15,
    3,
    1.5,
    NULL,
    NULL,
    NOW() - INTERVAL '5 minutes',
    NOW(),
    300,
    ARRAY['integration', 'automated_collection']
  )
ON CONFLICT DO NOTHING;

-- Insert sample anomaly signals for test users
INSERT INTO anomaly_signals (
  user_id,
  organization_id,
  anomaly_type,
  anomaly_category,
  severity,
  confidence_score,
  source_type,
  source_component_type,
  source_component_name,
  anomaly_description,
  anomaly_summary,
  baseline_value,
  observed_value,
  deviation_percentage,
  threshold_exceeded,
  pattern_type,
  detection_method,
  detection_algorithm,
  affected_components,
  business_impact,
  recommended_actions,
  detection_timestamp,
  status,
  tags
) VALUES
  (
    COALESCE(
      (SELECT id FROM auth.users WHERE email = 'e2e_starter_test@core314test.com' LIMIT 1),
      (SELECT id FROM auth.users WHERE email = 'admin_test@core314test.com' LIMIT 1),
      (SELECT id FROM auth.users WHERE email LIKE '%test%' LIMIT 1),
      (SELECT id FROM auth.users LIMIT 1)
    ),
    NULL,
    'latency_spike',
    'performance',
    'medium',
    85.5,
    'system_health_event',
    'edge_function',
    'cognitive-decision-engine',
    'Latency spike detected: 450ms (baseline: 200ms, +125.0%)',
    'Edge function response time has increased significantly, likely due to increased load or resource constraints.',
    200,
    450,
    125.0,
    'latency_threshold',
    'sudden_spike',
    'statistical_analysis',
    'threshold_comparison',
    ARRAY['cognitive-decision-engine'],
    'medium',
    '["investigate_recent_deployments", "check_resource_utilization", "scale_up_resources"]',
    NOW() - INTERVAL '10 minutes',
    'detected',
    ARRAY['latency', 'performance', 'automated_detection']
  ),
  (
    COALESCE(
      (SELECT id FROM auth.users WHERE email = 'e2e_starter_test@core314test.com' LIMIT 1),
      (SELECT id FROM auth.users WHERE email = 'admin_test@core314test.com' LIMIT 1),
      (SELECT id FROM auth.users WHERE email LIKE '%test%' LIMIT 1),
      (SELECT id FROM auth.users LIMIT 1)
    ),
    NULL,
    'error_rate_increase',
    'reliability',
    'high',
    92.3,
    'system_health_event',
    'integration',
    'sendgrid',
    'Error rate increase detected: 8.50% (baseline: 1.00%, +750.0%)',
    'SendGrid integration experiencing elevated error rates, possibly due to API rate limiting or authentication issues.',
    1.0,
    8.5,
    750.0,
    'error_rate_threshold',
    'gradual_increase',
    'statistical_analysis',
    'threshold_comparison',
    ARRAY['sendgrid'],
    'high',
    '["review_error_logs", "check_integration_health", "restart_affected_services"]',
    NOW() - INTERVAL '5 minutes',
    'investigating',
    ARRAY['error_rate', 'reliability', 'automated_detection']
  )
ON CONFLICT DO NOTHING;

-- Insert sample recovery actions for test users
INSERT INTO recovery_actions (
  user_id,
  organization_id,
  action_type,
  action_category,
  action_name,
  action_description,
  trigger_type,
  trigger_reason,
  target_component_type,
  target_component_name,
  action_config,
  execution_status,
  timeout_seconds,
  executed_by,
  tags
) VALUES
  (
    COALESCE(
      (SELECT id FROM auth.users WHERE email = 'e2e_starter_test@core314test.com' LIMIT 1),
      (SELECT id FROM auth.users WHERE email = 'admin_test@core314test.com' LIMIT 1),
      (SELECT id FROM auth.users WHERE email LIKE '%test%' LIMIT 1),
      (SELECT id FROM auth.users LIMIT 1)
    ),
    NULL,
    'clear_cache',
    'cache',
    'clear cache - cognitive-decision-engine',
    'Self-healing action triggered by anomaly detection',
    'automatic',
    'Anomaly detected: latency_spike (medium)',
    'edge_function',
    'cognitive-decision-engine',
    '{"cache_type": "all"}',
    'pending',
    300,
    'system',
    ARRAY['self_healing', 'automated']
  )
ON CONFLICT DO NOTHING;

-- Insert sample selftest results for test users
INSERT INTO selftest_results (
  user_id,
  organization_id,
  test_name,
  test_category,
  test_type,
  test_description,
  execution_mode,
  scheduled_by,
  target_component_type,
  target_component_name,
  target_environment,
  execution_status,
  started_at,
  completed_at,
  execution_duration_ms,
  test_result,
  success,
  pass_count,
  fail_count,
  total_assertions,
  test_summary,
  health_score,
  reliability_score,
  performance_score,
  tags
) VALUES
  (
    COALESCE(
      (SELECT id FROM auth.users WHERE email = 'e2e_starter_test@core314test.com' LIMIT 1),
      (SELECT id FROM auth.users WHERE email = 'admin_test@core314test.com' LIMIT 1),
      (SELECT id FROM auth.users WHERE email LIKE '%test%' LIMIT 1),
      (SELECT id FROM auth.users LIMIT 1)
    ),
    NULL,
    'Edge Function Health Check',
    'connectivity',
    'health_check',
    'Verifies all Edge Functions are responding correctly',
    'scheduled',
    'system',
    'edge_function',
    'all_functions',
    'production',
    'completed',
    NOW() - INTERVAL '1 hour',
    NOW() - INTERVAL '59 minutes',
    45000,
    'pass',
    true,
    11,
    0,
    11,
    'All Edge Functions responding normally with acceptable latency',
    98.5,
    99.2,
    97.8,
    ARRAY['health_check', 'scheduled', 'edge_functions']
  ),
  (
    COALESCE(
      (SELECT id FROM auth.users WHERE email = 'e2e_starter_test@core314test.com' LIMIT 1),
      (SELECT id FROM auth.users WHERE email = 'admin_test@core314test.com' LIMIT 1),
      (SELECT id FROM auth.users WHERE email LIKE '%test%' LIMIT 1),
      (SELECT id FROM auth.users LIMIT 1)
    ),
    NULL,
    'Database Connection Pool Test',
    'performance',
    'load',
    'Tests database connection pool under load',
    'scheduled',
    'system',
    'database',
    'supabase_postgres',
    'production',
    'completed',
    NOW() - INTERVAL '30 minutes',
    NOW() - INTERVAL '28 minutes',
    120000,
    'pass',
    true,
    8,
    0,
    8,
    'Database connection pool handling load efficiently',
    95.2,
    96.5,
    94.0,
    ARRAY['performance', 'scheduled', 'database']
  )
ON CONFLICT DO NOTHING;

-- =====================================================================================
-- =====================================================================================

COMMENT ON TABLE decision_events IS 'Seed data added for E2E testing - Phase 7 modules';
COMMENT ON TABLE system_health_events IS 'Seed data added for E2E testing - Phase 7 modules';
COMMENT ON TABLE anomaly_signals IS 'Seed data added for E2E testing - Phase 7 modules';
COMMENT ON TABLE recovery_actions IS 'Seed data added for E2E testing - Phase 7 modules';
COMMENT ON TABLE selftest_results IS 'Seed data added for E2E testing - Phase 7 modules';

COMMIT;

-- =====================================================================================
-- =====================================================================================

SELECT 
  'decision_events' as table_name, 
  to_regclass('public.decision_events') as exists
UNION ALL
SELECT 
  'system_health_events', 
  to_regclass('public.system_health_events')
UNION ALL
SELECT 
  'anomaly_signals', 
  to_regclass('public.anomaly_signals')
UNION ALL
SELECT 
  'recovery_actions', 
  to_regclass('public.recovery_actions')
UNION ALL
SELECT 
  'selftest_results', 
  to_regclass('public.selftest_results');

SELECT 'decision_events' as table_name, COUNT(*) as row_count FROM decision_events
UNION ALL
SELECT 'system_health_events', COUNT(*) FROM system_health_events
UNION ALL
SELECT 'anomaly_signals', COUNT(*) FROM anomaly_signals
UNION ALL
SELECT 'recovery_actions', COUNT(*) FROM recovery_actions
UNION ALL
SELECT 'selftest_results', COUNT(*) FROM selftest_results;

SELECT 
  schemaname, 
  tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
  AND tablename IN ('decision_events', 'system_health_events', 'anomaly_signals', 'recovery_actions', 'selftest_results')
ORDER BY tablename;
