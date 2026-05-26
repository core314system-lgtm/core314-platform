-- Migration: 135_beta_program.sql
-- Description: Creates beta_applications table for invitation-only beta program
-- Author: Devin AI
-- Date: 2026-01-13

-- =============================================================================
-- BETA APPLICATIONS TABLE
-- =============================================================================
-- Stores beta tester applications for manual review
-- No auto-approval - all applications require manual review
-- Hard cap: 25 beta testers

CREATE TABLE IF NOT EXISTS beta_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Applicant Information
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  role_title TEXT NOT NULL,
  company_size TEXT NOT NULL CHECK (company_size IN ('1-10', '11-100', '100+')),
  tools_systems_used TEXT NOT NULL,
  biggest_challenge TEXT NOT NULL,
  why_beta_test TEXT NOT NULL,
  
  -- Application Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'waitlisted')),
  
  -- Review Information
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  
  -- Metadata
  ip_address TEXT,
  user_agent TEXT,
  source TEXT DEFAULT 'website',
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT beta_applications_email_unique UNIQUE (email)
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_beta_applications_status ON beta_applications(status);
CREATE INDEX IF NOT EXISTS idx_beta_applications_email ON beta_applications(email);
CREATE INDEX IF NOT EXISTS idx_beta_applications_created_at ON beta_applications(created_at DESC);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE beta_applications ENABLE ROW LEVEL SECURITY;

-- Service role has full access (for Edge Function inserts)
CREATE POLICY "service_role_full_access_beta_applications"
  ON beta_applications
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Admins can view and update all applications
CREATE POLICY "admins_can_view_beta_applications"
  ON beta_applications
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "admins_can_update_beta_applications"
  ON beta_applications
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- No public INSERT - all inserts go through Edge Function with service_role

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Function to approve a beta application
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
  
  -- Update the application
  UPDATE beta_applications
  SET 
    status = 'approved',
    reviewed_by = auth.uid(),
    reviewed_at = NOW(),
    review_notes = COALESCE(notes, review_notes),
    updated_at = NOW()
  WHERE id = application_id
  AND status = 'pending';
  
  RETURN FOUND;
END;
$$;

-- Function to reject a beta application
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
  
  -- Update the application
  UPDATE beta_applications
  SET 
    status = 'rejected',
    reviewed_by = auth.uid(),
    reviewed_at = NOW(),
    review_notes = COALESCE(notes, review_notes),
    updated_at = NOW()
  WHERE id = application_id
  AND status IN ('pending', 'waitlisted');
  
  RETURN FOUND;
END;
$$;

-- Function to waitlist a beta application
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
  
  -- Update the application
  UPDATE beta_applications
  SET 
    status = 'waitlisted',
    reviewed_by = auth.uid(),
    reviewed_at = NOW(),
    review_notes = COALESCE(notes, review_notes),
    updated_at = NOW()
  WHERE id = application_id
  AND status = 'pending';
  
  RETURN FOUND;
END;
$$;

-- =============================================================================
-- STATS VIEW
-- =============================================================================

CREATE OR REPLACE VIEW beta_application_stats AS
SELECT
  COUNT(*) FILTER (WHERE status = 'pending') AS pending_count,
  COUNT(*) FILTER (WHERE status = 'approved') AS approved_count,
  COUNT(*) FILTER (WHERE status = 'rejected') AS rejected_count,
  COUNT(*) FILTER (WHERE status = 'waitlisted') AS waitlisted_count,
  COUNT(*) AS total_count,
  25 - COUNT(*) FILTER (WHERE status = 'approved') AS spots_remaining,
  MIN(created_at) FILTER (WHERE status = 'pending') AS oldest_pending,
  MAX(created_at) AS latest_application
FROM beta_applications;

-- Grant access to stats view for admins
GRANT SELECT ON beta_application_stats TO authenticated;

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Update updated_at timestamp on changes
CREATE OR REPLACE FUNCTION update_beta_applications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_beta_applications_updated_at
  BEFORE UPDATE ON beta_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_beta_applications_updated_at();

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE beta_applications IS 'Stores beta tester applications for the invitation-only beta program';
COMMENT ON COLUMN beta_applications.status IS 'Application status: pending, approved, rejected, or waitlisted';
COMMENT ON COLUMN beta_applications.company_size IS 'Company size: 1-10, 11-100, or 100+';
COMMENT ON FUNCTION approve_beta_application IS 'Approves a beta application (admin only, enforces 25-tester cap)';
COMMENT ON FUNCTION reject_beta_application IS 'Rejects a beta application (admin only)';
COMMENT ON FUNCTION waitlist_beta_application IS 'Waitlists a beta application (admin only)';
COMMENT ON VIEW beta_application_stats IS 'Statistics view for beta applications (admin only)';
