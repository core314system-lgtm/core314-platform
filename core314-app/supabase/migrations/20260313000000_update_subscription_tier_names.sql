-- ============================================================================
-- Update subscription tier names to match pricing page
-- Old: Free, Starter, Pro, Enterprise (and profiles: none, starter, professional, enterprise)
-- New: Free, Monitor, Intelligence, Command Center, Enterprise
-- ============================================================================

-- Step 1: Update plan_limits CHECK constraint and data
ALTER TABLE plan_limits DROP CONSTRAINT IF EXISTS plan_limits_plan_name_check;
ALTER TABLE plan_limits ADD CONSTRAINT plan_limits_plan_name_check
  CHECK (plan_name IN ('Free', 'Monitor', 'Intelligence', 'Command Center', 'Enterprise'));

UPDATE plan_limits SET plan_name = 'Monitor', description = 'Early warning system for operational issues' WHERE plan_name = 'Starter';
UPDATE plan_limits SET plan_name = 'Intelligence', description = 'Understand what is happening inside your business and why' WHERE plan_name = 'Pro';

-- Update features for new tiers to match pricing page
UPDATE plan_limits SET
  integration_limit = -1,
  user_limit = 5,
  features = '{"analytics": true, "advanced_ai": false, "proactive_optimization": true, "api_access": false}'::jsonb
WHERE plan_name = 'Monitor';

UPDATE plan_limits SET
  integration_limit = -1,
  user_limit = 10,
  features = '{"analytics": true, "advanced_ai": true, "proactive_optimization": true, "api_access": false}'::jsonb
WHERE plan_name = 'Intelligence';

-- Add Command Center tier
INSERT INTO plan_limits (plan_name, integration_limit, user_limit, features, description)
VALUES (
  'Command Center',
  -1,
  -1,
  '{"analytics": true, "advanced_ai": true, "proactive_optimization": true, "api_access": true, "signal_analytics": true}'::jsonb,
  'Continuous operational intelligence for scaling organizations'
)
ON CONFLICT (plan_name) DO UPDATE SET
  integration_limit = EXCLUDED.integration_limit,
  user_limit = EXCLUDED.user_limit,
  features = EXCLUDED.features,
  description = EXCLUDED.description,
  updated_at = NOW();

-- Update Enterprise features
UPDATE plan_limits SET
  user_limit = -1,
  features = '{"analytics": true, "advanced_ai": true, "proactive_optimization": true, "api_access": true, "signal_analytics": true, "custom_integrations": true, "dedicated_support": true}'::jsonb
WHERE plan_name = 'Enterprise';

-- Step 2: Update user_subscriptions CHECK constraint
ALTER TABLE user_subscriptions DROP CONSTRAINT IF EXISTS user_subscriptions_plan_name_check;
ALTER TABLE user_subscriptions ADD CONSTRAINT user_subscriptions_plan_name_check
  CHECK (plan_name IN ('Free', 'Monitor', 'Intelligence', 'Command Center', 'Enterprise'));

-- Migrate existing subscription data to new names
UPDATE user_subscriptions SET plan_name = 'Monitor' WHERE plan_name = 'Starter';
UPDATE user_subscriptions SET plan_name = 'Intelligence' WHERE plan_name = 'Pro';

-- Step 3: Update profiles.subscription_tier CHECK constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_subscription_tier_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_subscription_tier_check
  CHECK (subscription_tier IN ('none', 'free', 'monitor', 'intelligence', 'command_center', 'enterprise'));

-- Migrate existing profile tiers to new names
UPDATE profiles SET subscription_tier = 'monitor' WHERE subscription_tier = 'starter';
UPDATE profiles SET subscription_tier = 'intelligence' WHERE subscription_tier = 'professional';

-- Step 4: Recreate get_user_subscription_summary to handle new tier names
CREATE OR REPLACE FUNCTION get_user_subscription_summary(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
    v_profile RECORD;
    v_plan_display_name TEXT;
BEGIN
    -- First try to get from user_subscriptions (Stripe-managed)
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

    -- If no Stripe subscription, check profiles.subscription_tier (admin-assigned)
    IF v_result IS NULL THEN
        SELECT subscription_tier, subscription_status INTO v_profile
        FROM profiles
        WHERE id = p_user_id;

        -- Map profile tier to plan_limits name
        v_plan_display_name := CASE v_profile.subscription_tier
            WHEN 'monitor' THEN 'Monitor'
            WHEN 'intelligence' THEN 'Intelligence'
            WHEN 'command_center' THEN 'Command Center'
            WHEN 'enterprise' THEN 'Enterprise'
            ELSE 'Free'
        END;

        -- If user has an admin-assigned tier, return it with active status
        IF v_profile.subscription_tier IS NOT NULL
           AND v_profile.subscription_tier NOT IN ('none', 'free')
           AND v_profile.subscription_status = 'active' THEN
            SELECT jsonb_build_object(
                'subscription', jsonb_build_object(
                    'plan_name', v_plan_display_name,
                    'status', 'active',
                    'source', 'admin_assigned'
                ),
                'plan_limits', row_to_json(pl.*),
                'active_addons', '[]'::jsonb
            ) INTO v_result
            FROM plan_limits pl
            WHERE pl.plan_name = v_plan_display_name;
        END IF;
    END IF;

    -- Fallback to Free plan
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

-- Step 5: Update get_user_current_plan to handle new tier names
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
DECLARE
    v_profile RECORD;
    v_plan_display_name TEXT;
BEGIN
    -- First try Stripe subscriptions
    RETURN QUERY
    SELECT
        us.plan_name,
        us.status,
        pl.integration_limit,
        pl.features,
        us.current_period_end
    FROM user_subscriptions us
    JOIN plan_limits pl ON pl.plan_name = us.plan_name
    WHERE us.user_id = p_user_id
        AND us.status IN ('active', 'trialing')
        AND (us.current_period_end IS NULL OR us.current_period_end > NOW())
    LIMIT 1;

    IF FOUND THEN RETURN; END IF;

    -- Fall back to profile tier
    SELECT subscription_tier, subscription_status INTO v_profile
    FROM profiles WHERE id = p_user_id;

    v_plan_display_name := CASE v_profile.subscription_tier
        WHEN 'monitor' THEN 'Monitor'
        WHEN 'intelligence' THEN 'Intelligence'
        WHEN 'command_center' THEN 'Command Center'
        WHEN 'enterprise' THEN 'Enterprise'
        ELSE 'Free'
    END;

    IF v_profile.subscription_tier IS NOT NULL
       AND v_profile.subscription_tier NOT IN ('none', 'free')
       AND v_profile.subscription_status = 'active' THEN
        RETURN QUERY
        SELECT
            pl.plan_name,
            'active'::TEXT as status,
            pl.integration_limit,
            pl.features,
            NULL::TIMESTAMPTZ as current_period_end
        FROM plan_limits pl
        WHERE pl.plan_name = v_plan_display_name
        LIMIT 1;
    ELSE
        RETURN QUERY
        SELECT
            pl.plan_name,
            'canceled'::TEXT as status,
            pl.integration_limit,
            pl.features,
            NULL::TIMESTAMPTZ as current_period_end
        FROM plan_limits pl
        WHERE pl.plan_name = 'Free'
        LIMIT 1;
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION get_user_current_plan TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_subscription_summary TO authenticated;
