-- RLS Hardening: Remove overly permissive INSERT policy on profiles
-- 
-- This migration removes the "Allow inserts during signup" policy which had
-- WITH CHECK (true), allowing any insert without id = auth.uid() enforcement.
--
-- Profile creation is handled by the handle_new_user() trigger which:
-- - Runs with SECURITY DEFINER
-- - Is owned by postgres (bypasses RLS even with FORCE ROW LEVEL SECURITY)
-- - Sets profiles.id = NEW.id (auth.users.id)
--
-- Existing strict policies remain:
-- - "Users can insert own profile" - FOR INSERT TO authenticated WITH CHECK (id = auth.uid())
-- - "Service role can insert profiles" - FOR INSERT TO service_role WITH CHECK (true)

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Allow inserts during signup" ON public.profiles;

-- Also clean up duplicate policy (both enforce the same constraint)
-- Keep "Users can insert own profile" and drop the duplicate
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

-- Verify the remaining INSERT policies are strict:
-- 1. "Users can insert own profile" - enforces id = auth.uid() for authenticated users
-- 2. "Service role can insert profiles" - allows service_role for admin operations
