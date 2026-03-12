-- =============================================================================
-- Phase 2: Billing Pipeline Fix + Admin Intelligence Infrastructure
-- Creates all missing tables, RPC functions, and views needed for:
-- 1. Stripe billing pipeline (webhook_events, billing_state, ops_event_log)
-- 2. Admin operational intelligence (cross-user signal/brief/health views)
-- 3. User activity tracking
-- 4. Admin audit logging
-- 5. Automated alerting
-- =============================================================================

-- ============================================================
-- 1. WEBHOOK EVENTS TABLE (idempotency + audit trail)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text UNIQUE NOT NULL,
  event_type text NOT NULL,
  customer_id text,
  subscription_id text,
  user_id uuid REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'success', 'failed', 'skipped')),
  error_message text,
  event_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_event_id ON public.webhook_events(event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON public.webhook_events(status);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON public.webhook_events(created_at);

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Platform admins can view webhook events" ON public.webhook_events
  FOR SELECT USING (public.is_platform_admin());

-- ============================================================
-- 2. BILLING STATE TABLE (access enforcement)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.billing_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status text DEFAULT 'none',
  access_state text DEFAULT 'full' CHECK (access_state IN ('full', 'grace', 'locked')),
  payment_failed_at timestamptz,
  grace_period_ends_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_state_user_id ON public.billing_state(user_id);
CREATE INDEX IF NOT EXISTS idx_billing_state_access_state ON public.billing_state(access_state);

ALTER TABLE public.billing_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own billing state" ON public.billing_state
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Platform admins can view all billing state" ON public.billing_state
  FOR SELECT USING (public.is_platform_admin());

-- ============================================================
-- 3. OPS EVENT LOG TABLE (production monitoring)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ops_event_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  source text NOT NULL,
  severity text DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  user_id uuid,
  correlation_id text,
  error_code text,
  error_reason text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ops_event_log_event_type ON public.ops_event_log(event_type);
CREATE INDEX IF NOT EXISTS idx_ops_event_log_severity ON public.ops_event_log(severity);
CREATE INDEX IF NOT EXISTS idx_ops_event_log_created_at ON public.ops_event_log(created_at);

ALTER TABLE public.ops_event_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Platform admins can view ops events" ON public.ops_event_log
  FOR SELECT USING (public.is_platform_admin());

-- ============================================================
-- 4. USER ACTIVITY TABLE (session/feature tracking)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_source text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_activity_user_id ON public.user_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_event_type ON public.user_activity(event_type);
CREATE INDEX IF NOT EXISTS idx_user_activity_created_at ON public.user_activity(created_at);

ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert own activity" ON public.user_activity
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own activity" ON public.user_activity
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Platform admins can view all activity" ON public.user_activity
  FOR SELECT USING (public.is_platform_admin());

-- ============================================================
-- 5. ADMIN AUDIT LOG TABLE (admin action tracking)
-- ============================================================
-- admin_audit_logs may already exist but be empty; recreate if needed
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  action text NOT NULL,
  target_type text,
  target_id text,
  details jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin_id ON public.admin_audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action ON public.admin_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at ON public.admin_audit_logs(created_at);

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Platform admins can view admin audit logs" ON public.admin_audit_logs;
CREATE POLICY "Platform admins can view admin audit logs" ON public.admin_audit_logs
  FOR SELECT USING (public.is_platform_admin());
DROP POLICY IF EXISTS "Platform admins can insert admin audit logs" ON public.admin_audit_logs;
CREATE POLICY "Platform admins can insert admin audit logs" ON public.admin_audit_logs
  FOR INSERT WITH CHECK (public.is_platform_admin());

-- ============================================================
-- 6. PLATFORM ALERTS TABLE (automated alerting)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.platform_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text NOT NULL,
  severity text DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  title text NOT NULL,
  description text,
  source text,
  user_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  is_resolved boolean DEFAULT false,
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_alerts_alert_type ON public.platform_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_platform_alerts_severity ON public.platform_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_platform_alerts_is_resolved ON public.platform_alerts(is_resolved);
CREATE INDEX IF NOT EXISTS idx_platform_alerts_created_at ON public.platform_alerts(created_at);

ALTER TABLE public.platform_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Platform admins can view alerts" ON public.platform_alerts
  FOR SELECT USING (public.is_platform_admin());
CREATE POLICY "Platform admins can update alerts" ON public.platform_alerts
  FOR UPDATE USING (public.is_platform_admin());
CREATE POLICY "Service role can insert alerts" ON public.platform_alerts
  FOR INSERT WITH CHECK (true);

-- ============================================================
-- 7. RPC FUNCTIONS FOR STRIPE WEBHOOK
-- ============================================================

-- 7a. Check if webhook event already processed
CREATE OR REPLACE FUNCTION public.is_webhook_event_processed(p_event_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.webhook_events
    WHERE event_id = p_event_id AND status IN ('success', 'processing')
  );
END;
$$;

-- 7b. Log webhook event
CREATE OR REPLACE FUNCTION public.log_webhook_event(
  p_event_id text,
  p_event_type text,
  p_customer_id text DEFAULT NULL,
  p_subscription_id text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_status text DEFAULT 'pending',
  p_error_message text DEFAULT NULL,
  p_event_data jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.webhook_events (event_id, event_type, customer_id, subscription_id, user_id, status, error_message, event_data)
  VALUES (p_event_id, p_event_type, p_customer_id, p_subscription_id, p_user_id, p_status, p_error_message, p_event_data)
  ON CONFLICT (event_id) DO UPDATE SET
    status = EXCLUDED.status,
    error_message = COALESCE(EXCLUDED.error_message, webhook_events.error_message),
    updated_at = now();
END;
$$;

-- 7c. Update webhook event status
CREATE OR REPLACE FUNCTION public.update_webhook_event_status(
  p_event_id text,
  p_status text,
  p_error_message text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.webhook_events
  SET status = p_status,
      error_message = COALESCE(p_error_message, error_message),
      user_id = COALESCE(p_user_id, user_id),
      updated_at = now()
  WHERE event_id = p_event_id;
END;
$$;

-- 7d. Log ops event
CREATE OR REPLACE FUNCTION public.log_ops_event(
  p_event_type text,
  p_source text,
  p_severity text DEFAULT 'info',
  p_user_id uuid DEFAULT NULL,
  p_correlation_id text DEFAULT NULL,
  p_error_code text DEFAULT NULL,
  p_error_reason text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.ops_event_log (event_type, source, severity, user_id, correlation_id, error_code, error_reason, metadata)
  VALUES (p_event_type, p_source, p_severity, p_user_id, p_correlation_id, p_error_code, p_error_reason, p_metadata);
END;
$$;

-- 7e. Update billing state
CREATE OR REPLACE FUNCTION public.update_billing_state(
  p_user_id uuid,
  p_stripe_customer_id text DEFAULT NULL,
  p_stripe_subscription_id text DEFAULT NULL,
  p_subscription_status text DEFAULT NULL,
  p_payment_failed_at timestamptz DEFAULT NULL,
  p_clear_payment_failed boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_access_state text;
  v_new_access_state text;
  v_state_changed boolean := false;
  v_grace_period_ends timestamptz;
BEGIN
  -- Get current state
  SELECT access_state INTO v_old_access_state
  FROM public.billing_state WHERE user_id = p_user_id;

  -- Calculate new access state
  IF p_subscription_status IN ('active', 'trialing') THEN
    v_new_access_state := 'full';
  ELSIF p_subscription_status = 'past_due' THEN
    v_new_access_state := 'grace';
    v_grace_period_ends := COALESCE(p_payment_failed_at, now()) + interval '7 days';
  ELSIF p_subscription_status IN ('canceled', 'unpaid', 'incomplete_expired') THEN
    v_new_access_state := 'locked';
  ELSE
    v_new_access_state := COALESCE(v_old_access_state, 'full');
  END IF;

  v_state_changed := (v_old_access_state IS DISTINCT FROM v_new_access_state);

  INSERT INTO public.billing_state (user_id, stripe_customer_id, stripe_subscription_id, subscription_status, access_state, payment_failed_at, grace_period_ends_at)
  VALUES (p_user_id, p_stripe_customer_id, p_stripe_subscription_id, p_subscription_status, v_new_access_state,
          CASE WHEN p_clear_payment_failed THEN NULL ELSE p_payment_failed_at END,
          v_grace_period_ends)
  ON CONFLICT (user_id) DO UPDATE SET
    stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, billing_state.stripe_customer_id),
    stripe_subscription_id = COALESCE(EXCLUDED.stripe_subscription_id, billing_state.stripe_subscription_id),
    subscription_status = COALESCE(EXCLUDED.subscription_status, billing_state.subscription_status),
    access_state = v_new_access_state,
    payment_failed_at = CASE WHEN p_clear_payment_failed THEN NULL ELSE COALESCE(EXCLUDED.payment_failed_at, billing_state.payment_failed_at) END,
    grace_period_ends_at = COALESCE(v_grace_period_ends, billing_state.grace_period_ends_at),
    updated_at = now();

  RETURN jsonb_build_object(
    'old_access_state', COALESCE(v_old_access_state, 'none'),
    'new_access_state', v_new_access_state,
    'state_changed', v_state_changed
  );
END;
$$;

-- 7f. Get expired grace period users
CREATE OR REPLACE FUNCTION public.get_expired_grace_period_users()
RETURNS TABLE(user_id uuid, stripe_customer_id text, stripe_subscription_id text, hours_since_failure numeric)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT bs.user_id, bs.stripe_customer_id, bs.stripe_subscription_id,
         EXTRACT(EPOCH FROM (now() - bs.payment_failed_at)) / 3600 AS hours_since_failure
  FROM public.billing_state bs
  WHERE bs.access_state = 'grace'
    AND bs.payment_failed_at IS NOT NULL
    AND bs.grace_period_ends_at < now();
END;
$$;

-- 7g. Sync subscription to user_subscriptions
CREATE OR REPLACE FUNCTION public.sync_subscription_to_user_subscriptions(
  p_user_id uuid,
  p_plan_name text,
  p_stripe_subscription_id text,
  p_stripe_customer_id text,
  p_status text,
  p_current_period_start timestamptz,
  p_current_period_end timestamptz,
  p_trial_start timestamptz DEFAULT NULL,
  p_trial_end timestamptz DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.user_subscriptions (
    user_id, plan_name, stripe_subscription_id, stripe_customer_id,
    status, current_period_start, current_period_end, metadata
  )
  VALUES (
    p_user_id, p_plan_name, p_stripe_subscription_id, p_stripe_customer_id,
    p_status, p_current_period_start, p_current_period_end,
    jsonb_build_object('trial_start', p_trial_start, 'trial_end', p_trial_end)
  )
  ON CONFLICT (user_id) DO UPDATE SET
    plan_name = EXCLUDED.plan_name,
    stripe_subscription_id = EXCLUDED.stripe_subscription_id,
    stripe_customer_id = EXCLUDED.stripe_customer_id,
    status = EXCLUDED.status,
    current_period_start = EXCLUDED.current_period_start,
    current_period_end = EXCLUDED.current_period_end,
    metadata = EXCLUDED.metadata,
    updated_at = now();
END;
$$;

-- Ensure user_subscriptions has a unique constraint on user_id for upsert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_subscriptions_user_id_key'
  ) THEN
    ALTER TABLE public.user_subscriptions ADD CONSTRAINT user_subscriptions_user_id_key UNIQUE (user_id);
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END;
$$;

-- 7h. Handle subscription downgrade (graceful)
CREATE OR REPLACE FUNCTION public.handle_subscription_downgrade(
  p_user_id uuid,
  p_old_tier text,
  p_new_tier text,
  p_period_end_at text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Log the downgrade event
  INSERT INTO public.ops_event_log (event_type, source, severity, user_id, metadata)
  VALUES ('subscription_downgrade', 'stripe-webhook', 'info', p_user_id,
    jsonb_build_object('old_tier', p_old_tier, 'new_tier', p_new_tier, 'period_end_at', p_period_end_at));
END;
$$;

-- 7i. Handle subscription cancellation (graceful)
CREATE OR REPLACE FUNCTION public.handle_subscription_cancellation(
  p_user_id uuid,
  p_current_tier text,
  p_period_end_at text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update profile status
  UPDATE public.profiles
  SET subscription_status = 'canceled',
      updated_at = now()
  WHERE id = p_user_id;

  -- Update user_subscriptions
  UPDATE public.user_subscriptions
  SET status = 'canceled',
      canceled_at = now(),
      updated_at = now()
  WHERE user_id = p_user_id;

  -- Log the cancellation
  INSERT INTO public.ops_event_log (event_type, source, severity, user_id, metadata)
  VALUES ('subscription_canceled', 'stripe-webhook', 'warning', p_user_id,
    jsonb_build_object('tier', p_current_tier, 'period_end_at', p_period_end_at));
END;
$$;

-- 7j. Sync stripe to entitlements (stub - prevents webhook errors)
CREATE OR REPLACE FUNCTION public.sync_stripe_to_entitlements(
  p_user_id uuid,
  p_subscription_tier text,
  p_subscription_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Entitlements sync - updates plan_limits usage tracking
  -- This is a stub that prevents webhook errors; full implementation TBD
  NULL;
END;
$$;

-- ============================================================
-- 8. RLS POLICIES FOR user_subscriptions (admin read access)
-- ============================================================
DROP POLICY IF EXISTS "Platform admins can view all subscriptions" ON public.user_subscriptions;
CREATE POLICY "Platform admins can view all subscriptions" ON public.user_subscriptions
  FOR SELECT USING (public.is_platform_admin());

-- ============================================================
-- 9. RLS POLICIES FOR operational tables (admin read access)
-- ============================================================

-- operational_signals: admin can read all
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'operational_signals' AND table_schema = 'public') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Platform admins can view all signals" ON public.operational_signals';
    EXECUTE 'CREATE POLICY "Platform admins can view all signals" ON public.operational_signals FOR SELECT USING (public.is_platform_admin())';
  END IF;
END;
$$;

-- operational_briefs: admin can read all
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'operational_briefs' AND table_schema = 'public') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Platform admins can view all briefs" ON public.operational_briefs';
    EXECUTE 'CREATE POLICY "Platform admins can view all briefs" ON public.operational_briefs FOR SELECT USING (public.is_platform_admin())';
  END IF;
END;
$$;

-- operational_health_scores: admin can read all
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'operational_health_scores' AND table_schema = 'public') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Platform admins can view all health scores" ON public.operational_health_scores';
    EXECUTE 'CREATE POLICY "Platform admins can view all health scores" ON public.operational_health_scores FOR SELECT USING (public.is_platform_admin())';
  END IF;
END;
$$;

-- user_integrations: admin can read all
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_integrations' AND table_schema = 'public') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Platform admins can view all user integrations" ON public.user_integrations';
    EXECUTE 'CREATE POLICY "Platform admins can view all user integrations" ON public.user_integrations FOR SELECT USING (public.is_platform_admin())';
  END IF;
END;
$$;

-- integration_health_logs: admin can read all
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'integration_health_logs' AND table_schema = 'public') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Platform admins can view all health logs" ON public.integration_health_logs';
    EXECUTE 'CREATE POLICY "Platform admins can view all health logs" ON public.integration_health_logs FOR SELECT USING (public.is_platform_admin())';
  END IF;
END;
$$;

-- poll_run_logs: admin can read all
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'poll_run_logs' AND table_schema = 'public') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Platform admins can view all poll logs" ON public.poll_run_logs';
    EXECUTE 'CREATE POLICY "Platform admins can view all poll logs" ON public.poll_run_logs FOR SELECT USING (public.is_platform_admin())';
  END IF;
END;
$$;

-- ============================================================
-- 10. GRANT SERVICE ROLE ACCESS TO NEW TABLES
-- ============================================================
GRANT ALL ON public.webhook_events TO service_role;
GRANT ALL ON public.billing_state TO service_role;
GRANT ALL ON public.ops_event_log TO service_role;
GRANT ALL ON public.user_activity TO service_role;
GRANT ALL ON public.admin_audit_logs TO service_role;
GRANT ALL ON public.platform_alerts TO service_role;
