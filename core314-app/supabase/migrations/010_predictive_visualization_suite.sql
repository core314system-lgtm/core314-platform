-- ============================================================
-- ============================================================

CREATE TABLE IF NOT EXISTS fusion_visual_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  integration_name TEXT NOT NULL,
  data_type TEXT NOT NULL,
  data JSONB NOT NULL,
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fusion_visual_cache_updated_at ON fusion_visual_cache(last_updated DESC);
CREATE INDEX IF NOT EXISTS idx_fusion_visual_cache_integration ON fusion_visual_cache(integration_name);
CREATE INDEX IF NOT EXISTS idx_fusion_visual_cache_data_type ON fusion_visual_cache(data_type);

ALTER TABLE fusion_visual_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view visual cache" ON fusion_visual_cache;
CREATE POLICY "Users can view visual cache"
ON fusion_visual_cache FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.uid() = auth.users.id
    AND auth.users.raw_user_meta_data->>'role' IN ('admin', 'manager', 'user')
  )
);

DROP POLICY IF EXISTS "Service role can manage visual cache" ON fusion_visual_cache;
CREATE POLICY "Service role can manage visual cache"
ON fusion_visual_cache FOR ALL
WITH CHECK (true);

GRANT ALL ON fusion_visual_cache TO service_role;
GRANT SELECT ON fusion_visual_cache TO authenticated;

COMMENT ON TABLE fusion_visual_cache IS 'Caches aggregated visualization data for performance optimization';
