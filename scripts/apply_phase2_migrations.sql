-- ============================================================
-- ============================================================


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

DROP POLICY IF EXISTS "Users can view own telemetry metrics" ON telemetry_metrics;
DROP POLICY IF EXISTS "Service role can insert telemetry metrics" ON telemetry_metrics;
DROP POLICY IF EXISTS "Users can insert own telemetry metrics" ON telemetry_metrics;
DROP POLICY IF EXISTS "Users can update own telemetry metrics" ON telemetry_metrics;
DROP POLICY IF EXISTS "Users can delete own telemetry metrics" ON telemetry_metrics;

CREATE POLICY "Users can view own telemetry metrics"
  ON telemetry_metrics FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert telemetry metrics"
  ON telemetry_metrics FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can insert own telemetry metrics"
  ON telemetry_metrics FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own telemetry metrics"
  ON telemetry_metrics FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own telemetry metrics"
  ON telemetry_metrics FOR DELETE USING (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE telemetry_metrics;
