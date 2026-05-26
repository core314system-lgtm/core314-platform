
ALTER TABLE fusion_audit_log 
ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'info' 
CHECK (severity IN ('info', 'warning', 'error', 'critical'));

ALTER TABLE fusion_audit_log 
ADD COLUMN IF NOT EXISTS message TEXT;

UPDATE fusion_audit_log 
SET 
  severity = CASE 
    WHEN anomaly_detected = true THEN 'error'
    WHEN status = 'failed' THEN 'warning'
    ELSE 'info'
  END,
  message = COALESCE(
    decision_summary,
    event_type || ' event',
    'Legacy audit log entry'
  )
WHERE severity IS NULL OR message IS NULL;

CREATE INDEX IF NOT EXISTS idx_fusion_audit_log_severity 
ON fusion_audit_log(severity, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fusion_audit_log_user_severity 
ON fusion_audit_log(user_id, severity, created_at DESC);

COMMENT ON COLUMN fusion_audit_log.severity IS 'Event severity level: info, warning, error, critical. Used by Smart Agent for anomaly detection.';
COMMENT ON COLUMN fusion_audit_log.message IS 'Human-readable event description. Used for notification messages and audit trail.';
