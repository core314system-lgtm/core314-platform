-- ============================================================================
-- Fix seat limit enforcement: use org plan + profile tier, update limits
-- ============================================================================
-- Problem: check_organization_user_limit only checked user_subscriptions (Stripe)
-- but not profiles.subscription_tier (admin-assigned plans), so it always
-- fell back to 'Free' plan with 1 seat for admin-assigned plans.
--
-- Also updates plan_limits user_limit values per business requirements:
--   Monitor: 3 seats
--   Intelligence: 5 seats
--   Command Center: 25 seats
--   Enterprise: unlimited (-1)
-- ============================================================================

-- Step 1: Update plan_limits user_limit values
UPDATE plan_limits SET user_limit = 1  WHERE plan_name = 'Free';
UPDATE plan_limits SET user_limit = 3  WHERE plan_name = 'Monitor';
UPDATE plan_limits SET user_limit = 5  WHERE plan_name = 'Intelligence';
UPDATE plan_limits SET user_limit = 25 WHERE plan_name = 'Command Center';
UPDATE plan_limits SET user_limit = -1 WHERE plan_name = 'Enterprise';

-- Step 2: Recreate check_organization_user_limit to check BOTH
-- user_subscriptions (Stripe) AND profiles.subscription_tier (admin-assigned)
CREATE OR REPLACE FUNCTION check_organization_user_limit(p_organization_id UUID)
RETURNS TABLE (
    can_add_member BOOLEAN,
    current_count INTEGER,
    user_limit INTEGER,
    plan_name TEXT,
    message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_owner_id UUID;
    v_plan_name TEXT;
    v_user_limit INTEGER;
    v_current_count INTEGER;
    v_profile RECORD;
    v_plan_display_name TEXT;
BEGIN
    -- Get the organization owner
    SELECT om.user_id INTO v_owner_id
    FROM organization_members om
    WHERE om.organization_id = p_organization_id AND om.role = 'owner'
    LIMIT 1;
    
    IF v_owner_id IS NULL THEN
        RETURN QUERY SELECT 
            FALSE::BOOLEAN,
            0::INTEGER,
            0::INTEGER,
            'Unknown'::TEXT,
            'Organization has no owner'::TEXT;
        RETURN;
    END IF;
    
    -- Strategy 1: Check user_subscriptions (Stripe-managed)
    SELECT us.plan_name, pl.user_limit
    INTO v_plan_name, v_user_limit
    FROM user_subscriptions us
    JOIN plan_limits pl ON pl.plan_name = us.plan_name
    WHERE us.user_id = v_owner_id
        AND us.status IN ('active', 'trialing')
        AND (us.current_period_end IS NULL OR us.current_period_end > NOW())
    LIMIT 1;
    
    -- Strategy 2: Fall back to profiles.subscription_tier (admin-assigned)
    IF v_plan_name IS NULL THEN
        SELECT p.subscription_tier, p.subscription_status INTO v_profile
        FROM profiles p
        WHERE p.id = v_owner_id;

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
            SELECT pl.plan_name, pl.user_limit
            INTO v_plan_name, v_user_limit
            FROM plan_limits pl
            WHERE pl.plan_name = v_plan_display_name;
        END IF;
    END IF;

    -- Strategy 3: Also check the organization's own plan column
    IF v_plan_name IS NULL THEN
        SELECT CASE o.plan
            WHEN 'monitor' THEN 'Monitor'
            WHEN 'intelligence' THEN 'Intelligence'
            WHEN 'command_center' THEN 'Command Center'
            WHEN 'enterprise' THEN 'Enterprise'
            ELSE 'Free'
        END INTO v_plan_display_name
        FROM organizations o
        WHERE o.id = p_organization_id;

        IF v_plan_display_name IS NOT NULL AND v_plan_display_name != 'Free' THEN
            SELECT pl.plan_name, pl.user_limit
            INTO v_plan_name, v_user_limit
            FROM plan_limits pl
            WHERE pl.plan_name = v_plan_display_name;
        END IF;
    END IF;
    
    -- Final fallback: Free plan
    IF v_plan_name IS NULL THEN
        v_plan_name := 'Free';
        SELECT pl.user_limit INTO v_user_limit FROM plan_limits pl WHERE pl.plan_name = 'Free';
        IF v_user_limit IS NULL THEN
            v_user_limit := 1;
        END IF;
    END IF;
    
    -- Count current members
    SELECT COUNT(*)::INTEGER INTO v_current_count
    FROM organization_members om2
    WHERE om2.organization_id = p_organization_id;
    
    -- Add pending invites to the count
    v_current_count := v_current_count + (
        SELECT COUNT(*)::INTEGER FROM organization_invitations oi
        WHERE oi.organization_id = p_organization_id AND oi.status = 'pending'
    );
    
    -- Check if can add more members
    IF v_user_limit = -1 THEN
        -- Unlimited
        RETURN QUERY SELECT 
            TRUE::BOOLEAN,
            v_current_count::INTEGER,
            v_user_limit::INTEGER,
            v_plan_name::TEXT,
            'Unlimited members allowed'::TEXT;
    ELSIF v_current_count < v_user_limit THEN
        RETURN QUERY SELECT 
            TRUE::BOOLEAN,
            v_current_count::INTEGER,
            v_user_limit::INTEGER,
            v_plan_name::TEXT,
            format('Can add %s more member(s)', v_user_limit - v_current_count)::TEXT;
    ELSE
        RETURN QUERY SELECT 
            FALSE::BOOLEAN,
            v_current_count::INTEGER,
            v_user_limit::INTEGER,
            v_plan_name::TEXT,
            format('Team limit reached. %s plan allows %s member(s). Upgrade to add more.', v_plan_name, v_user_limit)::TEXT;
    END IF;
END;
$$;

COMMENT ON FUNCTION check_organization_user_limit IS 'Checks if an organization can add more members based on owner plan (Stripe, profile tier, or org plan)';
GRANT EXECUTE ON FUNCTION check_organization_user_limit TO authenticated;
GRANT EXECUTE ON FUNCTION check_organization_user_limit TO service_role;
