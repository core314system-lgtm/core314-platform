-- =====================================================
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- =====================================================

ALTER TABLE public.fusion_audit_log 
  ADD COLUMN IF NOT EXISTS action_type TEXT;

ALTER TABLE public.fusion_audit_log 
  ADD COLUMN IF NOT EXISTS decision_summary TEXT;

ALTER TABLE public.fusion_audit_log 
  ADD COLUMN IF NOT EXISTS system_context JSONB;

ALTER TABLE public.fusion_audit_log 
  ADD COLUMN IF NOT EXISTS triggered_by TEXT;

ALTER TABLE public.fusion_audit_log 
  ADD COLUMN IF NOT EXISTS confidence_level INTEGER;

ALTER TABLE public.fusion_audit_log 
  ADD COLUMN IF NOT EXISTS decision_impact TEXT;

ALTER TABLE public.fusion_audit_log 
  ADD COLUMN IF NOT EXISTS anomaly_detected BOOLEAN DEFAULT FALSE;

-- =====================================================
-- =====================================================

CREATE TABLE IF NOT EXISTS public.fusion_trust_graph (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  trust_score NUMERIC DEFAULT 75 CHECK (trust_score BETWEEN 0 AND 100),
  risk_level TEXT GENERATED ALWAYS AS (
    CASE
      WHEN trust_score >= 85 THEN 'Low'
      WHEN trust_score BETWEEN 60 AND 84 THEN 'Moderate'
      ELSE 'High'
    END
  ) STORED,
  total_interactions INTEGER DEFAULT 0,
  last_anomaly TIMESTAMPTZ,
  last_policy_action TEXT,
  behavior_consistency NUMERIC DEFAULT 0 CHECK (behavior_consistency BETWEEN 0 AND 100),
  adaptive_flags INTEGER DEFAULT 0,
  connections JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- =====================================================
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_trustgraph_user 
  ON public.fusion_trust_graph(user_id);

CREATE INDEX IF NOT EXISTS idx_trustgraph_org 
  ON public.fusion_trust_graph(organization_id);

CREATE INDEX IF NOT EXISTS idx_trustgraph_risk 
  ON public.fusion_trust_graph(risk_level);

CREATE INDEX IF NOT EXISTS idx_trustgraph_trust_score 
  ON public.fusion_trust_graph(trust_score DESC);

CREATE INDEX IF NOT EXISTS idx_trustgraph_updated 
  ON public.fusion_trust_graph(updated_at DESC);

-- =====================================================
-- =====================================================

ALTER TABLE public.fusion_trust_graph ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "End users can view own trust record" ON public.fusion_trust_graph;
DROP POLICY IF EXISTS "Operators can view org trust metrics" ON public.fusion_trust_graph;
DROP POLICY IF EXISTS "Platform admins can view all trust records" ON public.fusion_trust_graph;
DROP POLICY IF EXISTS "Platform admins can update trust records" ON public.fusion_trust_graph;
DROP POLICY IF EXISTS "Platform admins can insert trust records" ON public.fusion_trust_graph;
DROP POLICY IF EXISTS "Service role can manage trust records" ON public.fusion_trust_graph;

CREATE POLICY "End users can view own trust record"
  ON public.fusion_trust_graph FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('end_user', 'user')
    )
  );

CREATE POLICY "Operators can view org trust metrics"
  ON public.fusion_trust_graph FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('operator', 'admin', 'manager')
      AND profiles.organization_id = fusion_trust_graph.organization_id
    )
  );

CREATE POLICY "Platform admins can view all trust records"
  ON public.fusion_trust_graph FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.is_platform_admin = true OR profiles.role = 'platform_admin')
    )
  );

CREATE POLICY "Platform admins can update trust records"
  ON public.fusion_trust_graph FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.is_platform_admin = true OR profiles.role = 'platform_admin')
    )
  );

CREATE POLICY "Platform admins can insert trust records"
  ON public.fusion_trust_graph FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.is_platform_admin = true OR profiles.role = 'platform_admin')
    )
  );

CREATE POLICY "Service role can manage trust records"
  ON public.fusion_trust_graph FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- =====================================================

CREATE OR REPLACE FUNCTION public.fusion_trust_scoring_engine()
RETURNS TABLE (
  avg_trust_score NUMERIC,
  users_updated INTEGER,
  high_risk_users INTEGER,
  low_risk_users INTEGER
) AS $$
DECLARE
  v_users_updated INTEGER := 0;
  v_high_risk_users INTEGER := 0;
  v_low_risk_users INTEGER := 0;
  v_avg_trust_score NUMERIC := 0;
  v_user_record RECORD;
  v_trust_score NUMERIC;
  v_behavior_consistency NUMERIC;
  v_adaptive_flags INTEGER;
  v_policy_compliance NUMERIC;
  v_org_reputation NUMERIC;
  v_total_interactions INTEGER;
  v_last_anomaly TIMESTAMPTZ;
  v_last_policy_action TEXT;
  v_connections JSONB;
