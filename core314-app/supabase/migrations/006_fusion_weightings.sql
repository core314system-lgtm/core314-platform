-- ============================================================
-- ============================================================

CREATE TABLE IF NOT EXISTS fusion_weightings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    integration_id UUID REFERENCES integrations_master(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    metric_id UUID REFERENCES fusion_metrics(id) ON DELETE CASCADE,
    weight NUMERIC DEFAULT 1.0 CHECK (weight >= 0 AND weight <= 10),
    ai_confidence NUMERIC DEFAULT 0.0 CHECK (ai_confidence >= 0 AND ai_confidence <= 1),
    last_adjusted TIMESTAMPTZ DEFAULT NOW(),
    adjustment_reason TEXT,
    adaptive BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, integration_id, metric_id)
);

CREATE INDEX IF NOT EXISTS idx_fusion_weightings_user ON fusion_weightings(user_id);
CREATE INDEX IF NOT EXISTS idx_fusion_weightings_integration ON fusion_weightings(integration_id);
CREATE INDEX IF NOT EXISTS idx_fusion_weightings_metric ON fusion_weightings(metric_id);

ALTER TABLE fusion_weightings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own weights"
ON fusion_weightings FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own weights"
ON fusion_weightings FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own weights"
ON fusion_weightings FOR INSERT
WITH CHECK (auth.uid() = user_id);

GRANT ALL ON fusion_weightings TO service_role;
GRANT SELECT ON fusion_weightings TO anon;

CREATE OR REPLACE FUNCTION update_last_adjusted()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_adjusted = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_last_adjusted
BEFORE UPDATE ON fusion_weightings
FOR EACH ROW
EXECUTE FUNCTION update_last_adjusted();

COMMENT ON TABLE fusion_weightings IS 
  'Stores adaptive weights for fusion metrics based on variance, AI confidence, and correlation analysis';
