-- ============================================================
-- ============================================================

CREATE TABLE IF NOT EXISTS metric_thresholds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  metric_name TEXT NOT NULL,
  threshold_value NUMERIC NOT NULL,
  threshold_type TEXT NOT NULL CHECK (threshold_type IN ('above', 'below', 'equals', 'change_percentage')),
  alert_level TEXT NOT NULL CHECK (alert_level IN ('info', 'warning', 'critical')),
  auto_adjusted BOOLEAN DEFAULT FALSE,
  adjustment_factor NUMERIC DEFAULT 1.0,
  enabled BOOLEAN DEFAULT TRUE,
  alert_channels JSONB DEFAULT '["email"]'::jsonb,
  cooldown_minutes INTEGER DEFAULT 60,
  last_triggered_at TIMESTAMPTZ,
  trigger_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, metric_name, threshold_type)
);

CREATE INDEX IF NOT EXISTS idx_metric_thresholds_user_id ON metric_thresholds(user_id);
CREATE INDEX IF NOT EXISTS idx_metric_thresholds_metric_name ON metric_thresholds(metric_name);
CREATE INDEX IF NOT EXISTS idx_metric_thresholds_alert_level ON metric_thresholds(alert_level);
CREATE INDEX IF NOT EXISTS idx_metric_thresholds_enabled ON metric_thresholds(enabled) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_metric_thresholds_user_metric ON metric_thresholds(user_id, metric_name);
CREATE INDEX IF NOT EXISTS idx_metric_thresholds_auto_adjusted ON metric_thresholds(auto_adjusted) WHERE auto_adjusted = true;

ALTER TABLE metric_thresholds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own metric thresholds"
  ON metric_thresholds
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own metric thresholds"
  ON metric_thresholds
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own metric thresholds"
  ON metric_thresholds
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own metric thresholds"
  ON metric_thresholds
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can update metric thresholds"
  ON metric_thresholds
  FOR UPDATE
  USING (true);

CREATE TABLE IF NOT EXISTS alert_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  threshold_id UUID REFERENCES metric_thresholds(id) ON DELETE SET NULL,
  metric_name TEXT NOT NULL,
  metric_value NUMERIC NOT NULL,
  threshold_value NUMERIC NOT NULL,
  alert_level TEXT NOT NULL,
  alert_message TEXT NOT NULL,
  channels_sent JSONB DEFAULT '[]'::jsonb,
  delivery_status JSONB DEFAULT '{}'::jsonb,
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_history_user_id ON alert_history(user_id);
CREATE INDEX IF NOT EXISTS idx_alert_history_threshold_id ON alert_history(threshold_id);
CREATE INDEX IF NOT EXISTS idx_alert_history_metric_name ON alert_history(metric_name);
CREATE INDEX IF NOT EXISTS idx_alert_history_alert_level ON alert_history(alert_level);
CREATE INDEX IF NOT EXISTS idx_alert_history_created_at ON alert_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_history_acknowledged ON alert_history(acknowledged) WHERE acknowledged = false;
CREATE INDEX IF NOT EXISTS idx_alert_history_user_created ON alert_history(user_id, created_at DESC);

ALTER TABLE alert_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own alert history"
  ON alert_history
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert alert history"
  ON alert_history
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update own alert history"
  ON alert_history
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION should_trigger_threshold(
  p_threshold_id UUID,
  p_metric_value NUMERIC
)
RETURNS BOOLEAN AS $$
DECLARE
  v_threshold RECORD;
  v_should_trigger BOOLEAN := FALSE;
