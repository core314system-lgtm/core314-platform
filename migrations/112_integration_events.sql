-- Migration 112: Create integration_events table for Slack and Teams data ingestion
-- This table stores raw events from integrations for metrics aggregation

-- Create integration_events table
CREATE TABLE IF NOT EXISTS integration_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_integration_id UUID REFERENCES user_integrations(id) ON DELETE SET NULL,
  integration_registry_id UUID REFERENCES integration_registry(id) ON DELETE SET NULL,
  service_name TEXT NOT NULL, -- 'slack' or 'microsoft_teams'
  event_type TEXT NOT NULL, -- e.g., 'message.channels', 'reaction_added', 'chat_message', 'meeting_activity'
  occurred_at TIMESTAMPTZ NOT NULL, -- timestamp from provider
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT NOT NULL, -- 'slack_events_api', 'msgraph_poll', etc.
  metadata JSONB DEFAULT '{}', -- channel/meeting ids, counts, etc.
  CONSTRAINT valid_service_name CHECK (service_name IN ('slack', 'microsoft_teams'))
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_integration_events_user_id ON integration_events(user_id);
CREATE INDEX IF NOT EXISTS idx_integration_events_service_name ON integration_events(service_name);
CREATE INDEX IF NOT EXISTS idx_integration_events_event_type ON integration_events(event_type);
CREATE INDEX IF NOT EXISTS idx_integration_events_occurred_at ON integration_events(occurred_at);
CREATE INDEX IF NOT EXISTS idx_integration_events_user_service ON integration_events(user_id, service_name);

-- Create integration_ingestion_state table for tracking polling state
CREATE TABLE IF NOT EXISTS integration_ingestion_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_integration_id UUID REFERENCES user_integrations(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL,
  last_polled_at TIMESTAMPTZ,
  last_event_timestamp TIMESTAMPTZ,
  next_poll_after TIMESTAMPTZ,
  poll_cursor TEXT, -- for pagination/cursor-based polling
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, user_integration_id, service_name)
);

-- Create index for polling queries
CREATE INDEX IF NOT EXISTS idx_ingestion_state_next_poll ON integration_ingestion_state(next_poll_after);

-- Enable RLS
ALTER TABLE integration_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_ingestion_state ENABLE ROW LEVEL SECURITY;

-- RLS policies for integration_events
CREATE POLICY "Users can view their own events" ON integration_events
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert events" ON integration_events
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service role can update events" ON integration_events
  FOR UPDATE USING (true);

-- RLS policies for integration_ingestion_state
CREATE POLICY "Users can view their own ingestion state" ON integration_ingestion_state
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage ingestion state" ON integration_ingestion_state
  FOR ALL USING (true);

-- Grant permissions to service role
GRANT ALL ON integration_events TO service_role;
GRANT ALL ON integration_ingestion_state TO service_role;

COMMENT ON TABLE integration_events IS 'Stores raw events from Slack and Teams integrations for metrics aggregation';
COMMENT ON TABLE integration_ingestion_state IS 'Tracks polling state for integration data ingestion';
