-- =============================================================================
-- ALLOW RE-APPROVAL AFTER REVOKE
-- Updates RPC functions so admins can change their mind after revoking/rejecting.
-- Previously, approve only worked on 'pending', reject on 'pending'/'waitlisted',
-- and waitlist on 'pending'. Now all status transitions are allowed from any state.
-- =============================================================================

-- Allow approving from pending, waitlisted, OR rejected
CREATE OR REPLACE FUNCTION approve_beta_application(
  application_id UUID,
  notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  approved_count INTEGER;
BEGIN
  -- Check if we've hit the cap (25 beta testers)
  SELECT COUNT(*) INTO approved_count
  FROM beta_applications
  WHERE status = 'approved';
  
  IF approved_count >= 25 THEN
    RAISE EXCEPTION 'Beta program is at capacity (25 testers). Consider waitlisting instead.';
  END IF;
  
  -- Check if caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only admins can approve beta applications';
  END IF;
  
  -- Update the application (now accepts pending, waitlisted, OR rejected)
  UPDATE beta_applications
  SET 
    status = 'approved',
    reviewed_by = auth.uid(),
    reviewed_at = NOW(),
    review_notes = COALESCE(notes, review_notes),
    updated_at = NOW()
  WHERE id = application_id
  AND status IN ('pending', 'waitlisted', 'rejected');
  
  RETURN FOUND;
END;
$$;

-- Allow rejecting from pending, waitlisted, OR approved
CREATE OR REPLACE FUNCTION reject_beta_application(
  application_id UUID,
  notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only admins can reject beta applications';
  END IF;
  
  -- Update the application (now accepts pending, waitlisted, OR approved)
  UPDATE beta_applications
  SET 
    status = 'rejected',
    reviewed_by = auth.uid(),
    reviewed_at = NOW(),
    review_notes = COALESCE(notes, review_notes),
    updated_at = NOW()
  WHERE id = application_id
  AND status IN ('pending', 'waitlisted', 'approved');
  
  RETURN FOUND;
END;
$$;

-- Allow waitlisting from pending OR rejected
CREATE OR REPLACE FUNCTION waitlist_beta_application(
  application_id UUID,
  notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only admins can waitlist beta applications';
  END IF;
  
  -- Update the application (now accepts pending OR rejected)
  UPDATE beta_applications
  SET 
    status = 'waitlisted',
    reviewed_by = auth.uid(),
    reviewed_at = NOW(),
    review_notes = COALESCE(notes, review_notes),
    updated_at = NOW()
  WHERE id = application_id
  AND status IN ('pending', 'rejected');
  
  RETURN FOUND;
END;
$$;
