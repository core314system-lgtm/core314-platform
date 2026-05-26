-- ============================================================================
-- Platform Stabilization: Subscription Tier Alignment & Data Retention
-- Date: 2026-03-13
-- ============================================================================
-- 
-- Task 1: Align tenant_entitlements.plan_tier to use standardized tier names
-- Task 2: Update get_effective_entitlements() to use new tier names
-- Task 3: Create data retention policies with archive-before-delete
--
-- Standardized tier names:
--   Free, Monitor, Intelligence, Command Center, Enterprise
--
-- NOTE: Does NOT modify signal engine, integrations, or brief generator
-- ============================================================================

-- ============================================================================
-- TASK 1: Align tenant_entitlements.plan_tier
-- Old values: starter, professional, enterprise, internal
-- New values: free, monitor, intelligence, command_center, enterprise, internal
-- ============================================================================

-- Drop the old constraint
ALTER TABLE tenant_entitlements DROP CONSTRAINT IF EXISTS tenant_entitlements_plan_tier_check;

-- Migrate existing data
UPDATE tenant_entitlements SET plan_tier = 'monitor' WHERE plan_tier = 'starter';
UPDATE tenant_entitlements SET plan_tier = 'intelligence' WHERE plan_tier = 'professional';

-- Add new constraint with all valid tier names
ALTER TABLE tenant_entitlements ADD CONSTRAINT tenant_entitlements_plan_tier_check
  CHECK (plan_tier IN ('free', 'monitor', 'intelligence', 'command_center', 'enterprise', 'internal'));

-- ============================================================================
-- TASK 2: Update get_effective_entitlements() to use new tier names
-- ============================================================================

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

  -- Admin or enterprise users get full access
  IF v_role = 'admin' OR v_subscription_tier = 'enterprise' THEN
    RETURN QUERY SELECT 
      -1::INTEGER,    -- max_connected_integrations (unlimited)
      -1::INTEGER,    -- max_fusion_contributors (unlimited)
      5::INTEGER,     -- intelligence_refresh_frequency
      -1::INTEGER,    -- historical_depth_days (unlimited)
      'full'::TEXT,   -- cross_integration_depth
      'full'::TEXT,   -- admin_visibility_scope
      'enterprise'::TEXT, -- plan_tier (was 'internal')
      true::BOOLEAN;  -- is_beta_tenant
    RETURN;
  END IF;

  -- Command Center tier
  IF v_subscription_tier = 'command_center' THEN
    RETURN QUERY SELECT 
      -1::INTEGER,    -- max_connected_integrations (unlimited)
      -1::INTEGER,    -- max_fusion_contributors (unlimited)
      5::INTEGER,     -- intelligence_refresh_frequency
      -1::INTEGER,    -- historical_depth_days (unlimited)
      'full'::TEXT,   -- cross_integration_depth
      'full'::TEXT,   -- admin_visibility_scope
      'command_center'::TEXT, -- plan_tier
      false::BOOLEAN; -- is_beta_tenant
    RETURN;
  END IF;

  -- Intelligence tier (was 'professional')
  IF v_subscription_tier = 'intelligence' THEN
    RETURN QUERY SELECT 
      10::INTEGER,    -- max_connected_integrations
      7::INTEGER,     -- max_fusion_contributors
      15::INTEGER,    -- intelligence_refresh_frequency
      90::INTEGER,    -- historical_depth_days
      'deep'::TEXT,   -- cross_integration_depth
      'standard'::TEXT, -- admin_visibility_scope
      'intelligence'::TEXT, -- plan_tier
      false::BOOLEAN; -- is_beta_tenant
    RETURN;
  END IF;

  -- Monitor tier (was 'starter')
  IF v_subscription_tier = 'monitor' THEN
    RETURN QUERY SELECT 
      5::INTEGER,     -- max_connected_integrations
      3::INTEGER,     -- max_fusion_contributors
      60::INTEGER,    -- intelligence_refresh_frequency
      30::INTEGER,    -- historical_depth_days
      'basic'::TEXT,  -- cross_integration_depth
      'limited'::TEXT, -- admin_visibility_scope
      'monitor'::TEXT, -- plan_tier
      false::BOOLEAN; -- is_beta_tenant
    RETURN;
  END IF;

  -- Default (none/free tier) - still allows basic access
  RETURN QUERY SELECT 
    3::INTEGER,     -- max_connected_integrations
    2::INTEGER,     -- max_fusion_contributors
    120::INTEGER,   -- intelligence_refresh_frequency
    7::INTEGER,     -- historical_depth_days
    'basic'::TEXT,  -- cross_integration_depth
    'limited'::TEXT, -- admin_visibility_scope
    'free'::TEXT,   -- plan_tier (was 'starter')
    false::BOOLEAN; -- is_beta_tenant
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_effective_entitlements(UUID) TO authenticated;

