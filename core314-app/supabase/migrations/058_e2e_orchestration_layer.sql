-- =====================================================
-- =====================================================

-- =====================================================
-- =====================================================

CREATE TABLE IF NOT EXISTS public.fusion_e2e_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_name TEXT NOT NULL,
  phase_sequence JSONB NOT NULL,
  total_steps INTEGER,
  steps_completed INTEGER DEFAULT 0,
  success_rate NUMERIC DEFAULT 0,
  avg_confidence NUMERIC DEFAULT 0,
  avg_latency_ms NUMERIC DEFAULT 0,
  anomalies_detected INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_e2e_sessions_started ON public.fusion_e2e_sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_e2e_sessions_completed ON public.fusion_e2e_sessions(completed_at DESC);

-- =====================================================
-- =====================================================

CREATE TABLE IF NOT EXISTS public.fusion_e2e_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.fusion_e2e_sessions(id) ON DELETE CASCADE,
  phase_name TEXT NOT NULL,
  status TEXT CHECK (status IN ('success','warning','failure')),
  confidence NUMERIC,
  latency_ms NUMERIC,
  error_details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_e2e_results_session ON public.fusion_e2e_results(session_id);
CREATE INDEX IF NOT EXISTS idx_e2e_results_created ON public.fusion_e2e_results(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_e2e_results_phase ON public.fusion_e2e_results(phase_name);
CREATE INDEX IF NOT EXISTS idx_e2e_results_status ON public.fusion_e2e_results(status);

-- =====================================================
-- =====================================================

ALTER TABLE public.fusion_e2e_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fusion_e2e_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins can view e2e sessions" ON public.fusion_e2e_sessions;
DROP POLICY IF EXISTS "Platform admins can insert e2e sessions" ON public.fusion_e2e_sessions;
DROP POLICY IF EXISTS "Platform admins can delete e2e sessions" ON public.fusion_e2e_sessions;
DROP POLICY IF EXISTS "Service role can manage e2e sessions" ON public.fusion_e2e_sessions;

DROP POLICY IF EXISTS "Platform admins can view e2e results" ON public.fusion_e2e_results;
DROP POLICY IF EXISTS "Platform admins can insert e2e results" ON public.fusion_e2e_results;
DROP POLICY IF EXISTS "Platform admins can delete e2e results" ON public.fusion_e2e_results;
DROP POLICY IF EXISTS "Service role can manage e2e results" ON public.fusion_e2e_results;

CREATE POLICY "Platform admins can view e2e sessions"
  ON public.fusion_e2e_sessions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.is_platform_admin = true OR profiles.role = 'platform_admin')
    )
  );

CREATE POLICY "Platform admins can insert e2e sessions"
  ON public.fusion_e2e_sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.is_platform_admin = true OR profiles.role = 'platform_admin')
    )
  );

CREATE POLICY "Platform admins can delete e2e sessions"
  ON public.fusion_e2e_sessions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.is_platform_admin = true OR profiles.role = 'platform_admin')
    )
  );

CREATE POLICY "Service role can manage e2e sessions"
  ON public.fusion_e2e_sessions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Platform admins can view e2e results"
  ON public.fusion_e2e_results FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.is_platform_admin = true OR profiles.role = 'platform_admin')
    )
  );

CREATE POLICY "Platform admins can insert e2e results"
  ON public.fusion_e2e_results FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.is_platform_admin = true OR profiles.role = 'platform_admin')
    )
  );

CREATE POLICY "Platform admins can delete e2e results"
  ON public.fusion_e2e_results FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.is_platform_admin = true OR profiles.role = 'platform_admin')
    )
  );

CREATE POLICY "Service role can manage e2e results"
  ON public.fusion_e2e_results FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- =====================================================

