-- ============================================================
-- Migration 108: Disable all integrations for beta
-- ============================================================
-- Per beta directive: Only integrations with fully configured OAuth 
-- credentials should be visible. Since no credentials are configured yet,
-- disable all integrations. They will be re-enabled individually as 
-- credentials are provided.
-- ============================================================

-- Disable all integrations in the registry
UPDATE public.integration_registry
SET is_enabled = false,
    updated_at = NOW()
WHERE is_enabled = true;

-- Add a comment to track this change
COMMENT ON TABLE public.integration_registry IS 'Dynamic registry of available integrations with auth configuration. All integrations disabled for beta until OAuth credentials are configured.';