BEGIN
  SELECT * INTO v_threshold
  FROM metric_thresholds
  WHERE id = p_threshold_id AND enabled = true;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF v_threshold.last_triggered_at IS NOT NULL THEN
    IF NOW() - v_threshold.last_triggered_at < (v_threshold.cooldown_minutes || ' minutes')::INTERVAL THEN
      RETURN FALSE;
    END IF;
  END IF;

  CASE v_threshold.threshold_type
    WHEN 'above' THEN
      v_should_trigger := p_metric_value > v_threshold.threshold_value;
    WHEN 'below' THEN
      v_should_trigger := p_metric_value < v_threshold.threshold_value;
    WHEN 'equals' THEN
      v_should_trigger := p_metric_value = v_threshold.threshold_value;
    WHEN 'change_percentage' THEN
      DECLARE
        v_previous_value NUMERIC;
        v_change_pct NUMERIC;
      BEGIN
        SELECT metric_value INTO v_previous_value
        FROM telemetry_metrics
        WHERE user_id = v_threshold.user_id
          AND metric_name = v_threshold.metric_name
          AND timestamp < NOW()
        ORDER BY timestamp DESC
        LIMIT 1 OFFSET 1;

        IF v_previous_value IS NOT NULL AND v_previous_value > 0 THEN
          v_change_pct := ABS(((p_metric_value - v_previous_value) / v_previous_value) * 100);
          v_should_trigger := v_change_pct > v_threshold.threshold_value;
        END IF;
      END;
  END CASE;

  RETURN v_should_trigger;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_active_thresholds(
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

CREATE OR REPLACE FUNCTION get_unacknowledged_alerts(
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

CREATE OR REPLACE FUNCTION acknowledge_alert(
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

CREATE OR REPLACE FUNCTION auto_adjust_thresholds(
  p_user_id UUID,
  p_metric_name TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_avg_value NUMERIC;
  v_std_dev NUMERIC;
  v_threshold RECORD;
BEGIN
  SELECT
    AVG(metric_value),
    STDDEV(metric_value)
  INTO v_avg_value, v_std_dev
  FROM telemetry_metrics
  WHERE user_id = p_user_id
    AND metric_name = p_metric_name
    AND timestamp >= NOW() - INTERVAL '7 days';

  IF v_avg_value IS NULL OR v_std_dev IS NULL THEN
    RETURN FALSE;
  END IF;

  FOR v_threshold IN
    SELECT id, threshold_type, adjustment_factor
    FROM metric_thresholds
    WHERE user_id = p_user_id
      AND metric_name = p_metric_name
      AND auto_adjusted = true
      AND enabled = true
  LOOP
    CASE v_threshold.threshold_type
      WHEN 'above' THEN
        UPDATE metric_thresholds
        SET
          threshold_value = v_avg_value + (v_std_dev * v_threshold.adjustment_factor),
          updated_at = NOW()
        WHERE id = v_threshold.id;
      WHEN 'below' THEN
        UPDATE metric_thresholds
        SET
          threshold_value = v_avg_value - (v_std_dev * v_threshold.adjustment_factor),
          updated_at = NOW()
        WHERE id = v_threshold.id;
    END CASE;
  END LOOP;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION should_trigger_threshold(UUID, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION get_active_thresholds(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_unacknowledged_alerts(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION acknowledge_alert(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION auto_adjust_thresholds(UUID, TEXT) TO service_role;

COMMENT ON TABLE metric_thresholds IS 'Stores configurable thresholds for metric alerting with auto-adjustment capability';
COMMENT ON TABLE alert_history IS 'Tracks all triggered alerts with delivery status and acknowledgment';
COMMENT ON FUNCTION should_trigger_threshold IS 'Checks if a threshold should trigger based on metric value and cooldown period';
COMMENT ON FUNCTION get_active_thresholds IS 'Returns all active thresholds for a specific metric';
COMMENT ON FUNCTION get_unacknowledged_alerts IS 'Returns unacknowledged alerts for a user';
COMMENT ON FUNCTION acknowledge_alert IS 'Marks an alert as acknowledged by a user';
COMMENT ON FUNCTION auto_adjust_thresholds IS 'Automatically adjusts thresholds based on historical metric data (7-day window)';
