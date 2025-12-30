-- ============================================================================
-- PHASE 16B: INTEGRATION CONNECTION TYPE ENFORCEMENT
-- Migration 125: Add connection_type field for UI-level connection flow control
-- ============================================================================
-- 
-- This migration adds a new `connection_type` column to control how users
-- connect integrations in the UI. This is separate from `auth_type` which
-- controls how the backend authenticates with the integration.
--
-- connection_type values:
-- - oauth2: User initiates OAuth flow via "Connect" button
-- - api_key: Admin-configured API key (no user OAuth flow)
-- - manual: Manual setup by admin (no user OAuth flow)
-- - observational: No authentication required (passive observation)
--
-- IMPORTANT: If connection_type is missing, default to 'manual' (NOT oauth2)
-- ============================================================================

-- Step 1: Add the connection_type column (nullable initially for backfill)
ALTER TABLE public.integration_registry
  ADD COLUMN IF NOT EXISTS connection_type TEXT;

-- Step 2: Backfill existing integrations based on auth_type and service_name

-- 2a: Set oauth2 connection_type for known OAuth integrations
UPDATE public.integration_registry
SET connection_type = 'oauth2'
WHERE auth_type = 'oauth2'
  AND connection_type IS NULL;

-- 2b: Set api_key connection_type for api_key auth_type integrations
-- These are integrations like Basecamp, Linear, GitHub, etc. that use API keys
-- but don't have a user-facing OAuth flow
UPDATE public.integration_registry
SET connection_type = 'api_key'
WHERE auth_type = 'api_key'
  AND connection_type IS NULL;

-- 2c: Set manual connection_type for webhook auth_type integrations
UPDATE public.integration_registry
SET connection_type = 'manual'
WHERE auth_type = 'webhook'
  AND connection_type IS NULL;

-- 2d: Set manual for any remaining NULL values (safety fallback)
UPDATE public.integration_registry
SET connection_type = 'manual'
WHERE connection_type IS NULL;

-- Step 3: Add constraint and default
-- Default to 'manual' for any new integrations that don't specify connection_type
ALTER TABLE public.integration_registry
  ALTER COLUMN connection_type SET DEFAULT 'manual';

-- Make the column NOT NULL now that all rows have values
ALTER TABLE public.integration_registry
  ALTER COLUMN connection_type SET NOT NULL;

-- Add CHECK constraint for valid values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'integration_registry_connection_type_check'
  ) THEN
    ALTER TABLE public.integration_registry
      ADD CONSTRAINT integration_registry_connection_type_check
      CHECK (connection_type IN ('oauth2', 'api_key', 'manual', 'observational'));
  END IF;
END $$;

-- Step 4: Create index for efficient filtering by connection_type
CREATE INDEX IF NOT EXISTS idx_integration_registry_connection_type 
  ON public.integration_registry(connection_type);

-- Step 5: Verify the migration
DO $$
DECLARE
  oauth2_count INTEGER;
  api_key_count INTEGER;
  manual_count INTEGER;
  observational_count INTEGER;
  null_count INTEGER;
  basecamp_type TEXT;
BEGIN
  SELECT COUNT(*) INTO oauth2_count FROM public.integration_registry WHERE connection_type = 'oauth2';
  SELECT COUNT(*) INTO api_key_count FROM public.integration_registry WHERE connection_type = 'api_key';
  SELECT COUNT(*) INTO manual_count FROM public.integration_registry WHERE connection_type = 'manual';
  SELECT COUNT(*) INTO observational_count FROM public.integration_registry WHERE connection_type = 'observational';
  SELECT COUNT(*) INTO null_count FROM public.integration_registry WHERE connection_type IS NULL;
  SELECT connection_type INTO basecamp_type FROM public.integration_registry WHERE service_name = 'basecamp';
  
  RAISE NOTICE 'Connection type distribution: oauth2=%, api_key=%, manual=%, observational=%, null=%',
    oauth2_count, api_key_count, manual_count, observational_count, null_count;
  
  IF basecamp_type IS NOT NULL THEN
    RAISE NOTICE 'Basecamp connection_type: %', basecamp_type;
  END IF;
  
  IF null_count > 0 THEN
    RAISE WARNING 'Found % integrations with NULL connection_type!', null_count;
  END IF;
END $$;

-- Add documentation comment
COMMENT ON COLUMN public.integration_registry.connection_type IS 
  'Phase 16B: Controls how users connect this integration in the UI. Values: oauth2 (user OAuth flow), api_key (admin-configured), manual (admin setup), observational (no auth needed). Default: manual';

-- ============================================================================
-- GRANTS
-- ============================================================================
-- No new grants needed - connection_type is part of existing table with existing policies
