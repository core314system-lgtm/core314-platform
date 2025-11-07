-- =====================================================
-- =====================================================
-- =====================================================

-- =====================================================
-- =====================================================

CREATE TABLE IF NOT EXISTS public.fusion_adaptive_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_name TEXT NOT NULL,
  target_role TEXT NOT NULL CHECK (target_role IN ('end_user','operator','platform_admin')),
  target_function TEXT NOT NULL,
  condition_type TEXT CHECK (condition_type IN ('behavior_anomaly','load_spike','auth_failure','manual_override')),
  condition_threshold NUMERIC,
  action_type TEXT CHECK (action_type IN ('restrict','throttle','elevate','notify')),
  action_value TEXT,
  status TEXT DEFAULT 'Active' CHECK (status IN ('Active','Suspended','Expired')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id),
  notes TEXT
);

-- =====================================================
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_adaptive_policies_role_function 
  ON public.fusion_adaptive_policies(target_role, target_function);

CREATE INDEX IF NOT EXISTS idx_adaptive_policies_status 
  ON public.fusion_adaptive_policies(status);

CREATE INDEX IF NOT EXISTS idx_adaptive_policies_expires_at 
  ON public.fusion_adaptive_policies(expires_at) 
  WHERE status = 'Active';

CREATE INDEX IF NOT EXISTS idx_adaptive_policies_created_by 
  ON public.fusion_adaptive_policies(created_by);

-- =====================================================
-- =====================================================

ALTER TABLE public.fusion_adaptive_policies ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- =====================================================

CREATE POLICY "Platform admins can view adaptive policies"
  ON public.fusion_adaptive_policies FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_platform_admin = true
    )
  );

CREATE POLICY "Platform admins can create adaptive policies"
  ON public.fusion_adaptive_policies FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_platform_admin = true
    )
  );

CREATE POLICY "Platform admins can update adaptive policies"
  ON public.fusion_adaptive_policies FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_platform_admin = true
    )
  );

CREATE POLICY "Platform admins can delete adaptive policies"
  ON public.fusion_adaptive_policies FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_platform_admin = true
    )
  );

-- =====================================================
-- =====================================================

CREATE TABLE IF NOT EXISTS public.user_risk_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  risk_score NUMERIC NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
  auth_failures_count INTEGER DEFAULT 0,
  anomaly_count INTEGER DEFAULT 0,
  last_violation_at TIMESTAMPTZ,
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  UNIQUE(user_id, calculated_at)
);

CREATE INDEX IF NOT EXISTS idx_user_risk_scores_user_id 
  ON public.user_risk_scores(user_id);

CREATE INDEX IF NOT EXISTS idx_user_risk_scores_risk_score 
  ON public.user_risk_scores(risk_score DESC);

CREATE INDEX IF NOT EXISTS idx_user_risk_scores_calculated_at 
  ON public.user_risk_scores(calculated_at DESC);

ALTER TABLE public.user_risk_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can view user risk scores"
  ON public.user_risk_scores FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_platform_admin = true
    )
  );

CREATE POLICY "Service role can manage user risk scores"
  ON public.user_risk_scores FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- =====================================================

CREATE OR REPLACE FUNCTION public.fusion_adaptive_policy_engine()
RETURNS TABLE (
  analyzed_users INTEGER,
  policies_applied INTEGER,
  avg_risk_score NUMERIC
) AS $$
DECLARE
  v_analyzed_users INTEGER := 0;
  v_policies_applied INTEGER := 0;
  v_avg_risk_score NUMERIC := 0;
  v_user_record RECORD;
  v_risk_score NUMERIC;
  v_auth_failures INTEGER;
  v_anomaly_count INTEGER;
  v_last_violation TIMESTAMPTZ;
  v_policy_id UUID;
