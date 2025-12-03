-- ============================================================================
-- ============================================================================
-- 
--
--
-- ============================================================================

-- ============================================================================
-- ============================================================================

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read feature flags"
  ON public.feature_flags
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage feature flags"
  ON public.feature_flags
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.feature_flags IS 
  'Feature flags for tier-based access control. RLS enabled. FORCE RLS prevents bypass.';

-- ============================================================================
-- ============================================================================


ALTER TABLE public.feature_flags FORCE ROW LEVEL SECURITY;
ALTER TABLE public.metric_thresholds FORCE ROW LEVEL SECURITY;
ALTER TABLE public.alert_history FORCE ROW LEVEL SECURITY;
ALTER TABLE public.beta_monitoring_log FORCE ROW LEVEL SECURITY;
ALTER TABLE public.beta_users FORCE ROW LEVEL SECURITY;
ALTER TABLE public.beta_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.beta_feedback FORCE ROW LEVEL SECURITY;
ALTER TABLE public.beta_user_notes FORCE ROW LEVEL SECURITY;
-- ALTER TABLE public.beta_feature_usage FORCE ROW LEVEL SECURITY; -- Does not exist in production
ALTER TABLE public.fusion_neural_policy_weights FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fusion_explainability_log FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fusion_adaptive_policies FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fusion_trust_graph FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fusion_governance_audit FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fusion_simulation_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fusion_audit_log FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fusion_behavioral_metrics FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fusion_calibration_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fusion_feedback FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fusion_global_insights FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fusion_model_metrics FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fusion_narratives FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fusion_beta_audit FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fusion_e2e_anomalies FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fusion_e2e_benchmarks FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fusion_e2e_results FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fusion_e2e_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.telemetry_metrics FORCE ROW LEVEL SECURITY;
-- ALTER TABLE public.integration_credentials FORCE ROW LEVEL SECURITY; -- Does not exist in production
-- ALTER TABLE public.integration_sync_log FORCE ROW LEVEL SECURITY; -- Does not exist in production
ALTER TABLE public.ai_agents FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ai_tasks FORCE ROW LEVEL SECURITY;
ALTER TABLE public.automation_rules FORCE ROW LEVEL SECURITY;
ALTER TABLE public.automation_logs FORCE ROW LEVEL SECURITY;
-- ALTER TABLE public.alerts FORCE ROW LEVEL SECURITY; -- Does not exist in production
-- ALTER TABLE public.alert_throttle FORCE ROW LEVEL SECURITY; -- Does not exist in production
ALTER TABLE public.audit_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.daily_metrics FORCE ROW LEVEL SECURITY;
ALTER TABLE public.adaptive_workflow_metrics FORCE ROW LEVEL SECURITY;

COMMENT ON TABLE public.metric_thresholds IS 
  'User alert thresholds. RLS enabled. FORCE RLS prevents SECURITY DEFINER bypass.';

COMMENT ON TABLE public.beta_monitoring_log IS 
  'Beta user monitoring. RLS enabled. FORCE RLS prevents SECURITY DEFINER bypass.';

-- ============================================================================
-- ============================================================================


