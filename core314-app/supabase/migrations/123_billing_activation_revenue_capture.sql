-- ============================================================================
-- PHASE 13: BILLING ACTIVATION & REVENUE CAPTURE
-- Migration 123: Billing Foundation & Entitlement Sync
-- ============================================================================
-- 
-- NON-NEGOTIABLE RULES:
-- 1. Billing must NEVER directly control features
-- 2. Entitlements remain the sole authority
-- 3. All integrations remain visible and functional on all plans
-- 4. No beta-only logic - this must be launch-ready behavior
--
-- This migration adds:
-- 1. Beta/incentive support fields to profiles
-- 2. Stripe plan → entitlement sync function
-- 3. Subscription lifecycle tracking enhancements
-- ============================================================================

-- ============================================================================
-- PHASE 13.3: BETA / INCENTIVE SUPPORT FIELDS
-- ============================================================================
-- Add beta tenant and discount fields to profiles
-- These flags are for internal tracking only - they do NOT gate features

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_beta_tenant BOOLEAN DEFAULT false;

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS discount_percent INTEGER DEFAULT 0 
CHECK (discount_percent >= 0 AND discount_percent <= 100);

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS discount_expiration TIMESTAMPTZ;

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS billing_interval TEXT DEFAULT 'monthly'
CHECK (billing_interval IN ('monthly', 'annual'));

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS stripe_price_id TEXT;

COMMENT ON COLUMN profiles.is_beta_tenant IS 'Phase 13: Internal flag for beta tenants. Does NOT gate features - entitlements are the sole authority.';
COMMENT ON COLUMN profiles.discount_percent IS 'Phase 13: Discount percentage for this tenant (0-100). Applied at Stripe checkout level.';
COMMENT ON COLUMN profiles.discount_expiration IS 'Phase 13: When the discount expires. NULL means no expiration.';
COMMENT ON COLUMN profiles.billing_interval IS 'Phase 13: Monthly or annual billing cycle.';
COMMENT ON COLUMN profiles.stripe_price_id IS 'Phase 13: Current Stripe price ID for the subscription.';

-- Create index for beta tenant queries
CREATE INDEX IF NOT EXISTS idx_profiles_is_beta_tenant 
ON profiles(is_beta_tenant) 
WHERE is_beta_tenant = true;

-- ============================================================================
-- PHASE 13.1: STRIPE PLAN → ENTITLEMENT SYNC
-- ============================================================================
-- This function syncs Stripe subscription changes to tenant_entitlements
-- It ensures entitlements are the SOLE authority - billing just triggers updates

