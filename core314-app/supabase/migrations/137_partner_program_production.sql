-- =============================================================================
-- MIGRATION 137: CORE314 PARTNER PROGRAM - PRODUCTION SYSTEM
-- =============================================================================
-- Extends the partner program to a full production-grade, self-executing system.
-- Implements: Automated scoring, decision engine, partner registry, deal registration,
-- customer attribution, Stripe revenue tracking, payout preparation, and audit logging.
-- =============================================================================

-- =============================================================================
-- 1. EXTEND PARTNER APPLICATIONS TABLE WITH SCORING FIELDS
-- =============================================================================

-- Add new required fields to partner_applications
ALTER TABLE partner_applications ADD COLUMN IF NOT EXISTS firm_type TEXT;
ALTER TABLE partner_applications ADD COLUMN IF NOT EXISTS typical_client_profile TEXT;
ALTER TABLE partner_applications ADD COLUMN IF NOT EXISTS tooling_decision_frequency TEXT;
ALTER TABLE partner_applications ADD COLUMN IF NOT EXISTS how_introduce_core314 TEXT;
ALTER TABLE partner_applications ADD COLUMN IF NOT EXISTS understands_not_affiliate BOOLEAN DEFAULT FALSE;
ALTER TABLE partner_applications ADD COLUMN IF NOT EXISTS agrees_rules_of_engagement BOOLEAN DEFAULT FALSE;

-- Scoring fields (0-5 each, total 0-25)
ALTER TABLE partner_applications ADD COLUMN IF NOT EXISTS score_partner_role INTEGER CHECK (score_partner_role >= 0 AND score_partner_role <= 5);
ALTER TABLE partner_applications ADD COLUMN IF NOT EXISTS score_client_relationship INTEGER CHECK (score_client_relationship >= 0 AND score_client_relationship <= 5);
ALTER TABLE partner_applications ADD COLUMN IF NOT EXISTS score_icp_alignment INTEGER CHECK (score_icp_alignment >= 0 AND score_icp_alignment <= 5);
ALTER TABLE partner_applications ADD COLUMN IF NOT EXISTS score_positioning_quality INTEGER CHECK (score_positioning_quality >= 0 AND score_positioning_quality <= 5);
ALTER TABLE partner_applications ADD COLUMN IF NOT EXISTS score_program_intent INTEGER CHECK (score_program_intent >= 0 AND score_program_intent <= 5);
ALTER TABLE partner_applications ADD COLUMN IF NOT EXISTS total_score INTEGER;

-- Red-flag detection
ALTER TABLE partner_applications ADD COLUMN IF NOT EXISTS red_flag_detected BOOLEAN DEFAULT FALSE;
ALTER TABLE partner_applications ADD COLUMN IF NOT EXISTS red_flag_keywords TEXT[];

-- Decision tracking
ALTER TABLE partner_applications ADD COLUMN IF NOT EXISTS decision_type TEXT CHECK (decision_type IN ('auto_approved', 'auto_rejected', 'escalated', 'manual_approved', 'manual_rejected'));
ALTER TABLE partner_applications ADD COLUMN IF NOT EXISTS decision_reason TEXT;
ALTER TABLE partner_applications ADD COLUMN IF NOT EXISTS decision_timestamp TIMESTAMPTZ;
ALTER TABLE partner_applications ADD COLUMN IF NOT EXISTS decision_actor TEXT; -- 'system' or user email

-- Escalation tracking
ALTER TABLE partner_applications ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ;
ALTER TABLE partner_applications ADD COLUMN IF NOT EXISTS escalation_sla_deadline TIMESTAMPTZ;

-- Rejection cooldown
ALTER TABLE partner_applications ADD COLUMN IF NOT EXISTS reapplication_allowed_after TIMESTAMPTZ;

-- Update status constraint to include 'escalated'
ALTER TABLE partner_applications DROP CONSTRAINT IF EXISTS partner_applications_status_check;
ALTER TABLE partner_applications ADD CONSTRAINT partner_applications_status_check 
    CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn', 'escalated'));

-- =============================================================================
-- 2. PARTNER MASTER REGISTRY
-- =============================================================================

