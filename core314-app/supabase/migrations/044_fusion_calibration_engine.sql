
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.fusion_calibration_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  optimization_event_id UUID REFERENCES public.fusion_optimization_events(id) ON DELETE SET NULL,
  behavioral_event_id UUID REFERENCES public.fusion_behavioral_metrics(id) ON DELETE SET NULL,
  prediction_event_id UUID REFERENCES public.fusion_prediction_events(id) ON DELETE SET NULL,
  fusion_score NUMERIC(10,2) NOT NULL,
  calibration_action TEXT NOT NULL CHECK (calibration_action IN ('Amplify', 'Tune-Down', 'Monitor')),
  confidence_level NUMERIC(5,2) NOT NULL CHECK (confidence_level >= 0 AND confidence_level <= 100),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calibration_optimization 
  ON public.fusion_calibration_events(optimization_event_id);

CREATE INDEX IF NOT EXISTS idx_calibration_behavioral 
  ON public.fusion_calibration_events(behavioral_event_id);

CREATE INDEX IF NOT EXISTS idx_calibration_prediction 
  ON public.fusion_calibration_events(prediction_event_id);

CREATE INDEX IF NOT EXISTS idx_calibration_created_at 
  ON public.fusion_calibration_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_calibration_action 
  ON public.fusion_calibration_events(calibration_action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_calibration_score 
  ON public.fusion_calibration_events(fusion_score DESC, created_at DESC);

ALTER TABLE public.fusion_calibration_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can view calibration events"
  ON public.fusion_calibration_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_platform_admin = TRUE
    )
  );

CREATE POLICY "Service role can insert calibration events"
  ON public.fusion_calibration_events FOR INSERT
  TO service_role
  WITH CHECK (TRUE);

CREATE POLICY "Service role can update calibration events"
  ON public.fusion_calibration_events FOR UPDATE
  TO service_role
  USING (TRUE);

