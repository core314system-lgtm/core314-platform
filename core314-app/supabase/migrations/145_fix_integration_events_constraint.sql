-- ============================================================
-- Fix integration_events service_name constraint
-- Allows salesforce, quickbooks, xero, zoom, google_calendar
-- ============================================================

-- Drop the existing constraint if it exists
ALTER TABLE public.integration_events DROP CONSTRAINT IF EXISTS valid_service_name;

-- Add updated constraint with all supported service names
ALTER TABLE public.integration_events ADD CONSTRAINT valid_service_name 
CHECK (service_name IN (
  'slack',
  'teams',
  'microsoft_teams',
  'salesforce',
  'quickbooks',
  'xero',
  'zoom',
  'google_calendar',
  'gmail',
  'google_meet',
  'sendgrid',
  'notion',
  'trello',
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

COMMENT ON CONSTRAINT valid_service_name ON public.integration_events IS 'Ensures service_name matches supported integrations';
