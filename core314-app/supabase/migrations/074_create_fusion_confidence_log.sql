
CREATE TABLE IF NOT EXISTS fusion_confidence_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  integration_name text,
  source_event text NOT NULL,
  metric_type text NOT NULL,
  old_value numeric,
  new_value numeric NOT NULL,
  delta numeric GENERATED ALWAYS AS (new_value - COALESCE(old_value, 0)) STORED,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fusion_confidence_log_user_time 
  ON fusion_confidence_log(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fusion_confidence_log_metric_type 
  ON fusion_confidence_log(metric_type, created_at DESC);

ALTER TABLE fusion_confidence_log ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'fusion_confidence_log' 
    AND policyname = 'Users can view their own fusion confidence logs'
  ) THEN
    CREATE POLICY "Users can view their own fusion confidence logs"
      ON fusion_confidence_log FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'fusion_confidence_log' 
    AND policyname = 'Users can insert their own fusion confidence logs'
  ) THEN
    CREATE POLICY "Users can insert their own fusion confidence logs"
      ON fusion_confidence_log FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION log_fusion_metric_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.fusion_score IS DISTINCT FROM NEW.fusion_score) OR TG_OP = 'INSERT' THEN
    INSERT INTO fusion_confidence_log (user_id, integration_name, source_event, metric_type, old_value, new_value)
    VALUES (
      NEW.user_id,
      NEW.integration_name,
      TG_OP,
      'fusion_score',
      CASE WHEN TG_OP = 'UPDATE' THEN OLD.fusion_score ELSE NULL END,
      NEW.fusion_score
    );
  END IF;

  IF (TG_OP = 'UPDATE' AND OLD.efficiency_index IS DISTINCT FROM NEW.efficiency_index) OR TG_OP = 'INSERT' THEN
    INSERT INTO fusion_confidence_log (user_id, integration_name, source_event, metric_type, old_value, new_value)
    VALUES (
      NEW.user_id,
      NEW.integration_name,
      TG_OP,
      'efficiency_index',
      CASE WHEN TG_OP = 'UPDATE' THEN OLD.efficiency_index ELSE NULL END,
      NEW.efficiency_index
    );
  END IF;

  IF (TG_OP = 'UPDATE' AND OLD.stability_confidence IS DISTINCT FROM NEW.stability_confidence) OR TG_OP = 'INSERT' THEN
    INSERT INTO fusion_confidence_log (user_id, integration_name, source_event, metric_type, old_value, new_value)
    VALUES (
      NEW.user_id,
      NEW.integration_name,
      TG_OP,
      'stability_confidence',
      CASE WHEN TG_OP = 'UPDATE' THEN OLD.stability_confidence ELSE NULL END,
      NEW.stability_confidence
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'fusion_efficiency_metrics_log_changes'
  ) THEN
    CREATE TRIGGER fusion_efficiency_metrics_log_changes
      AFTER INSERT OR UPDATE ON fusion_efficiency_metrics
      FOR EACH ROW
      EXECUTE FUNCTION log_fusion_metric_change();
  END IF;
END $$;

GRANT SELECT, INSERT ON fusion_confidence_log TO authenticated;
