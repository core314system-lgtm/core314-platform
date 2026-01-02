-- ============================================================================
-- Migration 130: Viewer Role Permissions Enforcement
-- ============================================================================
-- This migration updates SQL functions to properly handle the Viewer role:
-- 1. Updates change_member_role to accept 'viewer' as a valid role
-- 2. Updates remove_organization_member to explicitly block viewer from removing members
-- ============================================================================

-- Update change_member_role to accept 'viewer' as a valid role
CREATE OR REPLACE FUNCTION change_member_role(
  p_caller_id UUID,
  p_target_user_id UUID,
  p_organization_id UUID,
  p_new_role TEXT
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_membership RECORD;
  v_target_membership RECORD;
BEGIN
  -- Validate new role (now includes 'viewer')
  IF p_new_role NOT IN ('admin', 'analyst', 'member', 'viewer') THEN
    RETURN QUERY SELECT false, 'Invalid role. Must be admin, analyst, member, or viewer'::TEXT;
    RETURN;
  END IF;
  
  -- Get caller's membership
  SELECT * INTO v_caller_membership
  FROM public.organization_members
  WHERE user_id = p_caller_id AND organization_id = p_organization_id;
  
  IF v_caller_membership IS NULL THEN
    RETURN QUERY SELECT false, 'Caller is not a member of this organization'::TEXT;
    RETURN;
  END IF;
  
  -- Get target's membership
  SELECT * INTO v_target_membership
  FROM public.organization_members
  WHERE user_id = p_target_user_id AND organization_id = p_organization_id;
  
  IF v_target_membership IS NULL THEN
    RETURN QUERY SELECT false, 'Target user is not a member of this organization'::TEXT;
    RETURN;
  END IF;
  
  -- Check permissions
  -- Only owners can change roles
  IF v_caller_membership.role != 'owner' THEN
    RETURN QUERY SELECT false, 'Only owners can change member roles'::TEXT;
    RETURN;
  END IF;
  
  -- Cannot change owner's role (use transfer ownership instead)
  IF v_target_membership.role = 'owner' THEN
    RETURN QUERY SELECT false, 'Cannot change owner role. Use transfer ownership instead.'::TEXT;
    RETURN;
  END IF;
  
  -- Cannot change own role
  IF p_caller_id = p_target_user_id THEN
    RETURN QUERY SELECT false, 'Cannot change your own role'::TEXT;
    RETURN;
  END IF;
  
  -- Update the role
  UPDATE public.organization_members
  SET role = p_new_role
  WHERE user_id = p_target_user_id AND organization_id = p_organization_id;
  
  RETURN QUERY SELECT true, 'Role updated successfully'::TEXT;
END;
$$;

-- Update remove_organization_member to explicitly block viewer role
CREATE OR REPLACE FUNCTION remove_organization_member(
  p_caller_id UUID,
  p_target_user_id UUID,
  p_organization_id UUID
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_membership RECORD;
  v_target_membership RECORD;
  v_owner_count INTEGER;
BEGIN
  -- Get caller's membership
  SELECT * INTO v_caller_membership
  FROM public.organization_members
  WHERE user_id = p_caller_id AND organization_id = p_organization_id;
  
  IF v_caller_membership IS NULL THEN
    RETURN QUERY SELECT false, 'Caller is not a member of this organization'::TEXT;
    RETURN;
  END IF;
  
  -- Get target's membership
  SELECT * INTO v_target_membership
  FROM public.organization_members
  WHERE user_id = p_target_user_id AND organization_id = p_organization_id;
  
  IF v_target_membership IS NULL THEN
    RETURN QUERY SELECT false, 'Target user is not a member of this organization'::TEXT;
    RETURN;
  END IF;
  
  -- Check permissions
  -- Owners can remove anyone except themselves (unless transferring ownership first)
  -- Admins can remove members, analysts, and viewers, but not owners or other admins
  -- Members, analysts, and viewers cannot remove anyone
  
  IF v_caller_membership.role IN ('member', 'analyst', 'viewer') THEN
    RETURN QUERY SELECT false, 'Insufficient permissions to remove members'::TEXT;
    RETURN;
  END IF;
  
  IF v_caller_membership.role = 'admin' THEN
    IF v_target_membership.role IN ('owner', 'admin') THEN
      RETURN QUERY SELECT false, 'Admins cannot remove owners or other admins'::TEXT;
      RETURN;
    END IF;
  END IF;
  
  -- Prevent removing the only owner
  IF v_target_membership.role = 'owner' THEN
    SELECT COUNT(*) INTO v_owner_count
    FROM public.organization_members
    WHERE organization_id = p_organization_id AND role = 'owner';
    
    IF v_owner_count <= 1 THEN
      RETURN QUERY SELECT false, 'Cannot remove the only owner. Transfer ownership first.'::TEXT;
      RETURN;
    END IF;
  END IF;
  
  -- Prevent self-removal for owners
  IF p_caller_id = p_target_user_id AND v_caller_membership.role = 'owner' THEN
    RETURN QUERY SELECT false, 'Owners cannot remove themselves. Transfer ownership first.'::TEXT;
    RETURN;
  END IF;
  
  -- Remove the membership
  DELETE FROM public.organization_members
  WHERE user_id = p_target_user_id AND organization_id = p_organization_id;
  
  RETURN QUERY SELECT true, 'Member removed successfully'::TEXT;
END;
$$;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON FUNCTION change_member_role IS 'Changes a member role (owner can change non-owner roles, now includes viewer)';
COMMENT ON FUNCTION remove_organization_member IS 'Removes a member from an organization with permission checks (viewer explicitly blocked)';
