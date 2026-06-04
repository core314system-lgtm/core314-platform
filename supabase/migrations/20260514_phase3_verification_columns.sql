-- Phase 3: Add verification, payment, and matching columns
-- Run this in Supabase SQL Editor

-- Add verification-related columns to master_subcontractors
ALTER TABLE master_subcontractors
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS verification_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS capability_narrative TEXT;

-- Add reminder tracking to certifications table
ALTER TABLE master_sub_certifications
  ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS file_url TEXT,
  ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMPTZ DEFAULT now();

-- Function to increment match count (called by auto-match engine)
CREATE OR REPLACE FUNCTION increment_match_count(sub_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE master_subcontractors
  SET match_count = COALESCE(match_count, 0) + 1
  WHERE id = sub_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Unique index on sam_uei (required for bulk import upsert de-duplication)
CREATE UNIQUE INDEX IF NOT EXISTS idx_master_sub_sam_uei ON master_subcontractors(sam_uei) WHERE sam_uei IS NOT NULL;

-- Index for verified subs (used in priority search)
CREATE INDEX IF NOT EXISTS idx_master_sub_verified ON master_subcontractors(verification_status, profile_completeness DESC) WHERE verification_status = 'verified';

-- Index for expiration monitoring
CREATE INDEX IF NOT EXISTS idx_master_sub_cert_expiration ON master_sub_certifications(expiration_date) WHERE expiration_date IS NOT NULL AND reminder_sent_at IS NULL;