-- ============================================================================
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_active_thresholds(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.get_active_thresholds(
  p_metric_name TEXT
)
RETURNS TABLE (
  id UUID,
  threshold_value NUMERIC,
  threshold_type TEXT,
  alert_level TEXT,
  alert_channels JSONB,
  cooldown_minutes INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    mt.id,
    mt.threshold_value,
    mt.threshold_type,
    mt.alert_level,
    mt.alert_channels,
    mt.cooldown_minutes
  FROM metric_thresholds mt
  WHERE mt.user_id = auth.uid()  -- Always current user
    AND mt.metric_name = p_metric_name
    AND mt.enabled = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_active_thresholds(TEXT) TO authenticated;

COMMENT ON FUNCTION public.get_active_thresholds IS 
  'Returns active thresholds for current user only. Uses auth.uid() internally for security.';

-- ============================================================================
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_unacknowledged_alerts(UUID, INTEGER);

CREATE OR REPLACE FUNCTION public.get_unacknowledged_alerts(
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  metric_name TEXT,
  metric_value NUMERIC,
  threshold_value NUMERIC,
  alert_level TEXT,
  alert_message TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ah.id,
    ah.metric_name,
    ah.metric_value,
    ah.threshold_value,
    ah.alert_level,
    ah.alert_message,
    ah.created_at
  FROM alert_history ah
  WHERE ah.user_id = auth.uid()  -- Always current user
    AND ah.acknowledged = false
  ORDER BY ah.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_unacknowledged_alerts(INTEGER) TO authenticated;

COMMENT ON FUNCTION public.get_unacknowledged_alerts IS 
  'Returns unacknowledged alerts for current user only. Uses auth.uid() internally for security.';

-- ============================================================================
-- ============================================================================

DROP FUNCTION IF EXISTS public.acknowledge_alert(UUID, UUID);

CREATE OR REPLACE FUNCTION public.acknowledge_alert(
  p_alert_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE alert_history
  SET
    acknowledged = true,
    acknowledged_at = NOW(),
    acknowledged_by = auth.uid()
  WHERE id = p_alert_id
    AND user_id = auth.uid()  -- Always current user
    AND acknowledged = false;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.acknowledge_alert(UUID) TO authenticated;

COMMENT ON FUNCTION public.acknowledge_alert IS 
  'Acknowledges an alert for current user only. Uses auth.uid() internally for security.';

-- ============================================================================
-- ============================================================================


REVOKE SELECT ON public.neural_policy_dashboard FROM authenticated;
REVOKE SELECT ON public.explainability_dashboard FROM authenticated;
REVOKE SELECT ON public.adaptive_policy_dashboard FROM authenticated;
REVOKE SELECT ON public.trust_graph_dashboard FROM authenticated;
REVOKE SELECT ON public.governance_dashboard FROM authenticated;
REVOKE SELECT ON public.simulation_dashboard FROM authenticated;

GRANT SELECT ON public.neural_policy_dashboard TO service_role;
GRANT SELECT ON public.explainability_dashboard TO service_role;
GRANT SELECT ON public.adaptive_policy_dashboard TO service_role;
GRANT SELECT ON public.trust_graph_dashboard TO service_role;
GRANT SELECT ON public.governance_dashboard TO service_role;
GRANT SELECT ON public.simulation_dashboard TO service_role;

DO $$
BEGIN
  EXECUTE 'REVOKE SELECT ON public.v_fusion_anomalies FROM authenticated';
EXCEPTION
  WHEN undefined_object THEN
    NULL; -- View might not exist or grant might not exist
END $$;

GRANT SELECT ON public.v_fusion_anomalies TO service_role;

COMMENT ON VIEW public.neural_policy_dashboard IS 
  'Admin-only view. Access via Edge Functions with service_role.';
COMMENT ON VIEW public.explainability_dashboard IS 
  'Admin-only view. Access via Edge Functions with service_role.';
COMMENT ON VIEW public.adaptive_policy_dashboard IS 
  'Admin-only view. Access via Edge Functions with service_role.';
COMMENT ON VIEW public.trust_graph_dashboard IS 
  'Admin-only view. Access via Edge Functions with service_role.';
COMMENT ON VIEW public.governance_dashboard IS 
  'Admin-only view. Access via Edge Functions with service_role.';
COMMENT ON VIEW public.simulation_dashboard IS 
  'Admin-only view. Access via Edge Functions with service_role.';
COMMENT ON VIEW public.v_fusion_anomalies IS 
  'Internal view for alert engine. Service role only.';

-- ============================================================================
-- ============================================================================


/*
SELECT 
  schemaname,
  tablename,
  rowsecurity AS rls_enabled,
  CASE 
    WHEN rowsecurity THEN 'Enabled'
    ELSE 'Disabled'
  END AS rls_status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'feature_flags',
    'metric_thresholds',
    'beta_monitoring_log'
  )
ORDER BY tablename;

SELECT 
  relname AS table_name,
  relrowsecurity AS rls_enabled,
  relforcerowsecurity AS force_rls_enabled
FROM pg_class
WHERE relnamespace = 'public'::regnamespace
  AND relkind = 'r'
  AND relname IN (
    'feature_flags',
    'metric_thresholds',
    'beta_monitoring_log',
    'profiles',
    'fusion_audit_log'
  )
ORDER BY relname;

SELECT 
  routine_name,
  routine_type,
  data_type,
  type_udt_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'get_active_thresholds',
    'get_unacknowledged_alerts',
    'acknowledge_alert'
  )
ORDER BY routine_name;

SELECT 
  table_name,
  grantee,
  privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND table_name IN (
    'neural_policy_dashboard',
    'explainability_dashboard',
    'adaptive_policy_dashboard',
    'trust_graph_dashboard',
    'governance_dashboard',
    'simulation_dashboard',
    'v_fusion_anomalies'
  )
ORDER BY table_name, grantee;
*/

-- ============================================================================
-- ============================================================================

--