CREATE TABLE IF NOT EXISTS partner_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Immutable Partner ID (Format: P-YYYY-XXXX)
    partner_id TEXT NOT NULL UNIQUE,
    
    -- Partner Information
    legal_name TEXT NOT NULL,
    partner_type TEXT NOT NULL CHECK (partner_type IN ('advisor', 'integrator', 'consultant', 'other')),
    primary_contact_name TEXT NOT NULL,
    primary_contact_email TEXT NOT NULL UNIQUE,
    
    -- Partner Tier & Status
    tier TEXT NOT NULL DEFAULT 'registered' CHECK (tier IN ('registered', 'silver', 'gold', 'platinum')),
    status TEXT NOT NULL DEFAULT 'pending_agreement' CHECK (status IN ('pending_agreement', 'active', 'suspended', 'terminated')),
    
    -- Revenue Share (always 25% per spec)
    revenue_share_percentage DECIMAL(5,2) NOT NULL DEFAULT 25.00 CHECK (revenue_share_percentage = 25.00),
    
    -- Dates
    effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
    agreement_signed_at TIMESTAMPTZ,
    enablement_sent_at TIMESTAMPTZ,
    
    -- Link to original application
    application_id UUID REFERENCES partner_applications(id) ON DELETE SET NULL,
    
    -- Metadata
    notes TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_partner_registry_partner_id ON partner_registry(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_registry_email ON partner_registry(primary_contact_email);
CREATE INDEX IF NOT EXISTS idx_partner_registry_status ON partner_registry(status);

-- Sequence for Partner ID generation
CREATE SEQUENCE IF NOT EXISTS partner_id_seq START WITH 1;

-- Function to generate Partner ID
CREATE OR REPLACE FUNCTION generate_partner_id()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    v_year TEXT;
    v_seq INTEGER;
BEGIN
    v_year := TO_CHAR(CURRENT_DATE, 'YYYY');
    v_seq := nextval('partner_id_seq');
    RETURN 'P-' || v_year || '-' || LPAD(v_seq::TEXT, 4, '0');
END;
$$;

-- =============================================================================
-- 3. DEAL REGISTRATION SYSTEM
-- =============================================================================

CREATE TABLE IF NOT EXISTS partner_deal_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Partner Reference
    partner_id TEXT NOT NULL REFERENCES partner_registry(partner_id) ON DELETE RESTRICT,
    
    -- Customer Information
    customer_legal_name TEXT NOT NULL,
    customer_domain TEXT NOT NULL,
    intro_date DATE NOT NULL,
    relationship_type TEXT NOT NULL CHECK (relationship_type IN ('new_business', 'existing_client', 'referral', 'co_sell')),
    
    -- Registration Status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
    approved_at TIMESTAMPTZ,
    approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    rejection_reason TEXT,
    
    -- Attribution Lock
    attribution_locked BOOLEAN DEFAULT FALSE,
    attribution_locked_at TIMESTAMPTZ,
    
    -- Notes
    notes TEXT,
    
    -- Ensure one partner per customer domain
    CONSTRAINT unique_customer_domain UNIQUE (customer_domain)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_deal_registrations_partner_id ON partner_deal_registrations(partner_id);
CREATE INDEX IF NOT EXISTS idx_deal_registrations_customer_domain ON partner_deal_registrations(customer_domain);
CREATE INDEX IF NOT EXISTS idx_deal_registrations_status ON partner_deal_registrations(status);

-- =============================================================================
-- 4. CUSTOMER-PARTNER ATTRIBUTION
-- =============================================================================

-- Add partner attribution fields to profiles/customers
-- (Assuming profiles table exists and represents customers)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS attributed_partner_id TEXT REFERENCES partner_registry(partner_id) ON DELETE SET NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS attribution_start_date DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS attribution_status TEXT DEFAULT 'none' CHECK (attribution_status IN ('none', 'active', 'removed'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS attribution_removal_reason TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS attribution_removal_approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS attribution_removal_timestamp TIMESTAMPTZ;

-- Index for partner attribution queries
CREATE INDEX IF NOT EXISTS idx_profiles_attributed_partner ON profiles(attributed_partner_id) WHERE attributed_partner_id IS NOT NULL;

-- =============================================================================
-- 5. PARTNER REVENUE LEDGER (Stripe Integration)
-- =============================================================================

CREATE TABLE IF NOT EXISTS partner_revenue_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Partner Reference
    partner_id TEXT NOT NULL REFERENCES partner_registry(partner_id) ON DELETE RESTRICT,
    
    -- Customer Reference
    customer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    customer_email TEXT,
    
    -- Stripe References (stubbed for now)
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    stripe_invoice_id TEXT,
    stripe_payment_intent_id TEXT,
    
    -- Revenue Details
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    gross_revenue_cents INTEGER NOT NULL,
    net_collected_cents INTEGER NOT NULL,
    refunds_cents INTEGER DEFAULT 0,
    chargebacks_cents INTEGER DEFAULT 0,
    
    -- Revenue Share Calculation
    revenue_share_percentage DECIMAL(5,2) NOT NULL DEFAULT 25.00,
    partner_share_cents INTEGER NOT NULL,
    
    -- Revenue Type
    revenue_type TEXT NOT NULL CHECK (revenue_type IN ('subscription', 'expansion', 'addon')),
    
    -- Processing Status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'paid', 'adjusted')),
    processed_at TIMESTAMPTZ,
    
    -- Audit
    calculation_notes TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_revenue_ledger_partner_id ON partner_revenue_ledger(partner_id);
CREATE INDEX IF NOT EXISTS idx_revenue_ledger_period ON partner_revenue_ledger(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_revenue_ledger_status ON partner_revenue_ledger(status);
CREATE INDEX IF NOT EXISTS idx_revenue_ledger_stripe_invoice ON partner_revenue_ledger(stripe_invoice_id);

-- =============================================================================
-- 6. PARTNER PAYOUT STATEMENTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS partner_payout_statements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Partner Reference
    partner_id TEXT NOT NULL REFERENCES partner_registry(partner_id) ON DELETE RESTRICT,
    
    -- Statement Period
    statement_period_start DATE NOT NULL,
    statement_period_end DATE NOT NULL,
    
    -- Amounts
    total_gross_revenue_cents INTEGER NOT NULL,
    total_net_collected_cents INTEGER NOT NULL,
    total_refunds_cents INTEGER DEFAULT 0,
    total_adjustments_cents INTEGER DEFAULT 0,
    total_partner_share_cents INTEGER NOT NULL,
    
    -- Customer Count
    active_customers_count INTEGER NOT NULL,
    new_customers_count INTEGER DEFAULT 0,
    churned_customers_count INTEGER DEFAULT 0,
    
    -- Status
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'finalized', 'sent', 'acknowledged')),
    finalized_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    acknowledged_at TIMESTAMPTZ,
    
    -- Export
    export_url TEXT,
    
    -- Unique constraint per partner per period
    CONSTRAINT unique_partner_statement_period UNIQUE (partner_id, statement_period_start, statement_period_end)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_payout_statements_partner_id ON partner_payout_statements(partner_id);