BEGIN
  FOR v_user_record IN
    SELECT DISTINCT 
      p.id AS user_id,
      p.organization_id,
      p.role AS user_role  -- FIXED: Using p.role instead of p.user_role
    FROM public.profiles p
    WHERE EXISTS (
      SELECT 1 FROM public.fusion_audit_log
      WHERE user_id = p.id
      AND created_at >= NOW() - INTERVAL '30 days'
    )
  LOOP
    v_users_updated := v_users_updated + 1;

    SELECT 
      CASE 
        WHEN COUNT(*) = 0 THEN 0
        WHEN STDDEV(EXTRACT(EPOCH FROM created_at)) IS NULL THEN 100
        ELSE LEAST(100, 100 - (STDDEV(EXTRACT(EPOCH FROM created_at)) / 3600))
      END
    INTO v_behavior_consistency
    FROM public.fusion_audit_log
    WHERE user_id = v_user_record.user_id
      AND created_at >= NOW() - INTERVAL '30 days';

    SELECT COUNT(*)
    INTO v_adaptive_flags
    FROM public.fusion_adaptive_policies
    WHERE action_value = v_user_record.user_id::TEXT
      AND created_at >= NOW() - INTERVAL '30 days';

    WITH access_stats AS (
      SELECT 
        COUNT(*) FILTER (WHERE decision_impact NOT IN ('unauthorized_access_attempt', 'FORBIDDEN')) AS successful,
        COUNT(*) AS total
      FROM public.fusion_audit_log
      WHERE user_id = v_user_record.user_id
        AND created_at >= NOW() - INTERVAL '30 days'
    )
    SELECT 
      CASE 
        WHEN total = 0 THEN 75
        ELSE (successful::NUMERIC / total::NUMERIC) * 100
      END
    INTO v_policy_compliance
    FROM access_stats;

    IF v_user_record.organization_id IS NOT NULL THEN
      SELECT COALESCE(AVG(trust_score), 75)
      INTO v_org_reputation
      FROM public.fusion_trust_graph
      WHERE organization_id = v_user_record.organization_id
        AND user_id != v_user_record.user_id;
    ELSE
      v_org_reputation := 75;
    END IF;

    SELECT COUNT(*)
    INTO v_total_interactions
    FROM public.fusion_audit_log
    WHERE user_id = v_user_record.user_id
      AND created_at >= NOW() - INTERVAL '30 days';

    SELECT MAX(created_at)
    INTO v_last_anomaly
    FROM public.fusion_audit_log
    WHERE user_id = v_user_record.user_id
      AND anomaly_detected = true;

    SELECT action_type
    INTO v_last_policy_action
    FROM public.fusion_adaptive_policies
    WHERE action_value = v_user_record.user_id::TEXT
    ORDER BY created_at DESC
    LIMIT 1;

    v_trust_score := LEAST(100, GREATEST(0,
      (COALESCE(v_behavior_consistency, 0) * 0.4) +
      ((100 - LEAST(100, v_adaptive_flags * 10)) * 0.2) +
      (COALESCE(v_policy_compliance, 75) * 0.2) +
      (COALESCE(v_org_reputation, 75) * 0.2)
    ));

    SELECT jsonb_agg(DISTINCT jsonb_build_object(
      'target_user_id', connected_user_id,
      'connection_type', connection_type,
      'weight', weight
    ))
    INTO v_connections
    FROM (
      SELECT 
        p.id AS connected_user_id,
        'organization' AS connection_type,
        0.8 AS weight
      FROM public.profiles p
      WHERE p.organization_id = v_user_record.organization_id
        AND p.organization_id IS NOT NULL
        AND p.id != v_user_record.user_id
      LIMIT 5
      
      UNION ALL
      
      SELECT 
        ftg.user_id AS connected_user_id,
        'behavior_similarity' AS connection_type,
        0.6 AS weight
      FROM public.fusion_trust_graph ftg
      WHERE ftg.user_id != v_user_record.user_id
        AND ABS(ftg.behavior_consistency - COALESCE(v_behavior_consistency, 0)) < 20
      LIMIT 5
    ) connections;

    INSERT INTO public.fusion_trust_graph (
      user_id,
      organization_id,
      trust_score,
      total_interactions,
      last_anomaly,
      last_policy_action,
      behavior_consistency,
      adaptive_flags,
      connections,
      updated_at
    ) VALUES (
      v_user_record.user_id,
      v_user_record.organization_id,
      v_trust_score,
      v_total_interactions,
      v_last_anomaly,
      v_last_policy_action,
      v_behavior_consistency,
      v_adaptive_flags,
      COALESCE(v_connections, '[]'::jsonb),
      NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      trust_score = EXCLUDED.trust_score,
      total_interactions = EXCLUDED.total_interactions,
      last_anomaly = EXCLUDED.last_anomaly,
      last_policy_action = EXCLUDED.last_policy_action,
      behavior_consistency = EXCLUDED.behavior_consistency,
      adaptive_flags = EXCLUDED.adaptive_flags,
      connections = EXCLUDED.connections,
      updated_at = NOW();

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
      'trust_update',
      format('Trust score updated to %s (risk level: %s)', 
             ROUND(v_trust_score, 2),
             CASE 
               WHEN v_trust_score >= 85 THEN 'Low'
               WHEN v_trust_score BETWEEN 60 AND 84 THEN 'Moderate'
               ELSE 'High'
             END),
      jsonb_build_object(
        'trust_score', v_trust_score,
        'behavior_consistency', v_behavior_consistency,
        'adaptive_flags', v_adaptive_flags,
        'policy_compliance', v_policy_compliance,
        'org_reputation', v_org_reputation,
        'total_interactions', v_total_interactions
      ),
      'trust-graph-engine',
      100,
      CASE 
        WHEN v_trust_score < 50 THEN 'HIGH'
        WHEN v_trust_score < 75 THEN 'MODERATE'
        ELSE 'LOW'
      END,
      false
    );

    IF v_trust_score < 60 THEN
      v_high_risk_users := v_high_risk_users + 1;
    ELSIF v_trust_score >= 85 THEN
      v_low_risk_users := v_low_risk_users + 1;
    END IF;
  END LOOP;

  SELECT COALESCE(AVG(trust_score), 0)
  INTO v_avg_trust_score
  FROM public.fusion_trust_graph;

  RETURN QUERY SELECT 
    ROUND(v_avg_trust_score, 2),
    v_users_updated,
    v_high_risk_users,
    v_low_risk_users;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.fusion_trust_scoring_engine() TO service_role;

