-- Phase 45: Explainable Decision Layer (EDL)

ALTER TABLE public.fusion_governance_audit
ADD COLUMN IF NOT EXISTS explanation_text TEXT,
ADD COLUMN IF NOT EXISTS reasoning_vector JSONB;

CREATE TABLE IF NOT EXISTS public.fusion_explainability_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID,
  subsystem TEXT CHECK (subsystem IN ('Optimization', 'Behavioral', 'Prediction', 'Calibration', 'Oversight', 'Orchestration', 'Policy', 'Trust', 'Governance')),
  explanation_text TEXT NOT NULL,
  reasoning_vector JSONB DEFAULT '{}'::jsonb,
  confidence NUMERIC DEFAULT 0.0 CHECK (confidence BETWEEN 0 AND 1),
  generated_by TEXT DEFAULT 'system',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_explainability_created_at ON public.fusion_explainability_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_explainability_subsystem ON public.fusion_explainability_log(subsystem);
CREATE INDEX IF NOT EXISTS idx_explainability_event_id ON public.fusion_explainability_log(event_id);
CREATE INDEX IF NOT EXISTS idx_explainability_confidence ON public.fusion_explainability_log(confidence DESC);

ALTER TABLE public.fusion_explainability_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins can view explainability logs" ON public.fusion_explainability_log;
DROP POLICY IF EXISTS "Operators can view explainability logs" ON public.fusion_explainability_log;
DROP POLICY IF EXISTS "Service role can manage explainability logs" ON public.fusion_explainability_log;

CREATE POLICY "Platform admins can view explainability logs"
  ON public.fusion_explainability_log FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND (profiles.is_platform_admin = true OR profiles.role = 'platform_admin')));

CREATE POLICY "Operators can view explainability logs"
  ON public.fusion_explainability_log FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('operator', 'admin', 'manager')));

CREATE POLICY "Service role can manage explainability logs"
  ON public.fusion_explainability_log FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.generate_explanation(
  p_event_id UUID,
  p_subsystem TEXT,
  p_metrics JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reasoning JSONB;
  v_confidence NUMERIC := 0;
  v_text TEXT;
  v_trust_score NUMERIC;
  v_policy_action TEXT;
BEGIN
  v_trust_score := COALESCE((p_metrics->>'trust_score')::NUMERIC, NULL);
  v_policy_action := p_metrics->>'action_type';

  v_reasoning := jsonb_build_object(
    'metric_snapshot', p_metrics,
    'subsystem', p_subsystem,
    'timestamp', NOW(),
    'risk_indicators', COALESCE(p_metrics->'risk', '{}'::jsonb)
  );

  IF p_subsystem = 'Trust' THEN
    IF v_trust_score IS NULL THEN
      v_text := 'Trust score unavailable. User flagged for manual review.';
      v_confidence := 0.60;
      v_reasoning := v_reasoning || jsonb_build_object('decision_reason', 'missing_trust_data', 'risk_level', 'medium');
    ELSIF v_trust_score < 30 THEN
      v_text := format('Critical trust violation (score: %.2f/100). Immediate restriction recommended.', v_trust_score);
      v_confidence := 0.95;
      v_reasoning := v_reasoning || jsonb_build_object('decision_reason', 'critical_trust_violation', 'risk_level', 'critical');
    ELSIF v_trust_score < 50 THEN
      v_text := format('Low trust score (%.2f/100). User flagged for review.', v_trust_score);
      v_confidence := 0.75;
      v_reasoning := v_reasoning || jsonb_build_object('decision_reason', 'low_trust_score', 'risk_level', 'high');
    ELSE
      v_text := format('Trust score acceptable (%.2f/100). User approved.', v_trust_score);
      v_confidence := 0.92;
      v_reasoning := v_reasoning || jsonb_build_object('decision_reason', 'acceptable_trust', 'risk_level', 'low');
    END IF;
  ELSIF p_subsystem = 'Policy' THEN
    IF v_policy_action = 'restrict' THEN
      v_text := 'Restrictive policy detected. Access limited due to behavioral concerns.';
      v_confidence := 0.80;
      v_reasoning := v_reasoning || jsonb_build_object('decision_reason', 'restrictive_policy', 'risk_level', 'high');
    ELSE
      v_text := format('Standard policy applied (%s). No anomalies detected.', COALESCE(v_policy_action, 'default'));
      v_confidence := 0.88;
      v_reasoning := v_reasoning || jsonb_build_object('decision_reason', 'standard_policy', 'risk_level', 'low');
    END IF;
  ELSE
    v_text := format('No major anomalies in %s subsystem. Decision approved.', p_subsystem);
    v_confidence := 0.85;
    v_reasoning := v_reasoning || jsonb_build_object('decision_reason', 'standard_approval', 'risk_level', 'low');
  END IF;

  INSERT INTO public.fusion_explainability_log (event_id, subsystem, explanation_text, reasoning_vector, confidence)
  VALUES (p_event_id, p_subsystem, v_text, v_reasoning, v_confidence);

  RETURN jsonb_build_object('event_id', p_event_id, 'subsystem', p_subsystem, 'explanation', v_text, 'confidence', v_confidence, 'context', v_reasoning);
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_explanation(UUID, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.generate_explanation(UUID, TEXT, JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.request_ai_explanation(p_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN format('AI Explanation Placeholder: %s', p_text);
END;
$$;

CREATE OR REPLACE VIEW public.explainability_dashboard AS
SELECT 
  fel.id,
  fel.event_id,
  fel.subsystem,
  fel.explanation_text,
  fel.reasoning_vector,
  fel.confidence,
  fel.generated_by,
  fel.created_at,
  CASE WHEN fel.confidence >= 0.9 THEN 'High' WHEN fel.confidence >= 0.7 THEN 'Medium' ELSE 'Low' END AS confidence_category,
  CASE WHEN fel.reasoning_vector->>'risk_level' = 'critical' THEN 'Critical' WHEN fel.reasoning_vector->>'risk_level' = 'high' THEN 'High' ELSE 'Low' END AS risk_level
FROM public.fusion_explainability_log fel
ORDER BY fel.created_at DESC;

GRANT SELECT ON public.explainability_dashboard TO authenticated;

COMMENT ON TABLE public.fusion_explainability_log IS 'Phase 45: Explainable Decision Layer';
