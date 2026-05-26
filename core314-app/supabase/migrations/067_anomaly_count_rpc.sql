
CREATE OR REPLACE FUNCTION get_anomaly_count(target_user_id UUID DEFAULT NULL)
RETURNS INTEGER AS $$
DECLARE
  user_to_check UUID;
  anomaly_count INTEGER;
BEGIN
  user_to_check := COALESCE(target_user_id, auth.uid());
  
  SELECT COUNT(*)::INTEGER INTO anomaly_count
  FROM fusion_audit_log
  WHERE user_id = user_to_check
    AND severity IN ('error', 'critical')
    AND created_at > NOW() - INTERVAL '24 hours';
  
  RETURN COALESCE(anomaly_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_recent_anomalies(
  target_user_id UUID DEFAULT NULL,
  hours_back INTEGER DEFAULT 24,
  limit_count INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  event_type TEXT,
  severity TEXT,
  message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ
) AS $$
DECLARE
  user_to_check UUID;
BEGIN
  user_to_check := COALESCE(target_user_id, auth.uid());
  
  RETURN QUERY
  SELECT 
    fal.id,
    fal.event_type,
    fal.severity,
    fal.message,
    fal.metadata,
    fal.created_at
  FROM fusion_audit_log fal
  WHERE fal.user_id = user_to_check
    AND fal.severity IN ('error', 'critical')
    AND fal.created_at > NOW() - (hours_back || ' hours')::INTERVAL
  ORDER BY fal.created_at DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_integration_error_count(
  target_user_id UUID DEFAULT NULL,
  hours_back INTEGER DEFAULT 24
)
RETURNS INTEGER AS $$
DECLARE
  user_to_check UUID;
  error_count INTEGER;
BEGIN
  user_to_check := COALESCE(target_user_id, auth.uid());
  
  SELECT COUNT(*)::INTEGER INTO error_count
  FROM fusion_audit_log
  WHERE user_id = user_to_check
    AND event_type LIKE '%integration%'
    AND severity IN ('error', 'critical')
    AND created_at > NOW() - (hours_back || ' hours')::INTERVAL;
  
  RETURN COALESCE(error_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_anomaly_count IS 'Returns count of anomalies (errors/critical events) for a user in last 24 hours';
COMMENT ON FUNCTION get_recent_anomalies IS 'Returns detailed list of recent anomalies for a user';
COMMENT ON FUNCTION get_integration_error_count IS 'Returns count of integration-related errors for a user';
