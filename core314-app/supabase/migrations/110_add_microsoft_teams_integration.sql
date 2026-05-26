-- ============================================================
-- Migration 110: Add Microsoft Teams OAuth Integration
-- ============================================================

-- Add Microsoft Teams to integration_registry
INSERT INTO public.integration_registry (
  service_name,
  display_name,
  auth_type,
  oauth_authorize_url,
  oauth_token_url,
  oauth_scopes,
  logo_url,
  description,
  is_enabled
) VALUES (
  'microsoft_teams',
  'Microsoft Teams',
  'oauth2',
  'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
  'https://login.microsoftonline.com/common/oauth2/v2.0/token',
  ARRAY['openid', 'profile', 'offline_access', 'User.Read', 'Team.ReadBasic.All', 'Channel.ReadBasic.All'],
  'https://cdn.worldvectorlogo.com/logos/microsoft-teams-1.svg',
  'Enterprise collaboration and communication platform',
  true
) ON CONFLICT (service_name) DO UPDATE SET
  oauth_authorize_url = EXCLUDED.oauth_authorize_url,
  oauth_token_url = EXCLUDED.oauth_token_url,
  oauth_scopes = EXCLUDED.oauth_scopes,
  is_enabled = EXCLUDED.is_enabled,
  updated_at = NOW();

-- Add Microsoft Teams to integrations_master (for integration_id lookup in oauth-callback)
INSERT INTO public.integrations_master (
  integration_name,
  integration_type,
  logo_url,
  is_core_integration,
  description
) VALUES (
  'Microsoft Teams',
  'microsoft_teams',
  'https://cdn.worldvectorlogo.com/logos/microsoft-teams-1.svg',
  true,
  'Enterprise collaboration and communication platform'
) ON CONFLICT (integration_name) DO NOTHING;

COMMENT ON TABLE public.integration_registry IS 'Dynamic registry of available integrations with auth configuration. Microsoft Teams added in migration 110.';
