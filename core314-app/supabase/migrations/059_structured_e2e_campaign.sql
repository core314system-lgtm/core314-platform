-- =====================================================
-- =====================================================

-- =====================================================
-- =====================================================

ALTER TABLE public.fusion_e2e_sessions 
ADD COLUMN IF NOT EXISTS test_mode TEXT DEFAULT 'functional' CHECK (test_mode IN ('functional','performance','resilience')),
ADD COLUMN IF NOT EXISTS simulation_cycles INTEGER DEFAULT 10,
ADD COLUMN IF NOT EXISTS errors_detected INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS avg_stability NUMERIC DEFAULT 0;

-- =====================================================
-- =====================================================

CREATE TABLE IF NOT EXISTS public.fusion_e2e_benchmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.fusion_e2e_sessions(id) ON DELETE CASCADE,
  phase_name TEXT NOT NULL,
  iteration INTEGER NOT NULL,
  confidence NUMERIC,
  latency_ms NUMERIC,
  stability NUMERIC,
  error_flag BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_e2e_benchmarks_session ON public.fusion_e2e_benchmarks(session_id);
CREATE INDEX IF NOT EXISTS idx_e2e_benchmarks_session_iter ON public.fusion_e2e_benchmarks(session_id, iteration);
CREATE INDEX IF NOT EXISTS idx_e2e_benchmarks_created ON public.fusion_e2e_benchmarks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_e2e_benchmarks_phase ON public.fusion_e2e_benchmarks(phase_name);

-- =====================================================
-- =====================================================

CREATE TABLE IF NOT EXISTS public.fusion_e2e_anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.fusion_e2e_sessions(id) ON DELETE CASCADE,
  iteration INTEGER NOT NULL,
  anomaly_type TEXT NOT NULL,
  impact TEXT,
  confidence_level NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_e2e_anomalies_session ON public.fusion_e2e_anomalies(session_id);
CREATE INDEX IF NOT EXISTS idx_e2e_anomalies_created ON public.fusion_e2e_anomalies(created_at DESC);

-- =====================================================
-- =====================================================

ALTER TABLE public.fusion_e2e_benchmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fusion_e2e_anomalies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins can view e2e benchmarks" ON public.fusion_e2e_benchmarks;
DROP POLICY IF EXISTS "Platform admins can insert e2e benchmarks" ON public.fusion_e2e_benchmarks;
DROP POLICY IF EXISTS "Platform admins can delete e2e benchmarks" ON public.fusion_e2e_benchmarks;
DROP POLICY IF EXISTS "Service role can manage e2e benchmarks" ON public.fusion_e2e_benchmarks;

DROP POLICY IF EXISTS "Platform admins can view e2e anomalies" ON public.fusion_e2e_anomalies;
DROP POLICY IF EXISTS "Platform admins can insert e2e anomalies" ON public.fusion_e2e_anomalies;
DROP POLICY IF EXISTS "Platform admins can delete e2e anomalies" ON public.fusion_e2e_anomalies;
DROP POLICY IF EXISTS "Service role can manage e2e anomalies" ON public.fusion_e2e_anomalies;

CREATE POLICY "Platform admins can view e2e benchmarks"
  ON public.fusion_e2e_benchmarks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.is_platform_admin = true OR profiles.role = 'platform_admin')
    )
  );

CREATE POLICY "Platform admins can insert e2e benchmarks"
  ON public.fusion_e2e_benchmarks FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.is_platform_admin = true OR profiles.role = 'platform_admin')
    )
  );

CREATE POLICY "Platform admins can delete e2e benchmarks"
  ON public.fusion_e2e_benchmarks FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.is_platform_admin = true OR profiles.role = 'platform_admin')
    )
  );

CREATE POLICY "Service role can manage e2e benchmarks"
  ON public.fusion_e2e_benchmarks FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Platform admins can view e2e anomalies"
  ON public.fusion_e2e_anomalies FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.is_platform_admin = true OR profiles.role = 'platform_admin')
    )
  );

CREATE POLICY "Platform admins can insert e2e anomalies"
  ON public.fusion_e2e_anomalies FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.is_platform_admin = true OR profiles.role = 'platform_admin')
    )
  );

CREATE POLICY "Platform admins can delete e2e anomalies"
  ON public.fusion_e2e_anomalies FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.is_platform_admin = true OR profiles.role = 'platform_admin')
    )
  );

CREATE POLICY "Service role can manage e2e anomalies"
  ON public.fusion_e2e_anomalies FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- =====================================================

