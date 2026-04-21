-- =============================================================================
-- BETA TESTER LIFECYCLE TRACKING
-- Tracks the full journey from beta acceptance through paid conversion
-- =============================================================================

-- 1. Create the beta_tester_lifecycle table
CREATE TABLE IF NOT EXISTS public.beta_tester_lifecycle (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,

  -- Lifecycle dates
  beta_accepted_at timestamptz,
  first_login_at timestamptz,
  day_38_email_sent_at timestamptz,
  day_45_completed_at timestamptz,
  first_payment_at timestamptz,

  -- Status tracking
  lifecycle_status text DEFAULT 'accepted' CHECK (lifecycle_status IN (
    'accepted',
    'active',
    'thanked',
    'completed',
    'converting',
    'converted',
    'churned',
    'extended'
  )),

  -- Stripe references
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_coupon_id text DEFAULT 'beta-tester-30-off-6mo',
  checkout_session_id text,
  checkout_url text,

  -- Activity tracking
  total_logins integer DEFAULT 0,
  total_sessions_minutes integer DEFAULT 0,
  features_used text[] DEFAULT '{}',
  last_activity_at timestamptz,

  -- Extension tracking
  extension_days integer DEFAULT 0,
  extended_at timestamptz,
  extended_by uuid,

  -- Admin notes
  admin_notes text,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  CONSTRAINT unique_user_lifecycle UNIQUE (user_id)
);

-- 2. Indexes for cron job queries and admin lookups
CREATE INDEX IF NOT EXISTS idx_beta_lifecycle_status
  ON beta_tester_lifecycle(lifecycle_status);

CREATE INDEX IF NOT EXISTS idx_beta_lifecycle_first_login
  ON beta_tester_lifecycle(first_login_at);

CREATE INDEX IF NOT EXISTS idx_beta_lifecycle_user
  ON beta_tester_lifecycle(user_id);

-- 3. Auto-update updated_at on changes
CREATE OR REPLACE FUNCTION update_beta_lifecycle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_beta_lifecycle_updated_at ON beta_tester_lifecycle;
CREATE TRIGGER trg_beta_lifecycle_updated_at
  BEFORE UPDATE ON beta_tester_lifecycle
  FOR EACH ROW
  EXECUTE FUNCTION update_beta_lifecycle_updated_at();

