-- Migration: Upgrade Jira integration to OAuth 2.0 (3LO) as primary connection method
-- API token remains as fallback (Advanced option in UI)

-- Update integration_registry for Jira: set auth_type and connection_type to oauth2,
-- add Atlassian OAuth URLs and required scopes
-- Note: oauth_scopes is a text[] ARRAY column, oauth_authorize_url is the correct column name
UPDATE integration_registry
SET
  auth_type = 'oauth2',
  connection_type = 'oauth2',
  oauth_scopes = ARRAY['read:jira-work', 'read:jira-user', 'read:jira-project', 'offline_access'],
  oauth_authorize_url = 'https://auth.atlassian.com/authorize',
  oauth_token_url = 'https://auth.atlassian.com/oauth/token',
  updated_at = now()
WHERE service_name = 'jira';
