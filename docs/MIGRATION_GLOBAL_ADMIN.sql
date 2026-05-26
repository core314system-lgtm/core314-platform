-- =============================================
-- Procuvex: Global Admin Column Migration
-- Run this in Supabase SQL editor
-- =============================================

-- 1. Add is_global_admin column to user_profiles
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS is_global_admin boolean DEFAULT false;

-- 2. Set the primary admin account as global admin
UPDATE user_profiles
SET is_global_admin = true
WHERE email = 'freshsaltyair@gmail.com';

-- To grant/revoke global admin for other users in the future:
-- UPDATE user_profiles SET is_global_admin = true WHERE email = 'someone@example.com';
-- UPDATE user_profiles SET is_global_admin = false WHERE email = 'someone@example.com';
