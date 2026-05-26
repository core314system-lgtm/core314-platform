-- Migration: 112_integration_maturity.sql
-- Purpose: Create integration_maturity table for future intelligence promotion logic
-- Scope: Database schema only, admin/internal use only, no UX changes

-- Create integration_maturity table
CREATE TABLE IF NOT EXISTS public.integration_maturity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_key TEXT NOT NULL,
  maturity_state TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Enforce allowed maturity_state values
  CONSTRAINT integration_maturity_state_check CHECK (
    maturity_state IN ('connected', 'observing', 'candidate', 'active_intelligence')
  )
);

-- Add comment for documentation
COMMENT ON TABLE public.integration_maturity IS 'Tracks maturity state of integrations for future intelligence promotion logic. Internal use only.';
COMMENT ON COLUMN public.integration_maturity.integration_key IS 'Integration identifier, e.g. slack, teams, jira';
COMMENT ON COLUMN public.integration_maturity.maturity_state IS 'Current maturity state: connected, observing, candidate, active_intelligence';
COMMENT ON COLUMN public.integration_maturity.reason IS 'Optional reason for current state or state transition';

-- Create index for common queries
CREATE INDEX IF NOT EXISTS idx_integration_maturity_key ON public.integration_maturity(integration_key);
CREATE INDEX IF NOT EXISTS idx_integration_maturity_state ON public.integration_maturity(maturity_state);

-- Enable RLS
ALTER TABLE public.integration_maturity ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Service role only, no user access
-- Drop any existing policies first
DROP POLICY IF EXISTS "Service role full access to integration_maturity" ON public.integration_maturity;

-- Service role has full access
CREATE POLICY "Service role full access to integration_maturity"
  ON public.integration_maturity
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- No policies for authenticated users - they cannot access this table
-- No policies for anon users - they cannot access this table
