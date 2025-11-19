
CREATE TABLE IF NOT EXISTS fusion_adaptive_reliability (
  channel TEXT PRIMARY KEY CHECK (channel IN ('slack', 'email')),
  avg_latency_ms FLOAT NOT NULL,
  failure_rate FLOAT NOT NULL CHECK (failure_rate >= 0 AND failure_rate <= 1),
  recommended_retry_ms INT NOT NULL CHECK (recommended_retry_ms >= 500 AND recommended_retry_ms <= 10000),
  confidence_score FLOAT NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fusion_adaptive_reliability_updated 
  ON fusion_adaptive_reliability(channel, last_updated DESC);

ALTER TABLE fusion_adaptive_reliability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read adaptive reliability"
  ON fusion_adaptive_reliability FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.is_platform_admin = TRUE)
    )
  );

CREATE POLICY "Service role can manage adaptive reliability"
  ON fusion_adaptive_reliability FOR ALL
  TO service_role
  USING (TRUE);

COMMENT ON TABLE fusion_adaptive_reliability IS 'Phase 62: Stores adaptive retry metrics for self-healing reliability optimization. Updated hourly by ai_agent_selftest based on last 24h performance data.';

COMMENT ON COLUMN fusion_adaptive_reliability.channel IS 'Notification channel: slack or email (Teams excluded from adaptive optimization)';
COMMENT ON COLUMN fusion_adaptive_reliability.avg_latency_ms IS 'Average latency in milliseconds over last 24 hours (excludes skipped tests)';
COMMENT ON COLUMN fusion_adaptive_reliability.failure_rate IS 'Failure rate (0-1) over last 24 hours (excludes skipped tests)';
COMMENT ON COLUMN fusion_adaptive_reliability.recommended_retry_ms IS 'Adaptive retry delay in milliseconds (clamped to 500-10000ms range)';
COMMENT ON COLUMN fusion_adaptive_reliability.confidence_score IS 'Confidence score (0-1) based on sample size and variance';
COMMENT ON COLUMN fusion_adaptive_reliability.last_updated IS 'Timestamp of last metric update from ai_agent_selftest';