CREATE INDEX IF NOT EXISTS idx_payout_statements_period ON partner_payout_statements(statement_period_start, statement_period_end);

-- =============================================================================
-- 7. PARTNER AUDIT LOG (Immutable)
-- =============================================================================

CREATE TABLE IF NOT EXISTS partner_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- What was affected
    entity_type TEXT NOT NULL CHECK (entity_type IN ('application', 'registry', 'deal', 'attribution', 'revenue', 'payout')),
    entity_id UUID NOT NULL,
    
    -- What happened
    action TEXT NOT NULL,
    
    -- Who did it
    actor_type TEXT NOT NULL CHECK (actor_type IN ('system', 'admin', 'partner', 'customer')),
    actor_id TEXT, -- user ID or 'system'
    actor_email TEXT,
    
    -- Details
    inputs JSONB,
    outputs JSONB,
    decision TEXT,
    reason TEXT,
    
    -- Override tracking
    is_override BOOLEAN DEFAULT FALSE,
    override_approved_by TEXT,
    override_reason TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON partner_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON partner_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON partner_audit_log(actor_type, actor_id);

-- Make audit log append-only (no updates or deletes)
CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Partner audit log is immutable. Updates and deletes are not allowed.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_audit_log_update ON partner_audit_log;
CREATE TRIGGER prevent_audit_log_update
    BEFORE UPDATE OR DELETE ON partner_audit_log
    FOR EACH ROW
    EXECUTE FUNCTION prevent_audit_log_modification();

