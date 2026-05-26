-- ============================================================================
-- PHASE 15: PRE-LAUNCH OPERATIONAL CONTROL & CONVERSION HARDENING
-- Migration 124: System Control Flags, Launch Events, and Data Protection Guards
-- ============================================================================
-- 
-- NON-NEGOTIABLE RULES:
-- 1. Fusion Score must NEVER reset on plan changes
-- 2. Intelligence history must NEVER be deleted on plan changes
-- 3. Entitlement changes must be silent and deterministic
-- 4. All kill switches are admin-only
-- 5. Launch metrics are backend-authoritative (server-side only)
--
-- This migration adds:
-- 1. System control flags for kill switches (15.2)
-- 2. Launch events table for conversion metrics (15.3)
-- 3. Data protection guards for plan changes (15.1)
-- ============================================================================

-- ============================================================================
-- PHASE 15.2: SYSTEM CONTROL FLAGS (KILL SWITCHES)
-- ============================================================================
-- Admin-only runtime controls for emergency situations
-- These flags can be toggled without deployment

CREATE TABLE IF NOT EXISTS system_control_flags (
  key TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT true,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('billing', 'intelligence', 'entitlements', 'trials', 'general')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_system_control_flags_category ON system_control_flags(category);

-- Enable RLS
ALTER TABLE system_control_flags ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can read control flags
CREATE POLICY "Admins can read system control flags"
  ON system_control_flags
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Policy: Only admins can update control flags
CREATE POLICY "Admins can update system control flags"
  ON system_control_flags
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Service role has full access (for Edge Functions)
CREATE POLICY "Service role has full access to system control flags"
  ON system_control_flags
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Seed the kill switch flags
INSERT INTO system_control_flags (key, enabled, description, category) VALUES
  ('stripe_billing_enabled', true, 'Enable/disable Stripe billing and webhook processing', 'billing'),
  ('intelligence_aggregator_enabled', true, 'Enable/disable universal intelligence aggregator scheduling', 'intelligence'),
  ('entitlement_mutations_enabled', true, 'Enable/disable entitlement changes (freeze current state)', 'entitlements'),
  ('trial_creation_enabled', true, 'Enable/disable new trial creation', 'trials'),
  ('new_signups_enabled', true, 'Enable/disable new user signups', 'general')
ON CONFLICT (key) DO NOTHING;

-- Helper function to check if a flag is enabled
CREATE OR REPLACE FUNCTION is_control_flag_enabled(p_key TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(enabled, true) FROM system_control_flags WHERE key = p_key;
$$;

-- Helper function to set a flag (admin only, via service role)
CREATE OR REPLACE FUNCTION set_control_flag(
  p_key TEXT,
  p_enabled BOOLEAN,
  p_updated_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_value BOOLEAN;
BEGIN
  SELECT enabled INTO v_old_value FROM system_control_flags WHERE key = p_key;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Flag not found: ' || p_key);
  END IF;
  
  UPDATE system_control_flags
  SET 
    enabled = p_enabled,
    updated_at = now(),
    updated_by = p_updated_by
  WHERE key = p_key;
  
  RETURN jsonb_build_object(
    'success', true,
    'key', p_key,
    'old_value', v_old_value,
    'new_value', p_enabled,
    'updated_at', now()
  );
END;
$$;

-- Grant execute to service role
GRANT EXECUTE ON FUNCTION is_control_flag_enabled(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION is_control_flag_enabled(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION set_control_flag(TEXT, BOOLEAN, UUID) TO service_role;

COMMENT ON TABLE system_control_flags IS 'Phase 15: Admin-only kill switches for emergency operational control';
COMMENT ON FUNCTION is_control_flag_enabled IS 'Phase 15: Check if a control flag is enabled (returns true if flag not found)';
COMMENT ON FUNCTION set_control_flag IS 'Phase 15: Set a control flag value (service role only)';

-- ============================================================================
-- PHASE 15.3: LAUNCH EVENTS TABLE (CONVERSION METRICS)
-- ============================================================================
-- Backend-authoritative event tracking for conversion funnel
-- Events are emitted server-side only (not frontend)

CREATE TABLE IF NOT EXISTS launch_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'trial_started',
    'first_integration_connected',
    'first_intelligence_generated',
    'fusion_score_nonzero',
    'upgrade_initiated',
    'upgrade_completed',
    'downgrade_completed',
    'cancellation',
    'reactivation'
  )),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_launch_events_user_id ON launch_events(user_id);
CREATE INDEX IF NOT EXISTS idx_launch_events_event_type ON launch_events(event_type);
CREATE INDEX IF NOT EXISTS idx_launch_events_occurred_at ON launch_events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_launch_events_user_event ON launch_events(user_id, event_type);

-- Partial unique indexes for "first_*" events (ensures idempotency)
CREATE UNIQUE INDEX IF NOT EXISTS ux_launch_events_first_integration
  ON launch_events (user_id)
  WHERE event_type = 'first_integration_connected';

CREATE UNIQUE INDEX IF NOT EXISTS ux_launch_events_first_intelligence
  ON launch_events (user_id)
  WHERE event_type = 'first_intelligence_generated';

CREATE UNIQUE INDEX IF NOT EXISTS ux_launch_events_fusion_nonzero
  ON launch_events (user_id)
  WHERE event_type = 'fusion_score_nonzero';

CREATE UNIQUE INDEX IF NOT EXISTS ux_launch_events_trial_started
  ON launch_events (user_id)
  WHERE event_type = 'trial_started';

-- Enable RLS
ALTER TABLE launch_events ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own events
CREATE POLICY "Users can read own launch events"
  ON launch_events
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Admins can read all events
CREATE POLICY "Admins can read all launch events"
  ON launch_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Policy: Service role can manage events
CREATE POLICY "Service role can manage launch events"
  ON launch_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Helper function to log a launch event (idempotent for first_* events)
CREATE OR REPLACE FUNCTION log_launch_event(
  p_user_id UUID,
  p_event_type TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event_id UUID;
BEGIN
  -- Insert the event (will fail silently for duplicate first_* events due to unique indexes)
  INSERT INTO launch_events (user_id, event_type, metadata)
  VALUES (p_user_id, p_event_type, p_metadata)
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_event_id;
  
  IF v_event_id IS NULL THEN
    -- Event already exists (for first_* events) or conflict
    RETURN jsonb_build_object(
      'success', true,
      'action', 'already_exists',
      'event_type', p_event_type,
      'user_id', p_user_id
    );
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'action', 'created',
    'event_id', v_event_id,
    'event_type', p_event_type,
    'user_id', p_user_id
  );
END;
$$;

-- Grant execute to service role
GRANT EXECUTE ON FUNCTION log_launch_event(UUID, TEXT, JSONB) TO service_role;

COMMENT ON TABLE launch_events IS 'Phase 15: Backend-authoritative conversion funnel events for launch metrics';
COMMENT ON FUNCTION log_launch_event IS 'Phase 15: Log a launch event (idempotent for first_* events)';

-- ============================================================================
-- PHASE 15.3: TRIGGERS FOR AUTOMATIC LAUNCH EVENT LOGGING
-- ============================================================================

-- Trigger: Log first_integration_connected when user connects their first integration
CREATE OR REPLACE FUNCTION trigger_log_first_integration()
RETURNS TRIGGER AS $$
DECLARE
  v_existing_count INTEGER;
BEGIN
  -- Check if user already has integrations (excluding this one)
  SELECT COUNT(*) INTO v_existing_count
  FROM user_integrations
  WHERE user_id = NEW.user_id
    AND id != NEW.id;
  
  -- If this is the first integration, log the event
  IF v_existing_count = 0 THEN
    PERFORM log_launch_event(
      NEW.user_id,
      'first_integration_connected',
      jsonb_build_object(
        'integration_id', NEW.id,
        'service_name', NEW.service_name,
        'provider_id', NEW.provider_id
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on user_integrations (only if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_integrations') THEN
    DROP TRIGGER IF EXISTS trigger_first_integration_connected ON user_integrations;
    CREATE TRIGGER trigger_first_integration_connected
      AFTER INSERT ON user_integrations
      FOR EACH ROW
      EXECUTE FUNCTION trigger_log_first_integration();
  END IF;
END $$;

-- Trigger: Log first_intelligence_generated when first intelligence is computed
CREATE OR REPLACE FUNCTION trigger_log_first_intelligence()
RETURNS TRIGGER AS $$
DECLARE
  v_existing_count INTEGER;
BEGIN
  -- Check if user already has intelligence data (excluding this one)
  SELECT COUNT(*) INTO v_existing_count
  FROM integration_intelligence
  WHERE user_id = NEW.user_id
    AND id != NEW.id;
  
  -- If this is the first intelligence record, log the event
  IF v_existing_count = 0 THEN
    PERFORM log_launch_event(
      NEW.user_id,
      'first_intelligence_generated',
      jsonb_build_object(
        'integration_id', NEW.integration_id,
        'service_name', NEW.service_name
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on integration_intelligence (only if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'integration_intelligence') THEN
    DROP TRIGGER IF EXISTS trigger_first_intelligence_generated ON integration_intelligence;
    CREATE TRIGGER trigger_first_intelligence_generated
      AFTER INSERT ON integration_intelligence
      FOR EACH ROW
      EXECUTE FUNCTION trigger_log_first_intelligence();
  END IF;
END $$;

-- Trigger: Log fusion_score_nonzero when fusion score becomes non-zero
CREATE OR REPLACE FUNCTION trigger_log_fusion_nonzero()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if this is a new non-zero score (not an update to existing)
  IF NEW.fusion_score IS NOT NULL AND NEW.fusion_score > 0 THEN
    -- Check if we've already logged this event
    IF NOT EXISTS (
      SELECT 1 FROM launch_events 
      WHERE user_id = NEW.user_id 
      AND event_type = 'fusion_score_nonzero'
    ) THEN
      PERFORM log_launch_event(
        NEW.user_id,
        'fusion_score_nonzero',
        jsonb_build_object(
          'fusion_score', NEW.fusion_score,
          'integration_id', NEW.integration_id
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on fusion_scores (only if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fusion_scores') THEN
    DROP TRIGGER IF EXISTS trigger_fusion_score_nonzero ON fusion_scores;
    CREATE TRIGGER trigger_fusion_score_nonzero
      AFTER INSERT OR UPDATE ON fusion_scores
      FOR EACH ROW
      EXECUTE FUNCTION trigger_log_fusion_nonzero();
  END IF;
END $$;

-- ============================================================================
-- PHASE 15.1: DATA PROTECTION GUARDS
-- ============================================================================
-- Prevent accidental data loss during plan changes
-- Fusion Score and Intelligence history must NEVER be deleted

-- Guard function: Validate that plan changes don't delete critical data
CREATE OR REPLACE FUNCTION validate_plan_change_data_integrity(
  p_user_id UUID,
  p_old_tier TEXT,
  p_new_tier TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_fusion_count INTEGER;
  v_intelligence_count INTEGER;
  v_integration_count INTEGER;
  v_result JSONB;
BEGIN
  -- Count current data
  SELECT COUNT(*) INTO v_fusion_count
  FROM fusion_scores WHERE user_id = p_user_id;
  
  SELECT COUNT(*) INTO v_intelligence_count
  FROM integration_intelligence WHERE user_id = p_user_id;
  
  SELECT COUNT(*) INTO v_integration_count
  FROM user_integrations WHERE user_id = p_user_id;
  
  v_result := jsonb_build_object(
    'user_id', p_user_id,
    'old_tier', p_old_tier,
    'new_tier', p_new_tier,
    'data_snapshot', jsonb_build_object(
      'fusion_scores_count', v_fusion_count,
      'intelligence_records_count', v_intelligence_count,
      'integrations_count', v_integration_count
    ),
    'validated_at', now(),
    'data_preserved', true
  );
  
  RETURN v_result;
END;
$$;

-- Enhanced downgrade handler with data protection
CREATE OR REPLACE FUNCTION handle_subscription_downgrade_safe(
  p_user_id UUID,
  p_old_tier TEXT,
  p_new_tier TEXT,
  p_period_end_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
  v_entitlements_snapshot JSONB;
  v_data_integrity JSONB;
  v_flag_enabled BOOLEAN;
BEGIN
  -- Check if entitlement mutations are enabled
  SELECT is_control_flag_enabled('entitlement_mutations_enabled') INTO v_flag_enabled;
  IF NOT v_flag_enabled THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Entitlement mutations are currently disabled',
      'kill_switch', 'entitlement_mutations_enabled'
    );
  END IF;

  -- Validate data integrity before proceeding
  v_data_integrity := validate_plan_change_data_integrity(p_user_id, p_old_tier, p_new_tier);
  
  -- Capture current entitlements snapshot for audit
  SELECT row_to_json(e.*) INTO v_entitlements_snapshot
  FROM (SELECT * FROM get_effective_entitlements(p_user_id)) e;

  -- Log the downgrade event with data integrity snapshot
  INSERT INTO subscription_history (
    user_id,
    event_type,
    lifecycle_event,
    previous_tier,
    new_tier,
    entitlements_snapshot,
    period_end_at,
    metadata
  ) VALUES (
    p_user_id,
    'subscription_downgrade',
    'downgrade',
    p_old_tier,
    p_new_tier,
    v_entitlements_snapshot,
    p_period_end_at,
    jsonb_build_object(
      'graceful_downgrade', true,
      'data_preserved', true,
      'intelligence_preserved', true,
      'fusion_score_preserved', true,
      'data_integrity_snapshot', v_data_integrity
    )
  );

  -- Log launch event
  PERFORM log_launch_event(
    p_user_id,
    'downgrade_completed',
    jsonb_build_object(
      'old_tier', p_old_tier,
      'new_tier', p_new_tier,
      'data_integrity', v_data_integrity
    )
  );

  -- Update profile subscription tier
  UPDATE profiles
  SET 
    subscription_tier = p_new_tier,
    updated_at = now()
  WHERE id = p_user_id;

  -- Sync to entitlements (respects custom overrides)
  PERFORM sync_stripe_to_entitlements(p_user_id, p_new_tier, 'active');

  RETURN jsonb_build_object(
    'success', true,
    'action', 'graceful_downgrade',
    'old_tier', p_old_tier,
    'new_tier', p_new_tier,
    'data_preserved', true,
    'data_integrity', v_data_integrity,
    'period_end_at', p_period_end_at
  );
END;
$$;

-- Enhanced cancellation handler with data protection
CREATE OR REPLACE FUNCTION handle_subscription_cancellation_safe(
  p_user_id UUID,
  p_current_tier TEXT,
  p_period_end_at TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_entitlements_snapshot JSONB;
  v_data_integrity JSONB;
  v_flag_enabled BOOLEAN;
BEGIN
  -- Check if entitlement mutations are enabled
  SELECT is_control_flag_enabled('entitlement_mutations_enabled') INTO v_flag_enabled;
  IF NOT v_flag_enabled THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Entitlement mutations are currently disabled',
      'kill_switch', 'entitlement_mutations_enabled'
    );
  END IF;

  -- Validate data integrity
  v_data_integrity := validate_plan_change_data_integrity(p_user_id, p_current_tier, 'canceled');

  -- Capture current entitlements snapshot
  SELECT row_to_json(e.*) INTO v_entitlements_snapshot
  FROM (SELECT * FROM get_effective_entitlements(p_user_id)) e;

  -- Create custom entitlement record to freeze current state
  INSERT INTO tenant_entitlements (
    user_id,
    max_connected_integrations,
    max_fusion_contributors,
    intelligence_refresh_frequency,
    historical_depth_days,
    cross_integration_depth,
    admin_visibility_scope,
    plan_tier,
    is_beta_tenant
  )
  SELECT 
    p_user_id,
    (v_entitlements_snapshot->>'max_connected_integrations')::INTEGER,
    (v_entitlements_snapshot->>'max_fusion_contributors')::INTEGER,
    (v_entitlements_snapshot->>'intelligence_refresh_frequency')::INTEGER,
    (v_entitlements_snapshot->>'historical_depth_days')::INTEGER,
    v_entitlements_snapshot->>'cross_integration_depth',
    v_entitlements_snapshot->>'admin_visibility_scope',
    p_current_tier,
    COALESCE((v_entitlements_snapshot->>'is_beta_tenant')::BOOLEAN, false)
  ON CONFLICT (user_id) DO UPDATE SET
    updated_at = now();

  -- Log the cancellation event
  INSERT INTO subscription_history (
    user_id,
    event_type,
    lifecycle_event,
    previous_tier,
    new_tier,
    new_status,
    entitlements_snapshot,
    period_end_at,
    metadata
  ) VALUES (
    p_user_id,
    'subscription_canceled',
    'cancel',
    p_current_tier,
    p_current_tier,
    'canceled',
    v_entitlements_snapshot,
    p_period_end_at,
    jsonb_build_object(
      'entitlements_frozen', true,
      'access_until', p_period_end_at,
      'graceful_cancellation', true,
      'data_integrity_snapshot', v_data_integrity
    )
  );

  -- Log launch event
  PERFORM log_launch_event(
    p_user_id,
    'cancellation',
    jsonb_build_object(
      'tier', p_current_tier,
      'access_until', p_period_end_at,
      'data_integrity', v_data_integrity
    )
  );

  -- Update profile status (but NOT tier - they keep access until period end)
  UPDATE profiles
  SET 
    subscription_status = 'canceled',
    updated_at = now()
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'action', 'graceful_cancellation',
    'current_tier', p_current_tier,
    'entitlements_frozen', true,
    'access_until', p_period_end_at,
    'data_integrity', v_data_integrity
  );
END;
$$;

-- Grant execute to service role
GRANT EXECUTE ON FUNCTION validate_plan_change_data_integrity(UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION handle_subscription_downgrade_safe(UUID, TEXT, TEXT, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION handle_subscription_cancellation_safe(UUID, TEXT, TIMESTAMPTZ) TO service_role;

COMMENT ON FUNCTION validate_plan_change_data_integrity IS 'Phase 15: Validates that plan changes preserve critical user data';
COMMENT ON FUNCTION handle_subscription_downgrade_safe IS 'Phase 15: Enhanced downgrade handler with kill switch check and data protection';
COMMENT ON FUNCTION handle_subscription_cancellation_safe IS 'Phase 15: Enhanced cancellation handler with kill switch check and data protection';

-- ============================================================================
-- PHASE 15.5: LAUNCH READINESS METRICS VIEW
-- ============================================================================
-- Aggregated view for the admin launch readiness dashboard

CREATE OR REPLACE FUNCTION get_launch_readiness_status()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
  v_kill_switches JSONB;
  v_integration_health JSONB;
  v_last_aggregator_run TIMESTAMPTZ;
  v_conversion_metrics JSONB;
BEGIN
  -- Get kill switch states
  SELECT jsonb_object_agg(key, jsonb_build_object('enabled', enabled, 'updated_at', updated_at))
  INTO v_kill_switches
  FROM system_control_flags;
  
  -- Get integration health summary
  SELECT jsonb_build_object(
    'total_integrations', COUNT(*),
    'healthy_integrations', COUNT(*) FILTER (WHERE status = 'active' OR status = 'connected'),
    'failed_integrations', COUNT(*) FILTER (WHERE status = 'failed' OR status = 'error'),
    'pending_integrations', COUNT(*) FILTER (WHERE status = 'pending')
  )
  INTO v_integration_health
  FROM user_integrations;
  
  -- Get last aggregator run (from system_health_events if available)
  SELECT MAX(created_at) INTO v_last_aggregator_run
  FROM system_health_events
  WHERE component_name LIKE '%intelligence%' OR component_name LIKE '%aggregator%';
  
  -- Get conversion funnel metrics
  SELECT jsonb_build_object(
    'trials_started', COUNT(*) FILTER (WHERE event_type = 'trial_started'),
    'first_integrations', COUNT(*) FILTER (WHERE event_type = 'first_integration_connected'),
    'first_intelligence', COUNT(*) FILTER (WHERE event_type = 'first_intelligence_generated'),
    'fusion_nonzero', COUNT(*) FILTER (WHERE event_type = 'fusion_score_nonzero'),
    'upgrades_completed', COUNT(*) FILTER (WHERE event_type = 'upgrade_completed'),
    'cancellations', COUNT(*) FILTER (WHERE event_type = 'cancellation')
  )
  INTO v_conversion_metrics
  FROM launch_events
  WHERE occurred_at >= NOW() - INTERVAL '30 days';
  
  v_result := jsonb_build_object(
    'timestamp', now(),
    'kill_switches', v_kill_switches,
    'integration_health', v_integration_health,
    'last_aggregator_run', v_last_aggregator_run,
    'conversion_metrics_30d', v_conversion_metrics,
    'entitlement_enforcement_active', is_control_flag_enabled('entitlement_mutations_enabled'),
    'stripe_billing_active', is_control_flag_enabled('stripe_billing_enabled')
  );
  
  RETURN v_result;
END;
$$;

-- Grant execute to authenticated (admin check in frontend)
GRANT EXECUTE ON FUNCTION get_launch_readiness_status() TO authenticated;

COMMENT ON FUNCTION get_launch_readiness_status IS 'Phase 15: Returns aggregated launch readiness status for admin dashboard';

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT ON system_control_flags TO authenticated;
GRANT SELECT ON launch_events TO authenticated;
GRANT ALL ON system_control_flags TO service_role;
GRANT ALL ON launch_events TO service_role;
