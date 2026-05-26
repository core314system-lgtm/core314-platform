-- =====================================================================================
-- =====================================================================================


-- =====================================================================================
-- =====================================================================================

CREATE TABLE IF NOT EXISTS system_health_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  
  component_type VARCHAR(50) NOT NULL, -- 'edge_function', 'api_endpoint', 'database_query', 'integration', 'frontend', 'background_job'
  component_name VARCHAR(255) NOT NULL, -- Specific component identifier (e.g., 'orchestrator-engine', '/api/fusion-analyze')
  component_version VARCHAR(50), -- Component version for tracking changes
  environment VARCHAR(50) DEFAULT 'production', -- 'production', 'staging', 'development'
  
  status VARCHAR(50) NOT NULL DEFAULT 'healthy', -- 'healthy', 'degraded', 'unhealthy', 'critical', 'unknown'
  uptime_percentage DECIMAL(5,2), -- Uptime % over measurement window
  availability_percentage DECIMAL(5,2), -- Availability % (successful requests / total requests)
  
  latency_ms INTEGER, -- Response time in milliseconds
  latency_p50_ms INTEGER, -- 50th percentile latency
  latency_p95_ms INTEGER, -- 95th percentile latency
  latency_p99_ms INTEGER, -- 99th percentile latency
  throughput_per_minute INTEGER, -- Requests per minute
  
  error_count INTEGER DEFAULT 0, -- Total errors in measurement window
  error_rate DECIMAL(5,2), -- Error rate % (errors / total requests)
  error_types JSONB, -- {"timeout": 5, "500": 3, "connection_refused": 2}
  last_error_message TEXT,
  last_error_timestamp TIMESTAMPTZ,
  
  cpu_usage_percent DECIMAL(5,2), -- CPU utilization %
  memory_usage_mb INTEGER, -- Memory usage in MB
  memory_usage_percent DECIMAL(5,2), -- Memory utilization %
  disk_usage_mb INTEGER, -- Disk usage in MB
  disk_usage_percent DECIMAL(5,2), -- Disk utilization %
  network_in_mbps DECIMAL(10,2), -- Network ingress in Mbps
  network_out_mbps DECIMAL(10,2), -- Network egress in Mbps
  
  db_connection_count INTEGER, -- Active database connections
  db_query_count INTEGER, -- Queries executed in window
  db_slow_query_count INTEGER, -- Queries exceeding threshold
  db_deadlock_count INTEGER, -- Deadlocks detected
  db_cache_hit_rate DECIMAL(5,2), -- Cache hit rate %
  
  integration_name VARCHAR(100), -- Integration identifier (e.g., 'slack', 'quickbooks')
  integration_success_rate DECIMAL(5,2), -- Success rate for integration calls
  integration_retry_count INTEGER, -- Number of retries
  integration_timeout_count INTEGER, -- Number of timeouts
  
  measurement_window_start TIMESTAMPTZ NOT NULL,
  measurement_window_end TIMESTAMPTZ NOT NULL,
  measurement_window_seconds INTEGER, -- Duration of measurement window
  
  metadata JSONB, -- Additional context-specific metrics
  tags TEXT[], -- Tags for filtering and grouping
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================================
-- =====================================================================================

CREATE INDEX idx_system_health_events_user_id ON system_health_events(user_id);
CREATE INDEX idx_system_health_events_organization_id ON system_health_events(organization_id);
CREATE INDEX idx_system_health_events_component_type ON system_health_events(component_type);
CREATE INDEX idx_system_health_events_component_name ON system_health_events(component_name);
CREATE INDEX idx_system_health_events_status ON system_health_events(status);

CREATE INDEX idx_system_health_events_created_at ON system_health_events(created_at DESC);
CREATE INDEX idx_system_health_events_measurement_window ON system_health_events(measurement_window_start DESC, measurement_window_end DESC);

CREATE INDEX idx_system_health_events_latency ON system_health_events(latency_ms DESC) WHERE latency_ms IS NOT NULL;
CREATE INDEX idx_system_health_events_error_rate ON system_health_events(error_rate DESC) WHERE error_rate > 0;
CREATE INDEX idx_system_health_events_availability ON system_health_events(availability_percentage ASC) WHERE availability_percentage < 99.0;

CREATE INDEX idx_system_health_events_cpu_usage ON system_health_events(cpu_usage_percent DESC) WHERE cpu_usage_percent > 80;
CREATE INDEX idx_system_health_events_memory_usage ON system_health_events(memory_usage_percent DESC) WHERE memory_usage_percent > 80;

CREATE INDEX idx_system_health_events_integration ON system_health_events(integration_name) WHERE integration_name IS NOT NULL;

CREATE INDEX idx_system_health_events_component_status_time ON system_health_events(component_type, component_name, status, created_at DESC);
CREATE INDEX idx_system_health_events_user_component_time ON system_health_events(user_id, component_type, created_at DESC);

CREATE INDEX idx_system_health_events_error_types ON system_health_events USING GIN(error_types);
CREATE INDEX idx_system_health_events_metadata ON system_health_events USING GIN(metadata);
CREATE INDEX idx_system_health_events_tags ON system_health_events USING GIN(tags);

-- =====================================================================================
-- =====================================================================================

ALTER TABLE system_health_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY system_health_events_select_own ON system_health_events
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY system_health_events_select_admin ON system_health_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY system_health_events_insert_system ON system_health_events
  FOR INSERT
  WITH CHECK (true); -- Service role bypasses RLS

CREATE POLICY system_health_events_update_system ON system_health_events
  FOR UPDATE
  USING (true); -- Service role bypasses RLS

-- =====================================================================================
-- =====================================================================================

