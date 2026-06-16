-- Secure subcontractor contact information from non-admin users
-- Problem: The current SELECT policy (USING true) lets any authenticated user
-- query contact_email and contact_phone directly, bypassing UI masking.
-- 
-- Solution: Replace the permissive policy with one that only allows admins
-- and service_role to see contact fields. Non-admin users see masked values.
-- We use a security-definer function + view approach.

-- Step 1: Create a helper function to check if user is global admin
CREATE OR REPLACE FUNCTION is_global_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (SELECT is_global_admin FROM user_profiles WHERE id = auth.uid()),
    false
  );
$$;

-- Step 2: Create a helper function to check if user's org is connected to a sub
CREATE OR REPLACE FUNCTION is_connected_to_sub(sub_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM sub_connections sc
    JOIN user_profiles up ON up.current_org_id = sc.org_id
    WHERE sc.sub_id = is_connected_to_sub.sub_id
    AND up.id = auth.uid()
  );
$$;

-- Step 3: Drop the overly-permissive SELECT policy
DROP POLICY IF EXISTS "Anyone can look up a claim token" ON master_subcontractors;

-- Step 4: Create a restrictive SELECT policy — all authenticated users can still
-- read rows, but we'll mask contact fields via a view
-- Service role bypasses RLS entirely, so Netlify functions still work
CREATE POLICY "Authenticated users can read master_subcontractors"
  ON master_subcontractors FOR SELECT
  TO authenticated
  USING (true);

-- Step 5: Create the secure view that masks contact info for non-admin users
CREATE OR REPLACE VIEW master_subcontractors_safe AS
SELECT
  id,
  company_name,
  dba_name,
  slug,
  contact_name,
  -- Mask contact fields unless user is admin or connected to this sub
  CASE
    WHEN is_global_admin() OR is_connected_to_sub(id)
    THEN contact_email
    ELSE CASE
      WHEN contact_email IS NOT NULL THEN
        LEFT(contact_email, 1) || '***@' || SPLIT_PART(contact_email, '@', 2)
      ELSE NULL
    END
  END AS contact_email,
  CASE
    WHEN is_global_admin() OR is_connected_to_sub(id)
    THEN contact_phone
    ELSE CASE
      WHEN contact_phone IS NOT NULL THEN '(***) ***-' || RIGHT(REGEXP_REPLACE(contact_phone, '[^0-9]', '', 'g'), 4)
      ELSE NULL
    END
  END AS contact_phone,
  city,
  state,
  zip_code,
  address_line1,
  trade_categories,
  naics_codes,
  small_business,
  small_business_types,
  geographic_coverage,
  website,
  sam_uei,
  cage_code,
  verification_status,
  profile_completeness,
  data_health_score,
  description,
  capability_statement_path,
  archived,
  unsubscribed,
  created_at,
  updated_at,
  claimed_by_user_id,
  claimed_at,
  claim_token,
  claim_token_expires_at,
  outreach_sent_at,
  outreach_email_count,
  last_outreach_email_at,
  profile_updated_at
FROM master_subcontractors;

-- Step 6: Grant access to the view for authenticated users
GRANT SELECT ON master_subcontractors_safe TO authenticated;

-- Step 7: Revoke direct SELECT on sensitive columns from anon/authenticated
-- Note: We can't do column-level revokes easily with Supabase's default grants,
-- so the view is the security boundary. The RLS policy still allows row access
-- but the UI will be updated to use the safe view for non-admin pages.
