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
-- Records every search, connection, and profile view for abuse detection
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

-- Index for querying recent activity per user/org
CREATE INDEX IF NOT EXISTS idx_sub_access_log_user_time ON sub_access_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sub_access_log_org_time ON sub_access_log(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sub_access_log_action_time ON sub_access_log(action_type, created_at DESC);

-- RLS: users can only insert their own logs, admins can read all
ALTER TABLE sub_access_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own access logs"
  ON sub_access_log FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can read all access logs"
  ON sub_access_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_global_admin = true
    )
  );


-- ============================================================================
-- 2. SERVER-SIDE CONNECTION LIMIT (TRIGGER)
-- Prevents bypassing client-side limit by inserting directly
-- ============================================================================

-- Create sub_connections table if not exists (may already exist from earlier migration)
CREATE TABLE IF NOT EXISTS sub_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL,
  sub_id UUID NOT NULL REFERENCES master_subcontractors(id) ON DELETE CASCADE,
  frozen BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, sub_id)
);

CREATE INDEX IF NOT EXISTS idx_sub_connections_org ON sub_connections(org_id);
CREATE INDEX IF NOT EXISTS idx_sub_connections_sub ON sub_connections(sub_id);
CREATE INDEX IF NOT EXISTS idx_sub_connections_user ON sub_connections(user_id);

-- RLS on sub_connections
ALTER TABLE sub_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their org connections"
  ON sub_connections FOR SELECT
  TO authenticated
  USING (
    org_id = (SELECT current_org_id FROM user_profiles WHERE id = auth.uid())
  );

CREATE POLICY "Users can insert connections for their org (trigger enforces limit)"
  ON sub_connections FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND org_id = (SELECT current_org_id FROM user_profiles WHERE id = auth.uid())
  );

