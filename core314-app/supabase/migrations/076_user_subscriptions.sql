
-- ============================================================================
-- ============================================================================

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id 
ON profiles(stripe_customer_id) 
WHERE stripe_customer_id IS NOT NULL;

COMMENT ON COLUMN profiles.stripe_customer_id IS 'Stripe customer ID for subscription and payment management';

-- ============================================================================
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_name TEXT NOT NULL CHECK (plan_name IN ('Free', 'Starter', 'Pro', 'Enterprise')),
    stripe_subscription_id TEXT UNIQUE,
    stripe_customer_id TEXT,
    status TEXT NOT NULL CHECK (status IN ('active', 'trialing', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid')),
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    canceled_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    proration_amount NUMERIC(10, 2) DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX idx_user_subscriptions_user_status ON user_subscriptions(user_id, status);
CREATE INDEX idx_user_subscriptions_stripe_subscription_id ON user_subscriptions(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;
CREATE INDEX idx_user_subscriptions_stripe_customer_id ON user_subscriptions(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

CREATE TRIGGER update_user_subscriptions_updated_at
    BEFORE UPDATE ON user_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE user_subscriptions IS 'Tracks user subscription plans and their lifecycle with Stripe';
COMMENT ON COLUMN user_subscriptions.plan_name IS 'Plan tier: Free, Starter, Pro, or Enterprise';
COMMENT ON COLUMN user_subscriptions.status IS 'Stripe subscription status';
COMMENT ON COLUMN user_subscriptions.proration_amount IS 'Proration amount for plan changes';

-- ============================================================================
-- ============================================================================

CREATE TABLE IF NOT EXISTS plan_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_name TEXT NOT NULL UNIQUE CHECK (plan_name IN ('Free', 'Starter', 'Pro', 'Enterprise')),
    integration_limit INTEGER NOT NULL,
    features JSONB NOT NULL DEFAULT '{}'::jsonb,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_plan_limits_updated_at
    BEFORE UPDATE ON plan_limits
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE plan_limits IS 'Defines limits and features for each subscription plan';
COMMENT ON COLUMN plan_limits.integration_limit IS 'Maximum number of integrations allowed (-1 for unlimited)';
COMMENT ON COLUMN plan_limits.features IS 'JSON object of feature flags (analytics, advanced_ai, etc.)';

INSERT INTO plan_limits (plan_name, integration_limit, features, description) VALUES
    ('Free', 0, '{"analytics": false, "advanced_ai": false, "proactive_optimization": false, "api_access": false}'::jsonb, 'Free tier with basic dashboard access'),
    ('Starter', 3, '{"analytics": false, "advanced_ai": false, "proactive_optimization": true, "api_access": false}'::jsonb, 'Starter plan with 3 integrations and proactive optimization'),
    ('Pro', 10, '{"analytics": true, "advanced_ai": false, "proactive_optimization": true, "api_access": true}'::jsonb, 'Pro plan with 10 integrations, analytics, and API access'),
    ('Enterprise', -1, '{"analytics": true, "advanced_ai": true, "proactive_optimization": true, "api_access": true, "custom_integrations": true, "dedicated_support": true}'::jsonb, 'Enterprise plan with unlimited integrations and all features')
ON CONFLICT (plan_name) DO UPDATE SET
    integration_limit = EXCLUDED.integration_limit,
    features = EXCLUDED.features,
    description = EXCLUDED.description,
    updated_at = NOW();

-- ============================================================================
-- ============================================================================

ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role has full access to user_subscriptions"
    ON user_subscriptions
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Users can read their own subscriptions"
    ON user_subscriptions
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Only service role can modify subscriptions"
    ON user_subscriptions
    FOR INSERT
    TO service_role
    WITH CHECK (true);

-- ============================================================================
-- ============================================================================

ALTER TABLE plan_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role has full access to plan_limits"
    ON plan_limits
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Authenticated users can read plan limits"
    ON plan_limits
    FOR SELECT
    TO authenticated
    USING (true);

-- ============================================================================
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_current_plan(p_user_id UUID)
RETURNS TABLE (
    plan_name TEXT,
    status TEXT,
    integration_limit INTEGER,
    features JSONB,
    current_period_end TIMESTAMPTZ
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(us.plan_name, 'Free') as plan_name,
        COALESCE(us.status, 'canceled') as status,
        pl.integration_limit,
        pl.features,
        us.current_period_end
    FROM plan_limits pl
    LEFT JOIN user_subscriptions us ON us.user_id = p_user_id 
        AND us.status IN ('active', 'trialing')
        AND (us.current_period_end IS NULL OR us.current_period_end > NOW())
    WHERE pl.plan_name = COALESCE(us.plan_name, 'Free')
    LIMIT 1;
END;
$$;

COMMENT ON FUNCTION get_user_current_plan IS 'Returns the current active plan for a user with limits and features';

-- ============================================================================
-- ============================================================================

CREATE OR REPLACE FUNCTION apply_plan_limits(p_user_id UUID, p_plan_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_limits RECORD;
    v_integration_count INTEGER;
    v_disabled_addons INTEGER := 0;
    v_result JSONB;
BEGIN
    SELECT integration_limit, features INTO v_limits
    FROM plan_limits
    WHERE plan_name = p_plan_name;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Plan % not found', p_plan_name;
    END IF;

    v_integration_count := 0;

    UPDATE user_addons
    SET 
        status = 'canceled',
        expires_at = NOW(),
        updated_at = NOW()
    WHERE user_id = p_user_id
        AND status = 'active'
        AND (
            (addon_category = 'analytics' AND NOT (v_limits.features->>'analytics')::boolean)
            OR
            (addon_category = 'ai' AND NOT (v_limits.features->>'advanced_ai')::boolean)
        );

    GET DIAGNOSTICS v_disabled_addons = ROW_COUNT;

    v_result := jsonb_build_object(
        'plan_name', p_plan_name,
        'integration_limit', v_limits.integration_limit,
        'current_integration_count', v_integration_count,
        'features', v_limits.features,
        'disabled_addons_count', v_disabled_addons,
        'applied_at', NOW()
    );

    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION apply_plan_limits IS 'Applies plan limits and disables incompatible add-ons when plan changes';

-- ============================================================================
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_subscription_summary(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'subscription', row_to_json(us.*),
        'plan_limits', row_to_json(pl.*),
        'active_addons', (
            SELECT COALESCE(jsonb_agg(row_to_json(ua.*)), '[]'::jsonb)
            FROM user_addons ua
            WHERE ua.user_id = p_user_id AND ua.status = 'active'
        )
    ) INTO v_result
    FROM user_subscriptions us
    LEFT JOIN plan_limits pl ON pl.plan_name = us.plan_name
    WHERE us.user_id = p_user_id
        AND us.status IN ('active', 'trialing')
    ORDER BY us.created_at DESC
    LIMIT 1;

    IF v_result IS NULL THEN
        SELECT jsonb_build_object(
            'subscription', jsonb_build_object(
                'plan_name', 'Free',
                'status', 'canceled'
            ),
            'plan_limits', row_to_json(pl.*),
            'active_addons', '[]'::jsonb
        ) INTO v_result
        FROM plan_limits pl
        WHERE pl.plan_name = 'Free';
    END IF;

    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION get_user_subscription_summary IS 'Returns complete subscription summary including plan, limits, and active add-ons';

-- ============================================================================
-- ============================================================================

GRANT SELECT ON plan_limits TO authenticated;
GRANT SELECT ON user_subscriptions TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_current_plan TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_subscription_summary TO authenticated;

GRANT ALL ON user_subscriptions TO service_role;
GRANT ALL ON plan_limits TO service_role;
GRANT EXECUTE ON FUNCTION apply_plan_limits TO service_role;
