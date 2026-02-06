-- ============================================================
-- Poll Function Cron Jobs
-- Configures scheduled execution of integration poll functions
-- ============================================================

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Grant usage to postgres role
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Note: Supabase Edge Functions are invoked via HTTP, not pg_cron directly.
-- The cron jobs below use pg_net to call the Edge Functions.
-- Ensure pg_net extension is enabled.
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create a helper function to invoke Edge Functions via HTTP
CREATE OR REPLACE FUNCTION public.invoke_poll_function(function_name TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  supabase_url TEXT;
  service_role_key TEXT;
BEGIN
  -- Get Supabase URL and service role key from vault or environment
  -- These should be set as secrets in the database
  SELECT decrypted_secret INTO supabase_url 
  FROM vault.decrypted_secrets 
  WHERE name = 'SUPABASE_URL' 
  LIMIT 1;
  
  SELECT decrypted_secret INTO service_role_key 
  FROM vault.decrypted_secrets 
  WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' 
  LIMIT 1;
  
  -- If secrets not in vault, use hardcoded project URL (fallback)
  IF supabase_url IS NULL THEN
    supabase_url := 'https://ygvkegcstaowikessigx.supabase.co';
  END IF;
  
  -- Make HTTP POST request to the Edge Function
  -- Note: This requires the service role key to be available
  IF service_role_key IS NOT NULL THEN
    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/' || function_name,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      ),
      body := '{}'::jsonb
    );
  ELSE
    RAISE WARNING 'Service role key not found in vault. Cannot invoke poll function: %', function_name;
  END IF;
END;
$$;

-- Create cron jobs for each poll function
-- Note: These use the cron.schedule function from pg_cron

-- Slack poll: every 5 minutes
SELECT cron.schedule(
  'slack-poll-job',
  '*/5 * * * *',
  $$SELECT public.invoke_poll_function('slack-poll')$$
);

-- Salesforce poll: every 15 minutes
SELECT cron.schedule(
  'salesforce-poll-job',
  '*/15 * * * *',
  $$SELECT public.invoke_poll_function('salesforce-poll')$$
);

-- Google Calendar poll: every 15 minutes
SELECT cron.schedule(
  'gcal-poll-job',
  '*/15 * * * *',
  $$SELECT public.invoke_poll_function('gcal-poll')$$
);

-- Zoom poll: every 30 minutes
SELECT cron.schedule(
  'zoom-poll-job',
  '*/30 * * * *',
  $$SELECT public.invoke_poll_function('zoom-poll')$$
);

-- QuickBooks poll: every 30 minutes
SELECT cron.schedule(
  'quickbooks-poll-job',
  '*/30 * * * *',
  $$SELECT public.invoke_poll_function('quickbooks-poll')$$
);

-- Xero poll: every 30 minutes
SELECT cron.schedule(
  'xero-poll-job',
  '*/30 * * * *',
  $$SELECT public.invoke_poll_function('xero-poll')$$
);

-- Create a view to monitor cron job status
CREATE OR REPLACE VIEW public.poll_cron_status AS
SELECT 
  jobid,
  jobname,
  schedule,
  command,
  nodename,
  nodeport,
  database,
  username,
  active
FROM cron.job
WHERE jobname LIKE '%-poll-job';

-- Grant access to the view
GRANT SELECT ON public.poll_cron_status TO authenticated;

-- Comments
COMMENT ON FUNCTION public.invoke_poll_function IS 'Helper function to invoke Edge Functions via HTTP for cron jobs';
COMMENT ON VIEW public.poll_cron_status IS 'View to monitor poll function cron job status';
