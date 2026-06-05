-- Add AI compliance analysis columns to sow_quotes
ALTER TABLE sow_quotes ADD COLUMN IF NOT EXISTS ai_compliance_score INTEGER;
ALTER TABLE sow_quotes ADD COLUMN IF NOT EXISTS ai_compliance_analysis JSONB;
ALTER TABLE sow_quotes ADD COLUMN IF NOT EXISTS ai_analyzed_at TIMESTAMPTZ;

-- Index for finding analyzed quotes
CREATE INDEX IF NOT EXISTS idx_sow_quotes_ai_analyzed ON sow_quotes(ai_analyzed_at) WHERE ai_analyzed_at IS NOT NULL;
