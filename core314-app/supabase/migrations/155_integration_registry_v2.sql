-- ============================================================
-- Integration Registry v2.0 Extension
-- Adds columns for event-driven ingestion configuration
-- Part of Integration Architecture v2.0
-- ============================================================

-- Add new columns to integration_registry
ALTER TABLE public.integration_registry 
  ADD COLUMN IF NOT EXISTS ingestion_mode TEXT DEFAULT 'poll' 
    CHECK (ingestion_mode IN ('event', 'hybrid', 'poll'));

ALTER TABLE public.integration_registry 
  ADD COLUMN IF NOT EXISTS webhook_endpoint_path TEXT;

ALTER TABLE public.integration_registry 
  ADD COLUMN IF NOT EXISTS event_types_supported TEXT[];

ALTER TABLE public.integration_registry 
  ADD COLUMN IF NOT EXISTS required_scopes_event TEXT[];

ALTER TABLE public.integration_registry 
  ADD COLUMN IF NOT EXISTS minimum_viable_metrics TEXT[] DEFAULT '{}';

ALTER TABLE public.integration_registry 
  ADD COLUMN IF NOT EXISTS expected_signal_outputs TEXT[] DEFAULT '{}';

ALTER TABLE public.integration_registry 
  ADD COLUMN IF NOT EXISTS backfill_on_connect BOOLEAN DEFAULT true;

ALTER TABLE public.integration_registry 
  ADD COLUMN IF NOT EXISTS max_backfill_days INTEGER DEFAULT 30;

ALTER TABLE public.integration_registry 
  ADD COLUMN IF NOT EXISTS signing_secret_env_var TEXT;

-- Update Slack to event-driven mode
UPDATE public.integration_registry SET
  ingestion_mode = 'event',
  webhook_endpoint_path = '/functions/v1/slack-events',
  event_types_supported = ARRAY[
    'message', 'reaction_added', 'reaction_removed',
    'channel_created', 'member_joined_channel', 'member_left_channel',
    'app_mention', 'file_shared'
  ],
  required_scopes_event = ARRAY[
    'channels:history', 'channels:read', 'groups:history', 'groups:read',
    'im:history', 'mpim:history', 'reactions:read', 'users:read'
  ],
  minimum_viable_metrics = ARRAY['message_count', 'active_channels'],
  expected_signal_outputs = ARRAY['activity_volume', 'user_engagement'],
  backfill_on_connect = true,
  max_backfill_days = 7,
  signing_secret_env_var = 'SLACK_SIGNING_SECRET'
WHERE service_name = 'slack';

-- Update QuickBooks to hybrid mode (webhooks + poll for reconciliation)
UPDATE public.integration_registry SET
  ingestion_mode = 'hybrid',
  webhook_endpoint_path = '/functions/v1/quickbooks-webhook',
  event_types_supported = ARRAY['Invoice', 'Payment', 'Customer', 'Bill'],
  minimum_viable_metrics = ARRAY['total_revenue', 'invoice_count'],
  expected_signal_outputs = ARRAY['activity_volume', 'risk_indicators'],
  backfill_on_connect = true,
  max_backfill_days = 90
WHERE service_name = 'quickbooks';

-- Update Xero to hybrid mode
UPDATE public.integration_registry SET
  ingestion_mode = 'hybrid',
  webhook_endpoint_path = '/functions/v1/xero-webhook',
  event_types_supported = ARRAY['INVOICE', 'PAYMENT', 'CONTACT'],
  minimum_viable_metrics = ARRAY['total_revenue', 'invoice_count'],
  expected_signal_outputs = ARRAY['activity_volume', 'risk_indicators'],
  backfill_on_connect = true,
  max_backfill_days = 90
WHERE service_name = 'xero';

-- Update Salesforce to poll mode (Events API requires additional enterprise setup)
UPDATE public.integration_registry SET
  ingestion_mode = 'poll',
  minimum_viable_metrics = ARRAY['account_count', 'opportunity_count'],
  expected_signal_outputs = ARRAY['activity_volume', 'risk_indicators'],
  backfill_on_connect = true,
  max_backfill_days = 90
WHERE service_name = 'salesforce';

-- Update Zoom to hybrid mode
UPDATE public.integration_registry SET
  ingestion_mode = 'hybrid',
  webhook_endpoint_path = '/functions/v1/zoom-webhook',
  event_types_supported = ARRAY['meeting.started', 'meeting.ended', 'meeting.participant_joined'],
  minimum_viable_metrics = ARRAY['meeting_count', 'total_participants'],
  expected_signal_outputs = ARRAY['activity_volume', 'user_engagement'],
  backfill_on_connect = true,
  max_backfill_days = 30
WHERE service_name = 'zoom';

-- Comments
COMMENT ON COLUMN public.integration_registry.ingestion_mode IS 'Primary ingestion mechanism: event (webhooks), hybrid (webhooks + poll), poll (API polling only)';
COMMENT ON COLUMN public.integration_registry.webhook_endpoint_path IS 'Path to the Edge Function that receives webhooks for this integration';
COMMENT ON COLUMN public.integration_registry.event_types_supported IS 'Array of event types this integration can receive via webhooks';
COMMENT ON COLUMN public.integration_registry.minimum_viable_metrics IS 'Metrics that MUST populate on successful connect';
COMMENT ON COLUMN public.integration_registry.expected_signal_outputs IS 'Signal groups this integration produces';
COMMENT ON COLUMN public.integration_registry.signing_secret_env_var IS 'Environment variable name containing the webhook signing secret';
