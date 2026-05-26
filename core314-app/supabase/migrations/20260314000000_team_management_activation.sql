-- ============================================================================
-- Migration: Team Management Activation
-- ============================================================================
-- Activates team management by:
-- 1. Updating organizations.plan CHECK constraint to match current tier names
-- 2. Migrating existing plan values to new names
-- 3. Ensuring all required SQL functions exist
-- 4. Adding auto-org creation trigger for new users
-- ============================================================================

-- ============================================================================
-- PART 1: Update organizations.plan CHECK constraint
-- ============================================================================

-- Drop the old constraint
ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS organizations_plan_check;

-- Migrate existing plan values to new tier names
UPDATE public.organizations SET plan = 'intelligence' WHERE plan = 'starter';
UPDATE public.organizations SET plan = 'command_center' WHERE plan = 'professional';

-- Add new constraint with current tier names
ALTER TABLE public.organizations 
ADD CONSTRAINT organizations_plan_check 
CHECK (plan IN ('monitor', 'intelligence', 'command_center', 'enterprise'));

-- Update default
ALTER TABLE public.organizations ALTER COLUMN plan SET DEFAULT 'intelligence';

-- ============================================================================
-- PART 2: Auto-create organization for new users (trigger)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user_organization()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_org_id UUID;
  v_user_email TEXT;
BEGIN
  -- Get user email
  v_user_email := NEW.email;
  
  -- Check if user already has an organization membership
  IF EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = NEW.id) THEN
    RETURN NEW;
  END IF;
  
  -- Create a default organization for the new user
  INSERT INTO public.organizations (name, owner_id, plan, status)
  VALUES (
    COALESCE(split_part(v_user_email, '@', 1), 'My') || '''s Organization',
    NEW.id,
    'intelligence',
    'active'
  )
  RETURNING id INTO v_org_id;
  
  -- Add user as owner
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org_id, NEW.id, 'owner');
  
  RETURN NEW;
END;
$$;

-- Create trigger on profiles table (fires after profile creation on signup)
DROP TRIGGER IF EXISTS on_profile_created_create_org ON public.profiles;
CREATE TRIGGER on_profile_created_create_org
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_organization();

-- ============================================================================
-- PART 3: Ensure existing users without orgs get one
-- ============================================================================

DO $$
DECLARE
  user_record RECORD;
  new_org_id UUID;
BEGIN
  FOR user_record IN 
    SELECT au.id, au.email
    FROM auth.users au
    WHERE NOT EXISTS (
      SELECT 1 FROM public.organization_members om WHERE om.user_id = au.id
    )
  LOOP
    INSERT INTO public.organizations (name, owner_id, plan, status)
    VALUES (
      COALESCE(split_part(user_record.email, '@', 1), 'My') || '''s Organization',
      user_record.id,
      'intelligence',
      'active'
    )
    RETURNING id INTO new_org_id;
    
    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (new_org_id, user_record.id, 'owner');
  END LOOP;
END $$;

-- ============================================================================
-- PART 4: Add viewer role to invitation table if missing
-- ============================================================================

ALTER TABLE public.organization_invitations DROP CONSTRAINT IF EXISTS organization_invitations_role_check;
ALTER TABLE public.organization_invitations 
ADD CONSTRAINT organization_invitations_role_check 
CHECK (role IN ('admin', 'analyst', 'member', 'viewer'));

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON FUNCTION public.handle_new_user_organization IS 'Auto-creates a default organization when a new user profile is created';
