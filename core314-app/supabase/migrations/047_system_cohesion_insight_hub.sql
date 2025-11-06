
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.fusion_system_insights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_phase TEXT NOT NULL,
  metric_type TEXT NOT NULL,
  metric_value NUMERIC,
  metric_context JSONB,
  cohesion_score NUMERIC CHECK (cohesion_score >= 0 AND cohesion_score <= 100),
  insight_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insights_source_phase 
  ON public.fusion_system_insights(source_phase, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_insights_created_at 
  ON public.fusion_system_insights(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_insights_cohesion_score 
  ON public.fusion_system_insights(cohesion_score DESC);

CREATE INDEX IF NOT EXISTS idx_insights_metric_type 
  ON public.fusion_system_insights(metric_type, created_at DESC);

ALTER TABLE public.fusion_system_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can view system insights"
  ON public.fusion_system_insights FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_platform_admin = TRUE
    )
  );

CREATE POLICY "Service role can manage system insights"
  ON public.fusion_system_insights FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

CREATE OR REPLACE FUNCTION public.fusion_cohesion_engine()
RETURNS TABLE(
  cohesion_score NUMERIC,
  insights_created INTEGER,
  system_health TEXT,
  active_subsystems INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cohesion_score NUMERIC := 0;
  v_insights_created INTEGER := 0;
  v_system_health TEXT := 'Healthy';
  v_active_subsystems INTEGER := 0;
  v_cohesion_window INTERVAL := INTERVAL '1 hour';
  v_start_time TIMESTAMPTZ;
  
  v_optimization_count INTEGER;
  v_behavioral_count INTEGER;
  v_prediction_count INTEGER;
  v_calibration_count INTEGER;
  v_audit_count INTEGER;
  v_orchestrator_count INTEGER;
  
  v_phase_variance NUMERIC;
  v_anomaly_weight NUMERIC;
  v_load_variance NUMERIC;
  v_avg_confidence NUMERIC;
  v_anomaly_count INTEGER;
  v_total_events INTEGER;
  
  v_optimization_last TIMESTAMPTZ;
  v_behavioral_last TIMESTAMPTZ;
  v_prediction_last TIMESTAMPTZ;
  v_calibration_last TIMESTAMPTZ;
  v_audit_last TIMESTAMPTZ;
  v_orchestrator_last TIMESTAMPTZ;
  v_sync_intervals NUMERIC[];
  v_sync_variance NUMERIC;
BEGIN
  v_start_time := clock_timestamp();
  
  SELECT COUNT(*), MAX(created_at) INTO v_optimization_count, v_optimization_last
  FROM public.fusion_optimization_events
  WHERE created_at >= NOW() - v_cohesion_window;
  
  SELECT COUNT(*), MAX(created_at) INTO v_behavioral_count, v_behavioral_last
  FROM public.fusion_behavioral_metrics
  WHERE created_at >= NOW() - v_cohesion_window;
  
  SELECT COUNT(*), MAX(created_at) INTO v_prediction_count, v_prediction_last
  FROM public.fusion_prediction_events
  WHERE created_at >= NOW() - v_cohesion_window;
  
  SELECT COUNT(*), MAX(created_at) INTO v_calibration_count, v_calibration_last
  FROM public.fusion_calibration_events
  WHERE created_at >= NOW() - v_cohesion_window;
  
  SELECT COUNT(*), MAX(created_at) INTO v_audit_count, v_audit_last
  FROM public.fusion_audit_log
  WHERE created_at >= NOW() - v_cohesion_window;
  
  SELECT COUNT(*), MAX(created_at) INTO v_orchestrator_count, v_orchestrator_last
  FROM public.fusion_orchestrator_events
  WHERE created_at >= NOW() - v_cohesion_window;
  
  v_active_subsystems := 0;
  IF v_optimization_count > 0 THEN v_active_subsystems := v_active_subsystems + 1; END IF;
  IF v_behavioral_count > 0 THEN v_active_subsystems := v_active_subsystems + 1; END IF;
  IF v_prediction_count > 0 THEN v_active_subsystems := v_active_subsystems + 1; END IF;
  IF v_calibration_count > 0 THEN v_active_subsystems := v_active_subsystems + 1; END IF;
  IF v_audit_count > 0 THEN v_active_subsystems := v_active_subsystems + 1; END IF;
  IF v_orchestrator_count > 0 THEN v_active_subsystems := v_active_subsystems + 1; END IF;
  
  v_total_events := v_optimization_count + v_behavioral_count + v_prediction_count + 
                    v_calibration_count + v_audit_count + v_orchestrator_count;
  
  v_sync_intervals := ARRAY[
    EXTRACT(EPOCH FROM (NOW() - COALESCE(v_optimization_last, NOW() - INTERVAL '1 day'))),
    EXTRACT(EPOCH FROM (NOW() - COALESCE(v_behavioral_last, NOW() - INTERVAL '1 day'))),
    EXTRACT(EPOCH FROM (NOW() - COALESCE(v_prediction_last, NOW() - INTERVAL '1 day'))),
    EXTRACT(EPOCH FROM (NOW() - COALESCE(v_calibration_last, NOW() - INTERVAL '1 day'))),
    EXTRACT(EPOCH FROM (NOW() - COALESCE(v_audit_last, NOW() - INTERVAL '1 day'))),
    EXTRACT(EPOCH FROM (NOW() - COALESCE(v_orchestrator_last, NOW() - INTERVAL '1 day')))
  ];
  
  SELECT COALESCE(VARIANCE(unnest), 0) / 1000 INTO v_sync_variance
  FROM unnest(v_sync_intervals);
  
  v_phase_variance := LEAST(v_sync_variance, 30);
  
  SELECT COUNT(*) INTO v_anomaly_count
  FROM public.fusion_audit_log
  WHERE anomaly_detected = TRUE
    AND created_at >= NOW() - v_cohesion_window;
  
  v_anomaly_weight := LEAST((v_anomaly_count::NUMERIC / NULLIF(v_total_events, 0)) * 100, 30);
  v_anomaly_weight := COALESCE(v_anomaly_weight, 0);
  
  DECLARE
    v_event_counts NUMERIC[];
    v_load_stddev NUMERIC;
  BEGIN
    v_event_counts := ARRAY[
      v_optimization_count::NUMERIC,
      v_behavioral_count::NUMERIC,
      v_prediction_count::NUMERIC,
      v_calibration_count::NUMERIC,
      v_audit_count::NUMERIC,
      v_orchestrator_count::NUMERIC
    ];
    
    SELECT COALESCE(STDDEV(unnest), 0) INTO v_load_stddev
    FROM unnest(v_event_counts);
    
    v_load_variance := LEAST(v_load_stddev, 40);
  END;
  
  v_cohesion_score := 100 - (v_phase_variance + v_anomaly_weight + v_load_variance);
  v_cohesion_score := GREATEST(LEAST(v_cohesion_score, 100), 0);
  
  IF v_cohesion_score >= 80 THEN
    v_system_health := 'Excellent';
  ELSIF v_cohesion_score >= 60 THEN
    v_system_health := 'Good';
  ELSIF v_cohesion_score >= 40 THEN
    v_system_health := 'Fair';
  ELSIF v_cohesion_score >= 20 THEN
    v_system_health := 'Poor';
  ELSE
    v_system_health := 'Critical';
  END IF;
  
  SELECT COALESCE(AVG(confidence_level), 0) INTO v_avg_confidence
  FROM public.fusion_calibration_events
  WHERE created_at >= NOW() - v_cohesion_window;
  
  INSERT INTO public.fusion_system_insights (
    source_phase,
    metric_type,
    metric_value,
    metric_context,
    cohesion_score,
    insight_summary
  ) VALUES (
    'System-Wide',
    'Cohesion Score',
    v_cohesion_score,
    jsonb_build_object(
      'active_subsystems', v_active_subsystems,
      'total_events', v_total_events,
      'phase_variance', v_phase_variance,
      'anomaly_weight', v_anomaly_weight,
      'load_variance', v_load_variance,
      'avg_confidence', v_avg_confidence,
      'anomaly_count', v_anomaly_count,
      'system_health', v_system_health
    ),
    v_cohesion_score,
    CASE
      WHEN v_cohesion_score >= 80 THEN 
        'System operating harmoniously with ' || v_active_subsystems || ' active subsystems. All phases synchronized.'
      WHEN v_cohesion_score >= 60 THEN
        'System functioning well with minor desynchronization. ' || v_anomaly_count || ' anomalies detected.'
      WHEN v_cohesion_score >= 40 THEN
        'System experiencing moderate cohesion issues. Phase variance: ' || ROUND(v_phase_variance, 1) || ', Load variance: ' || ROUND(v_load_variance, 1) || '.'
      WHEN v_cohesion_score >= 20 THEN
        'System cohesion degraded. Calibration layer may be desynchronized. Immediate attention recommended.'
      ELSE
        'Critical system cohesion failure. Multiple subsystems out of sync. Emergency intervention required.'
    END
  );
  v_insights_created := v_insights_created + 1;
  
  IF v_optimization_count > 0 THEN
    INSERT INTO public.fusion_system_insights (
      source_phase,
      metric_type,
      metric_value,
      metric_context,
      cohesion_score,
      insight_summary
    ) VALUES (
      'Optimization',
      'Activity Level',
      v_optimization_count,
      jsonb_build_object(
        'event_count', v_optimization_count,
        'last_activity', v_optimization_last,
        'time_since_last', EXTRACT(EPOCH FROM (NOW() - v_optimization_last))
      ),
      v_cohesion_score,
      'Optimization engine processed ' || v_optimization_count || ' events in the last hour.'
    );
    v_insights_created := v_insights_created + 1;
  END IF;
  
  IF v_calibration_count > 0 THEN
    INSERT INTO public.fusion_system_insights (
      source_phase,
      metric_type,
      metric_value,
      metric_context,
      cohesion_score,
      insight_summary
    ) VALUES (
      'Calibration',
      'Activity Level',
      v_calibration_count,
      jsonb_build_object(
        'event_count', v_calibration_count,
        'last_activity', v_calibration_last,
        'avg_confidence', v_avg_confidence,
        'time_since_last', EXTRACT(EPOCH FROM (NOW() - v_calibration_last))
      ),
      v_cohesion_score,
      'Calibration engine executed ' || v_calibration_count || ' adjustments with ' || ROUND(v_avg_confidence, 1) || '% average confidence.'
    );
    v_insights_created := v_insights_created + 1;
  END IF;
  
  IF v_prediction_count > 0 THEN
    INSERT INTO public.fusion_system_insights (
      source_phase,
      metric_type,
      metric_value,
      metric_context,
      cohesion_score,
      insight_summary
    ) VALUES (
      'Prediction',
      'Activity Level',
      v_prediction_count,
      jsonb_build_object(
        'event_count', v_prediction_count,
        'last_activity', v_prediction_last,
        'time_since_last', EXTRACT(EPOCH FROM (NOW() - v_prediction_last))
      ),
      v_cohesion_score,
      'Prediction engine generated ' || v_prediction_count || ' recommendations in the last hour.'
    );
    v_insights_created := v_insights_created + 1;
  END IF;
  
  IF v_anomaly_count > 0 THEN
    INSERT INTO public.fusion_system_insights (
      source_phase,
      metric_type,
      metric_value,
      metric_context,
      cohesion_score,
      insight_summary
    ) VALUES (
      'Oversight',
      'Anomaly Detection',
      v_anomaly_count,
      jsonb_build_object(
        'anomaly_count', v_anomaly_count,
        'total_audit_entries', v_audit_count,
        'anomaly_rate', (v_anomaly_count::NUMERIC / NULLIF(v_audit_count, 0)) * 100
      ),
      v_cohesion_score,
      'Oversight detected ' || v_anomaly_count || ' anomalies requiring attention.'
    );
    v_insights_created := v_insights_created + 1;
  END IF;
  
  RETURN QUERY SELECT 
    v_cohesion_score,
    v_insights_created,
    v_system_health,
    v_active_subsystems;
  
  RAISE NOTICE 'Cohesion analysis complete. Score: %, Insights: %, Health: %, Active: %',
    v_cohesion_score, v_insights_created, v_system_health, v_active_subsystems;
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
        'fusion-cohesion-engine',
        '0 * * * *',
        'SELECT public.fusion_cohesion_engine()'
      );
      RAISE NOTICE 'Successfully scheduled fusion cohesion engine to run every hour via pg_cron';
    ELSE
      RAISE NOTICE 'pg_cron schema exists but schedule function not found. Please schedule manually.';
    END IF;
  ELSE
    RAISE NOTICE 'pg_cron not available. Please schedule manually via Supabase Dashboard or enable pg_cron extension.';
  END IF;
END$$;

COMMENT ON TABLE public.fusion_system_insights IS 
  'Phase 40: System-wide intelligence insights and cohesion metrics';

COMMENT ON COLUMN public.fusion_system_insights.source_phase IS 
  'AI subsystem that generated this insight: Optimization, Calibration, Prediction, Oversight, Orchestrator, System-Wide';

COMMENT ON COLUMN public.fusion_system_insights.cohesion_score IS 
  'System cohesion score (0-100): 100 - (phase_variance + anomaly_weight + load_variance)';

COMMENT ON COLUMN public.fusion_system_insights.metric_context IS 
  'JSONB snapshot of subsystem metrics and context at insight generation time';

COMMENT ON FUNCTION public.fusion_cohesion_engine() IS 
  'Phase 40: Calculates system cohesion score and generates unified intelligence insights';
