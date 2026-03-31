-- Fix Gmail and Google Sheets integration_registry entries for OAuth flow
-- Root cause: Gmail had null oauth_authorize_url, oauth_token_url, oauth_scopes
-- Google Sheets had null oauth_scopes, wrong connection_type ('manual' instead of 'oauth2')
-- Google Calendar worked because all fields were correctly populated

-- Fix Gmail: add OAuth URLs and scopes
UPDATE integration_registry
SET
  oauth_authorize_url = 'https://accounts.google.com/o/oauth2/v2/auth',
  oauth_token_url = 'https://oauth2.googleapis.com/token',
  oauth_scopes = ARRAY['https://www.googleapis.com/auth/gmail.readonly']
WHERE service_name = 'gmail'
  AND (oauth_authorize_url IS NULL OR oauth_token_url IS NULL OR oauth_scopes IS NULL);

-- Fix Google Sheets: add OAuth URLs, scopes, and fix connection_type
UPDATE integration_registry
SET
  oauth_authorize_url = 'https://accounts.google.com/o/oauth2/v2/auth',
  oauth_token_url = 'https://oauth2.googleapis.com/token',
  oauth_scopes = ARRAY['https://www.googleapis.com/auth/drive.readonly', 'https://www.googleapis.com/auth/spreadsheets.readonly'],
  connection_type = 'oauth2',
  provider_type = 'oauth2',
  oauth_required = true
WHERE service_name = 'google_sheets'
  AND (oauth_scopes IS NULL OR connection_type != 'oauth2');

-- Ensure Google Sheets exists in integrations_master (needed for user_integrations FK)
INSERT INTO integrations_master (integration_name, integration_type, logo_url, is_core_integration, description, auto_recovery_enabled)
VALUES ('Google Sheets', 'google_sheets', 'https://cdn.worldvectorlogo.com/logos/google-sheets-logo-icon.svg', false, 'Track spreadsheet activity and data changes', true)
ON CONFLICT (integration_type) DO NOTHING;
