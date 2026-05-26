
CREATE TABLE IF NOT EXISTS memory_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  metric_name TEXT NOT NULL,
  data_window INTERVAL NOT NULL, -- e.g., '7 days', '30 days', '90 days'
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  avg_value NUMERIC NOT NULL,
  trend_slope NUMERIC NOT NULL, -- Linear regression slope
  variance NUMERIC NOT NULL,
  std_dev NUMERIC NOT NULL,
  min_value NUMERIC NOT NULL,
  max_value NUMERIC NOT NULL,
  sample_count INTEGER NOT NULL,
  seasonality_detected BOOLEAN DEFAULT FALSE,
  seasonality_period INTERVAL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_memory_snapshots_user_id ON memory_snapshots(user_id);
CREATE INDEX idx_memory_snapshots_metric_name ON memory_snapshots(metric_name);
CREATE INDEX idx_memory_snapshots_created_at ON memory_snapshots(created_at DESC);
CREATE INDEX idx_memory_snapshots_window_end ON memory_snapshots(window_end DESC);
CREATE INDEX idx_memory_snapshots_composite ON memory_snapshots(user_id, metric_name, window_end DESC);

ALTER TABLE memory_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY memory_snapshots_select_policy ON memory_snapshots
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY memory_snapshots_insert_policy ON memory_snapshots
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY memory_snapshots_update_policy ON memory_snapshots
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY memory_snapshots_delete_policy ON memory_snapshots
  FOR DELETE
  USING (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE memory_snapshots;

COMMENT ON TABLE memory_snapshots IS 'Phase 4: Stores historical pattern summaries for adaptive memory and long-term trend learning';
