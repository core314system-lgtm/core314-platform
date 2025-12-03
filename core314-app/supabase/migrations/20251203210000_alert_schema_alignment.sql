-- ============================================================================
-- ============================================================================
-- 
--
--
--
-- ============================================================================

ALTER TABLE alert_history ADD COLUMN IF NOT EXISTS metric_value NUMERIC;
ALTER TABLE alert_history ADD COLUMN IF NOT EXISTS threshold_value NUMERIC;
ALTER TABLE alert_history ADD COLUMN IF NOT EXISTS acknowledged BOOLEAN DEFAULT FALSE;
ALTER TABLE alert_history ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ;
ALTER TABLE alert_history ADD COLUMN IF NOT EXISTS acknowledged_by UUID;

COMMENT ON COLUMN alert_history.metric_value IS 
  'Metric value that triggered the alert. Used by get_unacknowledged_alerts function.';

COMMENT ON COLUMN alert_history.threshold_value IS 
  'Threshold value that was exceeded. Used by get_unacknowledged_alerts function.';

COMMENT ON COLUMN alert_history.acknowledged IS 
  'Whether the alert has been acknowledged by a user. Default FALSE. Used by acknowledge_alert function.';

COMMENT ON COLUMN alert_history.acknowledged_at IS 
  'Timestamp when alert was acknowledged. Set by acknowledge_alert function.';

COMMENT ON COLUMN alert_history.acknowledged_by IS 
  'User ID who acknowledged the alert. Set by acknowledge_alert function using auth.uid().';

-- ============================================================================
-- ============================================================================

/*
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'alert_history'
  AND column_name IN ('metric_value', 'threshold_value', 'acknowledged', 'acknowledged_at', 'acknowledged_by')
ORDER BY ordinal_position;

SELECT * FROM get_unacknowledged_alerts(10);

SELECT acknowledge_alert('00000000-0000-0000-0000-000000000000');
*/

-- ============================================================================
-- ============================================================================
