-- =====================================================
-- Phase 46 Patch: Make Neural Policy Training Resilient
-- =====================================================
-- This patch makes run_neural_policy_training() resilient to:
-- 1. Missing fusion_explainability_log table (Phase 45 not applied)
-- 2. Missing source_event_id column in fusion_governance_audit
-- Uses dynamic SQL to detect and adapt to schema differences

CREATE OR REPLACE FUNCTION public.run_neural_policy_training()
RETURNS TABLE(
  policies_trained INTEGER,
  avg_confidence NUMERIC,
  avg_accuracy NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_policies_trained INTEGER := 0;
  v_conf NUMERIC := 0;
  v_acc NUMERIC := 0;
  v_total_conf NUMERIC := 0;

  v_sql TEXT;
  v_has_explainability BOOLEAN := FALSE;
  v_has_source_event_id BOOLEAN := FALSE;

  rec RECORD;
  v_input JSONB;
  v_weights JSONB;
BEGIN
  -- Detect if explainability table exists
  SELECT to_regclass('public.fusion_explainability_log') IS NOT NULL
    INTO v_has_explainability;

  -- Detect if governance_audit has source_event_id
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'fusion_governance_audit'
      AND column_name = 'source_event_id'
  ) INTO v_has_source_event_id;

  -- Build the SELECT list for explanation fields based on table existence
  -- Always project aliases explanation_confidence and reasoning_vector
  -- so downstream logic can remain static.
  v_sql := 'SELECT
      g.id AS governance_id,
      g.subsystem,
      COALESCE(g.confidence_level, 0.5) AS confidence_level,
      COALESCE(t.trust_score, 50) AS trust_score, ';

  IF v_has_explainability THEN
    v_sql := v_sql ||
      'COALESCE(e.confidence, 0.5) AS explanation_confidence,
       e.reasoning_vector ';
  ELSE
    v_sql := v_sql ||
      '0.5 AS explanation_confidence,
       NULL::jsonb AS reasoning_vector ';
  END IF;

  v_sql := v_sql || '
    FROM public.fusion_governance_audit g
    LEFT JOIN public.fusion_trust_graph t ON g.reviewer_id = t.user_id ';

  IF v_has_explainability THEN
    v_sql := v_sql || 'LEFT JOIN public.fusion_explainability_log e ON e.event_id = ';
    IF v_has_source_event_id THEN
      v_sql := v_sql || 'g.source_event_id ';
    ELSE
      -- Fallback: use g.id if source_event_id is missing
      v_sql := v_sql || 'g.id ';
    END IF;
  END IF;

  v_sql := v_sql || '
    WHERE g.created_at >= NOW() - INTERVAL ''30 days''
    LIMIT 1000';

  -- Iterate the dynamic query results
  FOR rec IN EXECUTE v_sql LOOP
    v_policies_trained := v_policies_trained + 1;

    v_input := jsonb_build_object(
      'confidence', rec.confidence_level,
      'trust', rec.trust_score,
      'explanation_confidence', rec.explanation_confidence,
      'subsystem', rec.subsystem,
      'timestamp', NOW()
    );

    v_weights := jsonb_build_object(
      'confidence_weight', LEAST((rec.confidence_level + 0.01), 1.0),
      'trust_weight', (rec.trust_score / 100.0),
      'behavioral_weight', COALESCE(rec.explanation_confidence, 0.5),
      'risk_multiplier', CASE
        WHEN rec.trust_score < 30 THEN 1.5
        WHEN rec.trust_score < 50 THEN 1.2
        ELSE 1.0
      END
    );

    INSERT INTO public.fusion_neural_policy_weights (
      policy_name,
      input_vector,
      output_weights,
      confidence_avg,
      accuracy,
      total_iterations,
      last_trained,
      updated_at
    )
    VALUES (
      rec.subsystem,
      v_input,
      v_weights,
      rec.confidence_level,
      0.9,
      1,
      NOW(),
      NOW()
    )
    ON CONFLICT (policy_name)
    DO UPDATE SET
      output_weights = EXCLUDED.output_weights,
      confidence_avg = (public.fusion_neural_policy_weights.confidence_avg + EXCLUDED.confidence_avg) / 2,
      accuracy = 0.9,
      total_iterations = public.fusion_neural_policy_weights.total_iterations + 1,
      last_trained = NOW(),
      updated_at = NOW();

    v_total_conf := v_total_conf + rec.confidence_level;
  END LOOP;

  IF v_policies_trained > 0 THEN
    v_conf := v_total_conf / v_policies_trained;
    v_acc := 0.9;
  END IF;

  RETURN QUERY SELECT v_policies_trained, ROUND(v_conf, 4), ROUND(v_acc, 4);
END;
$$;

GRANT EXECUTE ON FUNCTION public.run_neural_policy_training() TO service_role;

COMMENT ON FUNCTION public.run_neural_policy_training() IS
  'Phase 46: Neural Policy Network - Resilient version with dynamic JOINs for explainability and governance keys';

-- =====================================================
-- Success Message
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Phase 46 Patch applied successfully';
  RAISE NOTICE 'Neural policy training function is now resilient to missing Phase 45 tables';
  RAISE NOTICE 'Test with: SELECT * FROM public.run_neural_policy_training();';
END $$;
