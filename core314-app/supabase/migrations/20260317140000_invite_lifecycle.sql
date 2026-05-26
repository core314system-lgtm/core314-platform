-- ============================================================================
-- Migration: Invitation Lifecycle Management
-- ============================================================================
-- Adds:
-- 1. 'cancelled' status to organization_invitations check constraint
-- 2. sent_at column to track when email was last sent (for resend)
-- 3. Updated get_invite_details function to handle cancelled status
-- ============================================================================

-- Step 1: Add 'cancelled' to the status check constraint
-- Drop existing constraint and recreate with 'cancelled' included
ALTER TABLE public.organization_invitations DROP CONSTRAINT IF EXISTS organization_invitations_status_check;
ALTER TABLE public.organization_invitations
  ADD CONSTRAINT organization_invitations_status_check
  CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled'));

-- Step 2: Add sent_at column to track last email send time
ALTER TABLE public.organization_invitations
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ DEFAULT NOW();

-- Backfill sent_at from created_at for existing rows
UPDATE public.organization_invitations
  SET sent_at = created_at
  WHERE sent_at IS NULL;

-- Step 3: Update get_invite_details to handle cancelled status
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

  -- Check if cancelled
  IF v_invite.status = 'cancelled' THEN
    RETURN QUERY SELECT false, v_org.name, v_invite.email, v_invite.role, v_invite.expires_at, 'cancelled'::TEXT;
    RETURN;
  END IF;

  -- Check if expired
  IF v_invite.expires_at < NOW() AND v_invite.status = 'pending' THEN
    UPDATE public.organization_invitations
    SET status = 'expired', updated_at = NOW()
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

-- Step 4: Grant permissions (re-grant to be safe)
GRANT EXECUTE ON FUNCTION get_invite_details(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION get_invite_details(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_invite_details(TEXT) TO authenticated;

-- Step 5: Grant UPDATE on organization_invitations to service_role for cancel/resend
GRANT UPDATE ON public.organization_invitations TO service_role;
