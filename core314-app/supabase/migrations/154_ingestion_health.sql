-- ============================================================
-- Ingestion Health Infrastructure
-- Monitors integration ingestion status and detects failures
-- Part of Integration Architecture v2.0
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ingestion_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  integration_type TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'healthy', 'degraded', 'failed', 'stale')),
  last_event_at TIMESTAMPTZ,
  last_successful_poll_at TIMESTAMPTZ,
  events_last_24h INTEGER DEFAULT 0,
  events_last_hour INTEGER DEFAULT 0,
  consecutive_failures INTEGER DEFAULT 0,
  last_error TEXT,
  last_error_at TIMESTAMPTZ,
  oauth_completed_at TIMESTAMPTZ,
  first_event_at TIMESTAMPTZ,
  time_to_first_event_seconds INTEGER, -- Tracks how long from OAuth to first event
  checked_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, integration_type)
);

CREATE INDEX IF NOT EXISTS idx_ingestion_health_user ON public.ingestion_health(user_id);
CREATE INDEX IF NOT EXISTS idx_ingestion_health_type ON public.ingestion_health(integration_type);
CREATE INDEX IF NOT EXISTS idx_ingestion_health_status ON public.ingestion_health(status);
CREATE INDEX IF NOT EXISTS idx_ingestion_health_user_type ON public.ingestion_health(user_id, integration_type);

ALTER TABLE public.ingestion_health ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ingestion health"
ON public.ingestion_health FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage ingestion health"
ON public.ingestion_health FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

GRANT ALL ON public.ingestion_health TO service_role;
GRANT SELECT ON public.ingestion_health TO authenticated;

-- Function to initialize ingestion health on OAuth completion
CREATE OR REPLACE FUNCTION public.init_ingestion_health(
  p_user_id UUID,
  p_integration_type TEXT
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.ingestion_health (
    user_id, integration_type, status, oauth_completed_at
  ) VALUES (
    p_user_id, p_integration_type, 'pending', NOW()
  )
  ON CONFLICT (user_id, integration_type)
  DO UPDATE SET 
    status = 'pending',
    oauth_completed_at = NOW(),
    first_event_at = NULL,
    time_to_first_event_seconds = NULL,
    last_error = NULL,
    last_error_at = NULL,
    consecutive_failures = 0,
    updated_at = NOW()
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record first event and calculate time-to-first-event
CREATE OR REPLACE FUNCTION public.record_first_event(
  p_user_id UUID,
  p_integration_type TEXT
)
RETURNS VOID AS $$
DECLARE
  v_oauth_time TIMESTAMPTZ;
  v_ttfe INTEGER;
BEGIN
  -- Get OAuth completion time
  SELECT oauth_completed_at INTO v_oauth_time
  FROM public.ingestion_health
  WHERE user_id = p_user_id AND integration_type = p_integration_type;
  
  IF v_oauth_time IS NOT NULL THEN
    v_ttfe := EXTRACT(EPOCH FROM (NOW() - v_oauth_time))::INTEGER;
  END IF;
  
  UPDATE public.ingestion_health
  SET 
    status = 'healthy',
    first_event_at = NOW(),
    last_event_at = NOW(),
    time_to_first_event_seconds = v_ttfe,
    events_last_hour = events_last_hour + 1,
    events_last_24h = events_last_24h + 1,
    updated_at = NOW()
  WHERE user_id = p_user_id 
    AND integration_type = p_integration_type
    AND first_event_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark ingestion as failed
CREATE OR REPLACE FUNCTION public.mark_ingestion_failed(
  p_user_id UUID,
  p_integration_type TEXT,
  p_error TEXT
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.ingestion_health
  SET 
    status = 'failed',
    last_error = p_error,
    last_error_at = NOW(),
    consecutive_failures = consecutive_failures + 1,
    updated_at = NOW()
  WHERE user_id = p_user_id AND integration_type = p_integration_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check for zero-data scenarios (called by scheduled job)
CREATE OR REPLACE FUNCTION public.check_ingestion_health()
RETURNS TABLE (
  user_id UUID,
  integration_type TEXT,
  status TEXT,
  issue TEXT,
  seconds_since_oauth INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ih.user_id,
    ih.integration_type,
    CASE 
      WHEN ih.first_event_at IS NULL AND ih.oauth_completed_at < NOW() - INTERVAL '60 seconds' THEN 'failed'
      WHEN ih.last_event_at IS NULL THEN 'pending'
      WHEN ih.last_event_at < NOW() - INTERVAL '24 hours' THEN 'stale'
      WHEN ih.events_last_hour < 1 THEN 'degraded'
      ELSE 'healthy'
    END::TEXT as status,
    CASE 
      WHEN ih.first_event_at IS NULL AND ih.oauth_completed_at < NOW() - INTERVAL '60 seconds' 
        THEN 'Zero events ingested within 60 seconds of OAuth'
      WHEN ih.last_event_at IS NULL THEN 'Awaiting first event'
      WHEN ih.last_event_at < NOW() - INTERVAL '24 hours' THEN 'No events in 24+ hours'
      WHEN ih.events_last_hour < 1 THEN 'Low event volume'
      ELSE NULL
    END::TEXT as issue,
    EXTRACT(EPOCH FROM (NOW() - ih.oauth_completed_at))::INTEGER as seconds_since_oauth
  FROM public.ingestion_health ih
  WHERE ih.status IN ('pending', 'degraded', 'stale')
    OR (ih.first_event_at IS NULL AND ih.oauth_completed_at IS NOT NULL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.init_ingestion_health(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_first_event(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_ingestion_failed(UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.check_ingestion_health() TO service_role;

-- Comments
COMMENT ON TABLE public.ingestion_health IS 'Monitors integration ingestion status and detects failures';
COMMENT ON COLUMN public.ingestion_health.status IS 'Health status: pending (awaiting first event), healthy (receiving events), degraded (low volume), failed (errors), stale (no recent events)';
COMMENT ON COLUMN public.ingestion_health.time_to_first_event_seconds IS 'Seconds from OAuth completion to first event received';
COMMENT ON FUNCTION public.check_ingestion_health() IS 'Returns integrations with health issues for alerting';
