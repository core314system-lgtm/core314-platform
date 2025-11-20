-- ============================================================================
-- ============================================================================

CREATE TABLE IF NOT EXISTS integrity_anomalies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    check_name TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    details JSONB DEFAULT '{}'::jsonb,
    resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_integrity_anomalies_check_name 
ON integrity_anomalies(check_name);

CREATE INDEX IF NOT EXISTS idx_integrity_anomalies_severity 
ON integrity_anomalies(severity) WHERE NOT resolved;

CREATE INDEX IF NOT EXISTS idx_integrity_anomalies_created_at 
ON integrity_anomalies(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_integrity_anomalies_user_id 
ON integrity_anomalies(user_id) WHERE NOT resolved;

ALTER TABLE integrity_anomalies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access"
ON integrity_anomalies
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

GRANT ALL ON integrity_anomalies TO service_role;

CREATE OR REPLACE FUNCTION run_integrity_checks()
RETURNS TABLE (
    check_name TEXT,
    anomaly_count INTEGER,
    details JSONB
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_anomaly_count INTEGER;
BEGIN
    INSERT INTO integrity_anomalies (check_name, user_id, severity, details)
    SELECT 
        'subscription_without_plan_limits',
        us.user_id,
        'high',
        jsonb_build_object(
            'subscription_id', us.id,
            'plan_name', us.plan_name,
            'status', us.status
        )
    FROM user_subscriptions us
    LEFT JOIN plan_limits pl ON us.plan_name = pl.plan_name
    WHERE pl.plan_name IS NULL
    AND us.status IN ('active', 'trialing')
    AND NOT EXISTS (
        SELECT 1 FROM integrity_anomalies ia
        WHERE ia.check_name = 'subscription_without_plan_limits'
        AND ia.user_id = us.user_id
        AND NOT ia.resolved
        AND ia.created_at > NOW() - INTERVAL '1 hour'
    );
    
    GET DIAGNOSTICS v_anomaly_count = ROW_COUNT;
    
    RETURN QUERY SELECT 
        'subscription_without_plan_limits'::TEXT,
        v_anomaly_count,
        jsonb_build_object('description', 'Active subscriptions with no matching plan_limits row');

    INSERT INTO integrity_anomalies (check_name, user_id, severity, details)
    SELECT DISTINCT
        'addon_feature_mismatch',
        ua.user_id,
        'medium',
        jsonb_build_object(
            'addon_name', ua.addon_name,
            'addon_category', ua.addon_category,
            'user_plan', us.plan_name,
            'addon_id', ua.id
        )
    FROM user_addons ua
    JOIN user_subscriptions us ON ua.user_id = us.user_id
    LEFT JOIN plan_limits pl ON us.plan_name = pl.plan_name
    WHERE ua.status = 'active'
    AND us.status IN ('active', 'trialing')
    AND (
        (ua.addon_category = 'analytics' AND NOT (pl.features->>'analytics')::boolean)
        OR (ua.addon_category = 'ai' AND NOT (pl.features->>'advanced_ai')::boolean)
    )
    AND NOT EXISTS (
        SELECT 1 FROM integrity_anomalies ia
        WHERE ia.check_name = 'addon_feature_mismatch'
        AND ia.user_id = ua.user_id
        AND NOT ia.resolved
        AND ia.created_at > NOW() - INTERVAL '1 hour'
    );
    
    GET DIAGNOSTICS v_anomaly_count = ROW_COUNT;
    
    RETURN QUERY SELECT 
        'addon_feature_mismatch'::TEXT,
        v_anomaly_count,
        jsonb_build_object('description', 'Active add-ons requiring features not available in user plan');

    INSERT INTO integrity_anomalies (check_name, user_id, severity, details)
    SELECT 
        'missing_stripe_customer_id',
        us.user_id,
        'critical',
        jsonb_build_object(
            'subscription_id', us.id,
            'plan_name', us.plan_name,
            'status', us.status,
            'stripe_subscription_id', us.stripe_subscription_id
        )
    FROM user_subscriptions us
    JOIN profiles p ON us.user_id = p.id
    WHERE us.plan_name != 'Free'
    AND us.status IN ('active', 'trialing')
    AND (p.stripe_customer_id IS NULL OR p.stripe_customer_id = '')
    AND NOT EXISTS (
        SELECT 1 FROM integrity_anomalies ia
        WHERE ia.check_name = 'missing_stripe_customer_id'
        AND ia.user_id = us.user_id
        AND NOT ia.resolved
        AND ia.created_at > NOW() - INTERVAL '1 hour'
    );
    
    GET DIAGNOSTICS v_anomaly_count = ROW_COUNT;
    
    RETURN QUERY SELECT 
        'missing_stripe_customer_id'::TEXT,
        v_anomaly_count,
        jsonb_build_object('description', 'Paid subscriptions without Stripe customer ID in profile');

    INSERT INTO integrity_anomalies (check_name, user_id, severity, details)
    SELECT 
        'duplicate_active_subscriptions',
        user_id,
        'critical',
        jsonb_build_object(
            'subscription_count', subscription_count,
            'subscription_ids', subscription_ids
        )
    FROM (
        SELECT 
            user_id,
            COUNT(*) as subscription_count,
            jsonb_agg(id) as subscription_ids
        FROM user_subscriptions
        WHERE status IN ('active', 'trialing')
        GROUP BY user_id
        HAVING COUNT(*) > 1
    ) duplicates
    WHERE NOT EXISTS (
        SELECT 1 FROM integrity_anomalies ia
        WHERE ia.check_name = 'duplicate_active_subscriptions'
        AND ia.user_id = duplicates.user_id
        AND NOT ia.resolved
        AND ia.created_at > NOW() - INTERVAL '1 hour'
    );
    
    GET DIAGNOSTICS v_anomaly_count = ROW_COUNT;
    
    RETURN QUERY SELECT 
        'duplicate_active_subscriptions'::TEXT,
        v_anomaly_count,
        jsonb_build_object('description', 'Users with multiple active subscriptions');

    INSERT INTO integrity_anomalies (check_name, user_id, severity, details)
    SELECT 
        'orphaned_addons',
        ua.user_id,
        'medium',
        jsonb_build_object(
            'addon_id', ua.id,
            'addon_name', ua.addon_name,
            'addon_category', ua.addon_category
        )
    FROM user_addons ua
    LEFT JOIN user_subscriptions us ON ua.user_id = us.user_id 
        AND us.status IN ('active', 'trialing')
    WHERE ua.status = 'active'
    AND us.id IS NULL
    AND NOT EXISTS (
        SELECT 1 FROM integrity_anomalies ia
        WHERE ia.check_name = 'orphaned_addons'
        AND ia.user_id = ua.user_id
        AND NOT ia.resolved
        AND ia.created_at > NOW() - INTERVAL '1 hour'
    );
    
    GET DIAGNOSTICS v_anomaly_count = ROW_COUNT;
    
    RETURN QUERY SELECT 
        'orphaned_addons'::TEXT,
        v_anomaly_count,
        jsonb_build_object('description', 'Active add-ons for users without active subscriptions');

    INSERT INTO integrity_anomalies (check_name, user_id, severity, details)
    SELECT 
        'missing_profile',
        au.id,
        'high',
        jsonb_build_object(
            'email', au.email,
            'created_at', au.created_at
        )
    FROM auth.users au
    LEFT JOIN profiles p ON au.id = p.id
    WHERE p.id IS NULL
    AND au.created_at < NOW() - INTERVAL '5 minutes'
    AND NOT EXISTS (
        SELECT 1 FROM integrity_anomalies ia
        WHERE ia.check_name = 'missing_profile'
        AND ia.user_id = au.id
        AND NOT ia.resolved
        AND ia.created_at > NOW() - INTERVAL '1 hour'
    );
    
    GET DIAGNOSTICS v_anomaly_count = ROW_COUNT;
    
    RETURN QUERY SELECT 
        'missing_profile'::TEXT,
        v_anomaly_count,
        jsonb_build_object('description', 'Auth users without corresponding profile records');

END;
$$;

GRANT EXECUTE ON FUNCTION run_integrity_checks() TO service_role;

CREATE TABLE IF NOT EXISTS auto_scale_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trigger_condition TEXT NOT NULL,
    failure_rate NUMERIC(5,2),
    connection_pool_usage NUMERIC(5,2),
    avg_response_time_ms INTEGER,
    recommendation TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auto_scale_recommendations_created_at 
ON auto_scale_recommendations(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_auto_scale_recommendations_severity 
ON auto_scale_recommendations(severity);

ALTER TABLE auto_scale_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on recommendations"
ON auto_scale_recommendations
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

GRANT ALL ON auto_scale_recommendations TO service_role;

COMMENT ON TABLE integrity_anomalies IS 'Tracks data integrity anomalies discovered during automated checks';
COMMENT ON FUNCTION run_integrity_checks() IS 'Runs comprehensive integrity checks across all tables and logs anomalies';
COMMENT ON TABLE auto_scale_recommendations IS 'Stores auto-scaling recommendations triggered during load testing';
