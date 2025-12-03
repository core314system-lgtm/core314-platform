-- ============================================================================
-- ============================================================================
-- 
--
-- ============================================================================

-- ============================================================================
-- ============================================================================

GRANT SELECT ON public.neural_policy_dashboard TO authenticated;
GRANT SELECT ON public.explainability_dashboard TO authenticated;
GRANT SELECT ON public.adaptive_policy_dashboard TO authenticated;
GRANT SELECT ON public.trust_graph_dashboard TO authenticated;
GRANT SELECT ON public.governance_dashboard TO authenticated;
GRANT SELECT ON public.simulation_dashboard TO authenticated;


-- ============================================================================
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_active_thresholds(TEXT);

CREATE OR REPLACE FUNCTION public.get_active_thresholds(
  p_user_id UUID,
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
  WHERE mt.user_id = p_user_id
    AND mt.metric_name = p_metric_name
    AND mt.enabled = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_active_thresholds(UUID, TEXT) TO authenticated;

DROP FUNCTION IF EXISTS public.get_unacknowledged_alerts(INTEGER);

CREATE OR REPLACE FUNCTION public.get_unacknowledged_alerts(
  p_user_id UUID,
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
  WHERE ah.user_id = p_user_id
    AND ah.acknowledged = false
  ORDER BY ah.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_unacknowledged_alerts(UUID, INTEGER) TO authenticated;

DROP FUNCTION IF EXISTS public.acknowledge_alert(UUID);

CREATE OR REPLACE FUNCTION public.acknowledge_alert(
  p_alert_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE alert_history
  SET
    acknowledged = true,
    acknowledged_at = NOW(),
    acknowledged_by = p_user_id
  WHERE id = p_alert_id
    AND user_id = p_user_id
    AND acknowledged = false;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.acknowledge_alert(UUID, UUID) TO authenticated;

-- ============================================================================
-- ============================================================================

ALTER TABLE public.feature_flags NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.metric_thresholds NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.alert_history NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.beta_monitoring_log NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.beta_users NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.beta_events NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.beta_feedback NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.beta_user_notes NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.beta_feature_usage NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fusion_neural_policy_weights NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fusion_explainability_log NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fusion_adaptive_policies NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fusion_trust_graph NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fusion_governance_audit NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fusion_simulation_events NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fusion_audit_log NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fusion_behavioral_metrics NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fusion_calibration_events NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fusion_feedback NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fusion_global_insights NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fusion_model_metrics NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fusion_narratives NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fusion_beta_audit NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fusion_e2e_anomalies NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fusion_e2e_benchmarks NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fusion_e2e_results NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fusion_e2e_sessions NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.profiles NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.telemetry_metrics NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.integration_credentials NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.integration_sync_log NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agents NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ai_tasks NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.automation_rules NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.automation_logs NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.alerts NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.alert_throttle NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.daily_metrics NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.adaptive_workflow_metrics NO FORCE ROW LEVEL SECURITY;

-- ============================================================================
-- ============================================================================

DROP POLICY IF EXISTS "Authenticated users can read feature flags" ON public.feature_flags;
DROP POLICY IF EXISTS "Service role can manage feature flags" ON public.feature_flags;

ALTER TABLE public.feature_flags DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- ============================================================================
