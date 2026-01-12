-- ============================================================================
-- PRODUCTION MONITORING & ALERTING (LAUNCH SAFETY)
-- Migration 133: Operational Event Logging and Alert Detection
-- ============================================================================
-- 
-- This migration implements production monitoring for launch readiness:
-- 1. Unified ops_event_log table for operational events
-- 2. Aggregate counters for high-frequency events (entitlement denials)
-- 3. Alert detection functions for threshold-based alerting
-- 4. Integration with existing alerts table for surfacing issues
--
-- MONITORED EVENTS:
-- - Signup failures
-- - Auth failures (login, token exchange, email confirmation)
-- - Stripe webhook failures (mirrors stripe_webhook_events)
-- - Entitlement/RLS denials (aggregated)
-- - Subscription state mismatches
--
-- LOGGING INCLUDES:
-- - User ID (where applicable)
-- - Event type
-- - Error reason
-- - Correlation ID (for tracing)
-- - Source (which service/function generated the event)
-- ============================================================================

-- ============================================================================
-- PART 1: UNIFIED OPS EVENT LOG TABLE
-- ============================================================================
-- Single table for all operational events with consistent schema
-- Keeps querying and alert logic simple

CREATE TABLE IF NOT EXISTS ops_event_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    event_type TEXT NOT NULL CHECK (event_type IN (
        'signup_failure',
        'signup_success',
        'auth_failure',
        'auth_success',
        'webhook_failure',
        'webhook_success',
        'entitlement_denied',
        'subscription_mismatch',
        'rls_denial'
    )),
    severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warn', 'error', 'critical')),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    correlation_id TEXT,  -- For tracing (e.g., stripe_event_id, request_id)
    source TEXT NOT NULL,  -- e.g., 'netlify:stripe-webhook', 'supabase:auth-hook', 'edge:signup'
    error_code TEXT,
    error_reason TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_ops_event_log_created_at ON ops_event_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ops_event_log_event_type ON ops_event_log(event_type);
