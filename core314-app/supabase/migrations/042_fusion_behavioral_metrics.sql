
CREATE TABLE IF NOT EXISTS public.fusion_behavioral_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_source TEXT NOT NULL,
  event_context JSONB DEFAULT '{}'::jsonb,
  outcome_reference UUID REFERENCES public.fusion_optimization_events(id) ON DELETE SET NULL,
  behavior_score NUMERIC(10,6),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_behavioral_metrics_event_type 
  ON public.fusion_behavioral_metrics(event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_behavioral_metrics_event_source 
  ON public.fusion_behavioral_metrics(event_source, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_behavioral_metrics_created_at 
  ON public.fusion_behavioral_metrics(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_behavioral_metrics_user_id 
  ON public.fusion_behavioral_metrics(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_behavioral_metrics_outcome_ref 
  ON public.fusion_behavioral_metrics(outcome_reference) 
  WHERE outcome_reference IS NOT NULL;

ALTER TABLE public.fusion_behavioral_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can view behavioral metrics"
  ON public.fusion_behavioral_metrics FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_platform_admin = TRUE
    )
  );

CREATE POLICY "Service role can insert behavioral metrics"
  ON public.fusion_behavioral_metrics FOR INSERT
  TO service_role
  WITH CHECK (TRUE);

CREATE POLICY "Service role can update behavioral metrics"
  ON public.fusion_behavioral_metrics FOR UPDATE
  TO service_role
  USING (TRUE);

COMMENT ON TABLE public.fusion_behavioral_metrics IS 
  'Phase 35: Stores user and system behavioral events for correlation with optimization outcomes';

COMMENT ON COLUMN public.fusion_behavioral_metrics.user_id IS 
  'User who triggered the event (NULL for system events)';

COMMENT ON COLUMN public.fusion_behavioral_metrics.event_type IS 
  'Type of behavioral event (e.g., workflow_trigger, parameter_adjustment, alert_response)';

COMMENT ON COLUMN public.fusion_behavioral_metrics.event_source IS 
  'Source of the event (e.g., frontend, automation, edge_function)';

COMMENT ON COLUMN public.fusion_behavioral_metrics.event_context IS 
  'Additional context data for the event (workflow_id, parameters, etc.)';

COMMENT ON COLUMN public.fusion_behavioral_metrics.outcome_reference IS 
  'Links to related optimization event if applicable';

COMMENT ON COLUMN public.fusion_behavioral_metrics.behavior_score IS 
  'Calculated behavior impact score (0-100, higher = more positive impact)';
