-- ============================================================
-- Poll Ingestion Infrastructure
-- Creates tables for tracking poll state and run metadata
-- ============================================================

-- 1. Create integration_ingestion_state table for cursor/state tracking
CREATE TABLE IF NOT EXISTS public.integration_ingestion_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_integration_id UUID REFERENCES public.user_integrations(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL,
  last_polled_at TIMESTAMPTZ,
  last_event_timestamp TEXT,
  next_poll_after TIMESTAMPTZ,
  cursor_value TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, user_integration_id, service_name)
);

CREATE INDEX IF NOT EXISTS idx_ingestion_state_user ON public.integration_ingestion_state(user_id);
CREATE INDEX IF NOT EXISTS idx_ingestion_state_service ON public.integration_ingestion_state(service_name);
CREATE INDEX IF NOT EXISTS idx_ingestion_state_next_poll ON public.integration_ingestion_state(next_poll_after);

ALTER TABLE public.integration_ingestion_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage ingestion state"
ON public.integration_ingestion_state FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Users can view own ingestion state"
ON public.integration_ingestion_state FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

GRANT ALL ON public.integration_ingestion_state TO service_role;
GRANT SELECT ON public.integration_ingestion_state TO authenticated;

-- 2. Create poll_run_logs table for tracking run metadata
CREATE TABLE IF NOT EXISTS public.poll_run_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_name TEXT NOT NULL,
  run_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  run_duration_ms INTEGER,
  records_fetched INTEGER DEFAULT 0,
  records_written INTEGER DEFAULT 0,
  users_processed INTEGER DEFAULT 0,
  users_skipped INTEGER DEFAULT 0,
  success BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_poll_run_logs_integration ON public.poll_run_logs(integration_name);
CREATE INDEX IF NOT EXISTS idx_poll_run_logs_timestamp ON public.poll_run_logs(run_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_poll_run_logs_success ON public.poll_run_logs(success);

ALTER TABLE public.poll_run_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage poll run logs"
ON public.poll_run_logs FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Platform admins can view poll run logs"
ON public.poll_run_logs FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_platform_admin = true
  )
);

GRANT ALL ON public.poll_run_logs TO service_role;
GRANT SELECT ON public.poll_run_logs TO authenticated;

-- 3. Add additional columns to integration_events if missing
DO $$
BEGIN
  -- Add user_integration_id if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'integration_events' 
    AND column_name = 'user_integration_id'
  ) THEN
    ALTER TABLE public.integration_events ADD COLUMN user_integration_id UUID REFERENCES public.user_integrations(id) ON DELETE SET NULL;
  END IF;

  -- Add integration_registry_id if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'integration_events' 
    AND column_name = 'integration_registry_id'
  ) THEN
    ALTER TABLE public.integration_events ADD COLUMN integration_registry_id UUID REFERENCES public.integration_registry(id) ON DELETE SET NULL;
  END IF;

  -- Add occurred_at if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'integration_events' 
    AND column_name = 'occurred_at'
  ) THEN
    ALTER TABLE public.integration_events ADD COLUMN occurred_at TIMESTAMPTZ DEFAULT NOW();
  END IF;

  -- Add source if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'integration_events' 
    AND column_name = 'source'
  ) THEN
    ALTER TABLE public.integration_events ADD COLUMN source TEXT;
  END IF;

  -- Add metadata if not exists (rename payload to metadata for consistency)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'integration_events' 
    AND column_name = 'metadata'
  ) THEN
    -- Check if payload exists and rename it
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'integration_events' 
      AND column_name = 'payload'
    ) THEN
      ALTER TABLE public.integration_events RENAME COLUMN payload TO metadata;
    ELSE
      ALTER TABLE public.integration_events ADD COLUMN metadata JSONB DEFAULT '{}';
    END IF;
  END IF;
END $$;

-- 4. Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_integration_events_user_integration ON public.integration_events(user_integration_id);
CREATE INDEX IF NOT EXISTS idx_integration_events_registry ON public.integration_events(integration_registry_id);
CREATE INDEX IF NOT EXISTS idx_integration_events_occurred_at ON public.integration_events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_integration_events_source ON public.integration_events(source);

-- Comments
COMMENT ON TABLE public.integration_ingestion_state IS 'Tracks polling state and cursors for each user integration';
COMMENT ON TABLE public.poll_run_logs IS 'Logs metadata for each poll function execution';
COMMENT ON COLUMN public.integration_ingestion_state.cursor_value IS 'Cursor or pagination token for incremental polling';
COMMENT ON COLUMN public.integration_ingestion_state.next_poll_after IS 'Rate limiting - do not poll before this timestamp';
COMMENT ON COLUMN public.poll_run_logs.records_fetched IS 'Number of records fetched from external API';
COMMENT ON COLUMN public.poll_run_logs.records_written IS 'Number of records written to Supabase';
