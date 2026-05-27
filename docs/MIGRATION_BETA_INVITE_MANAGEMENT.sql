-- =============================================
-- Procuvex: Beta Invite Management Enhancement
-- Run this in Supabase SQL editor
-- =============================================

-- 1. Add notes column for invitation tags/context
ALTER TABLE beta_invitations
  ADD COLUMN IF NOT EXISTS notes text DEFAULT NULL;