-- =============================================================================
-- 8. ROW LEVEL SECURITY FOR NEW TABLES
-- =============================================================================

-- Partner Registry RLS
ALTER TABLE partner_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to partner_registry"
    ON partner_registry FOR ALL TO service_role
    USING (true) WITH CHECK (true);

CREATE POLICY "Admins can read partner_registry"
    ON partner_registry FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE POLICY "Admins can update partner_registry"
    ON partner_registry FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- Deal Registrations RLS
ALTER TABLE partner_deal_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to deal_registrations"
    ON partner_deal_registrations FOR ALL TO service_role
    USING (true) WITH CHECK (true);

CREATE POLICY "Admins can read deal_registrations"
    ON partner_deal_registrations FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE POLICY "Admins can manage deal_registrations"
    ON partner_deal_registrations FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- Revenue Ledger RLS
ALTER TABLE partner_revenue_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to revenue_ledger"
    ON partner_revenue_ledger FOR ALL TO service_role
    USING (true) WITH CHECK (true);

CREATE POLICY "Admins can read revenue_ledger"
    ON partner_revenue_ledger FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- Payout Statements RLS
ALTER TABLE partner_payout_statements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to payout_statements"
    ON partner_payout_statements FOR ALL TO service_role
    USING (true) WITH CHECK (true);

CREATE POLICY "Admins can read payout_statements"
    ON partner_payout_statements FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- Audit Log RLS
ALTER TABLE partner_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to audit_log"
    ON partner_audit_log FOR ALL TO service_role
    USING (true) WITH CHECK (true);

CREATE POLICY "Admins can read audit_log"
    ON partner_audit_log FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- =============================================================================
-- 9. HELPER FUNCTIONS
-- =============================================================================

