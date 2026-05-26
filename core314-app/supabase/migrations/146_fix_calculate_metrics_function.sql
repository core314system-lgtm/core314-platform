-- ============================================================
-- Fix calculate_integration_metrics function
-- Uses ingested_at instead of created_at
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
  
  -- Get the latest event for this integration type (use ingested_at, not created_at)
  SELECT metadata INTO v_event_data
  FROM public.integration_events
  WHERE user_id = p_user_id
  AND service_name = p_integration_type
  ORDER BY ingested_at DESC
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
      INSERT INTO public.integration_metrics (
        user_id, integration_type, metric_name, metric_value, 
        metric_unit, period_start, period_end, calculated_at
      )
      VALUES (
        p_user_id, p_integration_type, v_metric.metric_name, v_value,
        v_metric.metric_unit, v_period_start, v_period_end, NOW()
      )
      ON CONFLICT (user_id, integration_type, metric_name, period_start, period_end)
      DO UPDATE SET metric_value = EXCLUDED.metric_value, calculated_at = NOW();
      
      v_count := v_count + 1;
    END IF;
  END LOOP;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.calculate_integration_metrics(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.calculate_integration_metrics(UUID, TEXT) TO authenticated;
