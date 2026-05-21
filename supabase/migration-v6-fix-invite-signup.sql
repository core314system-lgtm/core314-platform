-- ============================================================
-- Migration V6: Fix invite signup flow
-- - Update ensure_user_org to handle pending invitations
-- - Add missing INSERT policy on organizations
-- - Add UPDATE policy on org_invitations for the trigger
-- ============================================================

-- 1. Add missing INSERT policy on organizations (needed by trigger)
DO $$ BEGIN
  CREATE POLICY "Allow org creation"
    ON organizations FOR INSERT
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Allow the trigger to update org_invitations (mark as accepted)
DO $$ BEGIN
  CREATE POLICY "System can update invitations on accept"
    ON org_invitations FOR UPDATE
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Replace ensure_user_org to handle invite flow
CREATE OR REPLACE FUNCTION public.ensure_user_org()
RETURNS trigger AS $$
DECLARE
  new_org_id UUID;
  invite_record RECORD;
BEGIN
  -- Skip if user already has an organization membership
  IF EXISTS (SELECT 1 FROM organization_members WHERE user_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  -- Check for a pending invitation for this email
  SELECT id, org_id, role INTO invite_record
    FROM org_invitations
    WHERE email = NEW.email
      AND status = 'pending'
      AND expires_at > now()
    ORDER BY created_at DESC
    LIMIT 1;

  IF invite_record.id IS NOT NULL THEN
    -- Invitation found: join the invited org instead of creating a new one
    INSERT INTO organization_members (org_id, user_id, role)
    VALUES (invite_record.org_id, NEW.id, invite_record.role);

    UPDATE user_profiles SET current_org_id = invite_record.org_id WHERE id = NEW.id;

    -- Mark invitation as accepted
    UPDATE org_invitations
    SET status = 'accepted', accepted_at = now()
    WHERE id = invite_record.id;
  ELSE
    -- No invitation: create a personal organization
    INSERT INTO organizations (name, slug)
    VALUES (
      COALESCE(NEW.full_name, split_part(NEW.email, '@', 1)) || '''s Organization',
      'org-' || substr(gen_random_uuid()::text, 1, 8)
    )
    RETURNING id INTO new_org_id;

    INSERT INTO organization_members (org_id, user_id, role)
    VALUES (new_org_id, NEW.id, 'owner');

    UPDATE user_profiles SET current_org_id = new_org_id WHERE id = NEW.id;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block user signup even if org creation fails
  RAISE WARNING 'ensure_user_org failed for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
