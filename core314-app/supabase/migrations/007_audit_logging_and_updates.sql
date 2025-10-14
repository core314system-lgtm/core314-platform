-- ============================================================
-- ============================================================

ALTER TABLE fusion_weightings 
ADD COLUMN IF NOT EXISTS metric_name TEXT,
ADD COLUMN IF NOT EXISTS variance NUMERIC DEFAULT 0.0 CHECK (variance >= 0 AND variance <= 1),
ADD COLUMN IF NOT EXISTS correlation_penalty NUMERIC DEFAULT 0.0 CHECK (correlation_penalty >= 0 AND correlation_penalty <= 1);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public'
        AND table_name = 'fusion_weightings' 
        AND column_name = 'weight'
    ) THEN
        ALTER TABLE fusion_weightings RENAME COLUMN weight TO final_weight;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public'
        AND table_name = 'fusion_weightings' 
        AND column_name = 'last_adjusted'
    ) THEN
        ALTER TABLE fusion_weightings RENAME COLUMN last_adjusted TO last_updated;
    END IF;
END $$;

DROP TRIGGER IF EXISTS trg_update_last_adjusted ON fusion_weightings;
DROP TRIGGER IF EXISTS trg_update_last_updated ON fusion_weightings;
DROP FUNCTION IF EXISTS update_last_adjusted();

CREATE OR REPLACE FUNCTION update_last_updated()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_last_updated
BEFORE UPDATE ON fusion_weightings
FOR EACH ROW
EXECUTE FUNCTION update_last_updated();

CREATE TABLE IF NOT EXISTS fusion_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    integration_id UUID REFERENCES integrations_master(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('manual_recalibration', 'scheduled_recalibration', 'adaptive_trigger')),
    metrics_count INTEGER,
    total_variance NUMERIC,
    avg_ai_confidence NUMERIC,
    weight_changes JSONB,
    triggered_by TEXT,
    execution_time_ms INTEGER,
    status TEXT CHECK (status IN ('success', 'failed', 'partial')),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fusion_audit_log_user ON fusion_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_fusion_audit_log_integration ON fusion_audit_log(integration_id);
CREATE INDEX IF NOT EXISTS idx_fusion_audit_log_created ON fusion_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fusion_audit_log_event_type ON fusion_audit_log(event_type);

ALTER TABLE fusion_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own audit logs"
ON fusion_audit_log FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert audit logs"
ON fusion_audit_log FOR INSERT
WITH CHECK (true);

GRANT ALL ON fusion_audit_log TO service_role;
GRANT SELECT ON fusion_audit_log TO anon;

COMMENT ON TABLE fusion_audit_log IS 
  'Audit log for tracking all fusion weight recalibration events with execution details';

COMMENT ON COLUMN fusion_weightings.metric_name IS 
  'Denormalized metric name for easier querying';

COMMENT ON COLUMN fusion_weightings.variance IS 
  'Normalized variance (0-1) showing metric volatility';

COMMENT ON COLUMN fusion_weightings.correlation_penalty IS 
  'Penalty factor for highly correlated metrics (0-1)';
