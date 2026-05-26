-- ============================================================
-- ============================================================
-- ============================================================

CREATE TABLE IF NOT EXISTS fusion_insights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  integration_id UUID REFERENCES integrations_master(id) ON DELETE CASCADE,
  integration_name TEXT NOT NULL,
  insight_type TEXT NOT NULL CHECK (insight_type IN ('trend', 'prediction', 'anomaly', 'summary')),
  message TEXT NOT NULL,
  confidence NUMERIC NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fusion_insights_user ON fusion_insights(user_id);
CREATE INDEX IF NOT EXISTS idx_fusion_insights_integration_id ON fusion_insights(integration_id);
CREATE INDEX IF NOT EXISTS idx_fusion_insights_integration_name ON fusion_insights(integration_name);
CREATE INDEX IF NOT EXISTS idx_fusion_insights_created_at ON fusion_insights(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fusion_insights_type ON fusion_insights(insight_type);

ALTER TABLE fusion_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own insights" ON fusion_insights;
CREATE POLICY "Users can view own insights"
ON fusion_insights FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can insert insights" ON fusion_insights;
CREATE POLICY "Service role can insert insights"
ON fusion_insights FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can delete old insights" ON fusion_insights;
CREATE POLICY "Service role can delete old insights"
ON fusion_insights FOR DELETE
USING (true);

GRANT ALL ON fusion_insights TO service_role;
GRANT SELECT ON fusion_insights TO authenticated;

COMMENT ON TABLE fusion_insights IS 
  'Stores AI-generated insights from Fusion Intelligence Layer including trends, predictions, and anomalies';

COMMENT ON COLUMN fusion_insights.insight_type IS 
  'Type of insight: trend (performance change), prediction (forecast), anomaly (unusual pattern), summary (overview)';

COMMENT ON COLUMN fusion_insights.confidence IS 
  'Confidence score for the insight (0.0 to 1.0)';

COMMENT ON COLUMN fusion_insights.metadata IS 
  'Additional metadata like trend_value, predicted_score, anomaly_threshold, etc.';
