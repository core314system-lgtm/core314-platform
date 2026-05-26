-- =============================================================================
-- MIGRATION 134: CORE314 PARTNER PROGRAM
-- =============================================================================
-- Creates the partner application intake system for the invite-only partner program.
-- Applications are stored with status='pending' for admin review.
-- =============================================================================

-- =============================================================================
-- 1. PARTNER APPLICATIONS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS partner_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Applicant Information
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    company TEXT NOT NULL,
    role_title TEXT NOT NULL,
    years_experience INTEGER NOT NULL CHECK (years_experience >= 0),
    primary_industry TEXT NOT NULL,
    
    -- Long-form Responses
    how_advises_orgs TEXT NOT NULL,
    how_core314_fits TEXT NOT NULL,
    
    -- Disqualification Questions (must all be TRUE to submit)
    not_influencer_marketer BOOLEAN NOT NULL DEFAULT FALSE,
    will_not_misrepresent_ai BOOLEAN NOT NULL DEFAULT FALSE,
    understands_decision_intelligence BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Legal Acknowledgments (must all be TRUE to submit)
    ack_not_agent BOOLEAN NOT NULL DEFAULT FALSE,
    ack_no_misrepresent BOOLEAN NOT NULL DEFAULT FALSE,
    ack_no_entitlement BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Application Status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    review_notes TEXT,
    
    -- Metadata
    ip_address TEXT,
    user_agent TEXT,
    
    -- Constraints
    CONSTRAINT valid_disqualification_answers CHECK (
        not_influencer_marketer = TRUE AND
        will_not_misrepresent_ai = TRUE AND
        understands_decision_intelligence = TRUE
    ),
    CONSTRAINT valid_legal_acknowledgments CHECK (
        ack_not_agent = TRUE AND
        ack_no_misrepresent = TRUE AND
        ack_no_entitlement = TRUE
    )
);

-- Create index for admin queries
CREATE INDEX IF NOT EXISTS idx_partner_applications_status ON partner_applications(status);
CREATE INDEX IF NOT EXISTS idx_partner_applications_created_at ON partner_applications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_partner_applications_email ON partner_applications(email);

-- =============================================================================
-- 2. ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE partner_applications ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (for Edge Function inserts)
CREATE POLICY "Service role full access to partner_applications"
    ON partner_applications
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Admins can read all applications
CREATE POLICY "Admins can read partner_applications"
    ON partner_applications
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Admins can update applications (for approval/rejection)
CREATE POLICY "Admins can update partner_applications"
    ON partner_applications
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
-- 3. UPDATED_AT TRIGGER
-- =============================================================================

CREATE OR REPLACE FUNCTION update_partner_applications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_partner_applications_updated_at ON partner_applications;
CREATE TRIGGER trigger_partner_applications_updated_at
    BEFORE UPDATE ON partner_applications
    FOR EACH ROW
    EXECUTE FUNCTION update_partner_applications_updated_at();

-- =============================================================================
-- 4. ADMIN HELPER FUNCTIONS
-- =============================================================================

-- Function to approve a partner application
CREATE OR REPLACE FUNCTION approve_partner_application(
    p_application_id UUID,
    p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_is_admin BOOLEAN;
BEGIN
    -- Check if caller is admin
    SELECT EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role = 'admin'
    ) INTO v_is_admin;
    
    IF NOT v_is_admin THEN
        RAISE EXCEPTION 'Only admins can approve partner applications';
    END IF;
    
    UPDATE partner_applications
    SET 
        status = 'approved',
        reviewed_at = NOW(),
        reviewed_by = auth.uid(),
        review_notes = p_notes
    WHERE id = p_application_id
    AND status = 'pending';
    
    RETURN FOUND;
END;
$$;

-- Function to reject a partner application
CREATE OR REPLACE FUNCTION reject_partner_application(
    p_application_id UUID,
    p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_is_admin BOOLEAN;
BEGIN
    -- Check if caller is admin
    SELECT EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role = 'admin'
    ) INTO v_is_admin;
    
    IF NOT v_is_admin THEN
        RAISE EXCEPTION 'Only admins can reject partner applications';
    END IF;
    
    UPDATE partner_applications
    SET 
        status = 'rejected',
        reviewed_at = NOW(),
        reviewed_by = auth.uid(),
        review_notes = p_notes
    WHERE id = p_application_id
    AND status = 'pending';
    
    RETURN FOUND;
END;
$$;

-- Grant execute to authenticated users (function checks admin internally)
GRANT EXECUTE ON FUNCTION approve_partner_application TO authenticated;
GRANT EXECUTE ON FUNCTION reject_partner_application TO authenticated;

-- =============================================================================
-- 5. PARTNER APPLICATION STATS VIEW (for admin dashboard)
-- =============================================================================

CREATE OR REPLACE VIEW partner_application_stats AS
SELECT
    COUNT(*) FILTER (WHERE status = 'pending') AS pending_count,
    COUNT(*) FILTER (WHERE status = 'approved') AS approved_count,
    COUNT(*) FILTER (WHERE status = 'rejected') AS rejected_count,
    COUNT(*) FILTER (WHERE status = 'withdrawn') AS withdrawn_count,
    COUNT(*) AS total_count,
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') AS last_7_days,
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') AS last_30_days
FROM partner_applications;

-- Grant select on view to authenticated (view will respect RLS on underlying table)
GRANT SELECT ON partner_application_stats TO authenticated;

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
