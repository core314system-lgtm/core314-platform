-- ============================================================================
-- Migration 111: User & Team Management - Production Ready
-- ============================================================================
-- This migration adds:
-- 1. Single-org constraint (users can only belong to one organization)
-- 2. Single-owner constraint (each org has exactly one owner)
-- 3. Hardened RLS policies for organization_members
-- 4. SQL functions for invite acceptance, member removal, ownership transfer
-- ============================================================================

-- ============================================================================
-- PART 1: Add Constraints
-- ============================================================================

-- Ensure each user can only belong to one organization
-- First check if constraint already exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'organization_members_user_id_key'
  ) THEN
    ALTER TABLE public.organization_members 
    ADD CONSTRAINT organization_members_user_id_key UNIQUE (user_id);
  END IF;
END $$;

-- Ensure each organization has exactly one owner
-- Create partial unique index for single owner per org
CREATE UNIQUE INDEX IF NOT EXISTS idx_organization_single_owner 
ON public.organization_members(organization_id) 
WHERE role = 'owner';

-- ============================================================================
-- PART 2: Harden RLS Policies for organization_members
-- ============================================================================

-- Drop the overly permissive "FOR ALL" policy
DROP POLICY IF EXISTS "Organization owners/admins can manage members" ON public.organization_members;

-- Create separate, more restrictive policies

-- SELECT: Any org member can view members of their org
CREATE POLICY "org_members_select_policy"
ON public.organization_members FOR SELECT
USING (
  organization_id IN (
    SELECT om.organization_id FROM public.organization_members om
    WHERE om.user_id = auth.uid()
  )
);

-- INSERT: Only service_role can insert (via Edge Functions)
-- No INSERT policy for authenticated users - all inserts go through Edge Functions

-- UPDATE: Only service_role can update (via Edge Functions)
-- No UPDATE policy for authenticated users - all updates go through Edge Functions

-- DELETE: Only service_role can delete (via Edge Functions)
-- No DELETE policy for authenticated users - all deletes go through Edge Functions

-- ============================================================================
-- PART 3: Harden RLS Policies for organization_invitations
-- ============================================================================

-- Drop existing policies and recreate with stricter rules
DROP POLICY IF EXISTS "Organization owners/admins can create invitations" ON public.organization_invitations;

-- SELECT: Members can view invitations for their org
-- (Already exists: "Organization members can view invitations")

-- INSERT/UPDATE/DELETE: Only via service_role (Edge Functions)
-- No direct client access for mutations

-- ============================================================================
-- PART 4: SQL Functions for Team Management
-- ============================================================================