CREATE INDEX IF NOT EXISTS idx_ops_event_log_severity ON ops_event_log(severity);
CREATE INDEX IF NOT EXISTS idx_ops_event_log_user_id ON ops_event_log(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ops_event_log_correlation_id ON ops_event_log(correlation_id) WHERE correlation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ops_event_log_source ON ops_event_log(source);

-- Composite index for alert queries (event_type + severity + time window)
CREATE INDEX IF NOT EXISTS idx_ops_event_log_alert_query 
    ON ops_event_log(event_type, severity, created_at DESC);

-- Enable RLS
ALTER TABLE ops_event_log ENABLE ROW LEVEL SECURITY;

-- Policy: Service role has full access (for logging from Edge Functions/Netlify)
CREATE POLICY "Service role has full access to ops_event_log"
    ON ops_event_log FOR ALL TO service_role
    USING (true) WITH CHECK (true);

-- Policy: Admins can read all events
CREATE POLICY "Admins can read ops_event_log"
    ON ops_event_log FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

COMMENT ON TABLE ops_event_log IS 'Production monitoring: Unified operational event log for launch safety';

-- ============================================================================
-- PART 2: AGGREGATE COUNTERS FOR HIGH-FREQUENCY EVENTS
-- ============================================================================
-- For events that could be noisy (like entitlement denials), we aggregate
-- by time bucket + user + event type instead of logging every occurrence

CREATE TABLE IF NOT EXISTS ops_event_aggregate (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bucket_start TIMESTAMPTZ NOT NULL,  -- Start of the time bucket (e.g., 5-minute intervals)
    bucket_minutes INTEGER NOT NULL DEFAULT 5,  -- Bucket size in minutes
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    error_reason TEXT,
    source TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 1,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,
    UNIQUE(bucket_start, user_id, event_type, error_reason, source)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_ops_event_aggregate_bucket ON ops_event_aggregate(bucket_start DESC);
CREATE INDEX IF NOT EXISTS idx_ops_event_aggregate_event_type ON ops_event_aggregate(event_type);
CREATE INDEX IF NOT EXISTS idx_ops_event_aggregate_user_id ON ops_event_aggregate(user_id) WHERE user_id IS NOT NULL;

-- Enable RLS
ALTER TABLE ops_event_aggregate ENABLE ROW LEVEL SECURITY;

-- Policy: Service role has full access
CREATE POLICY "Service role has full access to ops_event_aggregate"
    ON ops_event_aggregate FOR ALL TO service_role
    USING (true) WITH CHECK (true);

-- Policy: Admins can read all aggregates
CREATE POLICY "Admins can read ops_event_aggregate"
    ON ops_event_aggregate FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

COMMENT ON TABLE ops_event_aggregate IS 'Production monitoring: Aggregated counters for high-frequency events (5-minute buckets)';

-- ============================================================================
-- PART 3: LOGGING FUNCTIONS
-- ============================================================================

-- Function to log an operational event
CREATE OR REPLACE FUNCTION log_ops_event(
    p_event_type TEXT,
    p_source TEXT,
    p_severity TEXT DEFAULT 'info',
    p_user_id UUID DEFAULT NULL,
    p_correlation_id TEXT DEFAULT NULL,
    p_error_code TEXT DEFAULT NULL,
    p_error_reason TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO ops_event_log (
        event_type,
        severity,
        user_id,
        correlation_id,
        source,
        error_code,
        error_reason,
        metadata
    ) VALUES (
        p_event_type,
        p_severity,
        p_user_id,
        p_correlation_id,
        p_source,
        p_error_code,
        p_error_reason,
        p_metadata
    )
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION log_ops_event TO service_role;

COMMENT ON FUNCTION log_ops_event IS 'Production monitoring: Log an operational event';

-- Function to log an aggregated event (upsert counter)
CREATE OR REPLACE FUNCTION log_ops_event_aggregate(
    p_event_type TEXT,
    p_source TEXT,
    p_user_id UUID DEFAULT NULL,
    p_error_reason TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb,
    p_bucket_minutes INTEGER DEFAULT 5
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_bucket_start TIMESTAMPTZ;
BEGIN
    -- Calculate the bucket start time (floor to nearest bucket)
    v_bucket_start := date_trunc('hour', NOW()) + 
        (FLOOR(EXTRACT(MINUTE FROM NOW()) / p_bucket_minutes) * p_bucket_minutes) * INTERVAL '1 minute';
    
    -- Upsert the aggregate counter
    INSERT INTO ops_event_aggregate (
        bucket_start,
        bucket_minutes,
        user_id,
        event_type,
        error_reason,
        source,
        count,
        first_seen_at,
        last_seen_at,
        metadata
    ) VALUES (
        v_bucket_start,
        p_bucket_minutes,
        p_user_id,
        p_event_type,
        p_error_reason,
        p_source,
        1,
        NOW(),
        NOW(),
        p_metadata
    )
    ON CONFLICT (bucket_start, user_id, event_type, error_reason, source) DO UPDATE SET
        count = ops_event_aggregate.count + 1,
        last_seen_at = NOW(),
        metadata = COALESCE(p_metadata, ops_event_aggregate.metadata);
END;
$$;

GRANT EXECUTE ON FUNCTION log_ops_event_aggregate TO service_role;

COMMENT ON FUNCTION log_ops_event_aggregate IS 'Production monitoring: Log an aggregated event (upsert counter in 5-minute buckets)';

-- ============================================================================
-- PART 4: CONVENIENCE LOGGING FUNCTIONS
-- ============================================================================

-- Log signup failure
CREATE OR REPLACE FUNCTION log_signup_failure(
    p_email TEXT DEFAULT NULL,
    p_error_code TEXT DEFAULT NULL,
    p_error_reason TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN log_ops_event(
        'signup_failure',
        'auth:signup',
        'error',
        NULL,  -- No user_id for failed signups
        NULL,
        p_error_code,
        p_error_reason,
        jsonb_build_object('email_hash', md5(COALESCE(p_email, ''))) || p_metadata
    );
END;
$$;

GRANT EXECUTE ON FUNCTION log_signup_failure TO service_role;

-- Log signup success
CREATE OR REPLACE FUNCTION log_signup_success(
    p_user_id UUID,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN log_ops_event(
        'signup_success',
        'auth:signup',
        'info',
        p_user_id,
        NULL,
        NULL,
        NULL,
        p_metadata
    );
END;
$$;

GRANT EXECUTE ON FUNCTION log_signup_success TO service_role;

-- Log auth failure
CREATE OR REPLACE FUNCTION log_auth_failure(
    p_user_id UUID DEFAULT NULL,
    p_auth_type TEXT DEFAULT 'login',  -- 'login', 'token_exchange', 'email_confirm', 'password_reset'
    p_error_code TEXT DEFAULT NULL,
    p_error_reason TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN log_ops_event(
        'auth_failure',
        'auth:' || p_auth_type,
        'error',
        p_user_id,
        NULL,
        p_error_code,
        p_error_reason,
        p_metadata
    );
END;
$$;

GRANT EXECUTE ON FUNCTION log_auth_failure TO service_role;

-- Log entitlement denial (aggregated to avoid noise)
CREATE OR REPLACE FUNCTION log_entitlement_denial(
    p_user_id UUID,
    p_reason TEXT DEFAULT 'not_entitled',
    p_source TEXT DEFAULT 'rls:check',
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    PERFORM log_ops_event_aggregate(
        'entitlement_denied',
        p_source,
        p_user_id,
        p_reason,
        p_metadata
    );
END;
$$;

GRANT EXECUTE ON FUNCTION log_entitlement_denial TO service_role;

-- Log subscription state mismatch
CREATE OR REPLACE FUNCTION log_subscription_mismatch(
    p_user_id UUID,
    p_profile_status TEXT,
    p_stripe_status TEXT,
    p_correlation_id TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN log_ops_event(
        'subscription_mismatch',
        'billing:sync',
        'error',
        p_user_id,
        p_correlation_id,
        'STATE_MISMATCH',
        'Profile status (' || p_profile_status || ') differs from Stripe status (' || p_stripe_status || ')',
        jsonb_build_object(
            'profile_status', p_profile_status,
            'stripe_status', p_stripe_status
        ) || p_metadata
    );
END;
$$;

GRANT EXECUTE ON FUNCTION log_subscription_mismatch TO service_role;

-- ============================================================================
-- PART 5: ALERT DETECTION FUNCTIONS
-- ============================================================================

-- Get signup failure alerts (threshold-based)
CREATE OR REPLACE FUNCTION get_signup_failure_alerts(
    p_window_minutes INTEGER DEFAULT 60,
    p_threshold INTEGER DEFAULT 5
)
RETURNS TABLE (
    alert_type TEXT,
    severity TEXT,
    count BIGINT,
    window_start TIMESTAMPTZ,
    window_end TIMESTAMPTZ,
    sample_errors JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        'signup_failures'::TEXT as alert_type,
        CASE 
            WHEN COUNT(*) >= p_threshold * 3 THEN 'critical'
            WHEN COUNT(*) >= p_threshold * 2 THEN 'error'
            ELSE 'warning'
        END::TEXT as severity,
        COUNT(*) as count,
        NOW() - (p_window_minutes || ' minutes')::INTERVAL as window_start,
        NOW() as window_end,
        jsonb_agg(
            jsonb_build_object(
                'error_code', error_code,
                'error_reason', error_reason,
                'created_at', created_at
            ) ORDER BY created_at DESC
        ) FILTER (WHERE error_code IS NOT NULL) as sample_errors
    FROM ops_event_log
    WHERE event_type = 'signup_failure'
    AND created_at > NOW() - (p_window_minutes || ' minutes')::INTERVAL
    HAVING COUNT(*) >= p_threshold;
END;
$$;

GRANT EXECUTE ON FUNCTION get_signup_failure_alerts TO service_role;
GRANT EXECUTE ON FUNCTION get_signup_failure_alerts TO authenticated;

-- Get webhook failure alerts (threshold-based)
CREATE OR REPLACE FUNCTION get_webhook_failure_alerts(
    p_window_minutes INTEGER DEFAULT 60,
    p_threshold INTEGER DEFAULT 3
)
RETURNS TABLE (
    alert_type TEXT,
    severity TEXT,
    count BIGINT,
    window_start TIMESTAMPTZ,
    window_end TIMESTAMPTZ,
    failed_events JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        'webhook_failures'::TEXT as alert_type,
        CASE 
            WHEN COUNT(*) >= p_threshold * 3 THEN 'critical'
            WHEN COUNT(*) >= p_threshold * 2 THEN 'error'
            ELSE 'warning'
        END::TEXT as severity,
        COUNT(*) as count,
        NOW() - (p_window_minutes || ' minutes')::INTERVAL as window_start,
        NOW() as window_end,
        jsonb_agg(
            jsonb_build_object(
                'stripe_event_id', stripe_event_id,
                'event_type', event_type,
                'error_message', error_message,
                'received_at', received_at
            ) ORDER BY received_at DESC
        ) as failed_events
    FROM stripe_webhook_events
    WHERE processing_status = 'failed'
    AND received_at > NOW() - (p_window_minutes || ' minutes')::INTERVAL
    HAVING COUNT(*) >= p_threshold;
END;
$$;

GRANT EXECUTE ON FUNCTION get_webhook_failure_alerts TO service_role;
GRANT EXECUTE ON FUNCTION get_webhook_failure_alerts TO authenticated;

-- Get subscription mismatch alerts
CREATE OR REPLACE FUNCTION get_subscription_mismatch_alerts(
    p_window_minutes INTEGER DEFAULT 60
)
RETURNS TABLE (
    alert_type TEXT,
    severity TEXT,
    count BIGINT,
    window_start TIMESTAMPTZ,
    window_end TIMESTAMPTZ,
    mismatches JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        'subscription_mismatches'::TEXT as alert_type,
        'error'::TEXT as severity,
        COUNT(*) as count,
        NOW() - (p_window_minutes || ' minutes')::INTERVAL as window_start,
        NOW() as window_end,
        jsonb_agg(
            jsonb_build_object(
                'user_id', user_id,
                'error_reason', error_reason,
                'metadata', metadata,
                'created_at', created_at
            ) ORDER BY created_at DESC
        ) as mismatches
    FROM ops_event_log
    WHERE event_type = 'subscription_mismatch'
    AND created_at > NOW() - (p_window_minutes || ' minutes')::INTERVAL
    HAVING COUNT(*) > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION get_subscription_mismatch_alerts TO service_role;
GRANT EXECUTE ON FUNCTION get_subscription_mismatch_alerts TO authenticated;

-- Get entitlement denial summary (aggregated)
CREATE OR REPLACE FUNCTION get_entitlement_denial_summary(
    p_window_minutes INTEGER DEFAULT 60
)
RETURNS TABLE (
    user_id UUID,
    total_denials BIGINT,
    denial_reasons JSONB,
    first_denial TIMESTAMPTZ,
    last_denial TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        oea.user_id,
        SUM(oea.count)::BIGINT as total_denials,
        jsonb_agg(
            jsonb_build_object(
                'reason', oea.error_reason,
                'count', oea.count,
                'source', oea.source
            )
        ) as denial_reasons,
        MIN(oea.first_seen_at) as first_denial,
        MAX(oea.last_seen_at) as last_denial
    FROM ops_event_aggregate oea
    WHERE oea.event_type = 'entitlement_denied'
    AND oea.bucket_start > NOW() - (p_window_minutes || ' minutes')::INTERVAL
    GROUP BY oea.user_id
    ORDER BY total_denials DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_entitlement_denial_summary TO service_role;
GRANT EXECUTE ON FUNCTION get_entitlement_denial_summary TO authenticated;

-- ============================================================================
-- PART 6: UNIFIED ALERT CHECK FUNCTION
-- ============================================================================
-- Returns all active alerts across all categories

CREATE OR REPLACE FUNCTION get_ops_alerts(
    p_window_minutes INTEGER DEFAULT 60
)
RETURNS TABLE (
    alert_category TEXT,
    alert_type TEXT,
    severity TEXT,
    count BIGINT,
    details JSONB,
    detected_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
    -- Signup failure alerts
    RETURN QUERY
    SELECT 
        'auth'::TEXT as alert_category,
        sfa.alert_type,
        sfa.severity,
        sfa.count,
        jsonb_build_object(
            'window_start', sfa.window_start,
            'window_end', sfa.window_end,
            'sample_errors', sfa.sample_errors
        ) as details,
        NOW() as detected_at
    FROM get_signup_failure_alerts(p_window_minutes, 5) sfa;
    
    -- Webhook failure alerts
    RETURN QUERY
    SELECT 
        'billing'::TEXT as alert_category,
        wfa.alert_type,
        wfa.severity,
        wfa.count,
        jsonb_build_object(
            'window_start', wfa.window_start,
            'window_end', wfa.window_end,
            'failed_events', wfa.failed_events
        ) as details,
        NOW() as detected_at
    FROM get_webhook_failure_alerts(p_window_minutes, 3) wfa;
    
    -- Subscription mismatch alerts
    RETURN QUERY
    SELECT 
        'billing'::TEXT as alert_category,
        sma.alert_type,
        sma.severity,
        sma.count,
        jsonb_build_object(
            'window_start', sma.window_start,
            'window_end', sma.window_end,
            'mismatches', sma.mismatches
        ) as details,
        NOW() as detected_at
    FROM get_subscription_mismatch_alerts(p_window_minutes) sma;
    
    -- Auth failure alerts (from ops_event_log)
    RETURN QUERY
    SELECT 
        'auth'::TEXT as alert_category,
        'auth_failures'::TEXT as alert_type,
        CASE 
            WHEN COUNT(*) >= 15 THEN 'critical'
            WHEN COUNT(*) >= 10 THEN 'error'
            ELSE 'warning'
        END::TEXT as severity,
        COUNT(*) as count,
        jsonb_build_object(
            'window_minutes', p_window_minutes,
            'sample_errors', jsonb_agg(
                jsonb_build_object(
                    'source', source,
                    'error_code', error_code,
                    'error_reason', error_reason,
                    'created_at', created_at
                ) ORDER BY created_at DESC
            )
        ) as details,
        NOW() as detected_at
    FROM ops_event_log
    WHERE event_type = 'auth_failure'
    AND created_at > NOW() - (p_window_minutes || ' minutes')::INTERVAL
    HAVING COUNT(*) >= 5;
END;
$$;

GRANT EXECUTE ON FUNCTION get_ops_alerts TO service_role;
GRANT EXECUTE ON FUNCTION get_ops_alerts TO authenticated;

COMMENT ON FUNCTION get_ops_alerts IS 'Production monitoring: Returns all active operational alerts';

-- ============================================================================
-- PART 7: ALERT SURFACING (Integration with existing alerts table)
-- ============================================================================
-- Function to surface detected alerts to the alerts table

CREATE OR REPLACE FUNCTION surface_ops_alerts()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_alert RECORD;
    v_count INTEGER := 0;
    v_throttle_key TEXT;
    v_last_sent TIMESTAMPTZ;
BEGIN
    FOR v_alert IN SELECT * FROM get_ops_alerts(60) LOOP
        -- Generate throttle key
        v_throttle_key := v_alert.alert_category || ':' || v_alert.alert_type;
        
        -- Check throttle (30-minute cooldown)
        SELECT last_sent INTO v_last_sent
        FROM alert_throttle
        WHERE throttle_key = v_throttle_key;
        
        IF v_last_sent IS NOT NULL AND v_last_sent > NOW() - INTERVAL '30 minutes' THEN
            CONTINUE;  -- Skip this alert (throttled)
        END IF;
        
        -- Insert alert
        INSERT INTO alerts (
            alert_type,
            severity,
            title,
            message,
            metadata,
            throttle_key
        ) VALUES (
            CASE v_alert.alert_category
                WHEN 'auth' THEN 'signup'
                WHEN 'billing' THEN 'system'
                ELSE 'system'
            END,
            v_alert.severity,
            v_alert.alert_type || ' detected',
            v_alert.count || ' ' || v_alert.alert_type || ' in the last hour',
            v_alert.details,
            v_throttle_key
        );
        
        -- Update throttle
        INSERT INTO alert_throttle (throttle_key, alert_type, last_sent)
        VALUES (v_throttle_key, v_alert.alert_type, NOW())
        ON CONFLICT (throttle_key) DO UPDATE SET
            last_sent = NOW();
        
        v_count := v_count + 1;
    END LOOP;
    
    RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION surface_ops_alerts TO service_role;

COMMENT ON FUNCTION surface_ops_alerts IS 'Production monitoring: Surface detected alerts to the alerts table (with 30-minute throttling)';

-- ============================================================================
-- PART 8: MONITORING DASHBOARD VIEW
-- ============================================================================
-- Provides a quick overview of system health

CREATE OR REPLACE VIEW ops_monitoring_dashboard AS
SELECT 
    'signup_failures_1h' as metric,
    COUNT(*)::TEXT as value,
    CASE WHEN COUNT(*) >= 10 THEN 'critical' WHEN COUNT(*) >= 5 THEN 'warning' ELSE 'ok' END as status
FROM ops_event_log
WHERE event_type = 'signup_failure' AND created_at > NOW() - INTERVAL '1 hour'

UNION ALL

SELECT 
    'auth_failures_1h' as metric,
    COUNT(*)::TEXT as value,
    CASE WHEN COUNT(*) >= 15 THEN 'critical' WHEN COUNT(*) >= 10 THEN 'warning' ELSE 'ok' END as status
FROM ops_event_log
WHERE event_type = 'auth_failure' AND created_at > NOW() - INTERVAL '1 hour'

UNION ALL

SELECT 
    'webhook_failures_1h' as metric,
    COUNT(*)::TEXT as value,
    CASE WHEN COUNT(*) >= 5 THEN 'critical' WHEN COUNT(*) >= 3 THEN 'warning' ELSE 'ok' END as status
FROM stripe_webhook_events
WHERE processing_status = 'failed' AND received_at > NOW() - INTERVAL '1 hour'

UNION ALL

SELECT 
    'subscription_mismatches_1h' as metric,
    COUNT(*)::TEXT as value,
    CASE WHEN COUNT(*) >= 1 THEN 'error' ELSE 'ok' END as status
FROM ops_event_log
WHERE event_type = 'subscription_mismatch' AND created_at > NOW() - INTERVAL '1 hour'

UNION ALL

SELECT 
    'entitlement_denials_1h' as metric,
    COALESCE(SUM(count), 0)::TEXT as value,
    CASE WHEN COALESCE(SUM(count), 0) >= 100 THEN 'warning' ELSE 'ok' END as status
FROM ops_event_aggregate
WHERE event_type = 'entitlement_denied' AND bucket_start > NOW() - INTERVAL '1 hour';

COMMENT ON VIEW ops_monitoring_dashboard IS 'Production monitoring: Quick overview of system health metrics';

-- ============================================================================
-- PART 9: GRANTS
-- ============================================================================

GRANT SELECT ON ops_event_log TO service_role;
GRANT INSERT ON ops_event_log TO service_role;
GRANT SELECT ON ops_event_aggregate TO service_role;
GRANT INSERT, UPDATE ON ops_event_aggregate TO service_role;
GRANT SELECT ON ops_monitoring_dashboard TO service_role;
GRANT SELECT ON ops_monitoring_dashboard TO authenticated;

-- ============================================================================
-- PART 10: CLEANUP OLD EVENTS (Retention Policy)
-- ============================================================================
-- Function to clean up old events (call periodically via cron or scheduled function)

CREATE OR REPLACE FUNCTION cleanup_old_ops_events(
    p_retention_days INTEGER DEFAULT 30
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_deleted INTEGER;
BEGIN
    -- Delete old events from ops_event_log
    WITH deleted AS (
        DELETE FROM ops_event_log
        WHERE created_at < NOW() - (p_retention_days || ' days')::INTERVAL
        RETURNING id
    )
    SELECT COUNT(*) INTO v_deleted FROM deleted;
    
    -- Delete old aggregates
    DELETE FROM ops_event_aggregate
    WHERE bucket_start < NOW() - (p_retention_days || ' days')::INTERVAL;
    
    RETURN v_deleted;
END;
$$;

GRANT EXECUTE ON FUNCTION cleanup_old_ops_events TO service_role;

COMMENT ON FUNCTION cleanup_old_ops_events IS 'Production monitoring: Clean up events older than retention period (default 30 days)';
