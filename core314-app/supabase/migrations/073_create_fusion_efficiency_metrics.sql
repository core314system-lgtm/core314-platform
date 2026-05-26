
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS fusion_efficiency_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  integration_name text NOT NULL,
  fusion_score numeric NOT NULL CHECK (fusion_score >= 0 AND fusion_score <= 100),
  efficiency_index numeric NOT NULL CHECK (efficiency_index >= 0),
  trend_7d numeric DEFAULT 0,
  stability_confidence numeric NOT NULL CHECK (stability_confidence >= 0 AND stability_confidence <= 100),
  last_anomaly_at timestamptz,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT fusion_efficiency_user_integration_uniq UNIQUE (user_id, integration_name)
);

CREATE INDEX IF NOT EXISTS idx_fusion_efficiency_metrics_user_integration 
  ON fusion_efficiency_metrics(user_id, integration_name, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_fusion_efficiency_metrics_anomalies 
  ON fusion_efficiency_metrics(last_anomaly_at DESC) 
  WHERE last_anomaly_at IS NOT NULL;

ALTER TABLE fusion_efficiency_metrics ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'fusion_efficiency_metrics' 
    AND policyname = 'Users can view their own fusion efficiency metrics'
  ) THEN
    CREATE POLICY "Users can view their own fusion efficiency metrics"
      ON fusion_efficiency_metrics FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'fusion_efficiency_metrics' 
    AND policyname = 'Users can insert their own fusion efficiency metrics'
  ) THEN
    CREATE POLICY "Users can insert their own fusion efficiency metrics"
      ON fusion_efficiency_metrics FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'fusion_efficiency_metrics' 
    AND policyname = 'Users can update their own fusion efficiency metrics'
  ) THEN
    CREATE POLICY "Users can update their own fusion efficiency metrics"
      ON fusion_efficiency_metrics FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION update_fusion_efficiency_metrics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'fusion_efficiency_metrics_updated_at'
  ) THEN
    CREATE TRIGGER fusion_efficiency_metrics_updated_at
      BEFORE UPDATE ON fusion_efficiency_metrics
      FOR EACH ROW
      EXECUTE FUNCTION update_fusion_efficiency_metrics_updated_at();
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE ON fusion_efficiency_metrics TO authenticated;
