-- ============================================================================
-- Fix RLS data exposure on master_subcontractors and user_profiles
--
-- Verified live against production (non-admin authenticated user):
--   * master_subcontractors raw table was readable by ANY authenticated user
--     (176k+ rows, unmasked contact emails) via blanket "Public/Anon read"
--     policies that override the intended admin-only + masked-view design.
--   * user_profiles was readable by ANY authenticated user (all emails, names,
--     and is_global_admin flags) via a "Users can view all profiles" policy.
--
-- This migration removes the permissive policies and replaces them with
-- correctly-scoped ones. Non-admins read subcontractors ONLY through the
-- masked master_subcontractors_safe view; they read user_profiles only for
-- their own row, fellow org members, or (for admins) everyone.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Helper: does the current user share an organization with target_user?
-- SECURITY DEFINER so it bypasses RLS on organization_members (no recursion).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION shares_org_with(target_user UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1
    FROM organization_members a
    JOIN organization_members b ON a.org_id = b.org_id
    WHERE a.user_id = auth.uid()
      AND b.user_id = target_user
  );
$$;

-- ============================================================================
-- 1. master_subcontractors — remove blanket-permissive policies
-- ============================================================================

-- Blanket read policies that expose the raw table (the whole point of the
-- masked view was to prevent this). Drop every known permissive variant.
DROP POLICY IF EXISTS "Public read master subs"                       ON master_subcontractors;
DROP POLICY IF EXISTS "Anon read master subs"                         ON master_subcontractors;
DROP POLICY IF EXISTS "Authenticated users can read master_subcontractors" ON master_subcontractors;
DROP POLICY IF EXISTS "Anyone can look up a claim token"              ON master_subcontractors;

-- Blanket write policies (any authenticated user could insert/edit any row).
DROP POLICY IF EXISTS "Auth insert master subs" ON master_subcontractors;
DROP POLICY IF EXISTS "Auth update master subs" ON master_subcontractors;

-- Keep (already present, correct): "Only admins can read raw master_subcontractors",
-- "Service role master subs", "Claimed subs can update their own profile".

-- Admin write access (replaces the blanket authenticated write policies).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'master_subcontractors' AND policyname = 'Admins manage master subs') THEN
    CREATE POLICY "Admins manage master subs"
      ON master_subcontractors FOR ALL TO authenticated
      USING (is_global_admin())
      WITH CHECK (is_global_admin());
  END IF;
END $$;

-- Non-admins consume the masked view; make sure it is readable by anon too
-- (the view masks contact fields for anyone who is not an admin/connected).
GRANT SELECT ON master_subcontractors_safe TO anon, authenticated;

-- Table-level privilege hygiene: anon has no business touching the raw table,
-- and nobody outside service_role should be able to TRUNCATE it (TRUNCATE is
-- NOT gated by RLS). Admin CRUD still works via the RLS policies above, which
-- require the authenticated role to retain SELECT/INSERT/UPDATE/DELETE grants.
REVOKE ALL ON master_subcontractors FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON master_subcontractors FROM authenticated;

-- ============================================================================
-- 2. user_profiles — scope profile reads (own / same-org / admin)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view all profiles" ON user_profiles;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_profiles' AND policyname = 'Users read own, same-org, or admin') THEN
    CREATE POLICY "Users read own, same-org, or admin"
      ON user_profiles FOR SELECT TO authenticated
      USING (
        id = auth.uid()
        OR is_global_admin()
        OR shares_org_with(id)
      );
  END IF;
END $$;

-- ============================================================================
-- 3. Cleanup: remove throwaway accounts created during rate-limiter testing
--    (disposable inbox signups, no org, no data).
-- ============================================================================
DELETE FROM auth.users
WHERE email LIKE 'devintest_%@web-library.net'
   OR email LIKE 'devincheck_%@web-library.net'
   OR email LIKE 'devinsub_%@web-library.net';
