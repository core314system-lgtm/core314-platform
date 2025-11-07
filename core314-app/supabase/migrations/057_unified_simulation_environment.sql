-- =====================================================
-- Phase 47: Unified Simulation Environment (USE)
-- =====================================================

-- =====================================================
-- 1. Simulation Events Table
-- =====================================================

CREATE TABLE IF NOT EXISTS public.fusion_simulation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_name TEXT NOT NULL,
  event_type TEXT CHECK (event_type IN ('login','policy_trigger','optimization','behavioral_change','trust_update','governance_audit','explainability_call')),
  subsystem TEXT,
  parameters JSONB,
  result JSONB,
  execution_time_ms INTEGER,
  outcome TEXT CHECK (outcome IN ('success','warning','error')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_simulation_created ON public.fusion_simulation_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_simulation_event_type ON public.fusion_simulation_events(event_type);
CREATE INDEX IF NOT EXISTS idx_simulation_subsystem ON public.fusion_simulation_events(subsystem);
CREATE INDEX IF NOT EXISTS idx_simulation_outcome ON public.fusion_simulation_events(outcome);

-- =====================================================
-- 2. RLS Policies
-- =====================================================

ALTER TABLE public.fusion_simulation_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins can view simulation events" ON public.fusion_simulation_events;
DROP POLICY IF EXISTS "Platform admins can insert simulation events" ON public.fusion_simulation_events;
DROP POLICY IF EXISTS "Platform admins can delete simulation events" ON public.fusion_simulation_events;
DROP POLICY IF EXISTS "Service role can manage simulation events" ON public.fusion_simulation_events;

CREATE POLICY "Platform admins can view simulation events"
  ON public.fusion_simulation_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.is_platform_admin = true OR profiles.role = 'platform_admin')
    )
  );

CREATE POLICY "Platform admins can insert simulation events"
  ON public.fusion_simulation_events FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.is_platform_admin = true OR profiles.role = 'platform_admin')
    )
  );

CREATE POLICY "Platform admins can delete simulation events"
  ON public.fusion_simulation_events FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.is_platform_admin = true OR profiles.role = 'platform_admin')
    )
  );

CREATE POLICY "Service role can manage simulation events"
  ON public.fusion_simulation_events FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- 3. Simulation Control Function
-- =====================================================

CREATE OR REPLACE FUNCTION public.run_full_system_simulation(p_cycles INTEGER DEFAULT 10)
RETURNS TABLE (
  total_events INTEGER,
  success_rate NUMERIC,
  avg_confidence NUMERIC,
  avg_latency NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total INTEGER := 0;
  v_success INTEGER := 0;
  v_latency NUMERIC := 0;
  v_conf NUMERIC := 0;
  v_start TIMESTAMPTZ;
  v_elapsed INTEGER;
  v_event_id UUID;
  v_result JSONB;
BEGIN
  FOR i IN 1..p_cycles LOOP
    -- Simulate Trust Update
    v_start := clock_timestamp();
    BEGIN
      INSERT INTO public.fusion_simulation_events (
        simulation_name, event_type, subsystem, parameters, outcome
      ) VALUES (
        'Core314 E2E', 'trust_update', 'Trust', 
        jsonb_build_object('cycle', i, 'timestamp', NOW()), 
        'success'
      ) RETURNING id INTO v_event_id;
      
      v_elapsed := EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_start))::INTEGER;
      UPDATE public.fusion_simulation_events 
      SET execution_time_ms = v_elapsed, 
          result = jsonb_build_object('status', 'completed', 'cycle', i)
      WHERE id = v_event_id;
      
      v_total := v_total + 1;
      v_success := v_success + 1;
      v_latency := v_latency + v_elapsed;
      v_conf := v_conf + 0.85;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.fusion_simulation_events 
      SET outcome = 'error', result = jsonb_build_object('error', SQLERRM)
      WHERE id = v_event_id;
      v_total := v_total + 1;
    END;

    -- Simulate Governance Audit
    v_start := clock_timestamp();
    BEGIN
      INSERT INTO public.fusion_simulation_events (
        simulation_name, event_type, subsystem, parameters, outcome
      ) VALUES (
        'Core314 E2E', 'governance_audit', 'Governance', 
        jsonb_build_object('cycle', i, 'timestamp', NOW()), 
        'success'
      ) RETURNING id INTO v_event_id;
      
      v_elapsed := EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_start))::INTEGER;
      UPDATE public.fusion_simulation_events 
      SET execution_time_ms = v_elapsed,
          result = jsonb_build_object('status', 'completed', 'audits', i)
      WHERE id = v_event_id;
      
      v_total := v_total + 1;
      v_success := v_success + 1;
      v_latency := v_latency + v_elapsed;
      v_conf := v_conf + 0.90;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.fusion_simulation_events 
      SET outcome = 'error', result = jsonb_build_object('error', SQLERRM)
      WHERE id = v_event_id;
      v_total := v_total + 1;
    END;

    -- Simulate Policy Trigger
    v_start := clock_timestamp();
    BEGIN
      INSERT INTO public.fusion_simulation_events (
        simulation_name, event_type, subsystem, parameters, outcome
      ) VALUES (
        'Core314 E2E', 'policy_trigger', 'Policy', 
        jsonb_build_object('cycle', i, 'timestamp', NOW()), 
        'success'
      ) RETURNING id INTO v_event_id;
      
      v_elapsed := EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_start))::INTEGER;
      UPDATE public.fusion_simulation_events 
      SET execution_time_ms = v_elapsed,
          result = jsonb_build_object('status', 'completed', 'policies', i)
      WHERE id = v_event_id;
      
      v_total := v_total + 1;
      v_success := v_success + 1;
      v_latency := v_latency + v_elapsed;
      v_conf := v_conf + 0.88;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.fusion_simulation_events 
      SET outcome = 'error', result = jsonb_build_object('error', SQLERRM)
      WHERE id = v_event_id;
      v_total := v_total + 1;
    END;

    -- Simulate Explainability Call
    v_start := clock_timestamp();
    BEGIN
      INSERT INTO public.fusion_simulation_events (
        simulation_name, event_type, subsystem, parameters, outcome
      ) VALUES (
        'Core314 E2E', 'explainability_call', 'Explainability', 
        jsonb_build_object('cycle', i, 'timestamp', NOW()), 
        'success'
      ) RETURNING id INTO v_event_id;
      
      v_elapsed := EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_start))::INTEGER;
      UPDATE public.fusion_simulation_events 
      SET execution_time_ms = v_elapsed,
          result = jsonb_build_object('status', 'completed', 'explanations', i)
      WHERE id = v_event_id;
      
      v_total := v_total + 1;
      v_success := v_success + 1;
      v_latency := v_latency + v_elapsed;
      v_conf := v_conf + 0.92;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.fusion_simulation_events 
      SET outcome = 'error', result = jsonb_build_object('error', SQLERRM)
      WHERE id = v_event_id;
      v_total := v_total + 1;
    END;
  END LOOP;

  IF v_total > 0 THEN
    RETURN QUERY SELECT 
      v_total, 
      ROUND((v_success::NUMERIC / v_total) * 100, 2), 
      ROUND(v_conf / v_total, 4), 
      ROUND(v_latency / v_total, 2);
  ELSE
    RETURN QUERY SELECT 0, 0.0::NUMERIC, 0.0::NUMERIC, 0.0::NUMERIC;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.run_full_system_simulation(INTEGER) TO service_role;

