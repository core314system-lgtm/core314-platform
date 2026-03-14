-- Fix infinite recursion in organization_members RLS policies
-- The org_members_select_policy used a subquery on organization_members itself,
-- which triggered other RLS policies recursively, causing "infinite recursion detected"
-- for any authenticated user trying to query their memberships.
DROP POLICY IF EXISTS "org_members_select_policy" ON organization_members;

-- The remaining policies are sufficient:
-- "Users can view own memberships" (auth.uid() = user_id) - no recursion
-- "Users can view org members" uses user_is_member_of_org() which is SECURITY DEFINER - safe
-- "Admins can manage members" uses user_is_admin_of_org() which is SECURITY DEFINER - safe

-- Add first_name and last_name columns to organization_invitations for richer invite emails
ALTER TABLE organization_invitations ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE organization_invitations ADD COLUMN IF NOT EXISTS last_name TEXT;
