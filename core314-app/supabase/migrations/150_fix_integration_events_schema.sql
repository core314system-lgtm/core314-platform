-- ============================================================
-- Fix Integration Events Schema
-- Adds missing columns required by poll functions and metric calculation
-- ============================================================

-- 1. Add metadata column (poll functions write metrics here)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'integration_events' 
    AND column_name = 'metadata'
  ) THEN
    ALTER TABLE public.integration_events ADD COLUMN metadata JSONB DEFAULT '{}';
  END IF;
END $$;

-- 2. Add user_integration_id column (links to user_integrations)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'integration_events' 
    AND column_name = 'user_integration_id'
  ) THEN
    ALTER TABLE public.integration_events ADD COLUMN user_integration_id UUID;
  END IF;
END $$;

-- 3. Add integration_registry_id column (links to integrations_master)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'integration_events' 
    AND column_name = 'integration_registry_id'
  ) THEN
    ALTER TABLE public.integration_events ADD COLUMN integration_registry_id UUID;
  END IF;
END $$;

-- 4. Add occurred_at column (when the event occurred in the source system)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'integration_events' 
    AND column_name = 'occurred_at'
  ) THEN
    ALTER TABLE public.integration_events ADD COLUMN occurred_at TIMESTAMPTZ;
  END IF;
END $$;

-- 5. Add source column (identifies where the event came from)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'integration_events' 
    AND column_name = 'source'
  ) THEN
    ALTER TABLE public.integration_events ADD COLUMN source TEXT;
  END IF;
END $$;

-- 6. Add ingested_at column (when the event was ingested into our system)
-- This is used by calculate_integration_metrics to get the latest event
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'integration_events' 
    AND column_name = 'ingested_at'
  ) THEN
    ALTER TABLE public.integration_events ADD COLUMN ingested_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- 7. Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_integration_events_metadata ON public.integration_events USING GIN(metadata);
CREATE INDEX IF NOT EXISTS idx_integration_events_user_integration ON public.integration_events(user_integration_id);
CREATE INDEX IF NOT EXISTS idx_integration_events_ingested_at ON public.integration_events(ingested_at DESC);
CREATE INDEX IF NOT EXISTS idx_integration_events_source ON public.integration_events(source);

-- 8. Add RLS policy for users to view their own events
DROP POLICY IF EXISTS "Users can view own integration events" ON public.integration_events;
CREATE POLICY "Users can view own integration events"
ON public.integration_events FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 9. Add service role policy for managing events
DROP POLICY IF EXISTS "Service role can manage integration events" ON public.integration_events;
CREATE POLICY "Service role can manage integration events"
ON public.integration_events FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT ALL ON public.integration_events TO service_role;
GRANT SELECT ON public.integration_events TO authenticated;

-- Add comments for documentation
COMMENT ON COLUMN public.integration_events.metadata IS 'JSONB containing metric values and additional data from the poll';
COMMENT ON COLUMN public.integration_events.user_integration_id IS 'Reference to user_integrations table';
COMMENT ON COLUMN public.integration_events.integration_registry_id IS 'Reference to integrations_master table';
COMMENT ON COLUMN public.integration_events.occurred_at IS 'When the event occurred in the source system';
COMMENT ON COLUMN public.integration_events.source IS 'Source of the event (e.g., salesforce_api_poll, slack_api_poll)';
COMMENT ON COLUMN public.integration_events.ingested_at IS 'When the event was ingested into Core314';

-- ============================================================
-- Fix calculate_integration_metrics function
-- Uses created_at as fallback if ingested_at is NULL
-- ============================================================

CREATE OR REPLACE FUNCTION public.calculate_integration_metrics(
  p_user_id UUID,
  p_integration_type TEXT
)
RETURNS INTEGER AS $$
DECLARE
  v_metric RECORD;
  v_value NUMERIC;
  v_event_data JSONB;
  v_count INTEGER := 0;
  v_period_start TIMESTAMPTZ;
  v_period_end TIMESTAMPTZ;
BEGIN
  v_period_end := NOW();
  v_period_start := v_period_end - INTERVAL '24 hours';
  
  -- Get the latest event for this integration type
  -- Try metadata first (new schema), fall back to payload (old schema)
  -- Order by ingested_at if available, otherwise created_at
  SELECT COALESCE(metadata, payload) INTO v_event_data
  FROM public.integration_events
  WHERE user_id = p_user_id
  AND service_name = p_integration_type
  ORDER BY COALESCE(ingested_at, created_at) DESC
  LIMIT 1;
  
  IF v_event_data IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Calculate each metric
  FOR v_metric IN 
    SELECT * FROM public.integration_metric_definitions
    WHERE integration_type = p_integration_type
    AND aggregation_type = 'latest'
  LOOP
    -- Extract value from event metadata
    v_value := (v_event_data ->> v_metric.source_field_path)::NUMERIC;
    
    IF v_value IS NOT NULL THEN
      -- Upsert the metric value
      INSERT INTO public.integration_metrics (
        user_id, integration_type, metric_name, metric_value, 
        metric_unit, period_start, period_end, calculated_at
      )
      VALUES (
        p_user_id, p_integration_type, v_metric.metric_name, v_value,
        v_metric.metric_unit, v_period_start, v_period_end, NOW()
      )
      ON CONFLICT (user_id, integration_type, metric_name, period_start, period_end)
      DO UPDATE SET 
        metric_value = EXCLUDED.metric_value,
        calculated_at = NOW();
      
      v_count := v_count + 1;
    END IF;
  END LOOP;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.calculate_integration_metrics IS 'Calculate metrics from integration_events and store in integration_metrics table';

GRANT EXECUTE ON FUNCTION public.calculate_integration_metrics TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_integration_metrics TO service_role;
