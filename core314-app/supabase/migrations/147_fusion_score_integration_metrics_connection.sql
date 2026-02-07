-- ============================================================
-- Fusion Score Integration Metrics Connection
-- Connects integration_metrics to fusion_metrics so Fusion Score
-- reflects real integration activity
-- ============================================================

-- 1. Define weight mappings for integration metrics -> fusion metrics
-- These weights determine how much each metric type contributes to the Fusion Score
CREATE TABLE IF NOT EXISTS public.fusion_metric_weights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_type TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  fusion_weight NUMERIC DEFAULT 0.2 CHECK (fusion_weight >= 0 AND fusion_weight <= 1),
  normalization_max NUMERIC DEFAULT 100, -- Max value for normalization
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(integration_type, metric_name)
);

-- Seed default weights for each integration type
-- These are simple, static weights for MVP - can be adjusted later

-- Salesforce weights (CRM activity)
INSERT INTO public.fusion_metric_weights (integration_type, metric_name, fusion_weight, normalization_max, description) VALUES
('salesforce', 'account_count', 0.15, 1000, 'Total accounts - indicates CRM scale'),
('salesforce', 'opportunity_count', 0.20, 500, 'Total opportunities - indicates sales pipeline'),
('salesforce', 'open_opportunities', 0.25, 200, 'Open opportunities - indicates active deals'),
('salesforce', 'opportunity_value', 0.25, 1000000, 'Pipeline value - indicates revenue potential'),
('salesforce', 'open_cases', 0.15, 100, 'Open cases - indicates support load')
ON CONFLICT (integration_type, metric_name) DO NOTHING;

-- Slack weights (Communication activity)
INSERT INTO public.fusion_metric_weights (integration_type, metric_name, fusion_weight, normalization_max, description) VALUES
('slack', 'message_count', 0.30, 10000, 'Total messages - indicates communication volume'),
('slack', 'active_channels', 0.25, 100, 'Active channels - indicates collaboration breadth'),
('slack', 'total_members', 0.20, 500, 'Team members - indicates team size'),
('slack', 'active_members', 0.25, 100, 'Active members - indicates engagement')
ON CONFLICT (integration_type, metric_name) DO NOTHING;

-- Google Calendar weights
INSERT INTO public.fusion_metric_weights (integration_type, metric_name, fusion_weight, normalization_max, description) VALUES
('google_calendar', 'event_count', 0.30, 500, 'Total events - indicates scheduling activity'),
('google_calendar', 'upcoming_events', 0.35, 50, 'Upcoming events - indicates near-term activity'),
('google_calendar', 'meeting_hours', 0.35, 40, 'Meeting hours - indicates time commitment')
ON CONFLICT (integration_type, metric_name) DO NOTHING;

-- Zoom weights
INSERT INTO public.fusion_metric_weights (integration_type, metric_name, fusion_weight, normalization_max, description) VALUES
('zoom', 'meeting_count', 0.35, 100, 'Total meetings - indicates meeting activity'),
('zoom', 'total_participants', 0.30, 500, 'Total participants - indicates collaboration scale'),
('zoom', 'meeting_minutes', 0.35, 2000, 'Meeting minutes - indicates time in meetings')
ON CONFLICT (integration_type, metric_name) DO NOTHING;

-- QuickBooks weights (Financial activity)
INSERT INTO public.fusion_metric_weights (integration_type, metric_name, fusion_weight, normalization_max, description) VALUES
('quickbooks', 'total_revenue', 0.30, 1000000, 'Total revenue - indicates business scale'),
('quickbooks', 'invoice_count', 0.25, 500, 'Invoice count - indicates transaction volume'),
('quickbooks', 'unpaid_invoices', 0.25, 50, 'Unpaid invoices - indicates AR health'),
('quickbooks', 'customer_count', 0.20, 500, 'Customer count - indicates customer base')
ON CONFLICT (integration_type, metric_name) DO NOTHING;

-- Xero weights (Financial activity)
INSERT INTO public.fusion_metric_weights (integration_type, metric_name, fusion_weight, normalization_max, description) VALUES
('xero', 'total_revenue', 0.30, 1000000, 'Total revenue - indicates business scale'),
('xero', 'invoice_count', 0.25, 500, 'Invoice count - indicates transaction volume'),
('xero', 'overdue_invoices', 0.25, 50, 'Overdue invoices - indicates AR health'),
('xero', 'bank_balance', 0.20, 100000, 'Bank balance - indicates cash position')
ON CONFLICT (integration_type, metric_name) DO NOTHING;

