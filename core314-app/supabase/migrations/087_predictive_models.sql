
BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ============================================================

CREATE TABLE IF NOT EXISTS public.predictive_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  model_name TEXT NOT NULL,
  model_type TEXT NOT NULL CHECK (model_type IN ('regression', 'classification', 'time_series', 'anomaly_detection')),
  target_metric TEXT NOT NULL,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  hyperparameters JSONB DEFAULT '{}'::jsonb,
  accuracy_score NUMERIC(5,4),
  mae NUMERIC(10,4),
  rmse NUMERIC(10,4),
  r2_score NUMERIC(5,4),
  training_samples INTEGER,
  is_active BOOLEAN DEFAULT true,
  last_trained_at TIMESTAMPTZ,
  next_retrain_at TIMESTAMPTZ,
  retrain_frequency_days INTEGER DEFAULT 7,
  drift_threshold NUMERIC(3,2) DEFAULT 0.10,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
  UNIQUE(user_id, model_name)
);

CREATE INDEX IF NOT EXISTS idx_predictive_models_user_active 
  ON public.predictive_models(user_id, is_active);

CREATE INDEX IF NOT EXISTS idx_predictive_models_target_metric 
  ON public.predictive_models(target_metric);

CREATE INDEX IF NOT EXISTS idx_predictive_models_next_retrain 
  ON public.predictive_models(next_retrain_at) 
  WHERE is_active = true;

-- ============================================================
-- ============================================================

CREATE TABLE IF NOT EXISTS public.training_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID NOT NULL REFERENCES public.predictive_models(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  training_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  training_completed_at TIMESTAMPTZ,
  training_duration_ms INTEGER,
  dataset_size INTEGER NOT NULL,
  dataset_start_date TIMESTAMPTZ,
  dataset_end_date TIMESTAMPTZ,
  accuracy_before NUMERIC(5,4),
  accuracy_after NUMERIC(5,4),
  mae_before NUMERIC(10,4),
  mae_after NUMERIC(10,4),
  rmse_before NUMERIC(10,4),
  rmse_after NUMERIC(10,4),
  r2_before NUMERIC(5,4),
  r2_after NUMERIC(5,4),
  improvement_percentage NUMERIC(5,2),
  training_status TEXT NOT NULL CHECK (training_status IN ('pending', 'in_progress', 'completed', 'failed')),
  error_message TEXT,
  hyperparameters_used JSONB DEFAULT '{}'::jsonb,
  features_used JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_training_logs_model_id 
  ON public.training_logs(model_id, training_started_at DESC);

CREATE INDEX IF NOT EXISTS idx_training_logs_user_id 
  ON public.training_logs(user_id, training_started_at DESC);

CREATE INDEX IF NOT EXISTS idx_training_logs_status 
  ON public.training_logs(training_status, training_started_at DESC);

-- ============================================================
-- ============================================================

ALTER TABLE public.predictive_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own predictive models"
  ON public.predictive_models FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own predictive models"
  ON public.predictive_models FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own predictive models"
  ON public.predictive_models FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own predictive models"
  ON public.predictive_models FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all predictive models"
  ON public.predictive_models FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Users can view own training logs"
  ON public.training_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own training logs"
  ON public.training_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage all training logs"
  ON public.training_logs FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- ============================================================
-- ============================================================

CREATE OR REPLACE FUNCTION update_predictive_models_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_predictive_models_updated_at ON public.predictive_models;
CREATE TRIGGER trigger_update_predictive_models_updated_at
  BEFORE UPDATE ON public.predictive_models
  FOR EACH ROW
  EXECUTE FUNCTION update_predictive_models_updated_at();

CREATE OR REPLACE FUNCTION calculate_training_duration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.training_completed_at IS NOT NULL AND NEW.training_started_at IS NOT NULL THEN
    NEW.training_duration_ms = EXTRACT(EPOCH FROM (NEW.training_completed_at - NEW.training_started_at)) * 1000;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calculate_training_duration ON public.training_logs;
CREATE TRIGGER trigger_calculate_training_duration
  BEFORE INSERT OR UPDATE ON public.training_logs
  FOR EACH ROW
  EXECUTE FUNCTION calculate_training_duration();

CREATE OR REPLACE FUNCTION get_models_due_for_retraining()
RETURNS TABLE (
  model_id UUID,
  user_id UUID,
  model_name TEXT,
  target_metric TEXT,
  last_trained_at TIMESTAMPTZ,
  next_retrain_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pm.id,
    pm.user_id,
    pm.model_name,
    pm.target_metric,
    pm.last_trained_at,
    pm.next_retrain_at
  FROM public.predictive_models pm
  WHERE pm.is_active = true
    AND pm.next_retrain_at IS NOT NULL
    AND pm.next_retrain_at <= NOW()
  ORDER BY pm.next_retrain_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_model_performance_history(p_model_id UUID)
RETURNS TABLE (
  training_date TIMESTAMPTZ,
  accuracy NUMERIC,
  mae NUMERIC,
  rmse NUMERIC,
  r2_score NUMERIC,
  dataset_size INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tl.training_completed_at,
    tl.accuracy_after,
    tl.mae_after,
    tl.rmse_after,
    tl.r2_after,
    tl.dataset_size
  FROM public.training_logs tl
  WHERE tl.model_id = p_model_id
    AND tl.training_status = 'completed'
  ORDER BY tl.training_completed_at DESC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- ============================================================

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.predictive_models;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.training_logs;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END
$$ LANGUAGE plpgsql;

COMMIT;
