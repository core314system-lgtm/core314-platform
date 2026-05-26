-- Integration Scheduler: pg_cron setup for automated polling & health checks
-- 
-- Creates cron jobs that invoke Edge Functions on a schedule:
--   1. integration-scheduler (every 15 min) — orchestrates data polling
--   2. integration-health-check (every 5 min) — validates tokens, refreshes expiring ones
--
-- Prerequisites:
--   - pg_cron extension enabled in Supabase Dashboard > Database > Extensions
--   - pg_net extension enabled in Supabase Dashboard > Database > Extensions
--   - Edge Functions deployed: integration-scheduler, integration-health-check
--
-- IMPORTANT: This migration uses placeholder values for the Supabase URL and
-- service role key. Replace <SUPABASE_URL> and <SERVICE_ROLE_KEY> with your
-- actual values before running, or configure the cron jobs directly in the
-- Supabase SQL Editor / Dashboard.
--
-- For Core314 production, these cron jobs have already been configured
-- directly in Supabase (job IDs 17 and 18).

-- Enable required extensions (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Schedule the integration scheduler to run every 15 minutes
-- Polls Slack, HubSpot, QuickBooks for new data/signals
SELECT cron.schedule(
  'integration-scheduler-15min',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := '<SUPABASE_URL>/functions/v1/integration-scheduler',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>',
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'triggered_by', 'pg_cron',
      'scheduled_at', now()::text
    )
  );
  $$
);

-- Schedule a dedicated health check every 5 minutes (more frequent than polling)
-- Validates OAuth tokens and refreshes them before they expire
SELECT cron.schedule(
  'integration-health-check-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := '<SUPABASE_URL>/functions/v1/integration-health-check',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>',
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'triggered_by', 'pg_cron_health',
      'scheduled_at', now()::text
    )
  );
  $$
);
