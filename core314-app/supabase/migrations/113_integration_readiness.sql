-- Migration: 113_integration_readiness.sql
-- Purpose: Create integration_readiness table for storing readiness evaluation results
-- Scope: Database schema only, admin/internal use only, no UX changes
-- Note: This table stores READ-ONLY evaluation results. Promotion to observing state is a separate step.

-- Create integration_readiness table
CREATE TABLE IF NOT EXISTS public.integration_readiness (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_key TEXT NOT NULL,
  eligible BOOLEAN NOT NULL DEFAULT false,
  reason TEXT,
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add comment for documentation
COMMENT ON TABLE public.integration_readiness IS 'Stores readiness evaluation results for integration maturity promotion. This function only evaluates readiness. Promotion is a separate step.';
COMMENT ON COLUMN public.integration_readiness.integration_key IS 'Integration identifier, e.g. slack, teams, jira';
COMMENT ON COLUMN public.integration_readiness.eligible IS 'Whether the integration is eligible for promotion to observing state';
COMMENT ON COLUMN public.integration_readiness.reason IS 'Explanation of why the integration is or is not eligible';
COMMENT ON COLUMN public.integration_readiness.evaluated_at IS 'Timestamp when the evaluation was performed';

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_integration_readiness_key ON public.integration_readiness(integration_key);
CREATE INDEX IF NOT EXISTS idx_integration_readiness_eligible ON public.integration_readiness(eligible);
CREATE INDEX IF NOT EXISTS idx_integration_readiness_evaluated_at ON public.integration_readiness(evaluated_at DESC);

-- Enable RLS
ALTER TABLE public.integration_readiness ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Service role only, no user access
-- Drop any existing policies first
DROP POLICY IF EXISTS "Service role full access to integration_readiness" ON public.integration_readiness;

-- Service role has full access
CREATE POLICY "Service role full access to integration_readiness"
  ON public.integration_readiness
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- No policies for authenticated users - they cannot access this table
-- No policies for anon users - they cannot access this table
