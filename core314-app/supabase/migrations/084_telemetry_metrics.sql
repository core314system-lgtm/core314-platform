-- ============================================================
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS telemetry_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  metric_name TEXT NOT NULL,
  metric_value NUMERIC NOT NULL,
  metric_unit TEXT,
  source_app TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telemetry_metrics_user_id ON telemetry_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_metrics_metric_name ON telemetry_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_telemetry_metrics_timestamp ON telemetry_metrics(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_metrics_user_metric ON telemetry_metrics(user_id, metric_name, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_metrics_source_app ON telemetry_metrics(source_app);

CREATE INDEX IF NOT EXISTS idx_telemetry_metrics_user_time_range 
  ON telemetry_metrics(user_id, timestamp DESC) 
  WHERE timestamp > NOW() - INTERVAL '30 days';

ALTER TABLE telemetry_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own telemetry metrics"
  ON telemetry_metrics
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert telemetry metrics"
  ON telemetry_metrics
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can insert own telemetry metrics"
  ON telemetry_metrics
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own telemetry metrics"
  ON telemetry_metrics
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own telemetry metrics"
  ON telemetry_metrics
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION calculate_metric_trend(
  p_user_id UUID,
  p_metric_name TEXT,
  p_time_window INTERVAL DEFAULT '7 days'
)
RETURNS TABLE (
  current_value NUMERIC,
  previous_value NUMERIC,
  trend_percentage NUMERIC,
  trend_direction TEXT
) AS $$
DECLARE
  v_current_avg NUMERIC;
  v_previous_avg NUMERIC;
  v_trend_pct NUMERIC;
BEGIN
  SELECT AVG(metric_value) INTO v_current_avg
  FROM telemetry_metrics
  WHERE user_id = p_user_id
    AND metric_name = p_metric_name
    AND timestamp >= NOW() - p_time_window;

  SELECT AVG(metric_value) INTO v_previous_avg
  FROM telemetry_metrics
  WHERE user_id = p_user_id
    AND metric_name = p_metric_name
    AND timestamp >= NOW() - (p_time_window * 2)
    AND timestamp < NOW() - p_time_window;

  IF v_previous_avg IS NOT NULL AND v_previous_avg > 0 THEN
    v_trend_pct := ((v_current_avg - v_previous_avg) / v_previous_avg) * 100;
  ELSE
    v_trend_pct := 0;
  END IF;

  RETURN QUERY SELECT
    v_current_avg,
    v_previous_avg,
    v_trend_pct,
    CASE
      WHEN v_trend_pct > 5 THEN 'up'
      WHEN v_trend_pct < -5 THEN 'down'
      ELSE 'stable'
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_latest_metrics(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  metric_name TEXT,
  metric_value NUMERIC,
  metric_unit TEXT,
  source_app TEXT,
  timestamp TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (tm.metric_name)
    tm.metric_name,
    tm.metric_value,
    tm.metric_unit,
    tm.source_app,
    tm.timestamp
  FROM telemetry_metrics tm
  WHERE tm.user_id = p_user_id
  ORDER BY tm.metric_name, tm.timestamp DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION aggregate_metrics_by_period(
  p_user_id UUID,
  p_metric_name TEXT,
  p_period TEXT DEFAULT 'hour',
  p_time_range INTERVAL DEFAULT '24 hours'
)
RETURNS TABLE (
  period_start TIMESTAMPTZ,
  avg_value NUMERIC,
  min_value NUMERIC,
  max_value NUMERIC,
  count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    date_trunc(p_period, timestamp) as period_start,
    AVG(metric_value) as avg_value,
    MIN(metric_value) as min_value,
    MAX(metric_value) as max_value,
    COUNT(*) as count
  FROM telemetry_metrics
  WHERE user_id = p_user_id
    AND metric_name = p_metric_name
    AND timestamp >= NOW() - p_time_range
  GROUP BY date_trunc(p_period, timestamp)
  ORDER BY period_start DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION calculate_metric_trend(UUID, TEXT, INTERVAL) TO authenticated;
GRANT EXECUTE ON FUNCTION get_latest_metrics(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION aggregate_metrics_by_period(UUID, TEXT, TEXT, INTERVAL) TO authenticated;

COMMENT ON TABLE telemetry_metrics IS 'Stores real-time KPI metrics from connected integrations for the Insight & Metrics Engine';
COMMENT ON FUNCTION calculate_metric_trend IS 'Calculates trend direction and percentage change for a specific metric';
COMMENT ON FUNCTION get_latest_metrics IS 'Returns the most recent value for each metric for a user';
COMMENT ON FUNCTION aggregate_metrics_by_period IS 'Aggregates metric values by time period (hour, day, week, month)';
