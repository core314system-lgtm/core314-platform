-- ============================================================
-- Fix integration_events service_name constraint to include hubspot, jira, asana, google_sheets
-- These were missing from the 145_ migration and blocking data ingestion
-- ============================================================

ALTER TABLE public.integration_events DROP CONSTRAINT IF EXISTS valid_service_name;

ALTER TABLE public.integration_events ADD CONSTRAINT valid_service_name
CHECK (service_name IN (
  'slack',
  'teams',
  'microsoft_teams',
  'hubspot',
  'salesforce',
  'quickbooks',
  'xero',
  'zoom',
  'google_calendar',
  'gmail',
  'google_meet',
  'google_sheets',
  'sendgrid',
  'notion',
  'trello',
  'jira',
  'asana',
  'intercom',
  'freshdesk',
  'linear',
  'monday',
  'clickup',
  'basecamp',
  'github',
  'zendesk',
  'microsoft_planner',
  'stripe'
));

COMMENT ON CONSTRAINT valid_service_name ON public.integration_events IS 'Ensures service_name matches all supported integrations including Phase 1 (slack, hubspot, quickbooks) and Command Center';