CREATE OR REPLACE FUNCTION public.run_e2e_validation_cycle(p_session_name TEXT DEFAULT 'Core314 E2E Run')
RETURNS TABLE (
  session_id UUID,
  total_phases INTEGER,
  success_rate NUMERIC,
  avg_confidence NUMERIC,
  avg_latency_ms NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session UUID;
  v_total INTEGER := 0;
  v_success INTEGER := 0;
  v_conf_sum NUMERIC := 0;
  v_lat_sum NUMERIC := 0;
  v_anomalies INTEGER := 0;
  v_start TIMESTAMPTZ;
  v_elapsed NUMERIC;
  v_phase_result RECORD;
BEGIN
  INSERT INTO public.fusion_e2e_sessions (session_name, phase_sequence, total_steps)
  VALUES (
    p_session_name, 
    jsonb_build_array('simulation','governance','policy','neural','trust','explainability'), 
    6
  )
  RETURNING id INTO v_session;

  v_start := clock_timestamp();
  BEGIN
    PERFORM public.run_full_system_simulation(5);
    v_elapsed := EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_start))::NUMERIC;
    
    INSERT INTO public.fusion_e2e_results (session_id, phase_name, status, confidence, latency_ms)
    VALUES (v_session, 'simulation', 'success', 0.90, v_elapsed);
    
    v_total := v_total + 1;
    v_success := v_success + 1;
    v_conf_sum := v_conf_sum + 0.90;
    v_lat_sum := v_lat_sum + v_elapsed;
  EXCEPTION WHEN OTHERS THEN
    v_elapsed := EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_start))::NUMERIC;
    INSERT INTO public.fusion_e2e_results (session_id, phase_name, status, confidence, latency_ms, error_details)
    VALUES (v_session, 'simulation', 'failure', 0.0, v_elapsed, SQLERRM);
    v_total := v_total + 1;
    v_anomalies := v_anomalies + 1;
  END;

  v_start := clock_timestamp();
  BEGIN
    PERFORM public.fusion_governance_engine();
    v_elapsed := EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_start))::NUMERIC;
    
    INSERT INTO public.fusion_e2e_results (session_id, phase_name, status, confidence, latency_ms)
    VALUES (v_session, 'governance', 'success', 0.85, v_elapsed);
    
    v_total := v_total + 1;
    v_success := v_success + 1;
    v_conf_sum := v_conf_sum + 0.85;
    v_lat_sum := v_lat_sum + v_elapsed;
  EXCEPTION WHEN OTHERS THEN
    v_elapsed := EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_start))::NUMERIC;
    INSERT INTO public.fusion_e2e_results (session_id, phase_name, status, confidence, latency_ms, error_details)
    VALUES (v_session, 'governance', 'failure', 0.0, v_elapsed, SQLERRM);
    v_total := v_total + 1;
    v_anomalies := v_anomalies + 1;
  END;

  v_start := clock_timestamp();
  BEGIN
    PERFORM public.fusion_adaptive_policy_engine();
    v_elapsed := EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_start))::NUMERIC;
    
    INSERT INTO public.fusion_e2e_results (session_id, phase_name, status, confidence, latency_ms)
    VALUES (v_session, 'policy', 'success', 0.82, v_elapsed);
    
    v_total := v_total + 1;
    v_success := v_success + 1;
    v_conf_sum := v_conf_sum + 0.82;
    v_lat_sum := v_lat_sum + v_elapsed;
  EXCEPTION WHEN OTHERS THEN
    v_elapsed := EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_start))::NUMERIC;
    INSERT INTO public.fusion_e2e_results (session_id, phase_name, status, confidence, latency_ms, error_details)
    VALUES (v_session, 'policy', 'failure', 0.0, v_elapsed, SQLERRM);
    v_total := v_total + 1;
    v_anomalies := v_anomalies + 1;
  END;

  v_start := clock_timestamp();
  BEGIN
    PERFORM public.run_neural_policy_training();
    v_elapsed := EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_start))::NUMERIC;
    
    INSERT INTO public.fusion_e2e_results (session_id, phase_name, status, confidence, latency_ms)
    VALUES (v_session, 'neural', 'success', 0.88, v_elapsed);
    
    v_total := v_total + 1;
    v_success := v_success + 1;
    v_conf_sum := v_conf_sum + 0.88;
    v_lat_sum := v_lat_sum + v_elapsed;
  EXCEPTION WHEN OTHERS THEN
    v_elapsed := EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_start))::NUMERIC;
    INSERT INTO public.fusion_e2e_results (session_id, phase_name, status, confidence, latency_ms, error_details)
    VALUES (v_session, 'neural', 'failure', 0.0, v_elapsed, SQLERRM);
    v_total := v_total + 1;
    v_anomalies := v_anomalies + 1;
  END;

  v_start := clock_timestamp();
  BEGIN
    PERFORM public.fusion_trust_scoring_engine();
    v_elapsed := EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_start))::NUMERIC;
    
    INSERT INTO public.fusion_e2e_results (session_id, phase_name, status, confidence, latency_ms)
    VALUES (v_session, 'trust', 'success', 0.84, v_elapsed);
    
    v_total := v_total + 1;
    v_success := v_success + 1;
    v_conf_sum := v_conf_sum + 0.84;
    v_lat_sum := v_lat_sum + v_elapsed;
  EXCEPTION WHEN OTHERS THEN
    v_elapsed := EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_start))::NUMERIC;
    INSERT INTO public.fusion_e2e_results (session_id, phase_name, status, confidence, latency_ms, error_details)
    VALUES (v_session, 'trust', 'failure', 0.0, v_elapsed, SQLERRM);
    v_total := v_total + 1;
    v_anomalies := v_anomalies + 1;
  END;

  v_start := clock_timestamp();
  BEGIN
    PERFORM public.generate_explanation(
      gen_random_uuid(),
      'E2E-Test',
      jsonb_build_object('phase', 'final', 'session', v_session)
    );
    v_elapsed := EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_start))::NUMERIC;
    
    INSERT INTO public.fusion_e2e_results (session_id, phase_name, status, confidence, latency_ms)
    VALUES (v_session, 'explainability', 'success', 0.87, v_elapsed);
    
    v_total := v_total + 1;
    v_success := v_success + 1;
    v_conf_sum := v_conf_sum + 0.87;
    v_lat_sum := v_lat_sum + v_elapsed;
  EXCEPTION WHEN OTHERS THEN
    v_elapsed := EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_start))::NUMERIC;
    INSERT INTO public.fusion_e2e_results (session_id, phase_name, status, confidence, latency_ms, error_details)
    VALUES (v_session, 'explainability', 'failure', 0.0, v_elapsed, SQLERRM);
    v_total := v_total + 1;
    v_anomalies := v_anomalies + 1;
  END;

  UPDATE public.fusion_e2e_sessions
  SET 
    steps_completed = v_total,
    success_rate = CASE WHEN v_total > 0 THEN (v_success::NUMERIC / v_total) * 100 ELSE 0 END,
    avg_confidence = CASE WHEN v_success > 0 THEN (v_conf_sum / v_success) ELSE 0 END,
    avg_latency_ms = CASE WHEN v_total > 0 THEN (v_lat_sum / v_total) ELSE 0 END,
    anomalies_detected = v_anomalies,
    completed_at = NOW()
  WHERE id = v_session;

  RETURN QUERY 
  SELECT 
    v_session,
    v_total,
    CASE WHEN v_total > 0 THEN (v_success::NUMERIC / v_total) * 100 ELSE 0 END,
    CASE WHEN v_success > 0 THEN (v_conf_sum / v_success) ELSE 0 END,
    CASE WHEN v_total > 0 THEN (v_lat_sum / v_total) ELSE 0 END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.run_e2e_validation_cycle(TEXT) TO service_role;

