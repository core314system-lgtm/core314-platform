-- ============================================================
-- QuickBooks Online Integration - Production Ready
-- First financial operations integration for Core314
-- ============================================================

-- 1. Add QuickBooks Online to integration_registry
INSERT INTO public.integration_registry (
  service_name,
  display_name,
  auth_type,
  provider_type,
  connection_type,
  credential_entry_mode,
  oauth_authorize_url,
  oauth_token_url,
  oauth_scopes,
  validation_endpoint,
  validation_method,
  validation_headers,
  required_fields,
  oauth_required,
  logo_url,
  description,
  docs_url,
  is_enabled,
  is_custom,
  category
) VALUES (
  'quickbooks',
  'QuickBooks Online',
  'oauth2',
  'oauth2',
  'oauth2',
  'user_supplied',
  'https://appcenter.intuit.com/connect/oauth2',
  'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
  ARRAY['com.intuit.quickbooks.accounting'],
  'https://quickbooks.api.intuit.com/v3/company/{realm_id}/companyinfo/{realm_id}',
  'GET',
  '{"Authorization": "Bearer {access_token}", "Accept": "application/json"}'::jsonb,
  '[{"name": "access_token", "type": "string", "label": "Access Token", "required": true}, {"name": "realm_id", "type": "string", "label": "Company ID", "required": true}]'::jsonb,
  true,
  'https://cdn.worldvectorlogo.com/logos/quickbooks-2.svg',
  'Analyzes invoices, payments, expenses, and financial activity to provide visibility into operational financial signals.',
  'https://developer.intuit.com/app/developer/qbo/docs/get-started',
  true,
  false,
  'financial'
) ON CONFLICT (service_name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  auth_type = EXCLUDED.auth_type,
  provider_type = EXCLUDED.provider_type,
  connection_type = EXCLUDED.connection_type,
  credential_entry_mode = EXCLUDED.credential_entry_mode,
  oauth_authorize_url = EXCLUDED.oauth_authorize_url,
  oauth_token_url = EXCLUDED.oauth_token_url,
  oauth_scopes = EXCLUDED.oauth_scopes,
  validation_endpoint = EXCLUDED.validation_endpoint,
  validation_method = EXCLUDED.validation_method,
  validation_headers = EXCLUDED.validation_headers,
  required_fields = EXCLUDED.required_fields,
  oauth_required = EXCLUDED.oauth_required,
  logo_url = EXCLUDED.logo_url,
  description = EXCLUDED.description,
  docs_url = EXCLUDED.docs_url,
  is_enabled = EXCLUDED.is_enabled,
  category = EXCLUDED.category,
  updated_at = NOW();

-- 2. Add entry to integrations_master for legacy FK support
INSERT INTO public.integrations_master (integration_name, integration_type, logo_url, is_core_integration, description)
VALUES (
  'QuickBooks Online',
  'quickbooks',
  'https://cdn.worldvectorlogo.com/logos/quickbooks-2.svg',
  true,
  'Financial operations - invoices, payments, expenses'
)
ON CONFLICT (integration_name) DO NOTHING;

-- 3. Verify QuickBooks is enabled
DO $$
DECLARE
  qb_enabled BOOLEAN;
BEGIN
  SELECT is_enabled INTO qb_enabled 
  FROM public.integration_registry 
  WHERE service_name = 'quickbooks';
  
  IF NOT qb_enabled THEN
    RAISE EXCEPTION 'QuickBooks Online integration was not enabled correctly';
  END IF;
  
  RAISE NOTICE 'QuickBooks Online integration enabled successfully';
END $$;

-- Add comment for documentation
COMMENT ON TABLE public.integration_registry IS 'QuickBooks Online added as first financial operations integration. OAuth2 authentication with read-only accounting scope.';