BEGIN
  UPDATE public.fusion_adaptive_policies
  SET status = 'Expired'
  WHERE status = 'Active'
    AND expires_at IS NOT NULL
    AND expires_at < NOW();

  FOR v_user_record IN
    SELECT DISTINCT 
      user_id,
      user_role
    FROM public.fusion_audit_log
    WHERE created_at >= NOW() - INTERVAL '24 hours'
      AND user_id IS NOT NULL
  LOOP
    v_analyzed_users := v_analyzed_users + 1;

    SELECT COUNT(*)
    INTO v_auth_failures
    FROM public.fusion_audit_log
    WHERE user_id = v_user_record.user_id
      AND created_at >= NOW() - INTERVAL '24 hours'
      AND decision_impact IN ('unauthorized_access_attempt', 'FORBIDDEN');

    SELECT COUNT(*)
    INTO v_anomaly_count
    FROM public.fusion_audit_log
    WHERE user_id = v_user_record.user_id
      AND created_at >= NOW() - INTERVAL '24 hours'
      AND anomaly_detected = true;

    SELECT MAX(created_at)
    INTO v_last_violation
    FROM public.fusion_audit_log
    WHERE user_id = v_user_record.user_id
      AND (anomaly_detected = true OR decision_impact IN ('unauthorized_access_attempt', 'FORBIDDEN'));

    v_risk_score := LEAST(100, (
      (v_auth_failures * 10) +  -- Each auth failure adds 10 points
      (v_anomaly_count * 15) +   -- Each anomaly adds 15 points
      CASE 
        WHEN v_last_violation >= NOW() - INTERVAL '1 hour' THEN 20  -- Recent violation adds 20
        WHEN v_last_violation >= NOW() - INTERVAL '6 hours' THEN 10 -- Older violation adds 10
        ELSE 0
      END
    ));

    INSERT INTO public.user_risk_scores (
      user_id,
      risk_score,
      auth_failures_count,
      anomaly_count,
      last_violation_at,
      calculated_at
    ) VALUES (
      v_user_record.user_id,
      v_risk_score,
      v_auth_failures,
      v_anomaly_count,
      v_last_violation,
      NOW()
    );

    
    IF v_risk_score >= 70 THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.fusion_adaptive_policies
        WHERE target_role = v_user_record.user_role
          AND condition_type = 'behavior_anomaly'
          AND action_type = 'restrict'
          AND status = 'Active'
          AND (expires_at IS NULL OR expires_at > NOW())
      ) THEN
        INSERT INTO public.fusion_adaptive_policies (
          policy_name,
          target_role,
          target_function,
          condition_type,
          condition_threshold,
          action_type,
          action_value,
          status,
          expires_at,
          notes
        ) VALUES (
          'Auto-Restrict High Risk User',
          v_user_record.user_role,
          '*',  -- All functions
          'behavior_anomaly',
          70,
          'restrict',
          v_user_record.user_id::TEXT,  -- Store user_id in action_value
          'Active',
          NOW() + INTERVAL '24 hours',
          format('Auto-generated: Risk score %s, Auth failures: %s, Anomalies: %s', 
                 v_risk_score, v_auth_failures, v_anomaly_count)
        )
        RETURNING id INTO v_policy_id;
        
        v_policies_applied := v_policies_applied + 1;

        INSERT INTO public.fusion_audit_log (
          user_id,
          user_role,
          action_type,
          decision_summary,
          system_context,
          triggered_by,
          confidence_level,
          decision_impact,
          anomaly_detected
        ) VALUES (
          v_user_record.user_id,
          v_user_record.user_role,
          'policy_adjustment',
          format('Adaptive policy applied: RESTRICT (risk score: %s)', v_risk_score),
          jsonb_build_object(
            'policy_id', v_policy_id,
            'risk_score', v_risk_score,
            'auth_failures', v_auth_failures,
            'anomaly_count', v_anomaly_count
          ),
          'adaptive-policy-engine',
          100,
          'HIGH',
          false
        );
      END IF;

    ELSIF v_risk_score >= 40 THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.fusion_adaptive_policies
        WHERE target_role = v_user_record.user_role
          AND condition_type = 'behavior_anomaly'
          AND action_type = 'throttle'
          AND status = 'Active'
          AND (expires_at IS NULL OR expires_at > NOW())
      ) THEN
        INSERT INTO public.fusion_adaptive_policies (
          policy_name,
          target_role,
          target_function,
          condition_type,
          condition_threshold,
          action_type,
          action_value,
          status,
          expires_at,
          notes
        ) VALUES (
          'Auto-Throttle Medium Risk User',
          v_user_record.user_role,
          '*',
          'behavior_anomaly',
          40,
          'throttle',
          v_user_record.user_id::TEXT,
          'Active',
          NOW() + INTERVAL '12 hours',
          format('Auto-generated: Risk score %s, Auth failures: %s, Anomalies: %s', 
                 v_risk_score, v_auth_failures, v_anomaly_count)
        )
        RETURNING id INTO v_policy_id;
        
        v_policies_applied := v_policies_applied + 1;

        INSERT INTO public.fusion_audit_log (
          user_id,
          user_role,
          action_type,
          decision_summary,
          system_context,
          triggered_by,
          confidence_level,
          decision_impact,
          anomaly_detected
        ) VALUES (
          v_user_record.user_id,
          v_user_record.user_role,
          'policy_adjustment',
          format('Adaptive policy applied: THROTTLE (risk score: %s)', v_risk_score),
          jsonb_build_object(
            'policy_id', v_policy_id,
            'risk_score', v_risk_score,
            'auth_failures', v_auth_failures,
            'anomaly_count', v_anomaly_count
          ),
          'adaptive-policy-engine',
          100,
          'MODERATE',
          false
        );
      END IF;

    ELSIF v_risk_score >= 20 THEN
      INSERT INTO public.fusion_audit_log (
        user_id,
        user_role,
        action_type,
        decision_summary,
        system_context,
        triggered_by,
        confidence_level,
        decision_impact,
        anomaly_detected
      ) VALUES (
        v_user_record.user_id,
        v_user_record.user_role,
        'policy_adjustment',
        format('Risk monitoring: NOTIFY (risk score: %s)', v_risk_score),
        jsonb_build_object(
          'risk_score', v_risk_score,
          'auth_failures', v_auth_failures,
          'anomaly_count', v_anomaly_count
        ),
        'adaptive-policy-engine',
        100,
        'LOW',
        false
      );
    END IF;
  END LOOP;

  SELECT COALESCE(AVG(risk_score), 0)
  INTO v_avg_risk_score
  FROM public.user_risk_scores
  WHERE calculated_at >= NOW() - INTERVAL '7 days';

  RETURN QUERY SELECT 
    v_analyzed_users,
    v_policies_applied,
    ROUND(v_avg_risk_score, 2);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.fusion_adaptive_policy_engine() TO service_role;

