-- ============================================================
-- Integration Ingestion State Table
-- Tracks polling state and rate limiting for each user integration
-- Required by poll functions (salesforce-poll, slack-poll, etc.)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.integration_ingestion_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_integration_id UUID NOT NULL,
  service_name TEXT NOT NULL,
  last_polled_at TIMESTAMPTZ,
  last_event_timestamp TIMESTAMPTZ,
  next_poll_after TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, user_integration_id, service_name)
);

CREATE INDEX IF NOT EXISTS idx_ingestion_state_user ON public.integration_ingestion_state(user_id);
CREATE INDEX IF NOT EXISTS idx_ingestion_state_service ON public.integration_ingestion_state(service_name);
CREATE INDEX IF NOT EXISTS idx_ingestion_state_next_poll ON public.integration_ingestion_state(next_poll_after);

ALTER TABLE public.integration_ingestion_state ENABLE ROW LEVEL SECURITY;

-- Users can view their own ingestion state
CREATE POLICY "Users can view own ingestion state"
ON public.integration_ingestion_state FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Service role can manage all ingestion state (for poll functions)
CREATE POLICY "Service role can manage ingestion state"
ON public.integration_ingestion_state FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

GRANT ALL ON public.integration_ingestion_state TO service_role;
GRANT SELECT ON public.integration_ingestion_state TO authenticated;

COMMENT ON TABLE public.integration_ingestion_state IS 'Tracks polling state and rate limiting for integration poll functions';
COMMENT ON COLUMN public.integration_ingestion_state.last_polled_at IS 'When the integration was last polled';
COMMENT ON COLUMN public.integration_ingestion_state.last_event_timestamp IS 'Timestamp of the last event from the integration';
COMMENT ON COLUMN public.integration_ingestion_state.next_poll_after IS 'Rate limiting - do not poll before this time';
COMMENT ON COLUMN public.integration_ingestion_state.metadata IS 'Additional state data (e.g., last_metrics, cursor)';
