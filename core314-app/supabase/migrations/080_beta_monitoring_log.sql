-- ============================================================================
-- ============================================================================

CREATE TABLE IF NOT EXISTS beta_monitoring_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id TEXT,
    event_type TEXT NOT NULL CHECK (event_type IN ('session_start', 'session_end', 'api_call', 'error', 'fusion_score', 'page_view')),
    endpoint TEXT,
    latency_ms INTEGER,
    status_code INTEGER,
    error_message TEXT,
    fusion_score NUMERIC(5,2),
    fusion_deviation NUMERIC(5,2),
    page_path TEXT,
    user_agent TEXT,
    ip_address TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_beta_monitoring_log_user_id 
ON beta_monitoring_log(user_id);

CREATE INDEX IF NOT EXISTS idx_beta_monitoring_log_session_id 
ON beta_monitoring_log(session_id);

CREATE INDEX IF NOT EXISTS idx_beta_monitoring_log_event_type 
ON beta_monitoring_log(event_type);

CREATE INDEX IF NOT EXISTS idx_beta_monitoring_log_created_at 
ON beta_monitoring_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_beta_monitoring_log_error 
ON beta_monitoring_log(created_at DESC) WHERE event_type = 'error';

CREATE INDEX IF NOT EXISTS idx_beta_monitoring_log_fusion 
ON beta_monitoring_log(created_at DESC) WHERE event_type = 'fusion_score';

ALTER TABLE beta_monitoring_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on beta_monitoring_log"
ON beta_monitoring_log
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Users can view own monitoring logs"
ON beta_monitoring_log
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

GRANT ALL ON beta_monitoring_log TO service_role;
GRANT SELECT ON beta_monitoring_log TO authenticated;

CREATE OR REPLACE FUNCTION get_active_sessions_count()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(DISTINCT session_id) INTO v_count
    FROM beta_monitoring_log
    WHERE event_type = 'session_start'
    AND created_at > NOW() - INTERVAL '30 minutes'
    AND NOT EXISTS (
        SELECT 1 FROM beta_monitoring_log bml2
        WHERE bml2.session_id = beta_monitoring_log.session_id
        AND bml2.event_type = 'session_end'
        AND bml2.created_at > beta_monitoring_log.created_at
    );
    
    RETURN COALESCE(v_count, 0);
END;
$$;

CREATE OR REPLACE FUNCTION get_error_rate_1h()
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_requests INTEGER;
    v_error_requests INTEGER;
    v_error_rate NUMERIC;
BEGIN
    SELECT COUNT(*) INTO v_total_requests
    FROM beta_monitoring_log
    WHERE event_type = 'api_call'
    AND created_at > NOW() - INTERVAL '1 hour';
    
    SELECT COUNT(*) INTO v_error_requests
    FROM beta_monitoring_log
    WHERE event_type = 'error'
    AND created_at > NOW() - INTERVAL '1 hour';
    
    IF v_total_requests = 0 THEN
        RETURN 0;
    END IF;
    
    v_error_rate := (v_error_requests::NUMERIC / v_total_requests::NUMERIC) * 100;
    
    RETURN ROUND(v_error_rate, 2);
END;
$$;

CREATE OR REPLACE FUNCTION get_avg_api_latency_1h()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_avg_latency INTEGER;
BEGIN
    SELECT AVG(latency_ms)::INTEGER INTO v_avg_latency
    FROM beta_monitoring_log
    WHERE event_type = 'api_call'
    AND latency_ms IS NOT NULL
    AND created_at > NOW() - INTERVAL '1 hour';
    
    RETURN COALESCE(v_avg_latency, 0);
END;
$$;

CREATE OR REPLACE FUNCTION get_fusion_health_trend_24h()
RETURNS TABLE (
    hour_bucket TIMESTAMPTZ,
    avg_fusion_score NUMERIC,
    avg_deviation NUMERIC,
    sample_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        date_trunc('hour', created_at) as hour_bucket,
        AVG(fusion_score)::NUMERIC(5,2) as avg_fusion_score,
        AVG(fusion_deviation)::NUMERIC(5,2) as avg_deviation,
        COUNT(*)::INTEGER as sample_count
    FROM beta_monitoring_log
    WHERE event_type = 'fusion_score'
    AND created_at > NOW() - INTERVAL '24 hours'
    GROUP BY date_trunc('hour', created_at)
    ORDER BY hour_bucket DESC;
END;
$$;

CREATE OR REPLACE FUNCTION get_user_retention_curve()
RETURNS TABLE (
    days_since_activation INTEGER,
    active_users INTEGER,
    retention_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH activation_dates AS (
        SELECT 
            user_id,
            MIN(created_at) as first_seen
        FROM beta_monitoring_log
        GROUP BY user_id
    ),
    daily_activity AS (
        SELECT 
            ad.user_id,
            EXTRACT(DAY FROM bml.created_at - ad.first_seen)::INTEGER as days_since_activation
        FROM activation_dates ad
        JOIN beta_monitoring_log bml ON ad.user_id = bml.user_id
        WHERE bml.created_at >= ad.first_seen
        GROUP BY ad.user_id, days_since_activation
    ),
    total_users AS (
        SELECT COUNT(DISTINCT user_id) as total FROM activation_dates
    )
    SELECT 
        da.days_since_activation,
        COUNT(DISTINCT da.user_id)::INTEGER as active_users,
        ROUND((COUNT(DISTINCT da.user_id)::NUMERIC / tu.total::NUMERIC) * 100, 2) as retention_rate
    FROM daily_activity da
    CROSS JOIN total_users tu
    WHERE da.days_since_activation <= 30
    GROUP BY da.days_since_activation, tu.total
    ORDER BY da.days_since_activation;
END;
$$;

GRANT EXECUTE ON FUNCTION get_active_sessions_count() TO service_role;
GRANT EXECUTE ON FUNCTION get_error_rate_1h() TO service_role;
GRANT EXECUTE ON FUNCTION get_avg_api_latency_1h() TO service_role;
GRANT EXECUTE ON FUNCTION get_fusion_health_trend_24h() TO service_role;
GRANT EXECUTE ON FUNCTION get_user_retention_curve() TO service_role;

COMMENT ON TABLE beta_monitoring_log IS 'Tracks active sessions, API latency, and performance metrics for beta users';
COMMENT ON FUNCTION get_active_sessions_count() IS 'Returns count of active sessions in last 30 minutes';
COMMENT ON FUNCTION get_error_rate_1h() IS 'Returns error rate percentage for last hour';
COMMENT ON FUNCTION get_avg_api_latency_1h() IS 'Returns average API latency in milliseconds for last hour';
COMMENT ON FUNCTION get_fusion_health_trend_24h() IS 'Returns hourly fusion score trend for last 24 hours';
COMMENT ON FUNCTION get_user_retention_curve() IS 'Returns user retention curve by days since activation';
