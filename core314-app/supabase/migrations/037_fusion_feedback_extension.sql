-- ============================================================================
-- ============================================================================

ALTER TABLE public.adaptive_workflow_metrics
  ADD COLUMN IF NOT EXISTS feedback_score NUMERIC(5,4) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS adjustment_type TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_adaptive_workflow_metrics_feedback_score
  ON public.adaptive_workflow_metrics(feedback_score DESC)
  WHERE feedback_score IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_adaptive_workflow_metrics_adjustment_type
  ON public.adaptive_workflow_metrics(adjustment_type, created_at DESC)
  WHERE adjustment_type IS NOT NULL;

COMMENT ON COLUMN public.adaptive_workflow_metrics.feedback_score IS 'Closed-loop feedback score (0.80 to 0.98) from Fusion Feedback Loop';
COMMENT ON COLUMN public.adaptive_workflow_metrics.adjustment_type IS 'Feedback adjustment type: reinforce, tune, or reset';

-- ============================================================================
-- ============================================================================
