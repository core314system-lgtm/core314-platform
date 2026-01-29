-- Migration: Trial Abuse Protection
-- Purpose: Create trial_attempts table to track and prevent trial abuse
-- Policy:
--   1. One free trial per EMAIL (lifetime)
--   2. One free trial per COMPANY DOMAIN (lifetime, excluding consumer domains)
--   3. Max 2 free trials per IP address per rolling 30-day window
--   4. Block disposable/temporary email domains

-- Create trial_attempts table
CREATE TABLE IF NOT EXISTS trial_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  domain TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_trial_attempts_email ON trial_attempts(email);
CREATE INDEX IF NOT EXISTS idx_trial_attempts_domain ON trial_attempts(domain);
CREATE INDEX IF NOT EXISTS idx_trial_attempts_ip_address ON trial_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_trial_attempts_created_at ON trial_attempts(created_at);

-- Composite index for IP + date range queries (rolling 30-day window)
CREATE INDEX IF NOT EXISTS idx_trial_attempts_ip_created ON trial_attempts(ip_address, created_at DESC);

-- RLS: Disabled for this table (backend-only access via service role)
-- This table should only be accessed by server-side functions with service_role key
ALTER TABLE trial_attempts ENABLE ROW LEVEL SECURITY;

-- No RLS policies = only service_role can access
-- This is intentional: trial_attempts is a backend-only enforcement table

-- Add comment for documentation
COMMENT ON TABLE trial_attempts IS 'Backend-only table for tracking trial signups to prevent abuse. Accessed only via service_role.';
COMMENT ON COLUMN trial_attempts.email IS 'Normalized email address (lowercase)';
COMMENT ON COLUMN trial_attempts.domain IS 'Email domain extracted from email address';
COMMENT ON COLUMN trial_attempts.ip_address IS 'Client IP address at time of trial signup';
COMMENT ON COLUMN trial_attempts.created_at IS 'Timestamp of trial attempt for rolling window calculations';