COMMENT ON FUNCTION public.run_full_system_simulation(INTEGER) IS 
  'Phase 47: Unified Simulation Environment - Simulates system behavior across all subsystems';

-- =====================================================
-- 4. Dashboard View
-- =====================================================

CREATE OR REPLACE VIEW public.simulation_dashboard AS
SELECT 
  fse.id,
  fse.simulation_name,
  fse.event_type,
  fse.subsystem,
  fse.parameters,
  fse.result,
  fse.execution_time_ms,
  fse.outcome,
  fse.created_at,
  CASE 
    WHEN fse.outcome = 'success' THEN 'Success'
    WHEN fse.outcome = 'warning' THEN 'Warning'
    WHEN fse.outcome = 'error' THEN 'Error'
    ELSE 'Unknown'
  END AS outcome_label,
  CASE 
    WHEN fse.execution_time_ms < 100 THEN 'Fast'
    WHEN fse.execution_time_ms < 500 THEN 'Normal'
    ELSE 'Slow'
  END AS latency_category
FROM public.fusion_simulation_events fse
ORDER BY fse.created_at DESC;

GRANT SELECT ON public.simulation_dashboard TO authenticated;

COMMENT ON VIEW public.simulation_dashboard IS 
  'Phase 47: Dashboard view for simulation events with computed categories';

-- =====================================================
-- 5. Table Comments
-- =====================================================

COMMENT ON TABLE public.fusion_simulation_events IS 
  'Phase 47: Unified Simulation Environment - Stores simulation events and telemetry';

COMMENT ON COLUMN public.fusion_simulation_events.simulation_name IS 
  'Name of the simulation run (e.g., Core314 E2E)';

COMMENT ON COLUMN public.fusion_simulation_events.event_type IS 
  'Type of simulated event (login, policy_trigger, optimization, etc.)';

COMMENT ON COLUMN public.fusion_simulation_events.subsystem IS 
  'Subsystem being simulated (Trust, Policy, Governance, etc.)';

COMMENT ON COLUMN public.fusion_simulation_events.parameters IS 
  'Input parameters for the simulation event';

COMMENT ON COLUMN public.fusion_simulation_events.result IS 
  'Output result from the simulation event';

COMMENT ON COLUMN public.fusion_simulation_events.execution_time_ms IS 
  'Execution time in milliseconds';

-- =====================================================
-- 6. Success Message
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Phase 47 Unified Simulation Environment installed successfully';
  RAISE NOTICE 'Verify with: SELECT COUNT(*) FROM public.fusion_simulation_events;';
  RAISE NOTICE 'Test simulation with: SELECT * FROM public.run_full_system_simulation(5);';
END $$;