CREATE OR REPLACE FUNCTION public.fusion_calibration_engine()
RETURNS TABLE(
  events_processed INTEGER,
  avg_fusion_score NUMERIC,
  amplify_count INTEGER,
  tune_down_count INTEGER,
  monitor_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_events_processed INTEGER := 0;
  v_amplify_count INTEGER := 0;
  v_tune_down_count INTEGER := 0;
  v_monitor_count INTEGER := 0;
  v_avg_fusion_score NUMERIC := 0;
  v_calibration_window INTERVAL := INTERVAL '24 hours';
BEGIN
  INSERT INTO public.fusion_calibration_events (
    optimization_event_id,
    behavioral_event_id,
    prediction_event_id,
    fusion_score,
    calibration_action,
    confidence_level,
    notes
  )
  SELECT 
    oe.id AS optimization_event_id,
    bm.id AS behavioral_event_id,
    pe.id AS prediction_event_id,
    (
      COALESCE(oe.efficiency_index, 50) * 0.4 +
      COALESCE(bm.behavior_score, 50) * 0.3 +
      COALESCE(pe.confidence_score, 50) * 0.3
    )::NUMERIC(10,2) AS fusion_score,
    CASE
      WHEN (
        COALESCE(oe.efficiency_index, 50) * 0.4 +
        COALESCE(bm.behavior_score, 50) * 0.3 +
        COALESCE(pe.confidence_score, 50) * 0.3
      ) >= 75 THEN 'Amplify'
      WHEN (
        COALESCE(oe.efficiency_index, 50) * 0.4 +
        COALESCE(bm.behavior_score, 50) * 0.3 +
        COALESCE(pe.confidence_score, 50) * 0.3
      ) <= 40 THEN 'Tune-Down'
      ELSE 'Monitor'
    END AS calibration_action,
    (
      (COALESCE(oe.efficiency_index, 50) + 
       COALESCE(bm.behavior_score, 50) + 
       COALESCE(pe.confidence_score, 50)) / 3.0
    )::NUMERIC(5,2) AS confidence_level,
    'Correlated: ' || 
    COALESCE(oe.optimization_type, 'N/A') || ' + ' ||
    COALESCE(bm.event_type, 'N/A') || ' + ' ||
    COALESCE(pe.prediction_type, 'N/A') AS notes
  FROM public.fusion_optimization_events oe
  LEFT JOIN public.fusion_behavioral_metrics bm 
    ON bm.created_at BETWEEN oe.created_at - INTERVAL '1 hour' AND oe.created_at + INTERVAL '1 hour'
  LEFT JOIN public.fusion_prediction_events pe
    ON pe.created_at BETWEEN oe.created_at - INTERVAL '2 hours' AND oe.created_at + INTERVAL '2 hours'
  WHERE oe.created_at >= NOW() - v_calibration_window
    AND NOT EXISTS (
      SELECT 1 FROM public.fusion_calibration_events fce
      WHERE fce.optimization_event_id = oe.id
        AND fce.behavioral_event_id = bm.id
        AND fce.prediction_event_id = pe.id
    )
  LIMIT 100;

  GET DIAGNOSTICS v_events_processed = ROW_COUNT;

  SELECT 
    COALESCE(AVG(fusion_score), 0),
    COALESCE(SUM(CASE WHEN calibration_action = 'Amplify' THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN calibration_action = 'Tune-Down' THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN calibration_action = 'Monitor' THEN 1 ELSE 0 END), 0)
  INTO v_avg_fusion_score, v_amplify_count, v_tune_down_count, v_monitor_count
  FROM public.fusion_calibration_events
  WHERE created_at >= NOW() - v_calibration_window;

  UPDATE public.adaptive_workflow_metrics awm
  SET efficiency_index = LEAST(100, efficiency_index * 1.1)
  WHERE EXISTS (
    SELECT 1 FROM public.fusion_calibration_events fce
    JOIN public.fusion_optimization_events oe ON fce.optimization_event_id = oe.id
    WHERE fce.calibration_action = 'Amplify'
      AND fce.created_at >= NOW() - INTERVAL '1 hour'
      AND oe.workflow_id = awm.workflow_id
  );

  RETURN QUERY SELECT 
    v_events_processed,
    v_avg_fusion_score,
    v_amplify_count,
    v_tune_down_count,
    v_monitor_count;

  RAISE NOTICE 'Fusion Calibration complete. Processed: %, Avg Score: %, Amplify: %, Tune-Down: %, Monitor: %',
    v_events_processed, v_avg_fusion_score, v_amplify_count, v_tune_down_count, v_monitor_count;
END;
$$;

DO $$
DECLARE
  v_cron_schema_exists BOOLEAN;
  v_schedule_function_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname = 'cron') INTO v_cron_schema_exists;
  
  IF v_cron_schema_exists THEN
    SELECT EXISTS(
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'cron' AND p.proname = 'schedule'
    ) INTO v_schedule_function_exists;
    
    IF v_schedule_function_exists THEN
      PERFORM cron.schedule(
        'fusion-calibration-engine',
        '0 */2 * * *',
        'SELECT public.fusion_calibration_engine()'
      );
      RAISE NOTICE 'Successfully scheduled fusion calibration engine to run every 2 hours via pg_cron';
    ELSE
      RAISE NOTICE 'pg_cron schema exists but schedule function not found. Please schedule manually.';
    END IF;
  ELSE
    RAISE NOTICE 'pg_cron not available. Please schedule manually via Supabase Dashboard or enable pg_cron extension.';
  END IF;
END$$;

COMMENT ON TABLE public.fusion_calibration_events IS 
  'Phase 37: Stores calibration events from the AI Fusion Calibration Engine (FACE)';

COMMENT ON COLUMN public.fusion_calibration_events.fusion_score IS 
  'Weighted composite score: (efficiency_index × 0.4) + (behavior_impact × 0.3) + (prediction_confidence × 0.3)';

COMMENT ON COLUMN public.fusion_calibration_events.calibration_action IS 
  'Action determined by fusion_score thresholds: Amplify (≥75), Tune-Down (≤40), Monitor (41-74)';

COMMENT ON COLUMN public.fusion_calibration_events.confidence_level IS 
  'Average confidence across optimization, behavioral, and prediction components';

COMMENT ON FUNCTION public.fusion_calibration_engine() IS 
  'Phase 37: Correlates optimization, behavioral, and prediction events to calculate fusion scores and determine calibration actions';
