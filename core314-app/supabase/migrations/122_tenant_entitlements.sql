-- ============================================================================
-- PHASE 12: MONETIZATION, ENTITLEMENTS & UPGRADE READINESS
-- Migration 122: Tenant Entitlements Table
-- ============================================================================
-- 
-- NON-NEGOTIABLE RULES:
-- 1. All integrations MUST remain visible and fully functional on all plans
-- 2. Plans may ONLY gate scale, depth, and intelligence richness — never availability
-- 3. Default = FULL ACCESS (for beta / internal tenants)
-- 4. Intelligence must NEVER error, show partial data, or mislead users
-- 5. Degradation must be graceful and silent
--
-- This table stores custom entitlement overrides per tenant/user.
-- If no row exists, the system falls back to plan-based defaults.
-- ============================================================================

-- Create tenant_entitlements table
CREATE TABLE IF NOT EXISTS tenant_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Integration limits (-1 = unlimited)
  max_connected_integrations INTEGER NOT NULL DEFAULT -1,
  max_fusion_contributors INTEGER NOT NULL DEFAULT -1,
  
  -- Intelligence limits
  intelligence_refresh_frequency INTEGER NOT NULL DEFAULT 5, -- minutes
  historical_depth_days INTEGER NOT NULL DEFAULT -1, -- -1 = unlimited
  
  -- Depth settings
  cross_integration_depth TEXT NOT NULL DEFAULT 'full' 
    CHECK (cross_integration_depth IN ('basic', 'standard', 'deep', 'full')),
  admin_visibility_scope TEXT NOT NULL DEFAULT 'full'
    CHECK (admin_visibility_scope IN ('limited', 'standard', 'full')),
  
  -- Plan metadata
  plan_tier TEXT NOT NULL DEFAULT 'internal'
    CHECK (plan_tier IN ('starter', 'professional', 'enterprise', 'internal')),
  is_beta_tenant BOOLEAN NOT NULL DEFAULT true,
  
  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Ensure one entitlement record per user
  CONSTRAINT unique_user_entitlements UNIQUE (user_id)
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_tenant_entitlements_user_id 
  ON tenant_entitlements(user_id);

-- Enable RLS
ALTER TABLE tenant_entitlements ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own entitlements
CREATE POLICY "Users can read own entitlements"
  ON tenant_entitlements
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Admins can read all entitlements
CREATE POLICY "Admins can read all entitlements"
  ON tenant_entitlements
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Policy: Admins can insert/update entitlements
CREATE POLICY "Admins can manage entitlements"
  ON tenant_entitlements
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_tenant_entitlements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_tenant_entitlements_updated_at
  BEFORE UPDATE ON tenant_entitlements
  FOR EACH ROW
  EXECUTE FUNCTION update_tenant_entitlements_updated_at();

-- ============================================================================
-- ENTITLEMENT USAGE TRACKING
-- ============================================================================
-- Track current usage against entitlements for admin visibility

CREATE TABLE IF NOT EXISTS entitlement_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Current usage counts
  connected_integrations_count INTEGER NOT NULL DEFAULT 0,
  fusion_contributors_count INTEGER NOT NULL DEFAULT 0,
  
  -- Last calculation timestamp
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Ensure one usage record per user
  CONSTRAINT unique_user_usage UNIQUE (user_id)
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_entitlement_usage_user_id 
  ON entitlement_usage(user_id);

-- Enable RLS
ALTER TABLE entitlement_usage ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own usage
CREATE POLICY "Users can read own usage"
  ON entitlement_usage
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Admins can read all usage
CREATE POLICY "Admins can read all usage"
  ON entitlement_usage
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Policy: System can update usage (via service role)
CREATE POLICY "System can manage usage"
  ON entitlement_usage
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- HELPER FUNCTION: Get effective entitlements for a user
-- ============================================================================
-- Returns entitlements with plan-based defaults if no custom override exists

