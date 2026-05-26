
CREATE TABLE IF NOT EXISTS fusion_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  event_source TEXT,
  event_payload JSONB,
  stability_score NUMERIC(5,2),
  reinforcement_delta NUMERIC(5,2),
  anomaly_flag BOOLEAN DEFAULT FALSE,
  anomaly_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fusion_audit_user_id ON fusion_audit_log(user_id);
CREATE INDEX idx_fusion_audit_event_type ON fusion_audit_log(event_type);
CREATE INDEX idx_fusion_audit_created_at ON fusion_audit_log(created_at DESC);
CREATE INDEX idx_fusion_audit_anomaly ON fusion_audit_log(anomaly_flag) WHERE anomaly_flag = TRUE;

CREATE VIEW v_fusion_anomalies AS
SELECT *
FROM fusion_audit_log
WHERE anomaly_flag = TRUE
ORDER BY created_at DESC;

ALTER TABLE fusion_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can view audit logs"
  ON fusion_audit_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_platform_admin = TRUE
    )
  );

CREATE POLICY "Platform admins can insert audit logs"
  ON fusion_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_platform_admin = TRUE
    )
  );

CREATE POLICY "Service role can insert audit logs"
  ON fusion_audit_log FOR INSERT
  TO service_role
  WITH CHECK (TRUE);

CREATE POLICY "Service role can update audit logs"
  ON fusion_audit_log FOR UPDATE
  TO service_role
  USING (TRUE);

COMMENT ON TABLE fusion_audit_log IS 'Phase 32: Audit trail for all Fusion Engine operations (Phases 26-31) with anomaly detection';
COMMENT ON COLUMN fusion_audit_log.event_type IS 'Type of event: baseline_analysis, reinforcement_calibration, cffe_sync, stability_forecast, risk_response';
COMMENT ON COLUMN fusion_audit_log.event_source IS 'Source function/phase that generated the event';
COMMENT ON COLUMN fusion_audit_log.stability_score IS 'Stability score at time of event (0-1 scale, stored as 0-100)';
COMMENT ON COLUMN fusion_audit_log.reinforcement_delta IS 'Change in reinforcement parameters';
COMMENT ON COLUMN fusion_audit_log.anomaly_flag IS 'TRUE if event triggered anomaly detection thresholds';
COMMENT ON COLUMN fusion_audit_log.anomaly_reason IS 'Reason for anomaly flag: High stability variance, Reinforcement spike, Critical instability';
