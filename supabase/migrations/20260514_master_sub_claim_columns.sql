-- Phase 2: Add claiming and outreach columns to master_subcontractors
-- Run this in Supabase SQL Editor

-- Add claim-related columns
ALTER TABLE master_subcontractors
  ADD COLUMN IF NOT EXISTS claim_token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS claim_token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS claimed_by_user_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS outreach_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS outreach_email_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_outreach_email_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS profile_updated_at TIMESTAMPTZ;

-- Index for token lookups (used during claim flow)
CREATE INDEX IF NOT EXISTS idx_master_sub_claim_token ON master_subcontractors(claim_token) WHERE claim_token IS NOT NULL;

-- Index for outreach targeting (unclaimed subs with email)
CREATE INDEX IF NOT EXISTS idx_master_sub_outreach_targets ON master_subcontractors(contact_email, outreach_sent_at) WHERE contact_email IS NOT NULL AND claimed_at IS NULL;

-- Allow the sub to update their own profile after claiming
CREATE POLICY "Claimed subs can update their own profile"
  ON master_subcontractors FOR UPDATE
  USING (claimed_by_user_id = auth.uid())
  WITH CHECK (claimed_by_user_id = auth.uid());

-- Allow public read of claim token for claim flow (token lookup)
CREATE POLICY "Anyone can look up a claim token"
  ON master_subcontractors FOR SELECT
  USING (true);