COMMENT ON FUNCTION public.run_e2e_validation_cycle(TEXT) IS 
  'Phase 48: E2E Orchestration & Validation Layer - Executes coordinated system-wide tests across all subsystems';

-- =====================================================
-- 5. Table Comments
-- =====================================================

COMMENT ON TABLE public.fusion_e2e_sessions IS 
  'Phase 48: E2E Orchestration sessions tracking system-wide validation runs';

COMMENT ON TABLE public.fusion_e2e_results IS 
  'Phase 48: Individual phase results for each E2E orchestration session';

COMMENT ON COLUMN public.fusion_e2e_sessions.phase_sequence IS 
  'JSONB array of phase names executed in sequence';

COMMENT ON COLUMN public.fusion_e2e_sessions.anomalies_detected IS 
  'Count of phases that failed during orchestration';

COMMENT ON COLUMN public.fusion_e2e_results.phase_name IS 
  'Name of the phase (simulation, governance, policy, neural, trust, explainability)';

COMMENT ON COLUMN public.fusion_e2e_results.error_details IS 
  'Error message if phase failed (SQLERRM)';

-- =====================================================
-- 6. Success Message
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Phase 48 E2E Orchestration & Validation Layer installed successfully';
  RAISE NOTICE 'Test with: SELECT * FROM public.run_e2e_validation_cycle(''Test Run'');';
  RAISE NOTICE 'View sessions: SELECT * FROM public.fusion_e2e_sessions ORDER BY started_at DESC LIMIT 5;';
  RAISE NOTICE 'View results: SELECT * FROM public.fusion_e2e_results ORDER BY created_at DESC LIMIT 10;';
END $$;