CREATE OR REPLACE FUNCTION get_effective_entitlements(p_user_id UUID)
RETURNS TABLE (
  max_connected_integrations INTEGER,
  max_fusion_contributors INTEGER,
  intelligence_refresh_frequency INTEGER,
  historical_depth_days INTEGER,
  cross_integration_depth TEXT,
  admin_visibility_scope TEXT,
  plan_tier TEXT,
  is_beta_tenant BOOLEAN
) AS $$
DECLARE
  v_subscription_tier TEXT;
  v_role TEXT;
BEGIN
  -- First check for custom entitlements
  IF EXISTS (SELECT 1 FROM tenant_entitlements WHERE user_id = p_user_id) THEN
    RETURN QUERY
    SELECT 
      te.max_connected_integrations,
      te.max_fusion_contributors,
      te.intelligence_refresh_frequency,
      te.historical_depth_days,
      te.cross_integration_depth,
      te.admin_visibility_scope,
      te.plan_tier,
      te.is_beta_tenant
    FROM tenant_entitlements te
    WHERE te.user_id = p_user_id;
    RETURN;
  END IF;

  -- Get user's subscription tier and role
  SELECT subscription_tier, role INTO v_subscription_tier, v_role
  FROM profiles
  WHERE id = p_user_id;

  -- Admin or enterprise users get full access (beta/internal)
  IF v_role = 'admin' OR v_subscription_tier = 'enterprise' THEN
    RETURN QUERY SELECT 
      -1::INTEGER, -- max_connected_integrations (unlimited)
      -1::INTEGER, -- max_fusion_contributors (unlimited)
      5::INTEGER,  -- intelligence_refresh_frequency
      -1::INTEGER, -- historical_depth_days (unlimited)
      'full'::TEXT, -- cross_integration_depth
      'full'::TEXT, -- admin_visibility_scope
      'internal'::TEXT, -- plan_tier
      true::BOOLEAN; -- is_beta_tenant
    RETURN;
  END IF;

  -- Professional tier
  IF v_subscription_tier = 'professional' THEN
    RETURN QUERY SELECT 
      10::INTEGER, -- max_connected_integrations
      7::INTEGER,  -- max_fusion_contributors
      15::INTEGER, -- intelligence_refresh_frequency
      90::INTEGER, -- historical_depth_days
      'deep'::TEXT, -- cross_integration_depth
      'standard'::TEXT, -- admin_visibility_scope
      'professional'::TEXT, -- plan_tier
      false::BOOLEAN; -- is_beta_tenant
    RETURN;
  END IF;

  -- Starter tier
  IF v_subscription_tier = 'starter' THEN
    RETURN QUERY SELECT 
      5::INTEGER,  -- max_connected_integrations
      3::INTEGER,  -- max_fusion_contributors
      60::INTEGER, -- intelligence_refresh_frequency
      30::INTEGER, -- historical_depth_days
      'basic'::TEXT, -- cross_integration_depth
      'limited'::TEXT, -- admin_visibility_scope
      'starter'::TEXT, -- plan_tier
      false::BOOLEAN; -- is_beta_tenant
    RETURN;
  END IF;

  -- Default (none/free tier) - still allows basic access
  RETURN QUERY SELECT 
    3::INTEGER,  -- max_connected_integrations
    2::INTEGER,  -- max_fusion_contributors
    120::INTEGER, -- intelligence_refresh_frequency
    7::INTEGER,  -- historical_depth_days
    'basic'::TEXT, -- cross_integration_depth
    'limited'::TEXT, -- admin_visibility_scope
    'starter'::TEXT, -- plan_tier
    false::BOOLEAN; -- is_beta_tenant
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_effective_entitlements(UUID) TO authenticated;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE tenant_entitlements IS 
  'Phase 12: Custom entitlement overrides per tenant. Falls back to plan-based defaults if no row exists.';

COMMENT ON TABLE entitlement_usage IS 
  'Phase 12: Tracks current usage against entitlements for admin visibility.';

COMMENT ON FUNCTION get_effective_entitlements(UUID) IS 
  'Phase 12: Returns effective entitlements for a user, with plan-based defaults if no custom override exists.';
