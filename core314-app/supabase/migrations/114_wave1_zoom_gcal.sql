-- ============================================================
-- Wave 1 Integration Enablement: Zoom + Google Calendar
-- Enables read-only OAuth integrations for communication analytics
-- ============================================================

-- 1. Enable Zoom with proper OAuth configuration
-- Zoom was seeded in migration 105 but disabled in 108
-- Now enabling with read-only scopes for meeting metadata only
UPDATE public.integration_registry
SET 
  is_enabled = true,
  oauth_authorize_url = 'https://zoom.us/oauth/authorize',
  oauth_token_url = 'https://zoom.us/oauth/token',
  -- Read-only scopes: meeting:read, user:read (no write permissions)
  oauth_scopes = ARRAY['meeting:read', 'user:read'],
  updated_at = NOW()
WHERE service_name = 'zoom';

-- 2. Add Google Calendar integration (new entry)
-- Using calendar.readonly scope for read-only access to event metadata
INSERT INTO public.integration_registry (
  service_name,
  display_name,
  auth_type,
  provider_type,
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
  'google_calendar',
  'Google Calendar',
  'oauth2',
  'oauth2',
  'https://accounts.google.com/o/oauth2/v2/auth',
  'https://oauth2.googleapis.com/token',
  ARRAY['https://www.googleapis.com/auth/calendar.readonly'],
  'https://www.googleapis.com/calendar/v3/users/me/calendarList',
  'GET',
  '{"Authorization": "Bearer {access_token}"}'::jsonb,
  '[{"name": "access_token", "type": "string", "label": "Access Token", "required": true}]'::jsonb,
  true,
  'https://cdn.worldvectorlogo.com/logos/google-calendar-2020.svg',
  'View calendar events and meeting schedules',
  'https://developers.google.com/calendar/api/guides/overview',
  true,
  false,
  'communication'
) ON CONFLICT (service_name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
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
  ('Zoom', 'zoom', 'https://cdn.worldvectorlogo.com/logos/zoom-communications-logo.svg', true, 'Video conferencing and meetings'),
  ('Google Calendar', 'google_calendar', 'https://cdn.worldvectorlogo.com/logos/google-calendar-2020.svg', true, 'Calendar events and meeting schedules')
ON CONFLICT (integration_name) DO NOTHING;

-- 4. Verify only Wave 0 + Wave 1 integrations are enabled
-- This ensures other integrations remain hidden
DO $$
DECLARE
  enabled_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO enabled_count 
  FROM public.integration_registry 
  WHERE is_enabled = true;
  
  IF enabled_count > 4 THEN
    RAISE WARNING 'More than 4 integrations enabled. Expected: slack, microsoft_teams, zoom, google_calendar';
  END IF;
END $$;

-- Add comment for documentation
COMMENT ON TABLE public.integration_registry IS 'Wave 1 enabled: Slack, Microsoft Teams, Zoom, Google Calendar. All other integrations remain disabled for beta.';
