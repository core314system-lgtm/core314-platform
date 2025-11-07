-- =====================================================
-- =====================================================

-- =====================================================
-- =====================================================

CREATE TABLE IF NOT EXISTS public.fusion_governance_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_event_id UUID,
  subsystem TEXT CHECK (subsystem IN ('Optimization', 'Behavioral', 'Prediction', 'Calibration', 'Oversight', 'Orchestration', 'Policy', 'Trust')),
  governance_action TEXT NOT NULL,
  justification TEXT,
  confidence_level NUMERIC DEFAULT 0 CHECK (confidence_level BETWEEN 0 AND 1),
  policy_reference TEXT,
  outcome TEXT CHECK (outcome IN ('Approved', 'Denied', 'Escalated', 'Deferred')),
  audit_severity TEXT CHECK (audit_severity IN ('Info', 'Warning', 'Critical')),
  reviewer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  explanation_context JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_governance_created_at 
  ON public.fusion_governance_audit(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_governance_subsystem 
  ON public.fusion_governance_audit(subsystem);

CREATE INDEX IF NOT EXISTS idx_governance_outcome 
  ON public.fusion_governance_audit(outcome);

CREATE INDEX IF NOT EXISTS idx_governance_severity 
  ON public.fusion_governance_audit(audit_severity);

CREATE INDEX IF NOT EXISTS idx_governance_source_event 
  ON public.fusion_governance_audit(source_event_id);

-- =====================================================
-- =====================================================

ALTER TABLE public.fusion_governance_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins can view all governance audits" ON public.fusion_governance_audit;
DROP POLICY IF EXISTS "Platform admins can insert governance audits" ON public.fusion_governance_audit;
DROP POLICY IF EXISTS "Platform admins can update governance audits" ON public.fusion_governance_audit;
DROP POLICY IF EXISTS "Operators can view governance audits" ON public.fusion_governance_audit;
DROP POLICY IF EXISTS "Service role can manage governance audits" ON public.fusion_governance_audit;

CREATE POLICY "Platform admins can view all governance audits"
  ON public.fusion_governance_audit FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.is_platform_admin = true OR profiles.role = 'platform_admin')
    )
  );

CREATE POLICY "Platform admins can insert governance audits"
  ON public.fusion_governance_audit FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.is_platform_admin = true OR profiles.role = 'platform_admin')
    )
  );

CREATE POLICY "Platform admins can update governance audits"
  ON public.fusion_governance_audit FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.is_platform_admin = true OR profiles.role = 'platform_admin')
    )
  );

CREATE POLICY "Operators can view governance audits"
  ON public.fusion_governance_audit FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('operator', 'admin', 'manager')
    )
  );

CREATE POLICY "Service role can manage governance audits"
  ON public.fusion_governance_audit FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- =====================================================

CREATE OR REPLACE FUNCTION public.fusion_governance_engine()
RETURNS TABLE (
  audits_run INTEGER,
  anomalies_detected INTEGER,
  average_confidence NUMERIC,
  policy_violations INTEGER
) AS $$
DECLARE
  v_audits_run INTEGER := 0;
  v_anomalies INTEGER := 0;
  v_confidence NUMERIC := 0;
  v_policy_violations INTEGER := 0;
  r RECORD;
  v_metric NUMERIC;
  v_subsystem TEXT;
  v_event_id UUID;
