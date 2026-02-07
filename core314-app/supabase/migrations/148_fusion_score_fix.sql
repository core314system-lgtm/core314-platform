-- ============================================================
-- Fusion Score Fix Migration
-- Fixes the functions from migration 147 that failed due to
-- missing columns in fusion_scores table
-- ============================================================

-- 1. Add missing columns to fusion_scores table if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'fusion_scores' 
                 AND column_name = 'baseline_score') THEN
    ALTER TABLE public.fusion_scores ADD COLUMN baseline_score NUMERIC DEFAULT 50;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'fusion_scores' 
                 AND column_name = 'adaptive_notes') THEN
    ALTER TABLE public.fusion_scores ADD COLUMN adaptive_notes TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'fusion_scores' 
                 AND column_name = 'weight_factor') THEN
    ALTER TABLE public.fusion_scores ADD COLUMN weight_factor NUMERIC DEFAULT 1.0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'fusion_scores' 
                 AND column_name = 'learning_rate') THEN
    ALTER TABLE public.fusion_scores ADD COLUMN learning_rate NUMERIC DEFAULT 0.05;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'fusion_scores' 
                 AND column_name = 'last_adjusted') THEN
    ALTER TABLE public.fusion_scores ADD COLUMN last_adjusted TIMESTAMPTZ;
  END IF;
END $$;

-- 2. Drop and recreate the functions with simpler return types

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS public.sync_integration_metrics_to_fusion(UUID, TEXT, UUID);
DROP FUNCTION IF EXISTS public.recalculate_fusion_score(UUID, UUID);
DROP FUNCTION IF EXISTS public.sync_and_calculate_fusion_score(UUID, TEXT, UUID);

-- 3. Function to sync integration_metrics to fusion_metrics
CREATE OR REPLACE FUNCTION public.sync_integration_metrics_to_fusion(
  p_user_id UUID,
  p_integration_type TEXT,
  p_integration_id UUID
)
RETURNS INTEGER AS $$
DECLARE
  v_metric RECORD;
  v_raw_value NUMERIC;
  v_normalized NUMERIC;
  v_weight NUMERIC;
  v_normalization_max NUMERIC;
  v_count INTEGER := 0;
BEGIN
  -- Loop through each weighted metric for this integration type
  FOR v_metric IN 
    SELECT fw.metric_name, fw.fusion_weight, fw.normalization_max
    FROM public.fusion_metric_weights fw
    WHERE fw.integration_type = p_integration_type
  LOOP
    -- Get the latest metric value from integration_metrics
    SELECT im.metric_value INTO v_raw_value
    FROM public.integration_metrics im
    WHERE im.user_id = p_user_id
    AND im.integration_type = p_integration_type
    AND im.metric_name = v_metric.metric_name
    ORDER BY im.calculated_at DESC
    LIMIT 1;
    
    -- Skip if no value found
    IF v_raw_value IS NULL THEN
      CONTINUE;
    END IF;
    
    -- Normalize the value (0-1 scale)
    v_normalization_max := COALESCE(v_metric.normalization_max, 100);
    v_normalized := LEAST(v_raw_value / NULLIF(v_normalization_max, 0), 1.0);
    v_weight := v_metric.fusion_weight;
    
    -- Upsert into fusion_metrics
    INSERT INTO public.fusion_metrics (
      user_id,
      integration_id,
      metric_name,
      metric_type,
      raw_value,
      normalized_value,
      weight,
      data_source,
      synced_at
    )
    VALUES (
      p_user_id,
      p_integration_id,
      v_metric.metric_name,
      'count',
      v_raw_value,
      v_normalized,
      v_weight,
      jsonb_build_object(
        'source', 'integration_metrics',
        'integration_type', p_integration_type,
        'synced_at', NOW()
      ),
      NOW()
    )
    ON CONFLICT (user_id, integration_id, metric_name)
    DO UPDATE SET
      raw_value = EXCLUDED.raw_value,
      normalized_value = EXCLUDED.normalized_value,
      weight = EXCLUDED.weight,
      data_source = EXCLUDED.data_source,
      synced_at = NOW();
    
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Function to recalculate Fusion Score for a user/integration
CREATE OR REPLACE FUNCTION public.recalculate_fusion_score(
  p_user_id UUID,
  p_integration_id UUID
)
RETURNS NUMERIC AS $$
DECLARE
  v_weighted_sum NUMERIC := 0;
  v_total_weight NUMERIC := 0;
  v_score NUMERIC;
  v_breakdown JSONB := '{}'::JSONB;
  v_metric RECORD;
  v_previous_score NUMERIC;
  v_trend TEXT := 'stable';
