-- ============================================================================
-- Migration: Add user_limit to plan_limits for team member enforcement
-- ============================================================================

-- Add user_limit column to plan_limits table
ALTER TABLE plan_limits 
ADD COLUMN IF NOT EXISTS user_limit INTEGER NOT NULL DEFAULT 1;

COMMENT ON COLUMN plan_limits.user_limit IS 'Maximum number of team members allowed per organization (-1 for unlimited)';

-- Update plan limits with user limits
-- Starter: 1 user (owner only)
-- Pro: 5 users
-- Enterprise: unlimited (-1)
UPDATE plan_limits SET user_limit = 1 WHERE plan_name = 'Free';
UPDATE plan_limits SET user_limit = 1 WHERE plan_name = 'Starter';
UPDATE plan_limits SET user_limit = 5 WHERE plan_name = 'Pro';
UPDATE plan_limits SET user_limit = -1 WHERE plan_name = 'Enterprise';

-- ============================================================================
-- Add viewer role to organization_members
-- ============================================================================

-- Update the role check constraint to include 'viewer'
ALTER TABLE organization_members 
DROP CONSTRAINT IF EXISTS organization_members_role_check;

ALTER TABLE organization_members 
ADD CONSTRAINT organization_members_role_check 
CHECK (role IN ('owner', 'admin', 'analyst', 'member', 'viewer'));

-- ============================================================================
-- Function to check if organization can add more members based on plan
-- ============================================================================

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
BEGIN
    -- Get the organization owner
    SELECT user_id INTO v_owner_id
    FROM organization_members
    WHERE organization_id = p_organization_id AND role = 'owner'
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
    
    -- Get the owner's plan
    SELECT COALESCE(us.plan_name, 'Free'), COALESCE(pl.user_limit, 1)
    INTO v_plan_name, v_user_limit
    FROM plan_limits pl
    LEFT JOIN user_subscriptions us ON us.plan_name = pl.plan_name 
        AND us.user_id = v_owner_id
        AND us.status IN ('active', 'trialing')
    WHERE pl.plan_name = COALESCE(us.plan_name, 'Free')
    LIMIT 1;
    
    -- If no plan found, default to Free
    IF v_plan_name IS NULL THEN
        v_plan_name := 'Free';
        SELECT user_limit INTO v_user_limit FROM plan_limits WHERE plan_name = 'Free';
    END IF;
    
    -- Count current members (including pending invites)
    SELECT COUNT(*) INTO v_current_count
    FROM organization_members
    WHERE organization_id = p_organization_id;
    
    -- Add pending invites to the count
    v_current_count := v_current_count + (
        SELECT COUNT(*) FROM organization_invitations
        WHERE organization_id = p_organization_id AND status = 'pending'
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

COMMENT ON FUNCTION check_organization_user_limit IS 'Checks if an organization can add more members based on the owner plan limits';

GRANT EXECUTE ON FUNCTION check_organization_user_limit TO authenticated;
GRANT EXECUTE ON FUNCTION check_organization_user_limit TO service_role;

-- ============================================================================
-- Update get_user_current_plan to include user_limit
-- ============================================================================

-- Drop existing function first since return type is changing
DROP FUNCTION IF EXISTS get_user_current_plan(UUID);

CREATE OR REPLACE FUNCTION get_user_current_plan(p_user_id UUID)
RETURNS TABLE (
    plan_name TEXT,
    status TEXT,
    integration_limit INTEGER,
    user_limit INTEGER,
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
        pl.user_limit,
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