COMMENT ON FUNCTION public.fusion_trust_scoring_engine() IS 
  'Phase 43: Analyzes user behavior over 30 days and calculates trust scores with graph connections';

-- =====================================================
-- =====================================================

CREATE OR REPLACE VIEW public.trust_graph_dashboard AS
SELECT 
  ftg.id,
  ftg.user_id,
  p.email AS user_email,
  p.role AS user_role,  -- FIXED: Using p.role instead of p.user_role
  ftg.organization_id,
  o.name AS organization_name,
  ftg.trust_score,
  ftg.risk_level,
  ftg.total_interactions,
  ftg.last_anomaly,
  ftg.last_policy_action,
  ftg.behavior_consistency,
  ftg.adaptive_flags,
  ftg.connections,
  ftg.updated_at,
  CASE 
    WHEN ftg.last_anomaly >= NOW() - INTERVAL '24 hours' THEN 'Recent'
    WHEN ftg.last_anomaly >= NOW() - INTERVAL '7 days' THEN 'This Week'
    WHEN ftg.last_anomaly IS NOT NULL THEN 'Older'
    ELSE 'None'
  END AS anomaly_recency
FROM public.fusion_trust_graph ftg
LEFT JOIN public.profiles p ON ftg.user_id = p.id
LEFT JOIN public.organizations o ON ftg.organization_id = o.id
ORDER BY ftg.trust_score ASC, ftg.updated_at DESC;

GRANT SELECT ON public.trust_graph_dashboard TO authenticated;

COMMENT ON VIEW public.trust_graph_dashboard IS 
  'Phase 43: Dashboard view for trust graph with user and organization details';

-- =====================================================
-- =====================================================

COMMENT ON TABLE public.fusion_trust_graph IS 
  'Phase 43: Dynamic trust graph tracking user behavior, policy history, and system interactions';

-- =====================================================
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Phase 43 Trust Graph System installed successfully';
  RAISE NOTICE 'Verify with: SELECT COUNT(*) FROM public.fusion_trust_graph;';
  RAISE NOTICE 'Test engine with: SELECT * FROM public.fusion_trust_scoring_engine();';
END $$;