-- =====================================================
-- =====================================================

CREATE OR REPLACE FUNCTION public.check_adaptive_policy(
  p_user_id UUID,
  p_user_role TEXT,
  p_function_name TEXT
)
RETURNS TABLE (
  has_restriction BOOLEAN,
  policy_action TEXT,
  policy_id UUID,
  policy_notes TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    true AS has_restriction,
    fap.action_type AS policy_action,
    fap.id AS policy_id,
    fap.notes AS policy_notes
  FROM public.fusion_adaptive_policies fap
  WHERE fap.status = 'Active'
    AND (fap.expires_at IS NULL OR fap.expires_at > NOW())
    AND fap.target_role = p_user_role
    AND (fap.target_function = p_function_name OR fap.target_function = '*')
    AND (
      fap.action_value = p_user_id::TEXT  -- User-specific policy
      OR fap.action_value IS NULL         -- Role-wide policy
    )
  ORDER BY 
    CASE 
      WHEN fap.action_value = p_user_id::TEXT THEN 1  -- User-specific first
      ELSE 2
    END,
    fap.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::TEXT, NULL::UUID, NULL::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.check_adaptive_policy(UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.check_adaptive_policy(UUID, TEXT, TEXT) TO authenticated;

-- =====================================================
-- =====================================================

CREATE OR REPLACE VIEW public.adaptive_policy_dashboard AS
SELECT 
  fap.id,
  fap.policy_name,
  fap.target_role,
  fap.target_function,
  fap.condition_type,
  fap.condition_threshold,
  fap.action_type,
  fap.action_value,
  fap.status,
  fap.created_at,
  fap.expires_at,
  fap.notes,
  p.email AS created_by_email,
  CASE 
    WHEN fap.expires_at IS NULL THEN 'Permanent'
    WHEN fap.expires_at > NOW() THEN 'Active'
    ELSE 'Expired'
  END AS expiration_status,
  EXTRACT(EPOCH FROM (fap.expires_at - NOW())) / 3600 AS hours_until_expiry
FROM public.fusion_adaptive_policies fap
LEFT JOIN public.profiles p ON fap.created_by = p.id
ORDER BY fap.created_at DESC;

GRANT SELECT ON public.adaptive_policy_dashboard TO authenticated;

-- =====================================================
-- =====================================================


-- =====================================================
-- =====================================================

COMMENT ON TABLE public.fusion_adaptive_policies IS 
  'Phase 42: Stores adaptive access policies that dynamically adjust based on user behavior and system health';

COMMENT ON TABLE public.user_risk_scores IS 
  'Phase 42: Tracks calculated risk scores for users based on behavior patterns and violations';

COMMENT ON FUNCTION public.fusion_adaptive_policy_engine() IS 
  'Phase 42: AI-driven policy engine that analyzes user behavior and applies adaptive policies';

COMMENT ON FUNCTION public.check_adaptive_policy(UUID, TEXT, TEXT) IS 
  'Phase 42: Checks if a user has any active adaptive policies that would restrict their access';