CREATE OR REPLACE FUNCTION public.run_structured_e2e_campaign(
  p_test_mode TEXT DEFAULT 'functional',
  p_cycles INTEGER DEFAULT 10
)
RETURNS TABLE (
  session_id UUID,
  total_iterations INTEGER,
  avg_confidence NUMERIC,
  avg_latency NUMERIC,
  avg_stability NUMERIC,
  errors_detected INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_campaign_session UUID;
  v_i INTEGER;
  v_phase_session_id UUID;
  v_total_benchmarks INTEGER := 0;
  v_total_errors INTEGER := 0;
BEGIN
  INSERT INTO public.fusion_e2e_sessions (
    session_name, 
    test_mode, 
    simulation_cycles,
    phase_sequence,
    total_steps
  )
  VALUES (
    CONCAT('E2E ', INITCAP(p_test_mode), ' Run ', NOW()), 
    p_test_mode, 
    p_cycles,
    jsonb_build_array('simulation','governance','policy','neural','trust','explainability'),
    p_cycles * 6
  )
  RETURNING id INTO v_campaign_session;

  FOR v_i IN 1..p_cycles LOOP
    BEGIN
      SELECT r.session_id INTO v_phase_session_id
      FROM public.run_e2e_validation_cycle(CONCAT('Cycle ', v_i, ' of ', p_cycles)) r;
      
      WITH iter_results AS (
        SELECT 
          r.phase_name,
          r.confidence,
          r.latency_ms,
          r.status,
          AVG(r.confidence) OVER () AS avg_conf
        FROM public.fusion_e2e_results r
        WHERE r.session_id = v_phase_session_id
      )
      INSERT INTO public.fusion_e2e_benchmarks (
        session_id, 
        phase_name, 
        iteration, 
        confidence, 
        latency_ms, 
        stability, 
        error_flag
      )
      SELECT 
        v_campaign_session,
        i.phase_name,
        v_i,
        i.confidence,
        i.latency_ms,
        GREATEST(0, LEAST(1, 1 - ABS(COALESCE(i.confidence, 0) - COALESCE(i.avg_conf, 0)))),
        (i.status <> 'success')
      FROM iter_results i;
      
      v_total_benchmarks := v_total_benchmarks + 6;
      
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Cycle % failed: %', v_i, SQLERRM;
      v_total_errors := v_total_errors + 1;
    END;

    IF p_test_mode = 'resilience' AND (v_i % 3 = 0) THEN
      BEGIN
        INSERT INTO public.fusion_e2e_anomalies (
          session_id, 
          iteration, 
          anomaly_type, 
          impact, 
          confidence_level
        )
        VALUES (
          v_campaign_session,
          v_i,
          'test_anomaly',
          'low',
          0.3
        );
        
        BEGIN
          INSERT INTO public.fusion_audit_log (
            event_type,
            triggered_by,
            status,
            avg_ai_confidence
          )
          VALUES (
            'adaptive_trigger',
            'SEVC',
            'partial',
            0.3
          );
        EXCEPTION WHEN OTHERS THEN
          NULL;
        END;
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END IF;
  END LOOP;

  WITH agg AS (
    SELECT 
      COUNT(*) AS total_rows,
      AVG(confidence) AS avg_conf,
      AVG(latency_ms) AS avg_lat,
      AVG(stability) AS avg_stab,
      SUM(CASE WHEN error_flag THEN 1 ELSE 0 END)::INTEGER AS err_count
    FROM public.fusion_e2e_benchmarks
    WHERE session_id = v_campaign_session
  )
  UPDATE public.fusion_e2e_sessions
  SET 
    steps_completed = (SELECT total_rows FROM agg),
    avg_confidence = (SELECT avg_conf FROM agg),
    avg_latency_ms = (SELECT avg_lat FROM agg),
    avg_stability = (SELECT avg_stab FROM agg),
    errors_detected = (SELECT err_count FROM agg),
    success_rate = CASE 
      WHEN (SELECT total_rows FROM agg) > 0 
      THEN ((SELECT total_rows FROM agg) - (SELECT err_count FROM agg))::NUMERIC / (SELECT total_rows FROM agg) * 100 
      ELSE 0 
    END,
    completed_at = NOW()
  WHERE id = v_campaign_session;

  RETURN QUERY 
  SELECT 
    v_campaign_session,
    v_total_benchmarks,
    b.avg_confidence,
    b.avg_latency,
    b.avg_stability,
    b.errors_detected
  FROM (
    SELECT 
      AVG(confidence) AS avg_confidence,
      AVG(latency_ms) AS avg_latency,
      AVG(stability) AS avg_stability,
      SUM(CASE WHEN error_flag THEN 1 ELSE 0 END)::INTEGER AS errors_detected
    FROM public.fusion_e2e_benchmarks
    WHERE session_id = v_campaign_session
  ) b;
END;
$$;

GRANT EXECUTE ON FUNCTION public.run_structured_e2e_campaign(TEXT, INTEGER) TO service_role;

COMMENT ON FUNCTION public.run_structured_e2e_campaign(TEXT, INTEGER) IS 
  'Phase 49: Structured E2E Validation Campaign - Executes multi-cycle benchmarking with anomaly injection';

-- =====================================================
-- =====================================================

COMMENT ON TABLE public.fusion_e2e_benchmarks IS 
  'Phase 49: Individual iteration benchmarks for E2E validation campaigns';

COMMENT ON TABLE public.fusion_e2e_anomalies IS 
  'Phase 49: Injected anomalies for resilience testing in E2E campaigns';

COMMENT ON COLUMN public.fusion_e2e_sessions.test_mode IS 
  'Campaign test mode: functional, performance, or resilience';

COMMENT ON COLUMN public.fusion_e2e_sessions.simulation_cycles IS 
  'Number of validation cycles executed in this campaign';

COMMENT ON COLUMN public.fusion_e2e_sessions.avg_stability IS 
  'Average stability score across all benchmark iterations';

COMMENT ON COLUMN public.fusion_e2e_benchmarks.stability IS 
  'Stability score: 1 - |confidence - avg_confidence| clamped to [0,1]';

COMMENT ON COLUMN public.fusion_e2e_benchmarks.error_flag IS 
  'TRUE if this phase iteration failed (status != success)';

-- =====================================================
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Phase 49 Structured E2E Validation Campaign installed successfully';
  RAISE NOTICE 'Test with: SELECT * FROM public.run_structured_e2e_campaign(''functional'', 5);';
  RAISE NOTICE 'View benchmarks: SELECT * FROM public.fusion_e2e_benchmarks ORDER BY created_at DESC LIMIT 30;';
  RAISE NOTICE 'View anomalies: SELECT * FROM public.fusion_e2e_anomalies ORDER BY created_at DESC LIMIT 10;';
END $$;
