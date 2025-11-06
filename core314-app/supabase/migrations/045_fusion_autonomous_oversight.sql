
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.fusion_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fusion_event_id UUID REFERENCES public.fusion_calibration_events(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  decision_summary TEXT NOT NULL,
  confidence_level NUMERIC(5,2) NOT NULL CHECK (confidence_level >= 0 AND confidence_level <= 100),
  system_context JSONB,
  decision_impact TEXT CHECK (decision_impact IN ('LOW', 'MODERATE', 'HIGH')),
  anomaly_detected BOOLEAN DEFAULT false,
  triggered_by TEXT DEFAULT 'AI-System',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_action_type 
  ON public.fusion_audit_log(action_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_created_at 
  ON public.fusion_audit_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_confidence 
  ON public.fusion_audit_log(confidence_level DESC);

CREATE INDEX IF NOT EXISTS idx_audit_fusion_event 
  ON public.fusion_audit_log(fusion_event_id);

CREATE INDEX IF NOT EXISTS idx_audit_decision_impact 
  ON public.fusion_audit_log(decision_impact, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_anomaly 
  ON public.fusion_audit_log(anomaly_detected, created_at DESC) 
  WHERE anomaly_detected = true;

ALTER TABLE public.fusion_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can view audit logs"
  ON public.fusion_audit_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_platform_admin = TRUE
    )
  );

CREATE POLICY "Service role can insert audit logs"
  ON public.fusion_audit_log FOR INSERT
  TO service_role
  WITH CHECK (TRUE);

CREATE OR REPLACE FUNCTION public.fusion_oversight_engine()
RETURNS TABLE(
  audit_entries_created INTEGER,
  anomalies_detected INTEGER,
  high_impact_decisions INTEGER,
  avg_confidence NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_audit_entries_created INTEGER := 0;
  v_anomalies_detected INTEGER := 0;
  v_high_impact_decisions INTEGER := 0;
  v_avg_confidence NUMERIC := 0;
  v_oversight_window INTERVAL := INTERVAL '24 hours';
  v_previous_avg_score NUMERIC;
  v_current_avg_score NUMERIC;
  v_score_variance NUMERIC;
BEGIN
  SELECT AVG(fusion_score) INTO v_previous_avg_score
  FROM public.fusion_calibration_events
  WHERE created_at BETWEEN NOW() - INTERVAL '48 hours' AND NOW() - v_oversight_window;

  SELECT AVG(fusion_score) INTO v_current_avg_score
  FROM public.fusion_calibration_events
  WHERE created_at >= NOW() - v_oversight_window;

  IF v_previous_avg_score IS NOT NULL AND v_previous_avg_score > 0 THEN
    v_score_variance := ABS((v_current_avg_score - v_previous_avg_score) / v_previous_avg_score * 100);
  ELSE
    v_score_variance := 0;
  END IF;

  INSERT INTO public.fusion_audit_log (
    fusion_event_id,
    action_type,
    decision_summary,
    confidence_level,
    system_context,
    decision_impact,
    anomaly_detected,
    triggered_by
  )
  SELECT 
    fce.id AS fusion_event_id,
    fce.calibration_action AS action_type,
    'Fusion Calibration: ' || fce.calibration_action || 
    ' action taken with fusion score ' || fce.fusion_score::TEXT ||
    '. ' || COALESCE(fce.notes, 'No additional notes.') AS decision_summary,
    fce.confidence_level,
    jsonb_build_object(
      'fusion_score', fce.fusion_score,
      'optimization_event_id', fce.optimization_event_id,
      'behavioral_event_id', fce.behavioral_event_id,
      'prediction_event_id', fce.prediction_event_id,
      'score_variance_pct', v_score_variance,
      'previous_avg_score', v_previous_avg_score,
      'current_avg_score', v_current_avg_score,
      'timestamp', fce.created_at
    ) AS system_context,
    CASE
      WHEN fce.confidence_level >= 80 THEN 'HIGH'
      WHEN fce.confidence_level >= 60 THEN 'MODERATE'
      ELSE 'LOW'
    END AS decision_impact,
    (v_score_variance > 20) AS anomaly_detected,
    'AI-System' AS triggered_by
  FROM public.fusion_calibration_events fce
  WHERE fce.created_at >= NOW() - v_oversight_window
    AND NOT EXISTS (
      SELECT 1 FROM public.fusion_audit_log fal
      WHERE fal.fusion_event_id = fce.id
    )
  ORDER BY fce.created_at DESC
  LIMIT 100;

  GET DIAGNOSTICS v_audit_entries_created = ROW_COUNT;

  SELECT 
    COALESCE(SUM(CASE WHEN anomaly_detected = true THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN decision_impact = 'HIGH' THEN 1 ELSE 0 END), 0),
    COALESCE(AVG(confidence_level), 0)
  INTO v_anomalies_detected, v_high_impact_decisions, v_avg_confidence
  FROM public.fusion_audit_log
  WHERE created_at >= NOW() - v_oversight_window;

  RETURN QUERY SELECT 
    v_audit_entries_created,
    v_anomalies_detected,
    v_high_impact_decisions,
    v_avg_confidence;

  RAISE NOTICE 'Fusion Oversight complete. Audit entries: %, Anomalies: %, High-impact: %, Avg confidence: %',
    v_audit_entries_created, v_anomalies_detected, v_high_impact_decisions, v_avg_confidence;
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
        'fusion-oversight-engine',
        '0 * * * *',
        'SELECT public.fusion_oversight_engine()'
      );
      RAISE NOTICE 'Successfully scheduled fusion oversight engine to run every hour via pg_cron';
    ELSE
      RAISE NOTICE 'pg_cron schema exists but schedule function not found. Please schedule manually.';
    END IF;
  ELSE
    RAISE NOTICE 'pg_cron not available. Please schedule manually via Supabase Dashboard or enable pg_cron extension.';
  END IF;
END$$;

COMMENT ON TABLE public.fusion_audit_log IS 
  'Phase 38: Audit trail for autonomous AI decisions providing transparency and compliance';

COMMENT ON COLUMN public.fusion_audit_log.action_type IS 
  'Type of action taken: Amplify, Tune-Down, Monitor, or Auto-Recalibration';

COMMENT ON COLUMN public.fusion_audit_log.decision_impact IS 
  'Impact classification: HIGH (confidence ≥80), MODERATE (60-79), LOW (<60)';

COMMENT ON COLUMN public.fusion_audit_log.system_context IS 
  'JSONB snapshot of system metrics, behavioral indicators, and contextual metadata';

COMMENT ON COLUMN public.fusion_audit_log.anomaly_detected IS 
  'True when fusion_score variance exceeds 20% from previous cycle';

COMMENT ON FUNCTION public.fusion_oversight_engine() IS 
  'Phase 38: Monitors calibration events and generates audit trail with anomaly detection';