CREATE OR REPLACE FUNCTION get_system_health_summary(
  p_user_id UUID DEFAULT NULL,
  p_time_window_minutes INTEGER DEFAULT 60
)
RETURNS TABLE (
  component_type VARCHAR,
  component_name VARCHAR,
  status VARCHAR,
  avg_latency_ms DECIMAL,
  avg_error_rate DECIMAL,
  avg_availability DECIMAL,
  event_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    she.component_type,
    she.component_name,
    she.status,
    AVG(she.latency_ms)::DECIMAL AS avg_latency_ms,
    AVG(she.error_rate)::DECIMAL AS avg_error_rate,
    AVG(she.availability_percentage)::DECIMAL AS avg_availability,
    COUNT(*)::BIGINT AS event_count
  FROM system_health_events she
  WHERE (p_user_id IS NULL OR she.user_id = p_user_id)
    AND she.created_at >= NOW() - (p_time_window_minutes || ' minutes')::INTERVAL
  GROUP BY she.component_type, she.component_name, she.status
  ORDER BY avg_error_rate DESC NULLS LAST, avg_latency_ms DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_unhealthy_components(
  p_user_id UUID DEFAULT NULL,
  p_time_window_minutes INTEGER DEFAULT 15
)
RETURNS TABLE (
  component_type VARCHAR,
  component_name VARCHAR,
  status VARCHAR,
  error_count INTEGER,
  error_rate DECIMAL,
  last_error_message TEXT,
  last_error_timestamp TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    she.component_type,
    she.component_name,
    she.status,
    she.error_count,
    she.error_rate,
    she.last_error_message,
    she.last_error_timestamp
  FROM system_health_events she
  WHERE (p_user_id IS NULL OR she.user_id = p_user_id)
    AND she.created_at >= NOW() - (p_time_window_minutes || ' minutes')::INTERVAL
    AND she.status IN ('degraded', 'unhealthy', 'critical')
  ORDER BY she.error_rate DESC NULLS LAST, she.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_performance_trends(
  p_user_id UUID DEFAULT NULL,
  p_component_type VARCHAR DEFAULT NULL,
  p_component_name VARCHAR DEFAULT NULL,
  p_time_window_hours INTEGER DEFAULT 24,
  p_bucket_minutes INTEGER DEFAULT 60
)
RETURNS TABLE (
  time_bucket TIMESTAMPTZ,
  avg_latency_ms DECIMAL,
  max_latency_ms INTEGER,
  avg_error_rate DECIMAL,
  avg_throughput INTEGER,
  event_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE_TRUNC('hour', she.created_at) + 
      (FLOOR(EXTRACT(MINUTE FROM she.created_at) / p_bucket_minutes) * p_bucket_minutes || ' minutes')::INTERVAL AS time_bucket,
    AVG(she.latency_ms)::DECIMAL AS avg_latency_ms,
    MAX(she.latency_ms) AS max_latency_ms,
    AVG(she.error_rate)::DECIMAL AS avg_error_rate,
    AVG(she.throughput_per_minute)::INTEGER AS avg_throughput,
    COUNT(*)::BIGINT AS event_count
  FROM system_health_events she
  WHERE (p_user_id IS NULL OR she.user_id = p_user_id)
    AND (p_component_type IS NULL OR she.component_type = p_component_type)
    AND (p_component_name IS NULL OR she.component_name = p_component_name)
    AND she.created_at >= NOW() - (p_time_window_hours || ' hours')::INTERVAL
  GROUP BY time_bucket
  ORDER BY time_bucket DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION calculate_system_availability(
  p_user_id UUID DEFAULT NULL,
  p_time_window_hours INTEGER DEFAULT 24
)
RETURNS TABLE (
  overall_availability DECIMAL,
  total_events BIGINT,
  healthy_events BIGINT,
  degraded_events BIGINT,
  unhealthy_events BIGINT,
  critical_events BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (COUNT(*) FILTER (WHERE status = 'healthy')::DECIMAL / NULLIF(COUNT(*), 0) * 100)::DECIMAL AS overall_availability,
    COUNT(*)::BIGINT AS total_events,
    COUNT(*) FILTER (WHERE status = 'healthy')::BIGINT AS healthy_events,
    COUNT(*) FILTER (WHERE status = 'degraded')::BIGINT AS degraded_events,
    COUNT(*) FILTER (WHERE status = 'unhealthy')::BIGINT AS unhealthy_events,
    COUNT(*) FILTER (WHERE status = 'critical')::BIGINT AS critical_events
  FROM system_health_events
  WHERE (p_user_id IS NULL OR user_id = p_user_id)
    AND created_at >= NOW() - (p_time_window_hours || ' hours')::INTERVAL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================================================
-- =====================================================================================

CREATE TRIGGER update_system_health_events_updated_at
  BEFORE UPDATE ON system_health_events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================================================
-- =====================================================================================

COMMENT ON TABLE system_health_events IS 'Tracks real-time health metrics for all Core314 components including uptime, latency, error rates, and resource utilization';
COMMENT ON COLUMN system_health_events.component_type IS 'Type of component being monitored (edge_function, api_endpoint, database_query, integration, frontend, background_job)';
COMMENT ON COLUMN system_health_events.status IS 'Current health status (healthy, degraded, unhealthy, critical, unknown)';
COMMENT ON COLUMN system_health_events.latency_p99_ms IS '99th percentile latency - critical for SLA monitoring';
COMMENT ON COLUMN system_health_events.error_types IS 'JSONB object mapping error types to counts for detailed analysis';
COMMENT ON COLUMN system_health_events.measurement_window_seconds IS 'Duration of measurement window for aggregated metrics';

-- =====================================================================================
-- =====================================================================================
