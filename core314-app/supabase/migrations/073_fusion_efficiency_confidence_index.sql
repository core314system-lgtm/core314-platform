
CREATE TABLE fusion_efficiency_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  integration_name text NOT NULL,
  fusion_score numeric NOT NULL CHECK (fusion_score >= 0 AND fusion_score <= 100),
  efficiency_index numeric NOT NULL CHECK (efficiency_index >= 0),
  trend_7d numeric DEFAULT 0,
  stability_confidence numeric NOT NULL CHECK (stability_confidence >= 0 AND stability_confidence <= 100),
  last_anomaly_at timestamptz,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_fusion_efficiency_metrics_user_integration 
  ON fusion_efficiency_metrics(user_id, integration_name, updated_at DESC);

CREATE INDEX idx_fusion_efficiency_metrics_anomalies 
  ON fusion_efficiency_metrics(last_anomaly_at DESC) 
  WHERE last_anomaly_at IS NOT NULL;

CREATE TABLE fusion_confidence_log (
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

CREATE INDEX idx_fusion_confidence_log_user_time 
  ON fusion_confidence_log(user_id, created_at DESC);

CREATE INDEX idx_fusion_confidence_log_metric_type 
  ON fusion_confidence_log(metric_type, created_at DESC);

ALTER TABLE fusion_efficiency_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE fusion_confidence_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own fusion efficiency metrics"
  ON fusion_efficiency_metrics FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own fusion efficiency metrics"
  ON fusion_efficiency_metrics FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own fusion efficiency metrics"
  ON fusion_efficiency_metrics FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own fusion confidence logs"
  ON fusion_confidence_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own fusion confidence logs"
  ON fusion_confidence_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION update_fusion_efficiency_metrics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER fusion_efficiency_metrics_updated_at
  BEFORE UPDATE ON fusion_efficiency_metrics
  FOR EACH ROW
  EXECUTE FUNCTION update_fusion_efficiency_metrics_updated_at();

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

CREATE TRIGGER fusion_efficiency_metrics_log_changes
  AFTER INSERT OR UPDATE ON fusion_efficiency_metrics
  FOR EACH ROW
  EXECUTE FUNCTION log_fusion_metric_change();

GRANT SELECT, INSERT, UPDATE ON fusion_efficiency_metrics TO authenticated;
GRANT SELECT, INSERT ON fusion_confidence_log TO authenticated;
