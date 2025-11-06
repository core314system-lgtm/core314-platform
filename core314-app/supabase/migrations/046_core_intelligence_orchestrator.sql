
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.fusion_orchestrator_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trigger_source TEXT NOT NULL,
  action_taken TEXT NOT NULL,
  priority_level INTEGER NOT NULL CHECK (priority_level >= 1 AND priority_level <= 4),
  system_state JSONB,
  policy_profile TEXT DEFAULT 'Standard' CHECK (policy_profile IN ('Conservative', 'Standard', 'Aggressive')),
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Running', 'Completed', 'Failed')),
  execution_time_ms INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_orchestrator_priority 
  ON public.fusion_orchestrator_events(priority_level, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orchestrator_trigger_source 
  ON public.fusion_orchestrator_events(trigger_source, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orchestrator_created_at 
  ON public.fusion_orchestrator_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orchestrator_status 
  ON public.fusion_orchestrator_events(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orchestrator_policy 
  ON public.fusion_orchestrator_events(policy_profile, created_at DESC);

ALTER TABLE public.fusion_orchestrator_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can view orchestrator events"
  ON public.fusion_orchestrator_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_platform_admin = TRUE
    )
  );

CREATE POLICY "Service role can manage orchestrator events"
  ON public.fusion_orchestrator_events FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

CREATE OR REPLACE FUNCTION public.fusion_orchestrator_engine(
  p_policy_profile TEXT DEFAULT 'Standard',
  p_max_priority INTEGER DEFAULT 4
)
RETURNS TABLE(
  tasks_created INTEGER,
  tasks_completed INTEGER,
  avg_priority NUMERIC,
  system_health TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tasks_created INTEGER := 0;
  v_tasks_completed INTEGER := 0;
  v_avg_priority NUMERIC := 0;
  v_system_health TEXT := 'Healthy';
  v_orchestration_window INTERVAL := INTERVAL '1 hour';
  v_start_time TIMESTAMPTZ;
  v_execution_time_ms INTEGER;
  
  v_optimization_count INTEGER;
  v_behavioral_count INTEGER;
  v_prediction_count INTEGER;
  v_calibration_count INTEGER;
  v_audit_count INTEGER;
  v_total_events INTEGER;
  
  v_optimization_threshold INTEGER;
  v_calibration_threshold INTEGER;
  v_prediction_threshold INTEGER;
BEGIN
  v_start_time := clock_timestamp();
  
  CASE p_policy_profile
    WHEN 'Conservative' THEN
      v_optimization_threshold := 10;
      v_calibration_threshold := 5;
      v_prediction_threshold := 8;
    WHEN 'Aggressive' THEN
      v_optimization_threshold := 50;
      v_calibration_threshold := 30;
      v_prediction_threshold := 40;
    ELSE -- Standard
      v_optimization_threshold := 25;
      v_calibration_threshold := 15;
      v_prediction_threshold := 20;
  END CASE;
  
  SELECT COUNT(*) INTO v_optimization_count
  FROM public.fusion_optimization_events
  WHERE created_at >= NOW() - v_orchestration_window;
  
  SELECT COUNT(*) INTO v_behavioral_count
  FROM public.fusion_behavioral_metrics
  WHERE created_at >= NOW() - v_orchestration_window;
  
  SELECT COUNT(*) INTO v_prediction_count
  FROM public.fusion_prediction_events
  WHERE created_at >= NOW() - v_orchestration_window;
  
  SELECT COUNT(*) INTO v_calibration_count
  FROM public.fusion_calibration_events
  WHERE created_at >= NOW() - v_orchestration_window;
  
  SELECT COUNT(*) INTO v_audit_count
  FROM public.fusion_audit_log
  WHERE created_at >= NOW() - v_orchestration_window;
  
  v_total_events := v_optimization_count + v_behavioral_count + v_prediction_count + 
                    v_calibration_count + v_audit_count;
  
  IF v_total_events > 100 THEN
    v_system_health := 'High Load';
  ELSIF v_total_events < 5 THEN
    v_system_health := 'Low Activity';
  ELSE
    v_system_health := 'Healthy';
  END IF;
  
  IF v_optimization_count < v_optimization_threshold THEN
    INSERT INTO public.fusion_orchestrator_events (
      trigger_source,
      action_taken,
      priority_level,
      system_state,
      policy_profile,
      status
    ) VALUES (
      'Optimization',
      'Trigger fusion_optimization_engine() - Low optimization event count',
      CASE 
        WHEN p_policy_profile = 'Aggressive' THEN 2
        WHEN p_policy_profile = 'Conservative' THEN 3
        ELSE 2
      END,
      jsonb_build_object(
        'optimization_count', v_optimization_count,
        'threshold', v_optimization_threshold,
        'total_events', v_total_events,
        'system_health', v_system_health
      ),
      p_policy_profile,
      'Completed'
    );
    v_tasks_created := v_tasks_created + 1;
  END IF;
  
  IF v_calibration_count < v_calibration_threshold THEN
    INSERT INTO public.fusion_orchestrator_events (
      trigger_source,
      action_taken,
      priority_level,
      system_state,
      policy_profile,
      status
    ) VALUES (
      'Calibration',
      'Trigger fusion_calibration_engine() - Low calibration event count',
      CASE 
        WHEN p_policy_profile = 'Aggressive' THEN 1
        WHEN p_policy_profile = 'Conservative' THEN 3
        ELSE 2
      END,
      jsonb_build_object(
        'calibration_count', v_calibration_count,
        'threshold', v_calibration_threshold,
        'total_events', v_total_events,
        'system_health', v_system_health
      ),
      p_policy_profile,
      'Completed'
    );
    v_tasks_created := v_tasks_created + 1;
  END IF;
  
  IF v_prediction_count < v_prediction_threshold THEN
    INSERT INTO public.fusion_orchestrator_events (
      trigger_source,
      action_taken,
      priority_level,
      system_state,
      policy_profile,
      status
    ) VALUES (
      'Prediction',
      'Trigger recommendation_engine() - Low prediction event count',
      CASE 
        WHEN p_policy_profile = 'Aggressive' THEN 2
        WHEN p_policy_profile = 'Conservative' THEN 4
        ELSE 3
      END,
      jsonb_build_object(
        'prediction_count', v_prediction_count,
        'threshold', v_prediction_threshold,
        'total_events', v_total_events,
        'system_health', v_system_health
      ),
      p_policy_profile,
      'Completed'
    );
    v_tasks_created := v_tasks_created + 1;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM public.fusion_audit_log
    WHERE anomaly_detected = TRUE
      AND created_at >= NOW() - INTERVAL '2 hours'
  ) THEN
    INSERT INTO public.fusion_orchestrator_events (
      trigger_source,
      action_taken,
      priority_level,
      system_state,
      policy_profile,
      status
    ) VALUES (
      'Oversight',
      'Trigger fusion_oversight_engine() - Anomalies detected',
      1, -- Critical priority
      jsonb_build_object(
        'anomaly_count', (
          SELECT COUNT(*) FROM public.fusion_audit_log
          WHERE anomaly_detected = TRUE
            AND created_at >= NOW() - INTERVAL '2 hours'
        ),
        'total_events', v_total_events,
        'system_health', v_system_health
      ),
      p_policy_profile,
      'Completed'
    );
    v_tasks_created := v_tasks_created + 1;
  END IF;
  
  IF v_system_health = 'High Load' THEN
    INSERT INTO public.fusion_orchestrator_events (
      trigger_source,
      action_taken,
      priority_level,
      system_state,
      policy_profile,
      status
    ) VALUES (
      'System Monitor',
      'Alert: System under high load - Consider scaling or throttling',
      1, -- Critical priority
      jsonb_build_object(
        'total_events', v_total_events,
        'system_health', v_system_health,
        'optimization_count', v_optimization_count,
        'behavioral_count', v_behavioral_count,
        'prediction_count', v_prediction_count,
        'calibration_count', v_calibration_count,
        'audit_count', v_audit_count
      ),
      p_policy_profile,
      'Completed'
    );
    v_tasks_created := v_tasks_created + 1;
  ELSIF v_system_health = 'Low Activity' THEN
    INSERT INTO public.fusion_orchestrator_events (
      trigger_source,
      action_taken,
      priority_level,
      system_state,
      policy_profile,
      status
    ) VALUES (
      'System Monitor',
      'Notice: Low system activity - All subsystems idle',
      4, -- Low priority
      jsonb_build_object(
        'total_events', v_total_events,
        'system_health', v_system_health
      ),
      p_policy_profile,
      'Completed'
    );
    v_tasks_created := v_tasks_created + 1;
  END IF;
  
  v_execution_time_ms := EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_start_time))::INTEGER;
  
  UPDATE public.fusion_orchestrator_events
  SET execution_time_ms = v_execution_time_ms,
      completed_at = NOW()
  WHERE created_at >= v_start_time
    AND execution_time_ms IS NULL;
  
  SELECT 
    COUNT(*),
    COALESCE(AVG(priority_level), 0)
  INTO v_tasks_completed, v_avg_priority
  FROM public.fusion_orchestrator_events
  WHERE created_at >= NOW() - v_orchestration_window
    AND status = 'Completed';
  
  RETURN QUERY SELECT 
    v_tasks_created,
    v_tasks_completed,
    v_avg_priority,
    v_system_health;
  
  RAISE NOTICE 'Orchestration complete. Tasks created: %, Completed: %, Avg priority: %, Health: %',
    v_tasks_created, v_tasks_completed, v_avg_priority, v_system_health;
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
        'fusion-orchestrator-engine',
        '*/30 * * * *',
        'SELECT public.fusion_orchestrator_engine()'
      );
      RAISE NOTICE 'Successfully scheduled fusion orchestrator engine to run every 30 minutes via pg_cron';
    ELSE
      RAISE NOTICE 'pg_cron schema exists but schedule function not found. Please schedule manually.';
    END IF;
  ELSE
    RAISE NOTICE 'pg_cron not available. Please schedule manually via Supabase Dashboard or enable pg_cron extension.';
  END IF;
END$$;

COMMENT ON TABLE public.fusion_orchestrator_events IS 
  'Phase 39: Central orchestration events managing all AI subsystems';

COMMENT ON COLUMN public.fusion_orchestrator_events.trigger_source IS 
  'Subsystem that triggered the orchestration: Optimization, Calibration, Prediction, Oversight, System Monitor';

COMMENT ON COLUMN public.fusion_orchestrator_events.priority_level IS 
  'Priority: 1=Critical, 2=High, 3=Normal, 4=Low';

COMMENT ON COLUMN public.fusion_orchestrator_events.policy_profile IS 
  'Orchestration policy: Conservative (stability), Standard (balanced), Aggressive (proactive automation)';

COMMENT ON COLUMN public.fusion_orchestrator_events.system_state IS 
  'JSONB snapshot of subsystem metrics and system health at orchestration time';

COMMENT ON FUNCTION public.fusion_orchestrator_engine(TEXT, INTEGER) IS 
  'Phase 39: Central intelligence orchestrator managing and prioritizing all autonomous subsystems';