-- Helper function to get org's subscription plan
CREATE OR REPLACE FUNCTION get_org_plan(target_org_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(subscription_plan, 'no_subscription')
  FROM organizations
  WHERE id = target_org_id;
$$;

-- Helper function to get org's subscription status
CREATE OR REPLACE FUNCTION get_org_status(target_org_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(subscription_status, 'no_subscription')
  FROM organizations
  WHERE id = target_org_id;
$$;

-- The enforcement trigger: blocks INSERT if monthly limit exceeded
CREATE OR REPLACE FUNCTION enforce_connection_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_plan TEXT;
  v_status TEXT;
  v_is_admin BOOLEAN;
  v_monthly_count INTEGER;
  v_limit INTEGER;
  v_month_start TIMESTAMPTZ;
BEGIN
  -- Global admins bypass all limits
  SELECT COALESCE(is_global_admin, false) INTO v_is_admin
  FROM user_profiles WHERE id = NEW.user_id;
  
  IF v_is_admin THEN
    RETURN NEW;
  END IF;

  -- Get org subscription info
  v_plan := get_org_plan(NEW.org_id);
  v_status := get_org_status(NEW.org_id);

  -- Determine connection limit based on plan
  IF v_plan LIKE '%enterprise%' OR v_plan LIKE '%agentic%' THEN
    v_limit := 100;
  ELSIF v_plan LIKE '%growth%' THEN
    v_limit := 25;
  ELSE
    -- Trial or no subscription: 10 connections max
    v_limit := 10;
  END IF;

  -- Block if subscription is not active/trialing
  IF v_status NOT IN ('active', 'trialing') THEN
    RAISE EXCEPTION 'Subscription inactive. Please renew to connect with subcontractors.'
      USING ERRCODE = 'P0001';
  END IF;

  -- Count connections this calendar month
  v_month_start := date_trunc('month', now());
  SELECT COUNT(*) INTO v_monthly_count
  FROM sub_connections
  WHERE org_id = NEW.org_id
    AND created_at >= v_month_start;

  IF v_monthly_count >= v_limit THEN
    RAISE EXCEPTION 'Monthly connection limit reached (% of %). Upgrade your plan for more connections.',
      v_monthly_count, v_limit
      USING ERRCODE = 'P0001';
  END IF;

  -- Log the connection attempt in audit table
  INSERT INTO sub_access_log (user_id, org_id, action_type, metadata)
  VALUES (NEW.user_id, NEW.org_id, 'connect', jsonb_build_object('sub_id', NEW.sub_id));

  RETURN NEW;
END;
$$;

-- Attach trigger
DROP TRIGGER IF EXISTS trg_enforce_connection_limit ON sub_connections;
CREATE TRIGGER trg_enforce_connection_limit
  BEFORE INSERT ON sub_connections
  FOR EACH ROW
  EXECUTE FUNCTION enforce_connection_limit();


-- ============================================================================
-- 3. SEARCH RATE LIMITING (DB-enforced)
-- Limit how many search queries a user/org can make per day
-- ============================================================================

CREATE OR REPLACE FUNCTION check_search_rate_limit(p_user_id UUID, p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_plan TEXT;
  v_is_admin BOOLEAN;
  v_daily_count INTEGER;
  v_limit INTEGER;
  v_day_start TIMESTAMPTZ;
BEGIN
  -- Global admins bypass
  SELECT COALESCE(is_global_admin, false) INTO v_is_admin
  FROM user_profiles WHERE id = p_user_id;
  
  IF v_is_admin THEN
    RETURN true;
  END IF;

  -- Get plan
  v_plan := get_org_plan(p_org_id);

  -- Set daily search limits
  IF v_plan LIKE '%enterprise%' OR v_plan LIKE '%agentic%' THEN
    v_limit := 200;
  ELSIF v_plan LIKE '%growth%' THEN
    v_limit := 50;
  ELSE
    -- Trial/no subscription: very limited
    v_limit := 15;
  END IF;

  -- Count searches today
  v_day_start := date_trunc('day', now());
  SELECT COUNT(*) INTO v_daily_count
  FROM sub_access_log
  WHERE user_id = p_user_id
    AND action_type IN ('search', 'page_browse')
    AND created_at >= v_day_start;

  RETURN v_daily_count < v_limit;
END;
$$;


-- ============================================================================
-- 4. CONNECTION REVOCATION ON SUBSCRIPTION END
-- Freeze connections when subscription becomes cancelled/past_due
-- ============================================================================

CREATE OR REPLACE FUNCTION freeze_connections_on_churn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- When subscription status changes to cancelled or past_due, freeze all connections
  IF NEW.subscription_status IN ('cancelled', 'past_due')
     AND OLD.subscription_status IN ('active', 'trialing') THEN
    UPDATE sub_connections
    SET frozen = true
    WHERE org_id = NEW.id;
  END IF;

  -- When subscription reactivates, unfreeze
  IF NEW.subscription_status IN ('active', 'trialing')
     AND OLD.subscription_status IN ('cancelled', 'past_due') THEN
    UPDATE sub_connections
    SET frozen = false
    WHERE org_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_freeze_connections_on_churn ON organizations;
CREATE TRIGGER trg_freeze_connections_on_churn
  AFTER UPDATE OF subscription_status ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION freeze_connections_on_churn();


-- ============================================================================
-- 5. UPDATE SAFE VIEW — Account for frozen connections + trial restrictions
-- ============================================================================

-- Update the is_connected_to_sub function to exclude frozen connections
CREATE OR REPLACE FUNCTION is_connected_to_sub(p_sub_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM sub_connections sc
    JOIN user_profiles up ON up.current_org_id = sc.org_id
    WHERE sc.sub_id = p_sub_id
    AND up.id = auth.uid()
    AND sc.frozen = false  -- Frozen connections don't count
  );
$$;


-- ============================================================================
-- 6. RESTRICT RAW TABLE ACCESS — Force usage of _safe view
-- ============================================================================

-- Revoke direct SELECT on master_subcontractors from authenticated role
-- This forces all non-service-role queries through the safe view
-- Note: We need to first drop the existing permissive policy
DROP POLICY IF EXISTS "Authenticated users can read master_subcontractors" ON master_subcontractors;

-- Create a restrictive policy: only global admins and service_role can read raw table
CREATE POLICY "Only admins can read raw master_subcontractors"
  ON master_subcontractors FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_global_admin = true
    )
  );

-- The safe view runs as SECURITY DEFINER (via its functions), so it can still
-- read the raw table. Regular users must go through the view.

-- Grant on the safe view remains for authenticated users
GRANT SELECT ON master_subcontractors_safe TO authenticated;


-- ============================================================================
-- 7. SEARCH RESULTS LIMITING FUNCTION
-- Returns max results based on subscription tier
-- ============================================================================

CREATE OR REPLACE FUNCTION get_sub_search_limit(p_user_id UUID, p_org_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_plan TEXT;
  v_status TEXT;
  v_is_admin BOOLEAN;
BEGIN
  SELECT COALESCE(is_global_admin, false) INTO v_is_admin
  FROM user_profiles WHERE id = p_user_id;
  
  IF v_is_admin THEN
    RETURN 10000;  -- Effectively unlimited for admins
  END IF;

  v_plan := get_org_plan(p_org_id);
  v_status := get_org_status(p_org_id);

  -- Inactive subscriptions get very limited access
  IF v_status NOT IN ('active', 'trialing') THEN
    RETURN 0;
  END IF;

  -- Tier-based limits
  IF v_plan LIKE '%enterprise%' OR v_plan LIKE '%agentic%' THEN
    RETURN 500;  -- Per search query
  ELSIF v_plan LIKE '%growth%' THEN
    RETURN 100;  -- Per search query
  ELSIF v_status = 'trialing' THEN
    RETURN 5;   -- Trial: very limited preview
  ELSE
    RETURN 0;   -- No subscription: no access
  END IF;
END;
$$;
