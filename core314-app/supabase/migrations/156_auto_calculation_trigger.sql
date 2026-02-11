-- ============================================================
-- Auto-Calculation Trigger
-- Automatically calculates metrics when events are inserted
-- Part of Integration Architecture v2.0
-- ============================================================

-- Function to extract signals from an event based on signal mappings
CREATE OR REPLACE FUNCTION public.extract_signals_from_event(p_event_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_event RECORD;
  v_mapping RECORD;
  v_value NUMERIC;
  v_count INTEGER := 0;
BEGIN
  -- Get the event
  SELECT * INTO v_event FROM public.integration_events WHERE id = p_event_id;
  
  IF v_event IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Find applicable signal mappings
  FOR v_mapping IN 
    SELECT * FROM public.integration_signal_mappings
    WHERE integration_type = v_event.service_name
    AND source_event_type = v_event.event_type
    AND is_enabled = true
  LOOP
    -- Determine value based on transformation type
    CASE v_mapping.transformation
      WHEN 'direct' THEN
        -- Extract value directly from metadata path
        v_value := (v_event.metadata #>> string_to_array(v_mapping.source_field_path, '.'))::NUMERIC;
      WHEN 'increment' THEN
        -- Just increment by default_value (usually 1)
        v_value := v_mapping.default_value;
      WHEN 'count' THEN
        -- Count as 1
        v_value := 1;
      ELSE
        v_value := v_mapping.default_value;
    END CASE;
    
    IF v_value IS NOT NULL THEN
      -- Insert signal
      INSERT INTO public.integration_signals (
        user_id, integration_type, signal_group, signal_name,
        signal_value, signal_metadata, source_event_id, occurred_at
      ) VALUES (
        v_event.user_id, v_event.service_name, v_mapping.target_signal_group,
        v_mapping.target_signal_name, v_value, 
        jsonb_build_object('source_event_type', v_event.event_type),
        p_event_id, COALESCE(v_event.occurred_at, v_event.created_at)
      );
      
      v_count := v_count + 1;
    END IF;
  END LOOP;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function to auto-process events when inserted
CREATE OR REPLACE FUNCTION public.trigger_process_integration_event()
RETURNS TRIGGER AS $$
DECLARE
  v_is_first_event BOOLEAN;
BEGIN
  -- Check if this is the first event for this user/integration
  SELECT NOT EXISTS(
    SELECT 1 FROM public.ingestion_health
    WHERE user_id = NEW.user_id 
    AND integration_type = NEW.service_name
    AND first_event_at IS NOT NULL
  ) INTO v_is_first_event;
  
  -- Record first event if applicable
  IF v_is_first_event THEN
    PERFORM public.record_first_event(NEW.user_id, NEW.service_name);
  ELSE
    -- Update last_event_at and increment counters
    UPDATE public.ingestion_health
    SET 
      last_event_at = NOW(),
      events_last_hour = events_last_hour + 1,
      events_last_24h = events_last_24h + 1,
      status = 'healthy',
      updated_at = NOW()
    WHERE user_id = NEW.user_id AND integration_type = NEW.service_name;
  END IF;
  
  -- Extract signals from the event
  PERFORM public.extract_signals_from_event(NEW.id);
  
  -- Trigger metrics recalculation
  PERFORM public.calculate_integration_metrics(NEW.user_id, NEW.service_name);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on integration_events
DROP TRIGGER IF EXISTS trigger_process_event_insert ON public.integration_events;
CREATE TRIGGER trigger_process_event_insert
  AFTER INSERT ON public.integration_events
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_process_integration_event();

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.extract_signals_from_event(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.trigger_process_integration_event() TO service_role;

-- Comments
COMMENT ON FUNCTION public.extract_signals_from_event(UUID) IS 'Extracts normalized signals from a raw integration event based on signal mappings';
COMMENT ON FUNCTION public.trigger_process_integration_event() IS 'Trigger function that processes events on insert: records first event, extracts signals, calculates metrics';