BEGIN
  FOR r IN
    SELECT 
      user_id AS id,
      'Trust' AS subsystem,
      trust_score AS metric
    FROM public.fusion_trust_graph
    WHERE updated_at >= NOW() - INTERVAL '2 days'
  LOOP
    v_audits_run := v_audits_run + 1;
    v_event_id := r.id;
    v_subsystem := r.subsystem;
    v_metric := r.metric;

    IF v_metric IS NULL OR v_metric < 50 THEN
      v_anomalies := v_anomalies + 1;
      INSERT INTO public.fusion_governance_audit (
        source_event_id,
        subsystem,
        governance_action,
        justification,
        confidence_level,
        outcome,
        audit_severity,
        explanation_context
      ) VALUES (
        v_event_id,
        v_subsystem,
        'Review Triggered',
        format('Trust score %s below threshold (50)', COALESCE(v_metric::TEXT, 'NULL')),
        0.75,
        'Escalated',
        'Warning',
        jsonb_build_object(
          'metric_value', v_metric,
          'threshold', 50,
          'reason', 'low_trust_score'
        )
      );
    ELSE
      INSERT INTO public.fusion_governance_audit (
        source_event_id,
        subsystem,
        governance_action,
        justification,
        confidence_level,
        outcome,
        audit_severity,
        explanation_context
      ) VALUES (
        v_event_id,
        v_subsystem,
        'Approved',
        format('Trust score %s within acceptable range', v_metric),
        0.92,
        'Approved',
        'Info',
        jsonb_build_object(
          'metric_value', v_metric,
          'threshold', 50,
          'reason', 'acceptable_trust_score'
        )
      );
    END IF;
  END LOOP;

  FOR r IN
    SELECT 
      id,
      'Policy' AS subsystem,
      CASE 
        WHEN action_type = 'restrict' THEN 30
        WHEN action_type = 'elevate' THEN 90
        ELSE 75
      END AS metric
    FROM public.fusion_adaptive_policies
    WHERE created_at >= NOW() - INTERVAL '2 days'
  LOOP
    v_audits_run := v_audits_run + 1;
    v_event_id := r.id;
    v_subsystem := r.subsystem;
    v_metric := r.metric;

    IF v_metric < 50 THEN
      v_anomalies := v_anomalies + 1;
      INSERT INTO public.fusion_governance_audit (
        source_event_id,
        subsystem,
        governance_action,
        justification,
        confidence_level,
        outcome,
        audit_severity,
        explanation_context
      ) VALUES (
        v_event_id,
        v_subsystem,
        'Policy Review Required',
        'Restrictive policy detected',
        0.80,
        'Escalated',
        'Warning',
        jsonb_build_object(
          'metric_value', v_metric,
          'threshold', 50,
          'reason', 'restrictive_policy'
        )
      );
    ELSE
      INSERT INTO public.fusion_governance_audit (
        source_event_id,
        subsystem,
        governance_action,
        justification,
        confidence_level,
        outcome,
        audit_severity,
        explanation_context
      ) VALUES (
        v_event_id,
        v_subsystem,
        'Policy Approved',
        'Policy within acceptable parameters',
        0.88,
        'Approved',
        'Info',
        jsonb_build_object(
          'metric_value', v_metric,
          'threshold', 50,
          'reason', 'acceptable_policy'
        )
      );
    END IF;
  END LOOP;

  SELECT COALESCE(AVG(confidence_level), 0)
  INTO v_confidence
  FROM public.fusion_governance_audit
  WHERE created_at >= NOW() - INTERVAL '2 days';

  SELECT COUNT(*)
  INTO v_policy_violations
  FROM public.fusion_adaptive_policies
  WHERE enforced = TRUE 
    AND expires_at IS NOT NULL 
    AND expires_at < NOW();

  RETURN QUERY SELECT 
    v_audits_run,
    v_anomalies,
    ROUND(v_confidence, 4),
    v_policy_violations;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.fusion_governance_engine() TO service_role;

COMMENT ON FUNCTION public.fusion_governance_engine() IS 
  'Phase 44: Analyzes subsystem events and generates governance audit records with explainable decisions';

-- =====================================================
-- =====================================================

CREATE OR REPLACE VIEW public.governance_dashboard AS
SELECT 
  fga.id,
  fga.source_event_id,
  fga.subsystem,
  fga.governance_action,
  fga.justification,
  fga.confidence_level,
  fga.policy_reference,
  fga.outcome,
  fga.audit_severity,
  fga.reviewer_id,
  p.email AS reviewer_email,
  fga.explanation_context,
  fga.created_at,
  CASE 
    WHEN fga.created_at >= NOW() - INTERVAL '1 hour' THEN 'Recent'
    WHEN fga.created_at >= NOW() - INTERVAL '24 hours' THEN 'Today'
    WHEN fga.created_at >= NOW() - INTERVAL '7 days' THEN 'This Week'
    ELSE 'Older'
  END AS recency
FROM public.fusion_governance_audit fga
LEFT JOIN public.profiles p ON fga.reviewer_id = p.id
ORDER BY fga.created_at DESC;

GRANT SELECT ON public.governance_dashboard TO authenticated;

COMMENT ON VIEW public.governance_dashboard IS 
  'Phase 44: Dashboard view for governance audits with reviewer details and recency classification';

-- =====================================================
-- =====================================================

COMMENT ON TABLE public.fusion_governance_audit IS 
  'Phase 44: Unified governance layer tracking AI-driven decisions, compliance audits, and autonomous parameter tuning';

-- =====================================================
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Phase 44 Governance Framework installed successfully';
  RAISE NOTICE 'Verify with: SELECT COUNT(*) FROM public.fusion_governance_audit;';
  RAISE NOTICE 'Test engine with: SELECT * FROM public.fusion_governance_engine();';
END $$;
