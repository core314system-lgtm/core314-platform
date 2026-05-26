-- =============================================================================
-- BETA PROGRAM SETTINGS & SHUTDOWN SYSTEM
-- Adds system_settings table for global config + eligibility enforcement
-- =============================================================================

-- 1. Create system_settings table (key/value store for global config)
CREATE TABLE IF NOT EXISTS public.system_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT 'true'::jsonb,
  description text,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid
);

-- Insert the beta_program_active setting (defaults to true)
INSERT INTO public.system_settings (key, value, description)
VALUES (
  'beta_program_active',
  'true'::jsonb,
  'Controls whether the beta testing program is active. When false: no new applications accepted, discount banner hidden, checkout blocked.'
)
ON CONFLICT (key) DO NOTHING;

-- 2. RPC: Get a system setting value
CREATE OR REPLACE FUNCTION get_system_setting(p_key text)
RETURNS jsonb AS $$
BEGIN
  RETURN (SELECT value FROM system_settings WHERE key = p_key);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. RPC: Set a system setting value (admin only)
CREATE OR REPLACE FUNCTION set_system_setting(p_key text, p_value jsonb)
RETURNS jsonb AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  -- Check caller is admin
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only admins can update system settings');
  END IF;

  INSERT INTO system_settings (key, value, updated_at, updated_by)
  VALUES (p_key, p_value, now(), auth.uid())
  ON CONFLICT (key) DO UPDATE
  SET value = p_value,
      updated_at = now(),
      updated_by = auth.uid();

  RETURN jsonb_build_object('success', true, 'key', p_key, 'value', p_value);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. RLS on system_settings
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can read settings (needed for frontend checks)
CREATE POLICY "Anyone can read system settings"
  ON system_settings FOR SELECT
  USING (true);

-- Only admins can modify settings
CREATE POLICY "Admins can manage system settings"
  ON system_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

GRANT SELECT ON system_settings TO anon;
GRANT SELECT ON system_settings TO authenticated;
GRANT ALL ON system_settings TO service_role;

-- 5. Update get_beta_lifecycle_status to include eligibility info
-- Adds: eligible_for_discount (bool), discount_deadline (timestamp)
CREATE OR REPLACE FUNCTION get_beta_lifecycle_status(p_user_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_lifecycle beta_tester_lifecycle%ROWTYPE;
  v_days_elapsed integer;
  v_days_remaining integer;
  v_total_days integer;
  v_beta_active boolean;
  v_eligible boolean;
  v_deadline timestamptz;
BEGIN
  SELECT * INTO v_lifecycle
  FROM beta_tester_lifecycle
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  -- Check if beta program is globally active
  SELECT COALESCE((SELECT value::text::boolean FROM system_settings WHERE key = 'beta_program_active'), true)
  INTO v_beta_active;

  v_total_days := 45 + COALESCE(v_lifecycle.extension_days, 0);

  IF v_lifecycle.first_login_at IS NOT NULL THEN
    v_days_elapsed := EXTRACT(DAY FROM now() - v_lifecycle.first_login_at)::integer;
    v_days_remaining := GREATEST(0, v_total_days - v_days_elapsed);
    -- Discount deadline: end of the last day of beta period
    v_deadline := v_lifecycle.first_login_at + ((v_total_days)::text || ' days')::interval;
  ELSE
    v_days_elapsed := 0;
    v_days_remaining := v_total_days;
    v_deadline := NULL;
  END IF;

  -- Eligible for discount if:
  -- 1. Beta program is globally active
  -- 2. Lifecycle status is 'completed', 'converting', or 'extended' (finished the beta)
  --    OR status is 'active'/'thanked' and still within beta period (can claim early)
  -- 3. Has NOT already converted (no stripe_subscription_id)
  -- 4. Still within deadline (now <= discount_deadline) OR no deadline yet
  v_eligible := v_beta_active
    AND v_lifecycle.stripe_subscription_id IS NULL
    AND (
      v_lifecycle.lifecycle_status IN ('completed', 'converting', 'extended')
      OR (v_lifecycle.lifecycle_status IN ('active', 'thanked') AND v_days_remaining > 0)
    )
    AND (v_deadline IS NULL OR now() <= v_deadline);

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
    'admin_notes', v_lifecycle.admin_notes,
    'beta_program_active', v_beta_active,
    'eligible_for_discount', v_eligible,
    'discount_deadline', v_deadline
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
