-- ============================================================
-- Fix Wave 3A auth_type constraint violation
-- Changes api_token to api_key for GitHub, GitLab, Bitbucket, Confluence
-- The integration_registry_auth_type_check constraint only allows: 'webhook', 'api_key', 'oauth2'
-- ============================================================

-- Update GitHub auth_type from api_token to api_key
UPDATE public.integration_registry
SET auth_type = 'api_key', updated_at = NOW()
WHERE service_name = 'github' AND auth_type = 'api_token';

-- Update GitLab auth_type from api_token to api_key
UPDATE public.integration_registry
SET auth_type = 'api_key', updated_at = NOW()
WHERE service_name = 'gitlab' AND auth_type = 'api_token';

-- Update Bitbucket auth_type from api_token to api_key
UPDATE public.integration_registry
SET auth_type = 'api_key', updated_at = NOW()
WHERE service_name = 'bitbucket' AND auth_type = 'api_token';

-- Update Confluence auth_type from api_token to api_key
UPDATE public.integration_registry
SET auth_type = 'api_key', updated_at = NOW()
WHERE service_name = 'confluence' AND auth_type = 'api_token';