-- Function to accept an organization invitation
CREATE OR REPLACE FUNCTION accept_organization_invite(
  p_token TEXT,
  p_user_id UUID
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  organization_id UUID,
  role TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invite RECORD;
  v_user_email TEXT;
  v_existing_membership RECORD;
BEGIN
  -- Get user's email
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = p_user_id;
  
  IF v_user_email IS NULL THEN
    RETURN QUERY SELECT false, 'User not found'::TEXT, NULL::UUID, NULL::TEXT;
    RETURN;
  END IF;
  
  -- Find the invitation
  SELECT * INTO v_invite
  FROM public.organization_invitations
  WHERE token = p_token
  FOR UPDATE;
  
  IF v_invite IS NULL THEN
    RETURN QUERY SELECT false, 'Invalid invite token'::TEXT, NULL::UUID, NULL::TEXT;
    RETURN;
  END IF;
  
  -- Check email matches (case-insensitive)
  IF lower(v_invite.email) != lower(v_user_email) THEN
    RETURN QUERY SELECT false, 'Email does not match invitation'::TEXT, NULL::UUID, NULL::TEXT;
    RETURN;
  END IF;
  
  -- Check if already accepted
  IF v_invite.status = 'accepted' THEN
    -- Check if user is already a member
    SELECT * INTO v_existing_membership
    FROM public.organization_members
    WHERE user_id = p_user_id AND organization_id = v_invite.organization_id;
    
    IF v_existing_membership IS NOT NULL THEN
      RETURN QUERY SELECT true, 'Already a member of this organization'::TEXT, v_invite.organization_id, v_existing_membership.role;
      RETURN;
    END IF;
  END IF;
  
  -- Check if expired
  IF v_invite.status = 'expired' OR v_invite.expires_at < NOW() THEN
    UPDATE public.organization_invitations
    SET status = 'expired', updated_at = NOW()
    WHERE id = v_invite.id AND status = 'pending';
    
    RETURN QUERY SELECT false, 'Invitation has expired'::TEXT, NULL::UUID, NULL::TEXT;
    RETURN;
  END IF;
  
  -- Check if pending
  IF v_invite.status != 'pending' THEN
    RETURN QUERY SELECT false, ('Invitation is ' || v_invite.status)::TEXT, NULL::UUID, NULL::TEXT;
    RETURN;
  END IF;
  
  -- Check if user already belongs to a different organization
  SELECT * INTO v_existing_membership
  FROM public.organization_members
  WHERE user_id = p_user_id;
  
  IF v_existing_membership IS NOT NULL AND v_existing_membership.organization_id != v_invite.organization_id THEN
    RETURN QUERY SELECT false, 'User already belongs to another organization'::TEXT, NULL::UUID, NULL::TEXT;
    RETURN;
  END IF;
  
  -- If user already belongs to this org, just mark invite as accepted
  IF v_existing_membership IS NOT NULL AND v_existing_membership.organization_id = v_invite.organization_id THEN
    UPDATE public.organization_invitations
    SET status = 'accepted', updated_at = NOW()
    WHERE id = v_invite.id;
    
    RETURN QUERY SELECT true, 'Already a member of this organization'::TEXT, v_invite.organization_id, v_existing_membership.role;
    RETURN;
  END IF;
  
  -- Create membership
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_invite.organization_id, p_user_id, v_invite.role);
  
  -- Mark invitation as accepted
  UPDATE public.organization_invitations
  SET status = 'accepted', updated_at = NOW()
  WHERE id = v_invite.id;
  
  RETURN QUERY SELECT true, 'Successfully joined organization'::TEXT, v_invite.organization_id, v_invite.role;
END;
$$;

-- Function to remove a member from an organization
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
  -- Admins can remove members and analysts, but not owners or other admins
  -- Members cannot remove anyone
  
  IF v_caller_membership.role = 'member' OR v_caller_membership.role = 'analyst' THEN
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

