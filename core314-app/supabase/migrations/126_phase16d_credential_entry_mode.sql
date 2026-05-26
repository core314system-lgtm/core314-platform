-- ============================================================================
-- PHASE 16D: USER CONNECTABILITY FOR ALL MARKETPLACE INTEGRATIONS
-- Migration 126: Add credential_entry_mode field for self-service connections
-- ============================================================================
-- 
-- This migration adds a new `credential_entry_mode` column to control whether
-- users can self-service connect integrations or if they require admin setup.
--
-- credential_entry_mode values:
-- - user_supplied (DEFAULT): Users can connect via UI (OAuth, API key entry, etc.)
-- - admin_supplied: Only admins can configure (internal/enterprise integrations)
--
-- RULE: All marketplace integrations MUST be user_supplied.
-- Only internal/system integrations may use admin_supplied.
-- ============================================================================

-- Step 1: Add the credential_entry_mode column (nullable initially for backfill)
ALTER TABLE public.integration_registry
  ADD COLUMN IF NOT EXISTS credential_entry_mode TEXT;

-- Step 2: Backfill ALL existing integrations to 'user_supplied'
-- Per user requirement: "All existing marketplace integrations MUST be set to user_supplied"
-- Currently there are NO admin_supplied integrations in the system
UPDATE public.integration_registry
SET credential_entry_mode = 'user_supplied'
WHERE credential_entry_mode IS NULL;

-- Step 3: Add constraint and default
-- Default to 'user_supplied' for any new integrations (self-service by default)
ALTER TABLE public.integration_registry
  ALTER COLUMN credential_entry_mode SET DEFAULT 'user_supplied';

-- Make the column NOT NULL now that all rows have values
ALTER TABLE public.integration_registry
  ALTER COLUMN credential_entry_mode SET NOT NULL;

-- Add CHECK constraint for valid values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'integration_registry_credential_entry_mode_check'
  ) THEN
    ALTER TABLE public.integration_registry
      ADD CONSTRAINT integration_registry_credential_entry_mode_check
      CHECK (credential_entry_mode IN ('user_supplied', 'admin_supplied'));
  END IF;
END $$;

-- Step 4: Create index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_integration_registry_credential_entry_mode 
  ON public.integration_registry(credential_entry_mode);

-- Step 5: Verify the migration
DO $$
DECLARE
  user_supplied_count INTEGER;
  admin_supplied_count INTEGER;
  null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO user_supplied_count FROM public.integration_registry WHERE credential_entry_mode = 'user_supplied';
  SELECT COUNT(*) INTO admin_supplied_count FROM public.integration_registry WHERE credential_entry_mode = 'admin_supplied';
  SELECT COUNT(*) INTO null_count FROM public.integration_registry WHERE credential_entry_mode IS NULL;
  
  RAISE NOTICE 'Credential entry mode distribution: user_supplied=%, admin_supplied=%, null=%',
    user_supplied_count, admin_supplied_count, null_count;
  
  IF null_count > 0 THEN
    RAISE WARNING 'Found % integrations with NULL credential_entry_mode!', null_count;
  END IF;
  
  IF admin_supplied_count > 0 THEN
    RAISE NOTICE 'WARNING: % integrations are admin_supplied - these will show "Admin configured" in UI', admin_supplied_count;
  END IF;
END $$;

-- Add documentation comment
COMMENT ON COLUMN public.integration_registry.credential_entry_mode IS 
  'Phase 16D: Controls who can configure this integration. user_supplied = users can self-service connect, admin_supplied = admin-only configuration. Default: user_supplied';

-- ============================================================================
-- GRANTS
-- ============================================================================
-- No new grants needed - credential_entry_mode is part of existing table with existing policies
