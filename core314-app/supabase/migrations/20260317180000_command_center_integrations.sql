-- ============================================================
-- Command Center Integrations: 7 new integrations for CC+ plans
-- Google Calendar, Gmail, Jira, Trello, Microsoft Teams,
-- Google Sheets, Asana
-- ============================================================

-- Add min_plan column to integration_registry for plan-gating
ALTER TABLE public.integration_registry
  ADD COLUMN IF NOT EXISTS min_plan TEXT DEFAULT 'intelligence';

-- Update existing integrations to intelligence tier
UPDATE public.integration_registry
SET min_plan = 'intelligence'
WHERE service_name IN ('slack', 'hubspot', 'quickbooks');

-- Ensure Google Calendar entry exists and is enabled for Command Center
INSERT INTO public.integration_registry (
  service_name, display_name, auth_type,
  oauth_authorize_url, oauth_token_url, oauth_scopes,
  logo_url, description, is_enabled, min_plan
) VALUES (
  'google_calendar',
  'Google Calendar',
  'oauth2',
  'https://accounts.google.com/o/oauth2/v2/auth',
  'https://oauth2.googleapis.com/token',
  ARRAY['https://www.googleapis.com/auth/calendar.readonly'],
  'https://cdn.worldvectorlogo.com/logos/google-calendar-2020.svg',
  'Track meeting patterns, scheduling conflicts, and calendar utilization to surface time-based operational signals.',
  true,
  'command_center'
) ON CONFLICT (service_name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  oauth_authorize_url = EXCLUDED.oauth_authorize_url,
  oauth_token_url = EXCLUDED.oauth_token_url,
  oauth_scopes = EXCLUDED.oauth_scopes,
  description = EXCLUDED.description,
  is_enabled = true,
  min_plan = 'command_center',
  updated_at = NOW();

-- Gmail integration (uses Google OAuth with gmail.readonly scope)
INSERT INTO public.integration_registry (
  service_name, display_name, auth_type,
  oauth_authorize_url, oauth_token_url, oauth_scopes,
  logo_url, description, is_enabled, min_plan
) VALUES (
  'gmail',
  'Gmail',
  'oauth2',
  'https://accounts.google.com/o/oauth2/v2/auth',
  'https://oauth2.googleapis.com/token',
  ARRAY['https://www.googleapis.com/auth/gmail.readonly'],
  'https://cdn.worldvectorlogo.com/logos/gmail-icon-2.svg',
  'Analyze email volume, response patterns, and communication trends without reading message content.',
  true,
  'command_center'
) ON CONFLICT (service_name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  oauth_authorize_url = EXCLUDED.oauth_authorize_url,
  oauth_token_url = EXCLUDED.oauth_token_url,
  oauth_scopes = EXCLUDED.oauth_scopes,
  description = EXCLUDED.description,
  is_enabled = true,
  min_plan = 'command_center',
  updated_at = NOW();

-- Jira integration (API token based)
INSERT INTO public.integration_registry (
  service_name, display_name, auth_type,
  base_url, oauth_authorize_url, oauth_token_url, oauth_scopes,
  logo_url, description, is_enabled, min_plan
) VALUES (
  'jira',
  'Jira',
  'api_key',
  'https://api.atlassian.com',
  NULL, NULL, NULL,
  'https://cdn.worldvectorlogo.com/logos/jira-1.svg',
  'Monitor sprint progress, ticket velocity, and blocker patterns to detect delivery risks early.',
  true,
  'command_center'
) ON CONFLICT (service_name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  auth_type = 'api_key',
  description = EXCLUDED.description,
  is_enabled = true,
  min_plan = 'command_center',
  updated_at = NOW();

-- Trello integration (API key + token based)
INSERT INTO public.integration_registry (
  service_name, display_name, auth_type,
  base_url, oauth_authorize_url, oauth_token_url, oauth_scopes,
  logo_url, description, is_enabled, min_plan
) VALUES (
  'trello',
  'Trello',
  'api_key',
  'https://api.trello.com',
  NULL, NULL, NULL,
  'https://cdn.worldvectorlogo.com/logos/trello.svg',
  'Track board activity, card movement, and workflow bottlenecks to surface stalled tasks and productivity patterns.',
  true,
  'command_center'
) ON CONFLICT (service_name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  auth_type = 'api_key',
  description = EXCLUDED.description,
  is_enabled = true,
  min_plan = 'command_center',
  updated_at = NOW();

-- Microsoft Teams integration (already exists from migration 110, update min_plan)
UPDATE public.integration_registry
SET min_plan = 'command_center',
    description = 'Monitor team channel activity, meeting patterns, and collaboration metrics across departments.',
    is_enabled = true,
    updated_at = NOW()
WHERE service_name = 'microsoft_teams';

-- If Microsoft Teams doesn't exist yet, insert it
INSERT INTO public.integration_registry (
  service_name, display_name, auth_type,
  oauth_authorize_url, oauth_token_url, oauth_scopes,
  logo_url, description, is_enabled, min_plan
) VALUES (
  'microsoft_teams',
  'Microsoft Teams',
  'oauth2',
  'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
  'https://login.microsoftonline.com/common/oauth2/v2.0/token',
  ARRAY['openid', 'profile', 'offline_access', 'User.Read', 'Team.ReadBasic.All', 'Channel.ReadBasic.All', 'ChannelMessage.Read.All'],
  'Monitor team channel activity, meeting patterns, and collaboration metrics across departments.',
  true,
  'command_center'
) ON CONFLICT (service_name) DO UPDATE SET
  description = EXCLUDED.description,
  oauth_scopes = EXCLUDED.oauth_scopes,
  is_enabled = true,
  min_plan = 'command_center',
  updated_at = NOW();

-- Google Sheets integration (uses Google OAuth with sheets.readonly scope)
INSERT INTO public.integration_registry (
  service_name, display_name, auth_type,
  oauth_authorize_url, oauth_token_url, oauth_scopes,
  logo_url, description, is_enabled, min_plan
) VALUES (
  'google_sheets',
  'Google Sheets',
  'oauth2',
  'https://accounts.google.com/o/oauth2/v2/auth',
  'https://oauth2.googleapis.com/token',
  ARRAY['https://www.googleapis.com/auth/spreadsheets.readonly'],
  'https://cdn.worldvectorlogo.com/logos/google-sheets-2020.svg',
  'Connect key operational spreadsheets for real-time KPI monitoring and data change tracking.',
  true,
  'command_center'
) ON CONFLICT (service_name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  oauth_authorize_url = EXCLUDED.oauth_authorize_url,
  oauth_token_url = EXCLUDED.oauth_token_url,
  oauth_scopes = EXCLUDED.oauth_scopes,
  description = EXCLUDED.description,
  is_enabled = true,
  min_plan = 'command_center',
  updated_at = NOW();

-- Asana integration (API token based)
INSERT INTO public.integration_registry (
  service_name, display_name, auth_type,
  base_url, oauth_authorize_url, oauth_token_url, oauth_scopes,
  logo_url, description, is_enabled, min_plan
) VALUES (
  'asana',
  'Asana',
  'api_key',
  'https://app.asana.com/api/1.0',
  NULL, NULL, NULL,
  'https://cdn.worldvectorlogo.com/logos/asana-logo.svg',
  'Track project milestones, task completion rates, and team workload to detect delivery risks and resource constraints.',
  true,
  'command_center'
) ON CONFLICT (service_name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  auth_type = 'api_key',
  description = EXCLUDED.description,
  is_enabled = true,
  min_plan = 'command_center',
  updated_at = NOW();

-- Add integrations_master entries for legacy FK support
INSERT INTO public.integrations_master (integration_name, integration_type, logo_url, is_core_integration, description)
VALUES 
  ('Gmail', 'gmail', 'https://cdn.worldvectorlogo.com/logos/gmail-icon-2.svg', true, 'Email communication analytics'),
  ('Jira', 'jira', 'https://cdn.worldvectorlogo.com/logos/jira-1.svg', true, 'Project management and issue tracking'),
  ('Trello', 'trello', 'https://cdn.worldvectorlogo.com/logos/trello.svg', true, 'Board-based project management'),
  ('Google Sheets', 'google_sheets', 'https://cdn.worldvectorlogo.com/logos/google-sheets-2020.svg', true, 'Spreadsheet data monitoring'),
  ('Asana', 'asana', 'https://cdn.worldvectorlogo.com/logos/asana-logo.svg', true, 'Task and project management')
ON CONFLICT (integration_name) DO NOTHING;

-- Ensure Google Calendar and Microsoft Teams have integrations_master entries too
INSERT INTO public.integrations_master (integration_name, integration_type, logo_url, is_core_integration, description)
VALUES 
  ('Google Calendar', 'google_calendar', 'https://cdn.worldvectorlogo.com/logos/google-calendar-2020.svg', true, 'Calendar events and meeting schedules'),
  ('Microsoft Teams', 'microsoft_teams', 'https://cdn.worldvectorlogo.com/logos/microsoft-teams-1.svg', true, 'Enterprise collaboration and communication')
ON CONFLICT (integration_name) DO NOTHING;

-- Disable any integrations NOT in the approved list
-- Only slack, hubspot, quickbooks (Intelligence) and the 7 new ones (Command Center) should be enabled
UPDATE public.integration_registry
SET is_enabled = false, updated_at = NOW()
WHERE service_name NOT IN (
  'slack', 'hubspot', 'quickbooks',
  'google_calendar', 'gmail', 'jira', 'trello',
  'microsoft_teams', 'google_sheets', 'asana'
)
AND is_enabled = true;

COMMENT ON TABLE public.integration_registry IS 'Integration registry with plan-gating. Intelligence: slack, hubspot, quickbooks. Command Center+: google_calendar, gmail, jira, trello, microsoft_teams, google_sheets, asana.';
