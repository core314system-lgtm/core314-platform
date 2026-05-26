
CREATE TABLE IF NOT EXISTS fusion_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anomaly_id UUID REFERENCES fusion_audit_log(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'moderate', 'high', 'critical')),
  message TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('slack', 'email', 'system')),
  dispatched BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fusion_alerts_event_type ON fusion_alerts(event_type, created_at DESC);
CREATE INDEX idx_fusion_alerts_severity ON fusion_alerts(severity, created_at DESC);
CREATE INDEX idx_fusion_alerts_dispatched ON fusion_alerts(dispatched);
CREATE INDEX idx_fusion_alerts_anomaly_id ON fusion_alerts(anomaly_id);

ALTER TABLE fusion_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can view alerts"
  ON fusion_alerts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_platform_admin = TRUE
    )
  );

CREATE POLICY "Platform admins can update alerts"
  ON fusion_alerts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_platform_admin = TRUE
    )
  );

CREATE POLICY "Service role can insert alerts"
  ON fusion_alerts FOR INSERT
  TO service_role
  WITH CHECK (TRUE);

CREATE POLICY "Service role can update alerts"
  ON fusion_alerts FOR UPDATE
  TO service_role
  USING (TRUE);

COMMENT ON TABLE fusion_alerts IS 'Phase 33: Stores generated anomaly alerts with severity levels and dispatch status';
COMMENT ON COLUMN fusion_alerts.anomaly_id IS 'Links to the source anomaly in fusion_audit_log';
COMMENT ON COLUMN fusion_alerts.event_type IS 'Type of anomaly event (e.g., reinforcement_spike, stability_variance)';
COMMENT ON COLUMN fusion_alerts.severity IS 'Alert severity: low, moderate, high, critical';
COMMENT ON COLUMN fusion_alerts.message IS 'Human-readable alert message';
COMMENT ON COLUMN fusion_alerts.channel IS 'Delivery channel: slack, email, or system (log only)';
COMMENT ON COLUMN fusion_alerts.dispatched IS 'TRUE once alert has been sent to the specified channel';