-- Function to transfer organization ownership
CREATE OR REPLACE FUNCTION transfer_organization_ownership(
  p_caller_id UUID,
  p_new_owner_id UUID,
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
  v_new_owner_membership RECORD;
  v_org RECORD;
BEGIN
  -- Get organization
  SELECT * INTO v_org
  FROM public.organizations
  WHERE id = p_organization_id;
  
  IF v_org IS NULL THEN
    RETURN QUERY SELECT false, 'Organization not found'::TEXT;
    RETURN;
  END IF;
  
  -- Verify caller is the current owner
  IF v_org.owner_id != p_caller_id THEN
    RETURN QUERY SELECT false, 'Only the current owner can transfer ownership'::TEXT;
    RETURN;
  END IF;
  
  -- Get caller's membership
  SELECT * INTO v_caller_membership
  FROM public.organization_members
  WHERE user_id = p_caller_id AND organization_id = p_organization_id;
  
  IF v_caller_membership IS NULL OR v_caller_membership.role != 'owner' THEN
    RETURN QUERY SELECT false, 'Caller is not the owner of this organization'::TEXT;
    RETURN;
  END IF;
  
  -- Get new owner's membership
  SELECT * INTO v_new_owner_membership
  FROM public.organization_members
  WHERE user_id = p_new_owner_id AND organization_id = p_organization_id;
  
  IF v_new_owner_membership IS NULL THEN
    RETURN QUERY SELECT false, 'New owner must be an existing member of the organization'::TEXT;
    RETURN;
  END IF;
  
  -- Cannot transfer to self
  IF p_caller_id = p_new_owner_id THEN
    RETURN QUERY SELECT false, 'Cannot transfer ownership to yourself'::TEXT;
    RETURN;
  END IF;
  
  -- Perform the transfer atomically
  -- 1. Update organizations.owner_id
  UPDATE public.organizations
  SET owner_id = p_new_owner_id, updated_at = NOW()
  WHERE id = p_organization_id;
  
  -- 2. Promote new owner's membership to 'owner'
  UPDATE public.organization_members
  SET role = 'owner'
  WHERE user_id = p_new_owner_id AND organization_id = p_organization_id;
  
  -- 3. Demote previous owner to 'admin'
  UPDATE public.organization_members
  SET role = 'admin'
  WHERE user_id = p_caller_id AND organization_id = p_organization_id;
  
  RETURN QUERY SELECT true, 'Ownership transferred successfully'::TEXT;
END;
$$;

-- Function to change a member's role
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
  -- Validate new role
  IF p_new_role NOT IN ('admin', 'analyst', 'member') THEN
    RETURN QUERY SELECT false, 'Invalid role. Must be admin, analyst, or member'::TEXT;
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

-- Function to get invite details by token (for public landing page)
CREATE OR REPLACE FUNCTION get_invite_details(p_token TEXT)
RETURNS TABLE (
  valid BOOLEAN,
  organization_name TEXT,
  invited_email TEXT,
  role TEXT,
  expires_at TIMESTAMPTZ,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invite RECORD;
  v_org RECORD;
BEGIN
  -- Find the invitation
  SELECT * INTO v_invite
  FROM public.organization_invitations
  WHERE token = p_token;
  
  IF v_invite IS NULL THEN
    RETURN QUERY SELECT false, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TIMESTAMPTZ, 'invalid'::TEXT;
    RETURN;
  END IF;
  
  -- Get organization name
  SELECT name INTO v_org
  FROM public.organizations
  WHERE id = v_invite.organization_id;
  
  -- Check if expired
  IF v_invite.expires_at < NOW() AND v_invite.status = 'pending' THEN
    UPDATE public.organization_invitations
    SET status = 'expired'
    WHERE id = v_invite.id;
    
    RETURN QUERY SELECT false, v_org.name, v_invite.email, v_invite.role, v_invite.expires_at, 'expired'::TEXT;
    RETURN;
  END IF;
  
  RETURN QUERY SELECT 
    v_invite.status = 'pending',
    v_org.name,
    v_invite.email,
    v_invite.role,
    v_invite.expires_at,
    v_invite.status;
END;
$$;

-- ============================================================================
-- PART 5: Grant Permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION accept_organization_invite(TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION accept_organization_invite(TEXT, UUID) TO authenticated;

GRANT EXECUTE ON FUNCTION remove_organization_member(UUID, UUID, UUID) TO service_role;

GRANT EXECUTE ON FUNCTION transfer_organization_ownership(UUID, UUID, UUID) TO service_role;

GRANT EXECUTE ON FUNCTION change_member_role(UUID, UUID, UUID, TEXT) TO service_role;

GRANT EXECUTE ON FUNCTION get_invite_details(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION get_invite_details(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_invite_details(TEXT) TO authenticated;

-- ============================================================================
-- PART 6: Add updated_at column to organization_invitations if missing
-- ============================================================================

ALTER TABLE public.organization_invitations 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON FUNCTION accept_organization_invite IS 'Accepts an organization invitation, validates token/email/expiry, and creates membership';
COMMENT ON FUNCTION remove_organization_member IS 'Removes a member from an organization with permission checks';
COMMENT ON FUNCTION transfer_organization_ownership IS 'Transfers organization ownership to another member';
COMMENT ON FUNCTION change_member_role IS 'Changes a member role (owner can change non-owner roles)';
COMMENT ON FUNCTION get_invite_details IS 'Gets invite details by token for public landing page';