-- 4. Function: Record first login (called from app or edge function)
CREATE OR REPLACE FUNCTION record_beta_first_login(p_user_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_lifecycle beta_tester_lifecycle%ROWTYPE;
BEGIN
  -- Check if lifecycle record exists and first_login_at is null
  SELECT * INTO v_lifecycle
  FROM beta_tester_lifecycle
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'No lifecycle record found');
  END IF;

  IF v_lifecycle.first_login_at IS NOT NULL THEN
    -- Already recorded, just increment login count
    UPDATE beta_tester_lifecycle
    SET total_logins = total_logins + 1,
        last_activity_at = now()
    WHERE user_id = p_user_id;

    RETURN jsonb_build_object('success', true, 'action', 'login_counted', 'day', EXTRACT(DAY FROM now() - v_lifecycle.first_login_at)::integer);
  END IF;

  -- Record first login and transition to active
  UPDATE beta_tester_lifecycle
  SET first_login_at = now(),
      lifecycle_status = 'active',
      total_logins = 1,
      last_activity_at = now()
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object('success', true, 'action', 'first_login_recorded', 'day', 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Function: Get lifecycle status with computed fields
CREATE OR REPLACE FUNCTION get_beta_lifecycle_status(p_user_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_lifecycle beta_tester_lifecycle%ROWTYPE;
  v_days_elapsed integer;
  v_days_remaining integer;
  v_total_days integer;
BEGIN
  SELECT * INTO v_lifecycle
  FROM beta_tester_lifecycle
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  v_total_days := 45 + COALESCE(v_lifecycle.extension_days, 0);

  IF v_lifecycle.first_login_at IS NOT NULL THEN
    v_days_elapsed := EXTRACT(DAY FROM now() - v_lifecycle.first_login_at)::integer;
    v_days_remaining := GREATEST(0, v_total_days - v_days_elapsed);
  ELSE
    v_days_elapsed := 0;
    v_days_remaining := v_total_days;
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'id', v_lifecycle.id,
    'user_id', v_lifecycle.user_id,
    'lifecycle_status', v_lifecycle.lifecycle_status,
    'beta_accepted_at', v_lifecycle.beta_accepted_at,
    'first_login_at', v_lifecycle.first_login_at,
    'day_38_email_sent_at', v_lifecycle.day_38_email_sent_at,
    'day_45_completed_at', v_lifecycle.day_45_completed_at,
    'first_payment_at', v_lifecycle.first_payment_at,
    'days_elapsed', v_days_elapsed,
    'days_remaining', v_days_remaining,
    'total_days', v_total_days,
    'total_logins', v_lifecycle.total_logins,
    'total_sessions_minutes', v_lifecycle.total_sessions_minutes,
    'features_used', v_lifecycle.features_used,
    'last_activity_at', v_lifecycle.last_activity_at,
    'stripe_customer_id', v_lifecycle.stripe_customer_id,
    'stripe_subscription_id', v_lifecycle.stripe_subscription_id,
    'checkout_url', v_lifecycle.checkout_url,
    'extension_days', v_lifecycle.extension_days,
    'admin_notes', v_lifecycle.admin_notes
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Function: Admin creates lifecycle record when approving beta tester
CREATE OR REPLACE FUNCTION create_beta_lifecycle(p_user_id uuid, p_admin_notes text DEFAULT NULL)
RETURNS jsonb AS $$
BEGIN
  INSERT INTO beta_tester_lifecycle (user_id, beta_accepted_at, admin_notes)
  VALUES (p_user_id, now(), p_admin_notes)
  ON CONFLICT (user_id) DO UPDATE
  SET beta_accepted_at = COALESCE(beta_tester_lifecycle.beta_accepted_at, now()),
      admin_notes = COALESCE(p_admin_notes, beta_tester_lifecycle.admin_notes),
      updated_at = now();

  RETURN jsonb_build_object('success', true, 'user_id', p_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Function: Extend beta period
CREATE OR REPLACE FUNCTION extend_beta_period(
  p_user_id uuid,
  p_extra_days integer DEFAULT 15,
  p_admin_id uuid DEFAULT NULL
)
RETURNS jsonb AS $$
BEGIN
  UPDATE beta_tester_lifecycle
  SET extension_days = extension_days + p_extra_days,
      extended_at = now(),
      extended_by = p_admin_id,
      lifecycle_status = CASE
        WHEN lifecycle_status = 'completed' THEN 'extended'
        ELSE lifecycle_status
      END
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'No lifecycle record found');
  END IF;

  RETURN jsonb_build_object('success', true, 'extra_days', p_extra_days);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Function: Get all active beta testers for admin view
CREATE OR REPLACE FUNCTION get_active_beta_testers()
RETURNS TABLE (
  lifecycle_id uuid,
  user_id uuid,
  full_name text,
  email text,
  company text,
  lifecycle_status text,
  beta_accepted_at timestamptz,
  first_login_at timestamptz,
  days_elapsed integer,
  days_remaining integer,
  total_days integer,
  total_logins integer,
  last_activity_at timestamptz,
  day_38_email_sent_at timestamptz,
  day_45_completed_at timestamptz,
  first_payment_at timestamptz,
  checkout_url text,
  stripe_subscription_id text,
  extension_days integer,
  admin_notes text
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    bl.id AS lifecycle_id,
    bl.user_id,
    COALESCE(p.full_name, 'Unknown') AS full_name,
    COALESCE(p.email, 'Unknown') AS email,
    ba.company AS company,
    bl.lifecycle_status,
    bl.beta_accepted_at,
    bl.first_login_at,
    CASE
      WHEN bl.first_login_at IS NOT NULL
      THEN EXTRACT(DAY FROM now() - bl.first_login_at)::integer
      ELSE 0
    END AS days_elapsed,
    CASE
      WHEN bl.first_login_at IS NOT NULL
      THEN GREATEST(0, (45 + COALESCE(bl.extension_days, 0)) - EXTRACT(DAY FROM now() - bl.first_login_at)::integer)
      ELSE 45 + COALESCE(bl.extension_days, 0)
    END AS days_remaining,
    45 + COALESCE(bl.extension_days, 0) AS total_days,
    bl.total_logins,
    bl.last_activity_at,
    bl.day_38_email_sent_at,
    bl.day_45_completed_at,
    bl.first_payment_at,
    bl.checkout_url,
    bl.stripe_subscription_id,
    bl.extension_days,
    bl.admin_notes
  FROM beta_tester_lifecycle bl
  JOIN profiles p ON p.id = bl.user_id
  LEFT JOIN beta_applications ba ON ba.email = p.email
  ORDER BY bl.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Function: Daily lifecycle check (called by pg_cron or edge function)
-- Returns users who need Day 38 emails or Day 45 completion
CREATE OR REPLACE FUNCTION check_beta_lifecycle_transitions()
RETURNS jsonb AS $$
DECLARE
  v_day38_users jsonb;
  v_day45_users jsonb;
  v_day38_count integer;
  v_day45_count integer;
BEGIN
  -- Find users who need Day 38 thank-you email
  WITH day38 AS (
    UPDATE beta_tester_lifecycle
    SET lifecycle_status = 'thanked'
    WHERE lifecycle_status = 'active'
      AND first_login_at IS NOT NULL
      AND first_login_at + ((38 + COALESCE(extension_days, 0) - (45 - 38))::text || ' days')::interval <= now()
      AND day_38_email_sent_at IS NULL
    RETURNING user_id
  )
  SELECT jsonb_agg(user_id), count(*) INTO v_day38_users, v_day38_count FROM day38;

  -- Find users who have completed 45 days
  WITH day45 AS (
    UPDATE beta_tester_lifecycle
    SET lifecycle_status = 'completed',
        day_45_completed_at = now()
    WHERE lifecycle_status IN ('active', 'thanked')
      AND first_login_at IS NOT NULL
      AND first_login_at + ((45 + COALESCE(extension_days, 0))::text || ' days')::interval <= now()
      AND day_45_completed_at IS NULL
    RETURNING user_id
  )
  SELECT jsonb_agg(user_id), count(*) INTO v_day45_users, v_day45_count FROM day45;

  RETURN jsonb_build_object(
    'day38_email_needed', COALESCE(v_day38_users, '[]'::jsonb),
    'day38_count', COALESCE(v_day38_count, 0),
    'day45_completed', COALESCE(v_day45_users, '[]'::jsonb),
    'day45_count', COALESCE(v_day45_count, 0),
    'checked_at', now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. RLS Policies
ALTER TABLE beta_tester_lifecycle ENABLE ROW LEVEL SECURITY;

-- Admins can see all lifecycle records
CREATE POLICY "Admins can view all beta lifecycles"
  ON beta_tester_lifecycle FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admins can insert/update lifecycle records
CREATE POLICY "Admins can manage beta lifecycles"
  ON beta_tester_lifecycle FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Users can view their own lifecycle record
CREATE POLICY "Users can view own beta lifecycle"
  ON beta_tester_lifecycle FOR SELECT
  USING (user_id = auth.uid());

-- Grant access to service role for edge functions
GRANT ALL ON beta_tester_lifecycle TO service_role;
GRANT USAGE ON SCHEMA public TO service_role;

-- 11. pg_cron job for daily lifecycle checks
-- This runs the beta-lifecycle-check Edge Function daily at 9:00 AM UTC
-- NOTE: pg_cron must be enabled in your Supabase project settings.
-- If pg_cron is not available, the lifecycle check can be triggered manually
-- from the Beta Operations admin page or via an external scheduler.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'beta-lifecycle-daily-check',
      '0 9 * * *',
      $$SELECT check_beta_lifecycle_transitions()$$
    );
    RAISE NOTICE 'pg_cron job "beta-lifecycle-daily-check" scheduled successfully';
  ELSE
    RAISE NOTICE 'pg_cron extension not available. Schedule beta-lifecycle-check externally.';
  END IF;
END
$$;
