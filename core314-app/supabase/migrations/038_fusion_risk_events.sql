-- ============================================================================
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.fusion_risk_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  predicted_variance NUMERIC(10,6) NOT NULL,
  predicted_stability NUMERIC(10,6) NOT NULL,
  risk_category TEXT NOT NULL CHECK (risk_category IN ('Stable', 'Moderate Risk', 'High Risk')),
  action_taken TEXT NOT NULL CHECK (action_taken IN ('maintain', 'reinforce', 'reset')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fusion_risk_events_event_type 
  ON public.fusion_risk_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fusion_risk_events_risk_category 
  ON public.fusion_risk_events(risk_category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fusion_risk_events_created_at 
  ON public.fusion_risk_events(created_at DESC);

COMMENT ON TABLE public.fusion_risk_events IS 'Tracks automated risk response actions taken by Fusion Risk Engine';
COMMENT ON COLUMN public.fusion_risk_events.event_type IS 'Type of event being monitored (e.g., integration_triggered)';
COMMENT ON COLUMN public.fusion_risk_events.predicted_variance IS 'Predicted variance from Phase 29 forecasting';
COMMENT ON COLUMN public.fusion_risk_events.predicted_stability IS 'Predicted stability index from Phase 29 forecasting';
COMMENT ON COLUMN public.fusion_risk_events.risk_category IS 'Risk level: Stable, Moderate Risk, or High Risk';
COMMENT ON COLUMN public.fusion_risk_events.action_taken IS 'Action applied: maintain, reinforce, or reset';

-- ============================================================================
-- ============================================================================

ALTER TABLE public.fusion_risk_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'fusion_risk_events'
      AND policyname = 'Platform admins can view fusion risk events'
  ) THEN
    CREATE POLICY "Platform admins can view fusion risk events"
      ON public.fusion_risk_events FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.id = auth.uid()
          AND profiles.is_platform_admin = true
        )
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'fusion_risk_events'
      AND policyname = 'Service role can manage fusion risk events'
  ) THEN
    CREATE POLICY "Service role can manage fusion risk events"
      ON public.fusion_risk_events FOR ALL
      TO authenticated
      USING (
        (auth.jwt() ->> 'role') = 'service_role'
      )
      WITH CHECK (
        (auth.jwt() ->> 'role') = 'service_role'
      );
  END IF;
END
$$;

-- ============================================================================
-- ============================================================================