-- ============================================================================
-- TASK 3: Data Retention — Archive Tables
-- ============================================================================

-- Archive table for old integration_events (retains 90 days)
CREATE TABLE IF NOT EXISTS integration_events_archive (
  LIKE integration_events INCLUDING ALL
);

-- Remove any unique constraints on archive table (allow duplicates from re-runs)
-- The archive table is append-only for audit purposes
ALTER TABLE integration_events_archive DROP CONSTRAINT IF EXISTS integration_events_archive_pkey;
ALTER TABLE integration_events_archive ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NOW();

-- Enable RLS on archive table
ALTER TABLE integration_events_archive ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view archived events"
ON integration_events_archive FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

CREATE POLICY "Service role can manage archived events"
ON integration_events_archive FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Archive table for old operational_signals (retains 30 days for inactive)
CREATE TABLE IF NOT EXISTS operational_signals_archive (
  LIKE operational_signals INCLUDING ALL
);

ALTER TABLE operational_signals_archive DROP CONSTRAINT IF EXISTS operational_signals_archive_pkey;
ALTER TABLE operational_signals_archive ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE operational_signals_archive ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view archived signals"
ON operational_signals_archive FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

CREATE POLICY "Service role can manage archived signals"
ON operational_signals_archive FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- TASK 3: Data Retention — Archive + Purge Functions
-- ============================================================================

-- Function: Archive and delete integration_events older than 90 days
CREATE OR REPLACE FUNCTION archive_old_integration_events()
RETURNS INTEGER AS $$
DECLARE
  v_archived INTEGER;
BEGIN
  -- Archive events older than 90 days
  INSERT INTO integration_events_archive 
  SELECT *, NOW() as archived_at
  FROM integration_events 
  WHERE created_at < NOW() - INTERVAL '90 days'
  ON CONFLICT DO NOTHING;
  
  -- Delete archived events from main table
  DELETE FROM integration_events 
  WHERE created_at < NOW() - INTERVAL '90 days';
  
  GET DIAGNOSTICS v_archived = ROW_COUNT;
  
  RAISE NOTICE 'Archived and deleted % integration_events older than 90 days', v_archived;
  RETURN v_archived;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Archive and delete inactive operational_signals older than 30 days
CREATE OR REPLACE FUNCTION archive_old_operational_signals()
RETURNS INTEGER AS $$
DECLARE
  v_archived INTEGER;
BEGIN
  -- Archive inactive signals older than 30 days
  INSERT INTO operational_signals_archive
  SELECT *, NOW() as archived_at
  FROM operational_signals 
  WHERE is_active = false 
  AND created_at < NOW() - INTERVAL '30 days'
  ON CONFLICT DO NOTHING;
  
  -- Delete archived signals from main table
  DELETE FROM operational_signals 
  WHERE is_active = false 
  AND created_at < NOW() - INTERVAL '30 days';
  
  GET DIAGNOSTICS v_archived = ROW_COUNT;
  
  RAISE NOTICE 'Archived and deleted % inactive operational_signals older than 30 days', v_archived;
  RETURN v_archived;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TASK 3: Data Retention — pg_cron Scheduling
-- ============================================================================
-- These run daily at 3 AM UTC to archive and clean up old data

-- Schedule integration_events cleanup (daily at 3:00 AM UTC)
SELECT cron.schedule(
  'archive-integration-events-daily',
  '0 3 * * *',
  $$SELECT archive_old_integration_events()$$
);

-- Schedule operational_signals cleanup (daily at 3:15 AM UTC)
SELECT cron.schedule(
  'archive-operational-signals-daily',
  '15 3 * * *',
  $$SELECT archive_old_operational_signals()$$
);

-- ============================================================================
-- VERIFICATION COMMENTS
-- ============================================================================

COMMENT ON TABLE integration_events_archive IS 
  'Archive of integration_events older than 90 days. Created during platform stabilization 2026-03-13.';

COMMENT ON TABLE operational_signals_archive IS 
  'Archive of inactive operational_signals older than 30 days. Created during platform stabilization 2026-03-13.';

COMMENT ON FUNCTION archive_old_integration_events() IS 
  'Archives and deletes integration_events older than 90 days. Runs daily at 3:00 AM UTC via pg_cron.';

COMMENT ON FUNCTION archive_old_operational_signals() IS 
  'Archives and deletes inactive operational_signals older than 30 days. Runs daily at 3:15 AM UTC via pg_cron.';