-- Microsoft Teams weights
INSERT INTO public.fusion_metric_weights (integration_type, metric_name, fusion_weight, normalization_max, description) VALUES
('microsoft_teams', 'message_count', 0.30, 10000, 'Total messages - indicates communication volume'),
('microsoft_teams', 'channel_count', 0.25, 100, 'Channel count - indicates collaboration breadth'),
('microsoft_teams', 'team_count', 0.20, 50, 'Team count - indicates organizational structure'),
('microsoft_teams', 'active_users', 0.25, 100, 'Active users - indicates engagement')
ON CONFLICT (integration_type, metric_name) DO NOTHING;

-- RLS for fusion_metric_weights
ALTER TABLE public.fusion_metric_weights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view fusion metric weights"
ON public.fusion_metric_weights FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Service role can manage fusion metric weights"
ON public.fusion_metric_weights FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

GRANT ALL ON public.fusion_metric_weights TO service_role;
GRANT SELECT ON public.fusion_metric_weights TO authenticated;

-- 2. Function to sync integration_metrics to fusion_metrics
-- This reads from integration_metrics and writes normalized values to fusion_metrics
CREATE OR REPLACE FUNCTION public.sync_integration_metrics_to_fusion(
  p_user_id UUID,
  p_integration_type TEXT,
  p_integration_id UUID
)
RETURNS TABLE (
  metric_name TEXT,
  raw_value NUMERIC,
  normalized_value NUMERIC,
  weight NUMERIC
) AS $$
DECLARE
  v_metric RECORD;
  v_raw_value NUMERIC;
  v_normalized NUMERIC;
  v_weight NUMERIC;
  v_normalization_max NUMERIC;
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
    -- Using min-max normalization with configured max
    v_normalization_max := COALESCE(v_metric.normalization_max, 100);
    v_normalized := LEAST(v_raw_value / v_normalization_max, 1.0);
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
      'count', -- Default type
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
    
    -- Return the synced metric
    metric_name := v_metric.metric_name;
    raw_value := v_raw_value;
    normalized_value := v_normalized;
    weight := v_weight;
    RETURN NEXT;
  END LOOP;
  
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Function to recalculate Fusion Score for a user/integration
-- This reads from fusion_metrics and updates fusion_scores
CREATE OR REPLACE FUNCTION public.recalculate_fusion_score(
  p_user_id UUID,
  p_integration_id UUID
)
RETURNS TABLE (
  fusion_score NUMERIC,
  contributor_count INTEGER,
  score_breakdown JSONB
) AS $$
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
  
  -- Return results
  fusion_score := v_score;
  contributor_count := (SELECT COUNT(*) FROM public.fusion_metrics WHERE user_id = p_user_id AND integration_id = p_integration_id)::INTEGER;
  score_breakdown := v_breakdown;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Combined function: sync metrics AND recalculate score in one call
CREATE OR REPLACE FUNCTION public.sync_and_calculate_fusion_score(
  p_user_id UUID,
  p_integration_type TEXT,
  p_integration_id UUID
)
RETURNS TABLE (
  fusion_score NUMERIC,
  metrics_synced INTEGER,
  score_breakdown JSONB
) AS $$
DECLARE
  v_metrics_count INTEGER := 0;
  v_score NUMERIC;
  v_breakdown JSONB;
BEGIN
  -- Step 1: Sync integration_metrics to fusion_metrics
  SELECT COUNT(*) INTO v_metrics_count
  FROM public.sync_integration_metrics_to_fusion(p_user_id, p_integration_type, p_integration_id);
  
  -- Step 2: Recalculate fusion score
  SELECT rfs.fusion_score, rfs.score_breakdown 
  INTO v_score, v_breakdown
  FROM public.recalculate_fusion_score(p_user_id, p_integration_id) rfs;
  
  -- Return results
  fusion_score := v_score;
  metrics_synced := v_metrics_count;
  score_breakdown := v_breakdown;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.sync_integration_metrics_to_fusion(UUID, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_integration_metrics_to_fusion(UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_fusion_score(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.recalculate_fusion_score(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_and_calculate_fusion_score(UUID, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_and_calculate_fusion_score(UUID, TEXT, UUID) TO authenticated;

-- Comments
COMMENT ON TABLE public.fusion_metric_weights IS 'Defines weights for mapping integration_metrics to fusion_metrics';
COMMENT ON FUNCTION public.sync_integration_metrics_to_fusion(UUID, TEXT, UUID) IS 'Syncs integration_metrics to fusion_metrics with normalization';
COMMENT ON FUNCTION public.recalculate_fusion_score(UUID, UUID) IS 'Recalculates Fusion Score from fusion_metrics';
COMMENT ON FUNCTION public.sync_and_calculate_fusion_score(UUID, TEXT, UUID) IS 'Combined: sync metrics and recalculate score in one call';
