-- =============================================
-- Procuvex: Global Admin Column Migration
-- Run this in Supabase SQL editor
-- =============================================

-- 1. Add is_global_admin column to user_profiles
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS is_global_admin boolean DEFAULT false;

-- 2. Set YOUR account as global admin
-- Replace the email below with your admin email if different
UPDATE user_profiles
SET is_global_admin = true
WHERE email = 'admin@core314.com';
