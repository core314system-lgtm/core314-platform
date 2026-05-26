-- ============================================================
-- Migration V4b: Fix self-referencing RLS on organization_members
-- The original policies had a circular dependency that blocked reads.
-- This fix uses a SECURITY DEFINER helper function to bypass RLS
-- in the subquery, breaking the circular reference.
-- ============================================================

-- 1. Create helper function (bypasses RLS for the inner lookup)
CREATE OR REPLACE FUNCTION public.get_user_org_ids(uid UUID)
RETURNS SETOF UUID AS $$
  SELECT org_id FROM organization_members WHERE user_id = uid;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 2. Drop old policies
DROP POLICY IF EXISTS "Users can view members of their orgs" ON organization_members;
DROP POLICY IF EXISTS "Org owners/admins can manage members" ON organization_members;
DROP POLICY IF EXISTS "Org owners/admins can update members" ON organization_members;
DROP POLICY IF EXISTS "Org owners/admins can remove members" ON organization_members;

-- 3. Recreate with helper function
CREATE POLICY "Users can view members of their orgs"
  ON organization_members FOR SELECT
  USING (org_id IN (SELECT public.get_user_org_ids(auth.uid())));

CREATE POLICY "Org owners/admins can manage members"
  ON organization_members FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT om.org_id FROM organization_members om
      WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Org owners/admins can update members"
  ON organization_members FOR UPDATE
  USING (
    org_id IN (
      SELECT om.org_id FROM organization_members om
      WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Org owners/admins can remove members"
  ON organization_members FOR DELETE
  USING (
    org_id IN (
      SELECT om.org_id FROM organization_members om
      WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin')
    )
    OR user_id = auth.uid()
  );
