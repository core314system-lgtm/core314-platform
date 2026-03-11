-- Integration Scheduler: pg_cron setup for automated polling
-- 
-- Creates a cron job that invokes the integration-scheduler Edge Function
-- every 15 minutes. The scheduler orchestrates:
--   1. Health checks (token validation)
--   2. Token refresh (for expiring OAuth tokens)
--   3. Data polling (Slack, HubSpot, QuickBooks)
--
-- Prerequisites:
--   - pg_cron extension must be enabled (Supabase Pro plan)
--   - pg_net extension must be enabled (for HTTP calls from SQL)
--   - Edge Functions deployed: integration-scheduler, integration-health-check,
--     slack-poll, hubspot-poll, quickbooks-poll

-- Enable required extensions (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Schedule the integration scheduler to run every 15 minutes
-- Uses pg_net to make an HTTP POST to the Edge Function
SELECT cron.schedule(
  'integration-scheduler-15min',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/integration-scheduler',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'triggered_by', 'pg_cron',
      'scheduled_at', now()::text
    )
  );
  $$
);

-- Also schedule a dedicated health check every 5 minutes (more frequent than polling)
-- This ensures token refresh happens before tokens expire
SELECT cron.schedule(
  'integration-health-check-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/integration-health-check',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'triggered_by', 'pg_cron_health',
      'scheduled_at', now()::text
    )
  );
  $$
);
