
BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ============================================================

CREATE TABLE IF NOT EXISTS public.prediction_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID NOT NULL REFERENCES public.predictive_models(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  metric_name TEXT NOT NULL,
  prediction_type TEXT NOT NULL CHECK (prediction_type IN ('forecast', 'anomaly', 'classification', 'regression')),
  predicted_value NUMERIC(15,4),
  predicted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  forecast_horizon_hours INTEGER,
  forecast_target_time TIMESTAMPTZ,
  confidence_score NUMERIC(5,4) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  lower_bound NUMERIC(15,4),
  upper_bound NUMERIC(15,4),
  anomaly_score NUMERIC(5,4),
  is_anomaly BOOLEAN DEFAULT false,
  actual_value NUMERIC(15,4),
  prediction_error NUMERIC(15,4),
  features_used JSONB DEFAULT '{}'::jsonb,
  explanation TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_prediction_results_model_id 
  ON public.prediction_results(model_id, predicted_at DESC);

CREATE INDEX IF NOT EXISTS idx_prediction_results_user_metric 
  ON public.prediction_results(user_id, metric_name, predicted_at DESC);

CREATE INDEX IF NOT EXISTS idx_prediction_results_forecast_time 
  ON public.prediction_results(forecast_target_time) 
  WHERE prediction_type = 'forecast';

CREATE INDEX IF NOT EXISTS idx_prediction_results_anomalies 
  ON public.prediction_results(user_id, is_anomaly, predicted_at DESC) 
  WHERE is_anomaly = true;

-- ============================================================
-- ============================================================

CREATE TABLE IF NOT EXISTS public.predictive_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_id UUID NOT NULL REFERENCES public.prediction_results(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  model_id UUID NOT NULL REFERENCES public.predictive_models(id) ON DELETE CASCADE,
  threshold_id UUID REFERENCES public.metric_thresholds(id) ON DELETE SET NULL,
  metric_name TEXT NOT NULL,
  predicted_value NUMERIC(15,4) NOT NULL,
  threshold_value NUMERIC(15,4) NOT NULL,
  alert_level TEXT NOT NULL CHECK (alert_level IN ('info', 'warning', 'critical')),
  alert_type TEXT NOT NULL CHECK (alert_type IN ('forecast_breach', 'anomaly_detected', 'trend_reversal', 'pattern_change')),
  forecast_breach_time TIMESTAMPTZ,
  time_to_breach_hours INTEGER,
  alert_message TEXT NOT NULL,
  recommendation TEXT,
  confidence_score NUMERIC(5,4),
  is_acknowledged BOOLEAN DEFAULT false,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES auth.users(id),
  channels_notified JSONB DEFAULT '[]'::jsonb,
  notification_status JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_predictive_alerts_user_id 
  ON public.predictive_alerts(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_predictive_alerts_model_id 
  ON public.predictive_alerts(model_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_predictive_alerts_unacknowledged 
  ON public.predictive_alerts(user_id, is_acknowledged, created_at DESC) 
  WHERE is_acknowledged = false;

CREATE INDEX IF NOT EXISTS idx_predictive_alerts_breach_time 
  ON public.predictive_alerts(forecast_breach_time) 
  WHERE alert_type = 'forecast_breach';

-- ============================================================
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'alert_history' 
    AND column_name = 'predictive_alert_id'
  ) THEN
    ALTER TABLE public.alert_history 
    ADD COLUMN predictive_alert_id UUID REFERENCES public.predictive_alerts(id) ON DELETE SET NULL;
  END IF;
END
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'alert_history' 
    AND column_name = 'alert_source'
  ) THEN
    ALTER TABLE public.alert_history 
    ADD COLUMN alert_source TEXT DEFAULT 'reactive' CHECK (alert_source IN ('reactive', 'predictive'));
  END IF;
END
$$ LANGUAGE plpgsql;

CREATE INDEX IF NOT EXISTS idx_alert_history_predictive 
  ON public.alert_history(predictive_alert_id) 
  WHERE predictive_alert_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_alert_history_source 
  ON public.alert_history(user_id, alert_source, created_at DESC);

-- ============================================================
-- ============================================================

ALTER TABLE public.prediction_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.predictive_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own prediction results"
  ON public.prediction_results FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own prediction results"
  ON public.prediction_results FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own prediction results"
  ON public.prediction_results FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all prediction results"
  ON public.prediction_results FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Users can view own predictive alerts"
  ON public.predictive_alerts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own predictive alerts"
  ON public.predictive_alerts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own predictive alerts"
  ON public.predictive_alerts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all predictive alerts"
  ON public.predictive_alerts FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- ============================================================
-- ============================================================

CREATE OR REPLACE FUNCTION calculate_prediction_error()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.actual_value IS NOT NULL AND NEW.predicted_value IS NOT NULL THEN
    NEW.prediction_error = ABS(NEW.actual_value - NEW.predicted_value);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calculate_prediction_error ON public.prediction_results;
CREATE TRIGGER trigger_calculate_prediction_error
  BEFORE INSERT OR UPDATE ON public.prediction_results
  FOR EACH ROW
  EXECUTE FUNCTION calculate_prediction_error();

CREATE OR REPLACE FUNCTION get_active_predictions(
  p_user_id UUID,
  p_metric_name TEXT,
  p_hours_ahead INTEGER DEFAULT 24
)
RETURNS TABLE (
  prediction_id UUID,
  model_name TEXT,
  predicted_value NUMERIC,
  forecast_target_time TIMESTAMPTZ,
  confidence_score NUMERIC,
  lower_bound NUMERIC,
  upper_bound NUMERIC,
  explanation TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pr.id,
    pm.model_name,
    pr.predicted_value,
    pr.forecast_target_time,
    pr.confidence_score,
    pr.lower_bound,
    pr.upper_bound,
    pr.explanation
  FROM public.prediction_results pr
  JOIN public.predictive_models pm ON pr.model_id = pm.id
  WHERE pr.user_id = p_user_id
    AND pr.metric_name = p_metric_name
    AND pr.prediction_type = 'forecast'
    AND pr.forecast_target_time > NOW()
    AND pr.forecast_target_time <= NOW() + (p_hours_ahead || ' hours')::INTERVAL
  ORDER BY pr.forecast_target_time ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_unacknowledged_predictive_alerts(p_user_id UUID)
RETURNS TABLE (
  alert_id UUID,
  metric_name TEXT,
  alert_level TEXT,
  alert_type TEXT,
  alert_message TEXT,
  forecast_breach_time TIMESTAMPTZ,
  time_to_breach_hours INTEGER,
  confidence_score NUMERIC,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pa.id,
    pa.metric_name,
    pa.alert_level,
    pa.alert_type,
    pa.alert_message,
    pa.forecast_breach_time,
    pa.time_to_breach_hours,
    pa.confidence_score,
    pa.created_at
  FROM public.predictive_alerts pa
  WHERE pa.user_id = p_user_id
    AND pa.is_acknowledged = false
  ORDER BY pa.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_prediction_accuracy_stats(
  p_model_id UUID,
  p_days_back INTEGER DEFAULT 30
)
RETURNS TABLE (
  total_predictions INTEGER,
  predictions_with_actuals INTEGER,
  avg_error NUMERIC,
  median_error NUMERIC,
  accuracy_percentage NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::INTEGER as total_predictions,
    COUNT(pr.actual_value)::INTEGER as predictions_with_actuals,
    AVG(pr.prediction_error) as avg_error,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY pr.prediction_error) as median_error,
    (1 - AVG(ABS(pr.prediction_error) / NULLIF(pr.actual_value, 0))) * 100 as accuracy_percentage
  FROM public.prediction_results pr
  WHERE pr.model_id = p_model_id
    AND pr.predicted_at >= NOW() - (p_days_back || ' days')::INTERVAL
    AND pr.actual_value IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- ============================================================

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.prediction_results;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.predictive_alerts;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END
$$ LANGUAGE plpgsql;

COMMIT;
