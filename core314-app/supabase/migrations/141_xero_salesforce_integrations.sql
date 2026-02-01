-- ============================================================
-- Xero and Salesforce Integrations - Production Ready
-- Financial and CRM integrations for Core314
-- ============================================================

-- 1. Add Xero to integration_registry
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
  'xero',
  'Xero',
  'oauth2',
  'oauth2',
  'oauth2',
  'user_supplied',
  'https://login.xero.com/identity/connect/authorize',
  'https://identity.xero.com/connect/token',
  ARRAY['openid', 'profile', 'email', 'accounting.transactions.read', 'accounting.contacts.read', 'accounting.settings.read'],
  'https://api.xero.com/connections',
  'GET',
  '{"Authorization": "Bearer {access_token}", "Accept": "application/json"}'::jsonb,
  '[{"name": "access_token", "type": "string", "label": "Access Token", "required": true}, {"name": "tenant_id", "type": "string", "label": "Tenant ID", "required": true}]'::jsonb,
  true,
  'https://cdn.worldvectorlogo.com/logos/xero-1.svg',
  'Invoices, payments, expenses, and financial activity.',
  'https://developer.xero.com/documentation/getting-started-guide/',
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

-- 2. Add Salesforce to integration_registry
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
  'salesforce',
  'Salesforce',
  'oauth2',
  'oauth2',
  'oauth2',
  'user_supplied',
  'https://login.salesforce.com/services/oauth2/authorize',
  'https://login.salesforce.com/services/oauth2/token',
  ARRAY['api', 'refresh_token'],
  'https://{instance_url}/services/data/v58.0/sobjects',
  'GET',
  '{"Authorization": "Bearer {access_token}", "Accept": "application/json"}'::jsonb,
  '[{"name": "access_token", "type": "string", "label": "Access Token", "required": true}, {"name": "instance_url", "type": "string", "label": "Instance URL", "required": true}]'::jsonb,
  true,
  'https://cdn.worldvectorlogo.com/logos/salesforce-2.svg',
  'Customer accounts, cases, and service activity.',
  'https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/',
  true,
  false,
  'crm'
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

-- 3. Add entries to integrations_master for legacy FK support
INSERT INTO public.integrations_master (integration_name, integration_type, logo_url, is_core_integration, description)
VALUES 
  ('Xero', 'xero', 'https://cdn.worldvectorlogo.com/logos/xero-1.svg', true, 'Financial operations - invoices, payments, expenses'),
  ('Salesforce', 'salesforce', 'https://cdn.worldvectorlogo.com/logos/salesforce-2.svg', true, 'CRM - accounts, opportunities, cases')
ON CONFLICT (integration_name) DO NOTHING;

-- 4. Verify integrations are enabled
DO $$
DECLARE
  xero_enabled BOOLEAN;
  sf_enabled BOOLEAN;
BEGIN
  SELECT is_enabled INTO xero_enabled 
  FROM public.integration_registry 
  WHERE service_name = 'xero';
  
  SELECT is_enabled INTO sf_enabled 
  FROM public.integration_registry 
  WHERE service_name = 'salesforce';
  
  IF NOT xero_enabled THEN
    RAISE EXCEPTION 'Xero integration was not enabled correctly';
  END IF;
  
  IF NOT sf_enabled THEN
    RAISE EXCEPTION 'Salesforce integration was not enabled correctly';
  END IF;
  
  RAISE NOTICE 'Xero and Salesforce integrations enabled successfully';
END $$;

-- Add comment for documentation
COMMENT ON TABLE public.integration_registry IS 'Xero and Salesforce added as production integrations. OAuth2 authentication with read-only scopes.';
