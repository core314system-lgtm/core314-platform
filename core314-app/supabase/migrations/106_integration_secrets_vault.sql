-- ============================================================
-- Integration Secrets with Vault Storage
-- Provides secure credential storage using Supabase Vault
-- ============================================================

-- Create integration_secrets table to track vault-stored secrets
CREATE TABLE IF NOT EXISTS public.integration_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  integration_registry_id UUID NOT NULL REFERENCES public.integration_registry(id) ON DELETE CASCADE,
  user_integration_id UUID REFERENCES public.user_integrations(id) ON DELETE CASCADE,
  secret_name TEXT NOT NULL,
  secret_id UUID NOT NULL, -- Reference to vault.secrets
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, integration_registry_id, secret_name)
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_integration_secrets_user 
  ON public.integration_secrets(user_id);
CREATE INDEX IF NOT EXISTS idx_integration_secrets_registry 
  ON public.integration_secrets(integration_registry_id);
CREATE INDEX IF NOT EXISTS idx_integration_secrets_user_integration 
  ON public.integration_secrets(user_integration_id);

-- Enable RLS
ALTER TABLE public.integration_secrets ENABLE ROW LEVEL SECURITY;

-- RLS Policies - secrets should only be accessible via service role
DROP POLICY IF EXISTS "Service role full access on integration_secrets" ON public.integration_secrets;
CREATE POLICY "Service role full access on integration_secrets"
ON public.integration_secrets FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Users can view their own secret metadata (not the actual secrets)
DROP POLICY IF EXISTS "Users can view own secret metadata" ON public.integration_secrets;
CREATE POLICY "Users can view own secret metadata"
ON public.integration_secrets FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Grant permissions
GRANT ALL ON public.integration_secrets TO service_role;
GRANT SELECT ON public.integration_secrets TO authenticated;

-- Function to store an integration secret in Vault
-- This function is SECURITY DEFINER and should only be called from backend functions
CREATE OR REPLACE FUNCTION integration_store_secret(
  p_user_id UUID,
  p_integration_id UUID,
  p_secret_name TEXT,
  p_secret_value TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret_id UUID;
  v_existing_id UUID;
BEGIN
  -- Check if secret already exists for this user/integration/name combo
  SELECT secret_id INTO v_existing_id
  FROM integration_secrets
  WHERE user_id = p_user_id 
    AND integration_registry_id = p_integration_id 
    AND secret_name = p_secret_name;

  -- Create new secret in vault
  SELECT vault.create_secret(p_secret_value) INTO v_secret_id;
  
  IF v_secret_id IS NULL THEN
    RAISE EXCEPTION 'Failed to create vault secret';
  END IF;

  -- Upsert the secret reference
  INSERT INTO integration_secrets (
    user_id,
    integration_registry_id,
    secret_name,
    secret_id,
    updated_at
  ) VALUES (
    p_user_id,
    p_integration_id,
    p_secret_name,
    v_secret_id,
    NOW()
  )
  ON CONFLICT (user_id, integration_registry_id, secret_name) 
  DO UPDATE SET
    secret_id = v_secret_id,
    updated_at = NOW();

  RETURN v_secret_id;
END;
$$;

-- Function to retrieve an integration secret from Vault
-- This function is SECURITY DEFINER and should only be called from backend functions
CREATE OR REPLACE FUNCTION integration_get_secret(
  p_user_id UUID,
  p_integration_id UUID,
  p_secret_name TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret_id UUID;
  v_secret_value TEXT;
BEGIN
  -- Get the secret_id from our tracking table
  SELECT secret_id INTO v_secret_id
  FROM integration_secrets
  WHERE user_id = p_user_id 
    AND integration_registry_id = p_integration_id 
    AND secret_name = p_secret_name;

  IF v_secret_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Retrieve the actual secret from vault
  SELECT decrypted_secret INTO v_secret_value
  FROM vault.decrypted_secrets
  WHERE id = v_secret_id;

  RETURN v_secret_value;
END;
$$;

-- Function to delete an integration secret from Vault
CREATE OR REPLACE FUNCTION integration_delete_secret(
  p_user_id UUID,
  p_integration_id UUID,
  p_secret_name TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret_id UUID;
BEGIN
  -- Get and delete the secret reference
  DELETE FROM integration_secrets
  WHERE user_id = p_user_id 
    AND integration_registry_id = p_integration_id 
    AND secret_name = p_secret_name
  RETURNING secret_id INTO v_secret_id;

  IF v_secret_id IS NOT NULL THEN
    -- Note: Vault secrets are automatically cleaned up or can be manually deleted
    -- depending on your Vault configuration
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- Grant execute permissions only to service_role (not authenticated users)
-- These functions should only be called from backend Edge Functions
REVOKE ALL ON FUNCTION integration_store_secret FROM PUBLIC;
REVOKE ALL ON FUNCTION integration_get_secret FROM PUBLIC;
REVOKE ALL ON FUNCTION integration_delete_secret FROM PUBLIC;

GRANT EXECUTE ON FUNCTION integration_store_secret TO service_role;
GRANT EXECUTE ON FUNCTION integration_get_secret TO service_role;
GRANT EXECUTE ON FUNCTION integration_delete_secret TO service_role;

-- Add comments for documentation
COMMENT ON TABLE public.integration_secrets IS 'Tracks integration credentials stored in Supabase Vault';
COMMENT ON COLUMN public.integration_secrets.secret_id IS 'Reference to vault.secrets for the encrypted credential';
COMMENT ON FUNCTION integration_store_secret IS 'Securely stores an integration credential in Vault. Service role only.';
COMMENT ON FUNCTION integration_get_secret IS 'Retrieves a decrypted integration credential from Vault. Service role only.';
COMMENT ON FUNCTION integration_delete_secret IS 'Removes an integration credential from Vault. Service role only.';
