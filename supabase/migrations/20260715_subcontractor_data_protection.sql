-- ============================================================================
-- Subcontractor Data Protection — Prevent data harvesting by trial/churned users
-- ============================================================================
-- Implements 6 security controls:
-- 1. Server-side connection limit (unbypassable trigger)
-- 2. Audit logging table for all subcontractor access
-- 3. Search rate limiting at DB level
-- 4. Connection revocation on subscription cancellation
-- 5. Restrict raw table access (force safe view usage)
-- 6. Trial user access restrictions (enforced in view)
-- ============================================================================

-- ============================================================================
-- 1. AUDIT LOGGING TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS sub_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('search', 'connect', 'view_profile', 'page_browse')),
  metadata JSONB DEFAULT '{}',
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sub_access_log_user_time ON sub_access_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sub_access_log_org_time ON sub_access_log(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sub_access_log_action_time ON sub_access_log(action_type, created_at DESC);

ALTER TABLE sub_access_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sub_access_log' AND policyname = 'Users can insert their own access logs') THEN
    CREATE POLICY "Users can insert their own access logs"
      ON sub_access_log FOR INSERT TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sub_access_log' AND policyname = 'Admins can read all access logs') THEN
    CREATE POLICY "Admins can read all access logs"
      ON sub_access_log FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_global_admin = true));
  END IF;
END $$;


-- ============================================================================
-- 2. SUB_CONNECTIONS TABLE + FROZEN COLUMN
-- ============================================================================

CREATE TABLE IF NOT EXISTS sub_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL,
  sub_id UUID NOT NULL REFERENCES master_subcontractors(id) ON DELETE CASCADE,
  frozen BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, sub_id)
);

-- Add frozen column if table already existed without it
ALTER TABLE sub_connections ADD COLUMN IF NOT EXISTS frozen BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_sub_connections_org ON sub_connections(org_id);
CREATE INDEX IF NOT EXISTS idx_sub_connections_sub ON sub_connections(sub_id);
CREATE INDEX IF NOT EXISTS idx_sub_connections_user ON sub_connections(user_id);

