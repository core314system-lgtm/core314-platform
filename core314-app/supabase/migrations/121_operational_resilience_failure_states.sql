-- ============================================================
-- Phase 10A: Operational Resilience & Failure Containment
-- Adds explicit failure state tracking to integration_intelligence
-- ============================================================

-- Add failure state columns to integration_intelligence
-- These columns enable:
-- 1. Tracking when intelligence was last successfully computed
-- 2. Tracking when failures occurred and why
-- 3. Preserving last known good data on failure (by not overwriting metrics)
-- 4. Excluding failed integrations from Fusion Score calculation

ALTER TABLE public.integration_intelligence
ADD COLUMN IF NOT EXISTS last_successful_run_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_failed_run_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS failure_reason TEXT;

-- Index for efficient querying of failed integrations
-- Used by Fusion Score calculation to exclude failed integrations
CREATE INDEX IF NOT EXISTS idx_integration_intelligence_failure 
ON public.integration_intelligence(failure_reason) 
WHERE failure_reason IS NOT NULL;

-- Index for querying by last successful run (useful for staleness detection)
CREATE INDEX IF NOT EXISTS idx_integration_intelligence_last_success 
ON public.integration_intelligence(last_successful_run_at DESC);

-- Comments for documentation
COMMENT ON COLUMN public.integration_intelligence.last_successful_run_at IS 
'Timestamp of last successful intelligence computation. Updated only on success.';

COMMENT ON COLUMN public.integration_intelligence.last_failed_run_at IS 
'Timestamp of last failed intelligence computation. Updated only on failure.';

COMMENT ON COLUMN public.integration_intelligence.failure_reason IS 
'Short description of failure reason (e.g., timeout, query_error, rate_limit). NULL means healthy. When set, Fusion Score excludes this integration.';

-- ============================================================
-- Failure State Semantics:
-- 
-- HEALTHY STATE:
--   failure_reason IS NULL
--   last_successful_run_at >= last_failed_run_at (or last_failed_run_at IS NULL)
--   Metrics are current and valid
--   Fusion Score includes this integration
--
-- FAILED STATE:
--   failure_reason IS NOT NULL
--   last_failed_run_at > last_successful_run_at
--   Metrics are frozen at last known good values
--   Fusion Score EXCLUDES this integration
--
-- ZERO-DATA STATE (NOT a failure):
--   failure_reason IS NULL
--   Metrics may be 0 or minimal
--   trend_direction = 'stable'
--   anomaly_detected = false
--   Fusion Score includes this integration (with low contribution)
-- ============================================================
