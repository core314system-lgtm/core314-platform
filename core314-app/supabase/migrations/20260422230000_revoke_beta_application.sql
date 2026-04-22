-- =============================================================================
-- REVOKE BETA APPLICATION
-- Allows admins to revoke an approved beta application, freeing the spot.
-- Resets status back to 'rejected' (with review notes) and cleans up lifecycle.
-- =============================================================================

CREATE OR REPLACE FUNCTION revoke_beta_application(
  application_id UUID,
  notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_email TEXT;
  v_user_id UUID;
BEGIN
  -- Check if caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only admins can revoke beta applications';
  END IF;

  -- Get the application email before revoking
  SELECT email INTO v_email
  FROM beta_applications
  WHERE id = application_id
  AND status = 'approved';

  IF v_email IS NULL THEN
    RETURN FALSE; -- Application not found or not in approved status
  END IF;

  -- Update the application status to rejected
  UPDATE beta_applications
  SET
    status = 'rejected',
    reviewed_by = auth.uid(),
    reviewed_at = NOW(),
    review_notes = COALESCE(notes, 'Approval revoked by admin'),
    updated_at = NOW()
  WHERE id = application_id
  AND status = 'approved';

  -- Clean up lifecycle record if one exists for this user
  SELECT p.id INTO v_user_id
  FROM profiles p
  WHERE p.email = v_email;

  IF v_user_id IS NOT NULL THEN
    DELETE FROM beta_tester_lifecycle
    WHERE user_id = v_user_id;
  END IF;

  RETURN TRUE;
END;
$$;

-- Grant execute to authenticated users (admin check is inside the function)
GRANT EXECUTE ON FUNCTION revoke_beta_application(UUID, TEXT) TO authenticated;
