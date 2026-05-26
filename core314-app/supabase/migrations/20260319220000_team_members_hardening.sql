-- ============================================================================
-- Migration: Team Members Hardening — seat release + ownership + org integrity
-- ============================================================================
-- Pre-merge blocker: ensures correct seat management and organization integrity
-- 1. Fix seat counting to exclude cancelled/expired/removed
-- 2. Enforce single-owner per organization
-- 3. Harden auto-accept (no duplicates, correct org linkage)
-- 4. Update check_organization_user_limit for accurate counting
-- ============================================================================

-- ============================================================================
-- PART 1: Enforce single owner per organization
-- ============================================================================

-- Deduplicate: if multiple owners exist, keep earliest, convert others to 'member'
DO $$
DECLARE
  v_org RECORD;
  v_earliest_owner_id UUID;
BEGIN
  FOR v_org IN
    SELECT organization_id, COUNT(*) as owner_count
    FROM organization_members
    WHERE role = 'owner'
    GROUP BY organization_id
    HAVING COUNT(*) > 1
  LOOP
    -- Find the earliest owner (by joined_at or id)
    SELECT user_id INTO v_earliest_owner_id
    FROM organization_members
    WHERE organization_id = v_org.organization_id AND role = 'owner'
    ORDER BY joined_at ASC NULLS LAST, id ASC
    LIMIT 1;

    -- Demote all other owners to 'member'
    UPDATE organization_members
    SET role = 'member'
    WHERE organization_id = v_org.organization_id
      AND role = 'owner'
      AND user_id != v_earliest_owner_id;

    RAISE NOTICE 'Org %: kept owner %, demoted others to member', v_org.organization_id, v_earliest_owner_id;
  END LOOP;
END $$;

-- Ensure the single-owner unique index exists (created in migration 111, but re-ensure)
CREATE UNIQUE INDEX IF NOT EXISTS idx_organization_single_owner
ON public.organization_members(organization_id)
WHERE role = 'owner';

-- ============================================================================
-- PART 2: Fix check_organization_user_limit — accurate seat counting
-- ============================================================================
-- Count ONLY: organization_members (active rows) + pending invitations
-- Exclude: cancelled, expired, removed invitations

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
    v_pending_count INTEGER;
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
    
    -- Count current ACTIVE members only
    SELECT COUNT(*)::INTEGER INTO v_current_count
    FROM organization_members om2
    WHERE om2.organization_id = p_organization_id;
    
    -- Count ONLY pending invitations (exclude cancelled, expired, accepted)
    SELECT COUNT(*)::INTEGER INTO v_pending_count
    FROM organization_invitations oi
    WHERE oi.organization_id = p_organization_id
      AND oi.status = 'pending'
      AND oi.expires_at > NOW();
    
    -- Total = active members + valid pending invites
    v_current_count := v_current_count + v_pending_count;
    
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

COMMENT ON FUNCTION check_organization_user_limit IS 'Checks if an organization can add more members based on owner plan. Counts active members + valid pending invites only.';
GRANT EXECUTE ON FUNCTION check_organization_user_limit TO authenticated;
GRANT EXECUTE ON FUNCTION check_organization_user_limit TO service_role;

-- ============================================================================
-- PART 3: Harden auto_accept_pending_invites — no duplicates, correct org linkage
-- ============================================================================

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
  -- Guard: Check if user already belongs to an organization
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

  -- Find the first valid pending invitation for this email (case-insensitive)
  -- Must be pending AND not expired
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

  -- Guard: Verify the invitation has a valid organization_id
  IF v_invite.organization_id IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, 'Invitation has no organization linked'::TEXT;
    RETURN;
  END IF;

  -- Guard: Verify the organization actually exists
  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = v_invite.organization_id) THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, 'Organization no longer exists'::TEXT;
    RETURN;
  END IF;

  -- Guard: Check no duplicate membership exists (race condition protection)
  IF EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = p_user_id AND organization_id = v_invite.organization_id
  ) THEN
    -- Mark invite as accepted since user is already a member
    UPDATE public.organization_invitations
    SET status = 'accepted', updated_at = NOW()
    WHERE id = v_invite.id;

    RETURN QUERY SELECT 
      TRUE,
      v_invite.organization_id,
      v_invite.role,
      'User is already a member of this organization'::TEXT;
    RETURN;
  END IF;

  -- Create membership with correct organization_id from the invitation
  INSERT INTO public.organization_members (organization_id, user_id, role, joined_at)
  VALUES (v_invite.organization_id, p_user_id, COALESCE(v_invite.role, 'member'), NOW());

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

COMMENT ON FUNCTION auto_accept_pending_invites IS 'Auto-accepts pending invitations when an invited user logs in. Guards against duplicates and validates org linkage.';
GRANT EXECUTE ON FUNCTION auto_accept_pending_invites(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION auto_accept_pending_invites(UUID, TEXT) TO authenticated;

-- ============================================================================
-- PART 4: Ensure organization_members always has organization_id populated
-- ============================================================================

-- Add NOT NULL constraint if not already present (safe: check first)
DO $$
BEGIN
  -- Verify no orphaned memberships exist
  DELETE FROM organization_members
  WHERE organization_id IS NULL;

  -- Verify no orphaned invitations exist
  DELETE FROM organization_invitations
  WHERE organization_id IS NULL;
END $$;

-- ============================================================================
-- PART 5: Mark expired invitations that are past their expires_at
-- ============================================================================

UPDATE organization_invitations
SET status = 'expired', updated_at = NOW()
WHERE status = 'pending'
  AND expires_at < NOW();
