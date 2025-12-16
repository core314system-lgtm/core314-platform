-- ============================================================
-- Integration Registry Extension
-- Adds category column and seeds additional business integrations
-- ============================================================

-- Add category column to integration_registry if it doesn't exist
ALTER TABLE public.integration_registry 
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'other';

-- Create index for category-based queries
CREATE INDEX IF NOT EXISTS idx_integration_registry_category 
  ON public.integration_registry(category);

-- Update existing integrations with appropriate categories
UPDATE public.integration_registry SET category = 'communication' WHERE service_name IN ('slack', 'teams');
UPDATE public.integration_registry SET category = 'email' WHERE service_name IN ('gmail', 'sendgrid');
UPDATE public.integration_registry SET category = 'productivity' WHERE service_name IN ('trello', 'notion');

-- Insert new integrations (8 additional as per requirements)
-- Using ON CONFLICT to safely handle re-runs
INSERT INTO public.integration_registry (
  service_name,
  display_name,
  auth_type,
  provider_type,
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
) VALUES 
  -- Project Management
  (
    'asana',
    'Asana',
    'api_key',
    'api_key',
    'https://app.asana.com/api/1.0/users/me',
    'GET',
    '{"Authorization": "Bearer {api_key}"}'::jsonb,
    '[{"name": "api_key", "type": "string", "label": "Personal Access Token", "required": true}]'::jsonb,
    false,
    'https://cdn.worldvectorlogo.com/logos/asana-logo.svg',
    'Work management platform for teams',
    'https://developers.asana.com/docs/authentication',
    true,
    false,
    'project_management'
  ),
  (
    'jira',
    'Jira',
    'api_key',
    'api_key',
    'https://api.atlassian.com/me',
    'GET',
    '{"Authorization": "Bearer {api_key}"}'::jsonb,
    '[{"name": "api_key", "type": "string", "label": "API Token", "required": true}, {"name": "domain", "type": "string", "label": "Jira Domain", "required": true}]'::jsonb,
    false,
    'https://cdn.worldvectorlogo.com/logos/jira-1.svg',
    'Issue tracking and project management',
    'https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro/',
    true,
    false,
    'project_management'
  ),
  -- CRM
  (
    'hubspot',
    'HubSpot',
    'api_key',
    'api_key',
    'https://api.hubapi.com/crm/v3/objects/contacts',
    'GET',
    '{"Authorization": "Bearer {api_key}"}'::jsonb,
    '[{"name": "api_key", "type": "string", "label": "Private App Access Token", "required": true}]'::jsonb,
    false,
    'https://cdn.worldvectorlogo.com/logos/hubspot.svg',
    'CRM, marketing, and sales platform',
    'https://developers.hubspot.com/docs/api/overview',
    true,
    false,
    'crm'
  ),
  (
    'salesforce',
    'Salesforce',
    'oauth2',
    'oauth2',
    'https://login.salesforce.com/services/oauth2/userinfo',
    'GET',
    '{"Authorization": "Bearer {access_token}"}'::jsonb,
    '[{"name": "access_token", "type": "string", "label": "Access Token", "required": true}]'::jsonb,
    true,
    'https://cdn.worldvectorlogo.com/logos/salesforce-2.svg',
    'Enterprise CRM and cloud platform',
    'https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/',
    true,
    false,
    'crm'
  ),
  -- Billing/Finance
  (
    'quickbooks',
    'QuickBooks',
    'oauth2',
    'oauth2',
    'https://accounts.intuit.com/v1/openid_connect/userinfo',
    'GET',
    '{"Authorization": "Bearer {access_token}"}'::jsonb,
    '[{"name": "access_token", "type": "string", "label": "Access Token", "required": true}]'::jsonb,
    true,
    'https://cdn.worldvectorlogo.com/logos/quickbooks-2.svg',
    'Accounting and financial management',
    'https://developer.intuit.com/app/developer/qbo/docs/get-started',
    true,
    false,
    'billing'
  ),
  (
    'stripe',
    'Stripe',
    'api_key',
    'api_key',
    'https://api.stripe.com/v1/balance',
    'GET',
    '{"Authorization": "Bearer {api_key}"}'::jsonb,
    '[{"name": "api_key", "type": "string", "label": "Secret Key", "required": true}]'::jsonb,
    false,
    'https://cdn.worldvectorlogo.com/logos/stripe-4.svg',
    'Payment processing and billing',
    'https://stripe.com/docs/api',
    true,
    false,
    'billing'
  ),
  -- Support
  (
    'zendesk',
    'Zendesk',
    'api_key',
    'api_key',
    'https://{subdomain}.zendesk.com/api/v2/users/me.json',
    'GET',
    '{"Authorization": "Basic {api_key}"}'::jsonb,
    '[{"name": "api_key", "type": "string", "label": "API Token", "required": true}, {"name": "subdomain", "type": "string", "label": "Subdomain", "required": true}, {"name": "email", "type": "email", "label": "Admin Email", "required": true}]'::jsonb,
    false,
    'https://cdn.worldvectorlogo.com/logos/zendesk-1.svg',
    'Customer service and support platform',
    'https://developer.zendesk.com/api-reference/',
    true,
    false,
    'support'
  ),
  -- Communication
  (
    'zoom',
    'Zoom',
    'oauth2',
    'oauth2',
    'https://api.zoom.us/v2/users/me',
    'GET',
    '{"Authorization": "Bearer {access_token}"}'::jsonb,
    '[{"name": "access_token", "type": "string", "label": "Access Token", "required": true}]'::jsonb,
    true,
    'https://cdn.worldvectorlogo.com/logos/zoom-communications-logo.svg',
    'Video conferencing and meetings',
    'https://developers.zoom.us/docs/api/',
    true,
    false,
    'communication'
  )
ON CONFLICT (service_name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  validation_endpoint = EXCLUDED.validation_endpoint,
  validation_method = EXCLUDED.validation_method,
  validation_headers = EXCLUDED.validation_headers,
  required_fields = EXCLUDED.required_fields,
  oauth_required = EXCLUDED.oauth_required,
  provider_type = EXCLUDED.provider_type,
  docs_url = EXCLUDED.docs_url,
  description = EXCLUDED.description,
  logo_url = EXCLUDED.logo_url,
  category = EXCLUDED.category,
  updated_at = NOW();

-- Add comments for documentation
COMMENT ON COLUMN public.integration_registry.category IS 'Integration category for grouping (communication, email, productivity, project_management, crm, billing, support, other)';