-- Function to create partner registry entry from approved application
CREATE OR REPLACE FUNCTION create_partner_from_application(
    p_application_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_app RECORD;
    v_partner_id TEXT;
BEGIN
    -- Get application
    SELECT * INTO v_app FROM partner_applications WHERE id = p_application_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Application not found';
    END IF;
    
    IF v_app.status != 'approved' THEN
        RAISE EXCEPTION 'Application must be approved first';
    END IF;
    
    -- Check if partner already exists
    IF EXISTS (SELECT 1 FROM partner_registry WHERE application_id = p_application_id) THEN
        SELECT partner_id INTO v_partner_id FROM partner_registry WHERE application_id = p_application_id;
        RETURN v_partner_id;
    END IF;
    
    -- Generate Partner ID
    v_partner_id := generate_partner_id();
    
    -- Create registry entry
    INSERT INTO partner_registry (
        partner_id,
        legal_name,
        partner_type,
        primary_contact_name,
        primary_contact_email,
        application_id
    ) VALUES (
        v_partner_id,
        v_app.company,
        COALESCE(v_app.firm_type, 'consultant'),
        v_app.full_name,
        v_app.email,
        p_application_id
    );
    
    -- Log to audit
    INSERT INTO partner_audit_log (
        entity_type, entity_id, action, actor_type, actor_id,
        inputs, outputs, decision
    ) VALUES (
        'registry', p_application_id, 'partner_created', 'system', 'system',
        jsonb_build_object('application_id', p_application_id),
        jsonb_build_object('partner_id', v_partner_id),
        'Partner registry entry created from approved application'
    );
    
    RETURN v_partner_id;
END;
$$;

-- Function to remove customer attribution (requires executive override)
CREATE OR REPLACE FUNCTION remove_customer_attribution(
    p_customer_id UUID,
    p_reason TEXT,
    p_override_approved_by TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_is_admin BOOLEAN;
    v_old_partner_id TEXT;
BEGIN
    -- Check if caller is admin
    SELECT EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role = 'admin'
    ) INTO v_is_admin;
    
    IF NOT v_is_admin THEN
        RAISE EXCEPTION 'Only admins can remove customer attribution';
    END IF;
    
    -- Get current attribution
    SELECT attributed_partner_id INTO v_old_partner_id
    FROM profiles WHERE id = p_customer_id;
    
    IF v_old_partner_id IS NULL THEN
        RAISE EXCEPTION 'Customer has no attribution to remove';
    END IF;
    
    -- Update customer
    UPDATE profiles SET
        attribution_status = 'removed',
        attribution_removal_reason = p_reason,
        attribution_removal_approved_by = auth.uid(),
        attribution_removal_timestamp = NOW()
    WHERE id = p_customer_id;
    
    -- Log to audit (with override tracking)
    INSERT INTO partner_audit_log (
        entity_type, entity_id, action, actor_type, actor_id, actor_email,
        inputs, decision, is_override, override_approved_by, override_reason
    ) VALUES (
        'attribution', p_customer_id, 'attribution_removed', 'admin', auth.uid()::TEXT, 
        (SELECT email FROM profiles WHERE id = auth.uid()),
        jsonb_build_object('customer_id', p_customer_id, 'old_partner_id', v_old_partner_id),
        'Customer attribution removed',
        TRUE, p_override_approved_by, p_reason
    );
    
    RETURN TRUE;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION create_partner_from_application TO service_role;
GRANT EXECUTE ON FUNCTION remove_customer_attribution TO authenticated;

-- =============================================================================
-- 10. VIEWS FOR ADMIN DASHBOARD
-- =============================================================================

-- Partner Program Overview
CREATE OR REPLACE VIEW partner_program_overview AS
SELECT
    (SELECT COUNT(*) FROM partner_registry WHERE status = 'active') AS active_partners,
    (SELECT COUNT(*) FROM partner_registry WHERE status = 'pending_agreement') AS pending_agreement,
    (SELECT COUNT(*) FROM partner_applications WHERE status = 'pending') AS pending_applications,
    (SELECT COUNT(*) FROM partner_applications WHERE status = 'escalated') AS escalated_applications,
    (SELECT COUNT(*) FROM partner_deal_registrations WHERE status = 'pending') AS pending_deals,
    (SELECT COUNT(*) FROM partner_deal_registrations WHERE status = 'approved') AS approved_deals,
    (SELECT COALESCE(SUM(total_partner_share_cents), 0) FROM partner_payout_statements WHERE status = 'finalized') AS total_partner_payouts_cents,
    (SELECT COUNT(DISTINCT attributed_partner_id) FROM profiles WHERE attributed_partner_id IS NOT NULL AND attribution_status = 'active') AS partners_with_customers;

GRANT SELECT ON partner_program_overview TO authenticated;

-- Partner Revenue Summary
CREATE OR REPLACE VIEW partner_revenue_summary AS
SELECT
    pr.partner_id,
    pr.legal_name,
    pr.status,
    COUNT(DISTINCT prl.customer_id) AS customer_count,
    COALESCE(SUM(prl.net_collected_cents), 0) AS total_revenue_cents,
    COALESCE(SUM(prl.partner_share_cents), 0) AS total_partner_share_cents,
    MAX(prl.period_end) AS last_revenue_date
FROM partner_registry pr
LEFT JOIN partner_revenue_ledger prl ON pr.partner_id = prl.partner_id
GROUP BY pr.partner_id, pr.legal_name, pr.status;

GRANT SELECT ON partner_revenue_summary TO authenticated;

-- =============================================================================
-- 11. UPDATED_AT TRIGGERS FOR NEW TABLES
-- =============================================================================

CREATE OR REPLACE FUNCTION update_partner_tables_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_partner_registry_updated_at ON partner_registry;
CREATE TRIGGER trigger_partner_registry_updated_at
    BEFORE UPDATE ON partner_registry
    FOR EACH ROW
    EXECUTE FUNCTION update_partner_tables_updated_at();

DROP TRIGGER IF EXISTS trigger_deal_registrations_updated_at ON partner_deal_registrations;
CREATE TRIGGER trigger_deal_registrations_updated_at
    BEFORE UPDATE ON partner_deal_registrations
    FOR EACH ROW
    EXECUTE FUNCTION update_partner_tables_updated_at();

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
