-- ============================================================
-- ============================================================

ALTER TABLE user_integrations DROP CONSTRAINT IF EXISTS user_integrations_status_check;

ALTER TABLE integration_registry 
  ADD COLUMN IF NOT EXISTS validation_endpoint TEXT,
  ADD COLUMN IF NOT EXISTS required_fields JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS oauth_required BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS docs_url TEXT,
  ADD COLUMN IF NOT EXISTS provider_type TEXT DEFAULT 'api_key' CHECK (provider_type IN ('api_key', 'oauth2', 'webhook', 'custom')),
  ADD COLUMN IF NOT EXISTS validation_method TEXT DEFAULT 'GET' CHECK (validation_method IN ('GET', 'POST', 'PUT')),
  ADD COLUMN IF NOT EXISTS validation_headers JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS validation_body JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS success_indicators JSONB DEFAULT '{"status_codes": [200, 201, 204]}'::jsonb,
  ADD COLUMN IF NOT EXISTS is_custom BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE user_integrations
  ADD COLUMN IF NOT EXISTS provider_id UUID REFERENCES integration_registry(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS error_message TEXT;

ALTER TABLE user_integrations 
  ADD CONSTRAINT user_integrations_status_check 
  CHECK (status IN ('active', 'inactive', 'error', 'pending'));

CREATE INDEX IF NOT EXISTS idx_integration_registry_provider_type ON integration_registry(provider_type);
CREATE INDEX IF NOT EXISTS idx_integration_registry_custom ON integration_registry(is_custom);
CREATE INDEX IF NOT EXISTS idx_user_integrations_provider ON user_integrations(provider_id);
CREATE INDEX IF NOT EXISTS idx_user_integrations_status_verified ON user_integrations(user_id, status, last_verified_at);

DROP POLICY IF EXISTS "Users can create custom integrations" ON integration_registry;
CREATE POLICY "Users can create custom integrations"
ON integration_registry FOR INSERT
WITH CHECK (
  is_custom = true AND 
  created_by = auth.uid()
);

DROP POLICY IF EXISTS "Users can view own custom integrations" ON integration_registry;
CREATE POLICY "Users can view own custom integrations"
ON integration_registry FOR SELECT
USING (
  is_enabled = true OR 
  (is_custom = true AND created_by = auth.uid())
);

DROP POLICY IF EXISTS "Users can update own custom integrations" ON integration_registry;
CREATE POLICY "Users can update own custom integrations"
ON integration_registry FOR UPDATE
USING (
  is_custom = true AND created_by = auth.uid()
);

DROP POLICY IF EXISTS "Users can delete own custom integrations" ON integration_registry;
CREATE POLICY "Users can delete own custom integrations"
ON integration_registry FOR DELETE
USING (
  is_custom = true AND created_by = auth.uid()
);

INSERT INTO integration_registry (
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
  is_custom
) VALUES 
  (
    'sendgrid',
    'SendGrid',
    'api_key',
    'api_key',
    'https://api.sendgrid.com/v3/user/profile',
    'GET',
    '{"Authorization": "Bearer {api_key}"}'::jsonb,
    '[{"name": "api_key", "type": "string", "label": "API Key", "required": true}, {"name": "from_email", "type": "email", "label": "From Email", "required": true}]'::jsonb,
    false,
    'https://cdn.worldvectorlogo.com/logos/sendgrid-1.svg',
    'Email delivery and transactional email service',
    'https://docs.sendgrid.com/api-reference/how-to-use-the-sendgrid-v3-api/authentication',
    true,
    false
  ),
  (
    'trello',
    'Trello',
    'api_key',
    'api_key',
    'https://api.trello.com/1/members/me',
    'GET',
    '{}'::jsonb,
    '[{"name": "api_key", "type": "string", "label": "API Key", "required": true}, {"name": "api_token", "type": "string", "label": "API Token", "required": true}]'::jsonb,
    false,
    'https://cdn.worldvectorlogo.com/logos/trello.svg',
    'Project management and task tracking',
    'https://developer.atlassian.com/cloud/trello/guides/rest-api/api-introduction/',
    true,
    false
  ),
  (
    'slack',
    'Slack',
    'oauth2',
    'oauth2',
    'https://slack.com/api/auth.test',
    'POST',
    '{"Authorization": "Bearer {access_token}"}'::jsonb,
    '[{"name": "access_token", "type": "string", "label": "Access Token", "required": true}]'::jsonb,
    true,
    'https://cdn.worldvectorlogo.com/logos/slack-new-logo.svg',
    'Team communication and collaboration platform',
    'https://api.slack.com/authentication',
    true,
    false
  ),
  (
    'teams',
    'Microsoft Teams',
    'oauth2',
    'oauth2',
    'https://graph.microsoft.com/v1.0/me',
    'GET',
    '{"Authorization": "Bearer {access_token}"}'::jsonb,
    '[{"name": "access_token", "type": "string", "label": "Access Token", "required": true}]'::jsonb,
    true,
    'https://cdn.worldvectorlogo.com/logos/microsoft-teams-1.svg',
    'Enterprise collaboration and communication',
    'https://learn.microsoft.com/en-us/graph/auth/',
    true,
    false
  ),
  (
    'gmail',
    'Gmail',
    'oauth2',
    'oauth2',
    'https://www.googleapis.com/gmail/v1/users/me/profile',
    'GET',
    '{"Authorization": "Bearer {access_token}"}'::jsonb,
    '[{"name": "access_token", "type": "string", "label": "Access Token", "required": true}]'::jsonb,
    true,
    'https://cdn.worldvectorlogo.com/logos/gmail-icon.svg',
    'Google email and workspace integration',
    'https://developers.google.com/gmail/api/auth/about-auth',
    true,
    false
  ),
  (
    'notion',
    'Notion',
    'api_key',
    'api_key',
    'https://api.notion.com/v1/users/me',
    'GET',
    '{"Authorization": "Bearer {api_key}", "Notion-Version": "2022-06-28"}'::jsonb,
    '[{"name": "api_key", "type": "string", "label": "Integration Token", "required": true}]'::jsonb,
    false,
    'https://upload.wikimedia.org/wikipedia/commons/4/45/Notion_app_logo.png',
    'All-in-one workspace for notes and collaboration',
    'https://developers.notion.com/reference/authentication',
    true,
    false
  )
ON CONFLICT (service_name) DO UPDATE SET
  validation_endpoint = EXCLUDED.validation_endpoint,
  validation_method = EXCLUDED.validation_method,
  validation_headers = EXCLUDED.validation_headers,
  required_fields = EXCLUDED.required_fields,
  oauth_required = EXCLUDED.oauth_required,
  provider_type = EXCLUDED.provider_type,
  docs_url = EXCLUDED.docs_url,
  updated_at = NOW();

CREATE OR REPLACE FUNCTION validate_integration_config(
  p_provider_id UUID,
  p_config JSONB
)
RETURNS TABLE(is_valid BOOLEAN, error_message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_required_fields JSONB;
  v_field JSONB;
  v_field_name TEXT;
  v_field_required BOOLEAN;
BEGIN
  SELECT required_fields INTO v_required_fields
  FROM integration_registry
  WHERE id = p_provider_id;

  FOR v_field IN SELECT * FROM jsonb_array_elements(v_required_fields)
  LOOP
    v_field_name := v_field->>'name';
    v_field_required := COALESCE((v_field->>'required')::boolean, false);
    
    IF v_field_required AND (p_config->>v_field_name IS NULL OR p_config->>v_field_name = '') THEN
      RETURN QUERY SELECT false, format('Missing required field: %s', v_field_name);
      RETURN;
    END IF;
  END LOOP;

  RETURN QUERY SELECT true, NULL::TEXT;
END;
$$;

CREATE OR REPLACE FUNCTION get_user_integration_status(
  p_user_id UUID,
  p_provider_name TEXT
)
RETURNS TABLE(
  connected BOOLEAN,
  status TEXT,
  last_verified_at TIMESTAMPTZ,
  error_message TEXT,
  provider_display_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE WHEN ui.status = 'active' THEN true ELSE false END as connected,
    ui.status,
    ui.last_verified_at,
    ui.error_message,
    ir.display_name as provider_display_name
  FROM user_integrations ui
  JOIN integration_registry ir ON ui.provider_id = ir.id
  WHERE ui.user_id = p_user_id 
    AND ir.service_name = p_provider_name
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION validate_integration_config TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_integration_status TO authenticated;

COMMENT ON COLUMN integration_registry.validation_endpoint IS 'API endpoint to validate credentials';
COMMENT ON COLUMN integration_registry.required_fields IS 'JSON array of required credential fields with type and validation rules';
COMMENT ON COLUMN integration_registry.oauth_required IS 'Whether this integration requires OAuth flow';
COMMENT ON COLUMN integration_registry.provider_type IS 'Type of authentication: api_key, oauth2, webhook, or custom';
COMMENT ON COLUMN integration_registry.validation_method IS 'HTTP method for validation endpoint';
COMMENT ON COLUMN integration_registry.validation_headers IS 'Headers template for validation request';
COMMENT ON COLUMN integration_registry.validation_body IS 'Body template for validation request';
COMMENT ON COLUMN integration_registry.success_indicators IS 'Criteria to determine successful validation';
COMMENT ON COLUMN integration_registry.is_custom IS 'Whether this is a user-defined custom integration';
COMMENT ON COLUMN integration_registry.created_by IS 'User who created this custom integration';
COMMENT ON COLUMN user_integrations.provider_id IS 'Foreign key to integration_registry';
COMMENT ON COLUMN user_integrations.last_verified_at IS 'Timestamp of last successful credential validation';
COMMENT ON COLUMN user_integrations.error_message IS 'Error message from last validation attempt';