BEGIN
  -- Calculate weighted sum from fusion_metrics
  FOR v_metric IN
    SELECT fm.metric_name, fm.normalized_value, fm.weight
    FROM public.fusion_metrics fm
    WHERE fm.user_id = p_user_id
    AND fm.integration_id = p_integration_id
  LOOP
    v_weighted_sum := v_weighted_sum + (v_metric.normalized_value * v_metric.weight);
    v_total_weight := v_total_weight + v_metric.weight;
    v_breakdown := v_breakdown || jsonb_build_object(
      v_metric.metric_name, 
      jsonb_build_object(
        'normalized', v_metric.normalized_value,
        'weight', v_metric.weight,
        'contribution', v_metric.normalized_value * v_metric.weight
      )
    );
  END LOOP;
  
  -- Calculate final score (0-100 scale)
  IF v_total_weight > 0 THEN
    v_score := (v_weighted_sum / v_total_weight) * 100;
  ELSE
    v_score := 50; -- Baseline score when no metrics
  END IF;
  
  -- Get previous score for trend calculation
  SELECT fs.fusion_score INTO v_previous_score
  FROM public.fusion_scores fs
  WHERE fs.user_id = p_user_id
  AND fs.integration_id = p_integration_id;
  
  -- Determine trend
  IF v_previous_score IS NOT NULL THEN
    IF v_score - v_previous_score > 5 THEN
      v_trend := 'up';
    ELSIF v_score - v_previous_score < -5 THEN
      v_trend := 'down';
    END IF;
  END IF;
  
  -- Upsert fusion_scores
  INSERT INTO public.fusion_scores (
    user_id,
    integration_id,
    fusion_score,
    score_breakdown,
    trend_direction,
    calculated_at,
    baseline_score,
    adaptive_notes
  )
  VALUES (
    p_user_id,
    p_integration_id,
    v_score,
    v_breakdown,
    v_trend,
    NOW(),
    50,
    'Calculated from integration_metrics via sync pipeline'
  )
  ON CONFLICT (user_id, integration_id)
  DO UPDATE SET
    fusion_score = EXCLUDED.fusion_score,
    score_breakdown = EXCLUDED.score_breakdown,
    trend_direction = EXCLUDED.trend_direction,
    calculated_at = NOW(),
    adaptive_notes = EXCLUDED.adaptive_notes,
    updated_at = NOW();
  
  RETURN v_score;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Combined function: sync metrics AND recalculate score in one call
CREATE OR REPLACE FUNCTION public.sync_and_calculate_fusion_score(
  p_user_id UUID,
  p_integration_type TEXT,
  p_integration_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_metrics_count INTEGER := 0;
  v_score NUMERIC;
BEGIN
  -- Step 1: Sync integration_metrics to fusion_metrics
  v_metrics_count := public.sync_integration_metrics_to_fusion(p_user_id, p_integration_type, p_integration_id);
  
  -- Step 2: Recalculate fusion score
  v_score := public.recalculate_fusion_score(p_user_id, p_integration_id);
  
  -- Return results as JSONB
  RETURN jsonb_build_object(
    'fusion_score', v_score,
    'metrics_synced', v_metrics_count,
    'calculated_at', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.sync_integration_metrics_to_fusion(UUID, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_integration_metrics_to_fusion(UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_fusion_score(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.recalculate_fusion_score(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_and_calculate_fusion_score(UUID, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_and_calculate_fusion_score(UUID, TEXT, UUID) TO authenticated;

-- Comments
COMMENT ON FUNCTION public.sync_integration_metrics_to_fusion(UUID, TEXT, UUID) IS 'Syncs integration_metrics to fusion_metrics with normalization. Returns count of metrics synced.';
COMMENT ON FUNCTION public.recalculate_fusion_score(UUID, UUID) IS 'Recalculates Fusion Score from fusion_metrics. Returns the new score.';
COMMENT ON FUNCTION public.sync_and_calculate_fusion_score(UUID, TEXT, UUID) IS 'Combined: sync metrics and recalculate score. Returns JSONB with score and metrics count.';
