-- ============================================================
-- Wave 3B Integration Enablement: 8 New Integrations
-- Final catalog expansion to 25+ integrations
-- Read-only, Tier 0 observational intelligence only
-- ============================================================

-- 1. Add Discord (Communication category) - API Token
INSERT INTO public.integration_registry (service_name, display_name, auth_type, category, is_enabled, created_at, updated_at)
VALUES ('discord', 'Discord', 'api_key', 'communication', true, NOW(), NOW())
ON CONFLICT (service_name) DO UPDATE SET is_enabled = true, category = 'communication', updated_at = NOW();

-- 2. Add Google Meet (Communication category) - OAuth2 read-only
INSERT INTO public.integration_registry (service_name, display_name, auth_type, oauth_scopes, category, is_enabled, created_at, updated_at)
VALUES ('google_meet', 'Google Meet', 'oauth2', ARRAY['https://www.googleapis.com/auth/calendar.events.readonly'], 'communication', true, NOW(), NOW())
ON CONFLICT (service_name) DO UPDATE SET is_enabled = true, category = 'communication', auth_type = 'oauth2', oauth_scopes = ARRAY['https://www.googleapis.com/auth/calendar.events.readonly'], updated_at = NOW();

-- 3. Add Microsoft Planner (Project Management category) - OAuth2 read-only
INSERT INTO public.integration_registry (service_name, display_name, auth_type, oauth_scopes, category, is_enabled, created_at, updated_at)
VALUES ('microsoft_planner', 'Microsoft Planner', 'oauth2', ARRAY['Tasks.Read', 'Group.Read.All'], 'project_management', true, NOW(), NOW())
ON CONFLICT (service_name) DO UPDATE SET is_enabled = true, category = 'project_management', auth_type = 'oauth2', oauth_scopes = ARRAY['Tasks.Read', 'Group.Read.All'], updated_at = NOW();

-- 4. Add ServiceNow (Support category) - API Token
INSERT INTO public.integration_registry (service_name, display_name, auth_type, category, is_enabled, created_at, updated_at)
VALUES ('servicenow', 'ServiceNow', 'api_key', 'support', true, NOW(), NOW())
ON CONFLICT (service_name) DO UPDATE SET is_enabled = true, category = 'support', updated_at = NOW();

-- 5. Add Airtable (Productivity category) - API Key
INSERT INTO public.integration_registry (service_name, display_name, auth_type, category, is_enabled, created_at, updated_at)
VALUES ('airtable', 'Airtable', 'api_key', 'productivity', true, NOW(), NOW())
ON CONFLICT (service_name) DO UPDATE SET is_enabled = true, category = 'productivity', updated_at = NOW();

-- 6. Add Smartsheet (Productivity category) - API Token
INSERT INTO public.integration_registry (service_name, display_name, auth_type, category, is_enabled, created_at, updated_at)
VALUES ('smartsheet', 'Smartsheet', 'api_key', 'productivity', true, NOW(), NOW())
ON CONFLICT (service_name) DO UPDATE SET is_enabled = true, category = 'productivity', updated_at = NOW();

-- 7. Add Miro (Collaboration category) - API Token
INSERT INTO public.integration_registry (service_name, display_name, auth_type, category, is_enabled, created_at, updated_at)
VALUES ('miro', 'Miro', 'api_key', 'collaboration', true, NOW(), NOW())
ON CONFLICT (service_name) DO UPDATE SET is_enabled = true, category = 'collaboration', updated_at = NOW();

-- 8. Add Figma (Collaboration category) - API Token
INSERT INTO public.integration_registry (service_name, display_name, auth_type, category, is_enabled, created_at, updated_at)
VALUES ('figma', 'Figma', 'api_key', 'collaboration', true, NOW(), NOW())
ON CONFLICT (service_name) DO UPDATE SET is_enabled = true, category = 'collaboration', updated_at = NOW();

-- Add entries to integrations_master for legacy FK support
INSERT INTO public.integrations_master (integration_name, integration_type, logo_url, is_core_integration, description)
VALUES 
  ('Discord', 'discord', 'https://cdn.worldvectorlogo.com/logos/discord-6.svg', true, 'Community and team communication'),
  ('Google Meet', 'google_meet', 'https://cdn.worldvectorlogo.com/logos/google-meet-icon.svg', true, 'Video conferencing'),
  ('Microsoft Planner', 'microsoft_planner', 'https://cdn.worldvectorlogo.com/logos/microsoft-planner.svg', true, 'Task and project management'),
  ('ServiceNow', 'servicenow', 'https://cdn.worldvectorlogo.com/logos/servicenow-2.svg', true, 'IT service management'),
  ('Airtable', 'airtable', 'https://cdn.worldvectorlogo.com/logos/airtable-1.svg', true, 'Spreadsheet-database hybrid'),
  ('Smartsheet', 'smartsheet', 'https://cdn.worldvectorlogo.com/logos/smartsheet-logo-1.svg', true, 'Work management platform'),
  ('Miro', 'miro', 'https://cdn.worldvectorlogo.com/logos/miro-2.svg', true, 'Online collaborative whiteboard'),
  ('Figma', 'figma', 'https://cdn.worldvectorlogo.com/logos/figma-icon.svg', true, 'Collaborative design tool')
ON CONFLICT (integration_name) DO NOTHING;

-- Verify total enabled integrations
-- Expected: Wave 0 (2) + Wave 1 (2) + Wave 2 (5) + Wave 3A (10) + Wave 3B (8) = 27 total
DO $$
DECLARE
  enabled_count INTEGER;
  enabled_list TEXT;
BEGIN
  SELECT COUNT(*), string_agg(service_name, ', ' ORDER BY service_name) 
  INTO enabled_count, enabled_list
  FROM public.integration_registry 
  WHERE is_enabled = true;
  
  RAISE NOTICE 'Enabled integrations (count: %): %', enabled_count, enabled_list;
  
  IF enabled_count < 25 THEN
    RAISE WARNING 'Expected at least 25 integrations enabled. Found: %. List: %', enabled_count, enabled_list;
  END IF;
END $$;

-- Add comment for documentation
COMMENT ON TABLE public.integration_registry IS 'Wave 3B enabled: Added Discord, Google Meet, Microsoft Planner, ServiceNow, Airtable, Smartsheet, Miro, Figma. Total: 27+ integrations.';
