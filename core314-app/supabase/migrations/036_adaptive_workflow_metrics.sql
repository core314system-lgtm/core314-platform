
-- ============================================================================
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.adaptive_workflow_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  trigger_source TEXT NOT NULL,
  outcome TEXT NOT NULL,
  confidence_score NUMERIC(5,4) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_adaptive_workflow_metrics_workflow_id 
  ON public.adaptive_workflow_metrics(workflow_id);
CREATE INDEX IF NOT EXISTS idx_adaptive_workflow_metrics_event_type 
  ON public.adaptive_workflow_metrics(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_adaptive_workflow_metrics_trigger_source 
  ON public.adaptive_workflow_metrics(trigger_source, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_adaptive_workflow_metrics_outcome 
  ON public.adaptive_workflow_metrics(outcome, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_adaptive_workflow_metrics_created_at 
  ON public.adaptive_workflow_metrics(created_at DESC);

COMMENT ON TABLE public.adaptive_workflow_metrics IS 'Stores telemetry data for adaptive workflow intelligence and learning';
COMMENT ON COLUMN public.adaptive_workflow_metrics.workflow_id IS 'Reference to the workflow instance being tracked';
COMMENT ON COLUMN public.adaptive_workflow_metrics.event_type IS 'Type of event (e.g., integration_triggered, recovery_attempted, workflow_completed)';
COMMENT ON COLUMN public.adaptive_workflow_metrics.trigger_source IS 'Source that triggered the workflow (e.g., slack, teams, stripe, self_healing)';
COMMENT ON COLUMN public.adaptive_workflow_metrics.outcome IS 'Result of the workflow (e.g., success, failure, partial, retry_scheduled)';
COMMENT ON COLUMN public.adaptive_workflow_metrics.confidence_score IS 'AI confidence score (0.0 to 1.0) for the workflow decision';
COMMENT ON COLUMN public.adaptive_workflow_metrics.metadata IS 'Additional context as JSON for future extensibility';

-- ============================================================================
-- ============================================================================

ALTER TABLE public.adaptive_workflow_metrics ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'adaptive_workflow_metrics'
      AND policyname = 'Platform admins can view adaptive workflow metrics'
  ) THEN
    CREATE POLICY "Platform admins can view adaptive workflow metrics"
      ON public.adaptive_workflow_metrics FOR SELECT
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
      AND tablename = 'adaptive_workflow_metrics'
      AND policyname = 'Service role can manage adaptive workflow metrics'
  ) THEN
    CREATE POLICY "Service role can manage adaptive workflow metrics"
      ON public.adaptive_workflow_metrics FOR ALL
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