CREATE OR REPLACE FUNCTION sync_stripe_to_entitlements(
  p_user_id UUID,
  p_subscription_tier TEXT,
  p_subscription_status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_entitlements RECORD;
  v_result JSONB;
BEGIN
  -- ========================================================================
  -- GUARD: Entitlements are the sole authority
  -- This function ONLY updates entitlements based on subscription changes
  -- It does NOT directly control features
  -- ========================================================================

  -- If user has custom entitlements, do NOT override them
  -- Custom entitlements take precedence over plan-based defaults
  IF EXISTS (SELECT 1 FROM tenant_entitlements WHERE user_id = p_user_id) THEN
    -- Just update the plan_tier field to track the subscription
    UPDATE tenant_entitlements
    SET 
      plan_tier = CASE 
        WHEN p_subscription_tier = 'enterprise' THEN 'enterprise'
        WHEN p_subscription_tier = 'professional' THEN 'professional'
        WHEN p_subscription_tier = 'starter' THEN 'starter'
        ELSE plan_tier -- Keep existing if unknown
      END,
      updated_at = now()
    WHERE user_id = p_user_id;
    
    RETURN jsonb_build_object(
      'action', 'updated_plan_tier',
      'user_id', p_user_id,
      'new_tier', p_subscription_tier,
      'custom_entitlements_preserved', true
    );
  END IF;

  -- No custom entitlements - the system will use plan-based defaults
  -- from get_effective_entitlements() function (created in migration 122)
  -- We don't need to create a row - the function handles defaults

  RETURN jsonb_build_object(
    'action', 'using_plan_defaults',
    'user_id', p_user_id,
    'subscription_tier', p_subscription_tier,
    'subscription_status', p_subscription_status
  );
END;
$$;

COMMENT ON FUNCTION sync_stripe_to_entitlements IS 
  'Phase 13: Syncs Stripe subscription changes to entitlements. Entitlements remain the sole authority.';

GRANT EXECUTE ON FUNCTION sync_stripe_to_entitlements TO service_role;

-- ============================================================================
-- PHASE 13.2: SUBSCRIPTION LIFECYCLE TRACKING
-- ============================================================================
-- Enhanced subscription history for upgrade/downgrade/cancel tracking

ALTER TABLE subscription_history
ADD COLUMN IF NOT EXISTS lifecycle_event TEXT 
CHECK (lifecycle_event IN ('upgrade', 'downgrade', 'cancel', 'reactivate', 'trial_start', 'trial_end', 'payment_failed', 'payment_recovered'));

ALTER TABLE subscription_history
ADD COLUMN IF NOT EXISTS entitlements_snapshot JSONB;

ALTER TABLE subscription_history
ADD COLUMN IF NOT EXISTS period_end_at TIMESTAMPTZ;

COMMENT ON COLUMN subscription_history.lifecycle_event IS 'Phase 13: Type of subscription lifecycle event.';
COMMENT ON COLUMN subscription_history.entitlements_snapshot IS 'Phase 13: Snapshot of entitlements at time of event for audit.';
COMMENT ON COLUMN subscription_history.period_end_at IS 'Phase 13: When the current billing period ends (for cancellation grace period).';

-- ============================================================================
-- PHASE 13.2: GRACEFUL DOWNGRADE HANDLING
-- ============================================================================
-- Function to handle subscription downgrades gracefully
-- No data loss, no intelligence corruption, no Fusion Score reset

CREATE OR REPLACE FUNCTION handle_subscription_downgrade(
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
BEGIN
  -- ========================================================================
  -- GRACEFUL DOWNGRADE RULES:
  -- 1. No data loss - all integrations remain
  -- 2. No intelligence corruption - insights preserved
  -- 3. No Fusion Score reset - historical data maintained
  -- 4. Entitlements reduce at period end (if provided) or immediately
  -- ========================================================================

  -- Capture current entitlements snapshot for audit
  SELECT row_to_json(e.*) INTO v_entitlements_snapshot
  FROM (SELECT * FROM get_effective_entitlements(p_user_id)) e;

  -- Log the downgrade event
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
      'fusion_score_preserved', true
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
    'period_end_at', p_period_end_at
  );
END;
$$;

COMMENT ON FUNCTION handle_subscription_downgrade IS 
  'Phase 13: Handles subscription downgrades gracefully without data loss or intelligence corruption.';

GRANT EXECUTE ON FUNCTION handle_subscription_downgrade TO service_role;

-- ============================================================================
-- PHASE 13.2: CANCELLATION HANDLING
-- ============================================================================
-- Function to handle subscription cancellation
-- Freeze entitlements at current state until period end

CREATE OR REPLACE FUNCTION handle_subscription_cancellation(
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
BEGIN
  -- ========================================================================
  -- CANCELLATION RULES:
  -- 1. Entitlements freeze at current state until period end
  -- 2. No immediate feature removal
  -- 3. User retains full access until period_end_at
  -- ========================================================================

  -- Capture current entitlements snapshot
  SELECT row_to_json(e.*) INTO v_entitlements_snapshot
  FROM (SELECT * FROM get_effective_entitlements(p_user_id)) e;

  -- Create custom entitlement record to freeze current state
  -- This ensures the user keeps their entitlements until period end
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
    -- Keep existing entitlements frozen
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
    p_current_tier, -- Tier stays same until period end
    'canceled',
    v_entitlements_snapshot,
    p_period_end_at,
    jsonb_build_object(
      'entitlements_frozen', true,
      'access_until', p_period_end_at,
      'graceful_cancellation', true
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
    'access_until', p_period_end_at
  );
END;
$$;

COMMENT ON FUNCTION handle_subscription_cancellation IS 
  'Phase 13: Handles subscription cancellation by freezing entitlements until period end.';

GRANT EXECUTE ON FUNCTION handle_subscription_cancellation TO service_role;

-- ============================================================================
-- PHASE 13.1: STRIPE PRODUCTS/PRICES REFERENCE TABLE
-- ============================================================================
-- Reference table for Stripe products and prices
-- Used for mapping and validation

CREATE TABLE IF NOT EXISTS stripe_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_product_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  product_type TEXT NOT NULL CHECK (product_type IN ('base_plan', 'addon')),
  tier TEXT CHECK (tier IN ('starter', 'professional', 'enterprise')),
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stripe_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_price_id TEXT NOT NULL UNIQUE,
  stripe_product_id TEXT NOT NULL REFERENCES stripe_products(stripe_product_id),
  billing_interval TEXT NOT NULL CHECK (billing_interval IN ('monthly', 'annual')),
  unit_amount INTEGER NOT NULL, -- in cents
  currency TEXT DEFAULT 'usd',
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE stripe_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_prices ENABLE ROW LEVEL SECURITY;

-- Policies: Read-only for authenticated users, full access for service role
CREATE POLICY "Authenticated users can read stripe_products"
  ON stripe_products FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role has full access to stripe_products"
  ON stripe_products FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read stripe_prices"
  ON stripe_prices FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role has full access to stripe_prices"
  ON stripe_prices FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_stripe_products_type ON stripe_products(product_type);
CREATE INDEX IF NOT EXISTS idx_stripe_products_tier ON stripe_products(tier);
CREATE INDEX IF NOT EXISTS idx_stripe_prices_product ON stripe_prices(stripe_product_id);
CREATE INDEX IF NOT EXISTS idx_stripe_prices_interval ON stripe_prices(billing_interval);

COMMENT ON TABLE stripe_products IS 'Phase 13: Reference table for Stripe products.';
COMMENT ON TABLE stripe_prices IS 'Phase 13: Reference table for Stripe prices with billing intervals.';

-- ============================================================================
-- PHASE 13.1: SEED STRIPE PRODUCTS/PRICES (Test Mode)
-- ============================================================================
-- These are placeholder IDs - replace with actual Stripe IDs in production

INSERT INTO stripe_products (stripe_product_id, name, description, product_type, tier) VALUES
  ('prod_starter', 'Core314 Starter', 'Perfect for small teams getting started', 'base_plan', 'starter'),
  ('prod_professional', 'Core314 Pro', 'Advanced operations for growing businesses', 'base_plan', 'professional'),
  ('prod_enterprise', 'Core314 Enterprise', 'Full-featured for large operations', 'base_plan', 'enterprise')
ON CONFLICT (stripe_product_id) DO NOTHING;

INSERT INTO stripe_prices (stripe_price_id, stripe_product_id, billing_interval, unit_amount) VALUES
  ('price_starter_monthly', 'prod_starter', 'monthly', 9900),
  ('price_starter_annual', 'prod_starter', 'annual', 99000),
  ('price_professional_monthly', 'prod_professional', 'monthly', 99900),
  ('price_professional_annual', 'prod_professional', 'annual', 999000),
  ('price_enterprise_monthly', 'prod_enterprise', 'monthly', 0),
  ('price_enterprise_annual', 'prod_enterprise', 'annual', 0)
ON CONFLICT (stripe_price_id) DO NOTHING;

-- ============================================================================
-- PHASE 13.1: PLAN → ENTITLEMENT MAPPING FUNCTION
-- ============================================================================
-- Returns the entitlement limits for a given plan tier

CREATE OR REPLACE FUNCTION get_plan_entitlement_limits(p_tier TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN CASE p_tier
    WHEN 'enterprise' THEN jsonb_build_object(
      'max_connected_integrations', -1,
      'max_fusion_contributors', -1,
      'intelligence_refresh_frequency', 5,
      'historical_depth_days', -1,
      'cross_integration_depth', 'full',
      'admin_visibility_scope', 'full'
    )
    WHEN 'professional' THEN jsonb_build_object(
      'max_connected_integrations', 10,
      'max_fusion_contributors', 7,
      'intelligence_refresh_frequency', 15,
      'historical_depth_days', 90,
      'cross_integration_depth', 'deep',
      'admin_visibility_scope', 'standard'
    )
    WHEN 'starter' THEN jsonb_build_object(
      'max_connected_integrations', 5,
      'max_fusion_contributors', 3,
      'intelligence_refresh_frequency', 60,
      'historical_depth_days', 30,
      'cross_integration_depth', 'basic',
      'admin_visibility_scope', 'limited'
    )
    ELSE jsonb_build_object(
      'max_connected_integrations', 3,
      'max_fusion_contributors', 2,
      'intelligence_refresh_frequency', 120,
      'historical_depth_days', 7,
      'cross_integration_depth', 'basic',
      'admin_visibility_scope', 'limited'
    )
  END;
END;
$$;

COMMENT ON FUNCTION get_plan_entitlement_limits IS 
  'Phase 13: Returns entitlement limits for a given plan tier. Used for plan comparison UI.';

GRANT EXECUTE ON FUNCTION get_plan_entitlement_limits TO authenticated;

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT ON stripe_products TO authenticated;
GRANT SELECT ON stripe_prices TO authenticated;
GRANT ALL ON stripe_products TO service_role;
GRANT ALL ON stripe_prices TO service_role;