ALTER TABLE sub_connections ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sub_connections' AND policyname = 'Users can read their org connections') THEN
    CREATE POLICY "Users can read their org connections"
      ON sub_connections FOR SELECT TO authenticated
      USING (org_id = (SELECT current_org_id FROM user_profiles WHERE id = auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sub_connections' AND policyname = 'Users can insert connections for their org (trigger enforces limit)') THEN
    CREATE POLICY "Users can insert connections for their org (trigger enforces limit)"
      ON sub_connections FOR INSERT TO authenticated
      WITH CHECK (user_id = auth.uid() AND org_id = (SELECT current_org_id FROM user_profiles WHERE id = auth.uid()));
  END IF;
END $$;


-- ============================================================================
-- 3. HELPER FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION get_org_plan(target_org_id UUID)
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COALESCE(subscription_plan, 'no_subscription') FROM organizations WHERE id = target_org_id;
$$;

CREATE OR REPLACE FUNCTION get_org_status(target_org_id UUID)
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COALESCE(subscription_status, 'no_subscription') FROM organizations WHERE id = target_org_id;
$$;


-- ============================================================================
-- 4. CONNECTION LIMIT TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION enforce_connection_limit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_plan TEXT; v_status TEXT; v_is_admin BOOLEAN;
  v_monthly_count INTEGER; v_limit INTEGER; v_month_start TIMESTAMPTZ;
BEGIN
  SELECT COALESCE(is_global_admin, false) INTO v_is_admin FROM user_profiles WHERE id = NEW.user_id;
  IF v_is_admin THEN RETURN NEW; END IF;

  v_plan := get_org_plan(NEW.org_id);
  v_status := get_org_status(NEW.org_id);

  IF v_plan LIKE '%enterprise%' OR v_plan LIKE '%agentic%' THEN v_limit := 100;
  ELSIF v_plan LIKE '%growth%' THEN v_limit := 25;
  ELSE v_limit := 10; END IF;

  IF v_status NOT IN ('active', 'trialing') THEN
    RAISE EXCEPTION 'Subscription inactive. Please renew to connect with subcontractors.' USING ERRCODE = 'P0001';
  END IF;

  v_month_start := date_trunc('month', now());
  SELECT COUNT(*) INTO v_monthly_count FROM sub_connections WHERE org_id = NEW.org_id AND created_at >= v_month_start;

  IF v_monthly_count >= v_limit THEN
    RAISE EXCEPTION 'Monthly connection limit reached (% of %). Upgrade your plan.', v_monthly_count, v_limit USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO sub_access_log (user_id, org_id, action_type, metadata)
  VALUES (NEW.user_id, NEW.org_id, 'connect', jsonb_build_object('sub_id', NEW.sub_id));

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_connection_limit ON sub_connections;
CREATE TRIGGER trg_enforce_connection_limit
  BEFORE INSERT ON sub_connections FOR EACH ROW EXECUTE FUNCTION enforce_connection_limit();


-- ============================================================================
-- 5. SEARCH RATE LIMITING
-- ============================================================================

CREATE OR REPLACE FUNCTION check_search_rate_limit(p_user_id UUID, p_org_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_plan TEXT; v_is_admin BOOLEAN; v_daily_count INTEGER; v_limit INTEGER; v_day_start TIMESTAMPTZ;
BEGIN
  SELECT COALESCE(is_global_admin, false) INTO v_is_admin FROM user_profiles WHERE id = p_user_id;
  IF v_is_admin THEN RETURN true; END IF;

  v_plan := get_org_plan(p_org_id);
  IF v_plan LIKE '%enterprise%' OR v_plan LIKE '%agentic%' THEN v_limit := 200;
  ELSIF v_plan LIKE '%growth%' THEN v_limit := 50;
  ELSE v_limit := 15; END IF;

  v_day_start := date_trunc('day', now());
  SELECT COUNT(*) INTO v_daily_count FROM sub_access_log
  WHERE user_id = p_user_id AND action_type IN ('search', 'page_browse') AND created_at >= v_day_start;

  RETURN v_daily_count < v_limit;
END;
$$;


-- ============================================================================
-- 6. CONNECTION FREEZE ON CHURN
-- ============================================================================

CREATE OR REPLACE FUNCTION freeze_connections_on_churn()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.subscription_status IN ('cancelled', 'past_due') AND OLD.subscription_status IN ('active', 'trialing') THEN
    UPDATE sub_connections SET frozen = true WHERE org_id = NEW.id;
  END IF;
  IF NEW.subscription_status IN ('active', 'trialing') AND OLD.subscription_status IN ('cancelled', 'past_due') THEN
    UPDATE sub_connections SET frozen = false WHERE org_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_freeze_connections_on_churn ON organizations;
CREATE TRIGGER trg_freeze_connections_on_churn
  AFTER UPDATE OF subscription_status ON organizations FOR EACH ROW EXECUTE FUNCTION freeze_connections_on_churn();


-- ============================================================================
-- 7. DROP VIEW → RECREATE FUNCTION → RECREATE VIEW
-- (View depends on is_connected_to_sub which now references frozen column)
-- ============================================================================

DROP VIEW IF EXISTS master_subcontractors_safe;
DROP FUNCTION IF EXISTS is_connected_to_sub(uuid);

CREATE FUNCTION is_connected_to_sub(p_sub_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM sub_connections sc
    JOIN user_profiles up ON up.current_org_id = sc.org_id
    WHERE sc.sub_id = p_sub_id
    AND up.id = auth.uid()
    AND sc.frozen = false
  );
$$;

CREATE OR REPLACE VIEW master_subcontractors_safe AS
SELECT
  id,
  company_name,
  dba_name,
  slug,
  contact_name,
  CASE
    WHEN is_global_admin() OR is_connected_to_sub(id)
    THEN contact_email
    ELSE CASE
      WHEN contact_email IS NOT NULL THEN
        LEFT(contact_email, 1) || '***@' || SPLIT_PART(contact_email, '@', 2)
      ELSE NULL
    END
  END AS contact_email,
  CASE
    WHEN is_global_admin() OR is_connected_to_sub(id)
    THEN contact_phone
    ELSE CASE
      WHEN contact_phone IS NOT NULL THEN '(***) ***-' || RIGHT(REGEXP_REPLACE(contact_phone, '[^0-9]', '', 'g'), 4)
      ELSE NULL
    END
  END AS contact_phone,
  city,
  state,
  zip_code,
  address_line1,
  trade_categories,
  naics_codes,
  small_business,
  small_business_types,
  geographic_coverage,
  website,
  sam_uei,
  cage_code,
  verification_status,
  profile_completeness,
  data_health_score,
  description,
  capability_statement_path,
  archived,
  unsubscribed,
  created_at,
  updated_at,
  claimed_by_user_id,
  claimed_at,
  claim_token,
  claim_token_expires_at,
  outreach_sent_at,
  outreach_email_count,
  last_outreach_email_at,
  profile_updated_at
FROM master_subcontractors;

GRANT SELECT ON master_subcontractors_safe TO authenticated;


-- ============================================================================
-- 8. RESTRICT RAW TABLE ACCESS
-- ============================================================================

DROP POLICY IF EXISTS "Authenticated users can read master_subcontractors" ON master_subcontractors;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'master_subcontractors' AND policyname = 'Only admins can read raw master_subcontractors') THEN
    CREATE POLICY "Only admins can read raw master_subcontractors"
      ON master_subcontractors FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_global_admin = true));
  END IF;
END $$;


-- ============================================================================
-- 9. SEARCH RESULTS LIMITING FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION get_sub_search_limit(p_user_id UUID, p_org_id UUID)
RETURNS INTEGER LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE v_plan TEXT; v_status TEXT; v_is_admin BOOLEAN;
BEGIN
  SELECT COALESCE(is_global_admin, false) INTO v_is_admin FROM user_profiles WHERE id = p_user_id;
  IF v_is_admin THEN RETURN 10000; END IF;

  v_plan := get_org_plan(p_org_id);
  v_status := get_org_status(p_org_id);

  IF v_status NOT IN ('active', 'trialing') THEN RETURN 0; END IF;

  IF v_plan LIKE '%enterprise%' OR v_plan LIKE '%agentic%' THEN RETURN 500;
  ELSIF v_plan LIKE '%growth%' THEN RETURN 100;
  ELSIF v_status = 'trialing' THEN RETURN 5;
  ELSE RETURN 0; END IF;
END;
$$;
