-- ============================================================
-- ============================================================

CREATE TABLE IF NOT EXISTS insight_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  metric_group TEXT NOT NULL,
  insight_text TEXT NOT NULL,
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative', 'warning', 'critical')),
  confidence NUMERIC CHECK (confidence >= 0 AND confidence <= 1),
  recommendations JSONB DEFAULT '[]'::jsonb,
  metrics_analyzed JSONB DEFAULT '[]'::jsonb,
  model_version TEXT DEFAULT 'gpt-4o',
  processing_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days'
);

CREATE INDEX IF NOT EXISTS idx_insight_logs_user_id ON insight_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_insight_logs_metric_group ON insight_logs(metric_group);
CREATE INDEX IF NOT EXISTS idx_insight_logs_created_at ON insight_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_insight_logs_sentiment ON insight_logs(sentiment);
CREATE INDEX IF NOT EXISTS idx_insight_logs_confidence ON insight_logs(confidence DESC);
CREATE INDEX IF NOT EXISTS idx_insight_logs_user_created ON insight_logs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_insight_logs_active 
  ON insight_logs(user_id, created_at DESC) 
  WHERE expires_at > NOW();

ALTER TABLE insight_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own insight logs"
  ON insight_logs
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert insight logs"
  ON insight_logs
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can insert own insight logs"
  ON insight_logs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own insight logs"
  ON insight_logs
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own insight logs"
  ON insight_logs
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION get_recent_insights(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 10,
  p_metric_group TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  metric_group TEXT,
  insight_text TEXT,
  sentiment TEXT,
  confidence NUMERIC,
  recommendations JSONB,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    il.id,
    il.metric_group,
    il.insight_text,
    il.sentiment,
    il.confidence,
    il.recommendations,
    il.created_at
  FROM insight_logs il
  WHERE il.user_id = p_user_id
    AND il.expires_at > NOW()
    AND (p_metric_group IS NULL OR il.metric_group = p_metric_group)
  ORDER BY il.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_insights_by_sentiment(
  p_user_id UUID,
  p_sentiment TEXT,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  metric_group TEXT,
  insight_text TEXT,
  confidence NUMERIC,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    il.id,
    il.metric_group,
    il.insight_text,
    il.confidence,
    il.created_at
  FROM insight_logs il
  WHERE il.user_id = p_user_id
    AND il.sentiment = p_sentiment
    AND il.expires_at > NOW()
  ORDER BY il.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_insight_statistics(
  p_user_id UUID,
  p_time_range INTERVAL DEFAULT '7 days'
)
RETURNS TABLE (
  total_insights BIGINT,
  avg_confidence NUMERIC,
  sentiment_breakdown JSONB,
  top_metric_groups JSONB
) AS $$
DECLARE
  v_total BIGINT;
  v_avg_conf NUMERIC;
  v_sentiment JSONB;
  v_groups JSONB;
BEGIN
  SELECT COUNT(*) INTO v_total
  FROM insight_logs
  WHERE user_id = p_user_id
    AND created_at >= NOW() - p_time_range
    AND expires_at > NOW();

  SELECT AVG(confidence) INTO v_avg_conf
  FROM insight_logs
  WHERE user_id = p_user_id
    AND created_at >= NOW() - p_time_range
    AND expires_at > NOW();

  SELECT jsonb_object_agg(sentiment, count) INTO v_sentiment
  FROM (
    SELECT sentiment, COUNT(*) as count
    FROM insight_logs
    WHERE user_id = p_user_id
      AND created_at >= NOW() - p_time_range
      AND expires_at > NOW()
    GROUP BY sentiment
  ) s;

  SELECT jsonb_agg(row_to_json(t)) INTO v_groups
  FROM (
    SELECT metric_group, COUNT(*) as count
    FROM insight_logs
    WHERE user_id = p_user_id
      AND created_at >= NOW() - p_time_range
      AND expires_at > NOW()
    GROUP BY metric_group
    ORDER BY count DESC
    LIMIT 5
  ) t;

  RETURN QUERY SELECT v_total, v_avg_conf, v_sentiment, v_groups;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION cleanup_expired_insights()
RETURNS INTEGER AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM insight_logs
  WHERE expires_at < NOW();
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_recent_insights(UUID, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_insights_by_sentiment(UUID, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_insight_statistics(UUID, INTERVAL) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_insights() TO service_role;

COMMENT ON TABLE insight_logs IS 'Stores AI-generated insights from GPT-4o Reasoning API for the Insight & Metrics Engine';
COMMENT ON FUNCTION get_recent_insights IS 'Returns recent insights for a user, optionally filtered by metric group';
COMMENT ON FUNCTION get_insights_by_sentiment IS 'Returns insights filtered by sentiment (positive, neutral, negative, warning, critical)';
COMMENT ON FUNCTION get_insight_statistics IS 'Returns aggregate statistics about insights for a user over a time period';
COMMENT ON FUNCTION cleanup_expired_insights IS 'Removes expired insights from the database (run via cron job)';
