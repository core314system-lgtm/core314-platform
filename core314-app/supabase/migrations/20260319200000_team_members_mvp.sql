-- ============================================================================
-- Migration: Team Members MVP — Update plan limits + auto-accept on login
-- ============================================================================

-- ============================================================================
-- PART 1: Update plan_limits for correct team member seat limits
-- ============================================================================

-- Intelligence → 1 user (owner only)
-- Command Center → 5 users
-- Enterprise → 20 users

-- First update any existing rows that match our plan names
UPDATE plan_limits SET user_limit = 1 WHERE lower(plan_name) IN ('intelligence', 'free', 'starter');
UPDATE plan_limits SET user_limit = 5 WHERE lower(plan_name) IN ('command center', 'command_center', 'commandcenter', 'pro');
UPDATE plan_limits SET user_limit = 20 WHERE lower(plan_name) IN ('enterprise');

-- Ensure Intelligence plan exists in plan_limits
INSERT INTO plan_limits (plan_name, integration_limit, user_limit, features)
VALUES ('Intelligence', 3, 1, '{"briefs_per_month": 30}')
ON CONFLICT (plan_name) DO UPDATE SET user_limit = 1;

-- Ensure Command Center plan exists
INSERT INTO plan_limits (plan_name, integration_limit, user_limit, features)
VALUES ('Command Center', 10, 5, '{"briefs_per_month": -1}')
ON CONFLICT (plan_name) DO UPDATE SET user_limit = 5;

-- Ensure Enterprise plan exists
INSERT INTO plan_limits (plan_name, integration_limit, user_limit, features)
VALUES ('Enterprise', -1, 20, '{"briefs_per_month": -1}')
ON CONFLICT (plan_name) DO UPDATE SET user_limit = 20;

-- ============================================================================
-- PART 2: Auto-accept pending invites on login
-- ============================================================================

-- This function is called when a user logs in and has no organization.
-- It checks if they have any pending invitations and auto-accepts the first one.
CREATE OR REPLACE FUNCTION auto_accept_pending_invites(
  p_user_id UUID,
  p_user_email TEXT
)
RETURNS TABLE (
  accepted BOOLEAN,
  organization_id UUID,
  role TEXT,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invite RECORD;
  v_existing_membership RECORD;
BEGIN
  -- Check if user already belongs to an organization
  SELECT * INTO v_existing_membership
  FROM public.organization_members
  WHERE user_id = p_user_id;

  IF v_existing_membership IS NOT NULL THEN
    RETURN QUERY SELECT 
      FALSE,
      v_existing_membership.organization_id,
      v_existing_membership.role,
      'User already belongs to an organization'::TEXT;
    RETURN;
  END IF;

  -- Find the first pending invitation for this email (case-insensitive)
  SELECT * INTO v_invite
  FROM public.organization_invitations
  WHERE lower(email) = lower(p_user_email)
    AND status = 'pending'
    AND expires_at > NOW()
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE;

  IF v_invite IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, 'No pending invitations found'::TEXT;
    RETURN;
  END IF;

  -- Create membership
  INSERT INTO public.organization_members (organization_id, user_id, role, joined_at)
  VALUES (v_invite.organization_id, p_user_id, v_invite.role, NOW());

  -- Mark invitation as accepted
  UPDATE public.organization_invitations
  SET status = 'accepted', updated_at = NOW()
  WHERE id = v_invite.id;

  RETURN QUERY SELECT 
    TRUE,
    v_invite.organization_id,
    v_invite.role,
    'Successfully joined organization'::TEXT;
END;
$$;

COMMENT ON FUNCTION auto_accept_pending_invites IS 'Auto-accepts pending invitations when an invited user logs in';

GRANT EXECUTE ON FUNCTION auto_accept_pending_invites(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION auto_accept_pending_invites(UUID, TEXT) TO authenticated;

-- ============================================================================
-- PART 3: Update check_organization_user_limit to use correct plan name mapping
-- ============================================================================

-- Recreate with better plan name resolution that handles both
-- DB plan names and frontend plan names
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
    
    -- Get the owner's active subscription plan name
    SELECT us.plan_name INTO v_plan_name
    FROM user_subscriptions us
    WHERE us.user_id = v_owner_id
      AND us.status IN ('active', 'trialing')
    LIMIT 1;

    -- Default to Intelligence if no active subscription
    v_plan_name := COALESCE(v_plan_name, 'Intelligence');

    -- Get user_limit from plan_limits (case-insensitive match)
    SELECT pl.user_limit INTO v_user_limit
    FROM plan_limits pl
    WHERE lower(pl.plan_name) = lower(v_plan_name)
    LIMIT 1;

    -- Fallback: try matching common variants
    IF v_user_limit IS NULL THEN
      SELECT pl.user_limit INTO v_user_limit
      FROM plan_limits pl
      WHERE lower(pl.plan_name) LIKE '%' || lower(
        CASE 
          WHEN v_plan_name ILIKE '%intelligence%' THEN 'intelligence'
          WHEN v_plan_name ILIKE '%command%' THEN 'command'
          WHEN v_plan_name ILIKE '%enterprise%' THEN 'enterprise'
          ELSE v_plan_name
        END
      ) || '%'
      LIMIT 1;
    END IF;

    -- Final fallback
    IF v_user_limit IS NULL THEN
      v_user_limit := 1; -- default to most restrictive
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
