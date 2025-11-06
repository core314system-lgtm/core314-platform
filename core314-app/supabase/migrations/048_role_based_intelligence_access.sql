
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$
DECLARE 
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%role%'
  LOOP
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS %I', r.conname);
    RAISE NOTICE 'Dropped constraint: %', r.conname;
  END LOOP;
END
$$;

ALTER TABLE public.profiles 
  ADD CONSTRAINT profiles_role_check_phase41
  CHECK (role IN ('admin', 'manager', 'user', 'platform_admin', 'operator', 'end_user'))
  NOT VALID;

ALTER TABLE public.profiles VALIDATE CONSTRAINT profiles_role_check_phase41;

ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON public.profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

UPDATE public.profiles 
SET role = 'platform_admin'
WHERE is_platform_admin = TRUE 
  AND role IN ('admin', 'manager', 'user');

ALTER TABLE public.fusion_audit_log 
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.fusion_audit_log 
  ADD COLUMN IF NOT EXISTS user_role TEXT;

CREATE INDEX IF NOT EXISTS idx_fusion_audit_log_user_id ON public.fusion_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_fusion_audit_log_user_role ON public.fusion_audit_log(user_role);

DROP POLICY IF EXISTS "Platform admins can view optimization events" ON public.fusion_optimization_events;
DROP POLICY IF EXISTS "Operators can view optimization events" ON public.fusion_optimization_events;
DROP POLICY IF EXISTS "End users can view own org optimization events" ON public.fusion_optimization_events;
DROP POLICY IF EXISTS "Service role can manage optimization events" ON public.fusion_optimization_events;

CREATE POLICY "Platform admins can manage optimization events"
  ON public.fusion_optimization_events FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND (profiles.is_platform_admin = TRUE OR profiles.role = 'platform_admin')
    )
  );

CREATE POLICY "Operators can view optimization events"
  ON public.fusion_optimization_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('operator', 'admin', 'manager')
    )
  );

CREATE POLICY "End users can view own org optimization events"
  ON public.fusion_optimization_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('end_user', 'user')
        AND (
          profiles.organization_id IS NULL
          OR profiles.organization_id = (
            SELECT organization_id FROM public.profiles WHERE id = auth.uid()
          )
        )
    )
  );

CREATE POLICY "Service role can manage optimization events"
  ON public.fusion_optimization_events FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Platform admins can view behavioral metrics" ON public.fusion_behavioral_metrics;
DROP POLICY IF EXISTS "Operators can view behavioral metrics" ON public.fusion_behavioral_metrics;
DROP POLICY IF EXISTS "End users can view own org behavioral metrics" ON public.fusion_behavioral_metrics;
DROP POLICY IF EXISTS "Service role can manage behavioral metrics" ON public.fusion_behavioral_metrics;

CREATE POLICY "Platform admins can manage behavioral metrics"
  ON public.fusion_behavioral_metrics FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND (profiles.is_platform_admin = TRUE OR profiles.role = 'platform_admin')
    )
  );

CREATE POLICY "Operators can view behavioral metrics"
  ON public.fusion_behavioral_metrics FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('operator', 'admin', 'manager')
    )
  );

CREATE POLICY "End users can view own org behavioral metrics"
  ON public.fusion_behavioral_metrics FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('end_user', 'user')
    )
  );

CREATE POLICY "Service role can manage behavioral metrics"
  ON public.fusion_behavioral_metrics FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Platform admins can view prediction events" ON public.fusion_prediction_events;
DROP POLICY IF EXISTS "Operators can view prediction events" ON public.fusion_prediction_events;
DROP POLICY IF EXISTS "End users can view own org prediction events" ON public.fusion_prediction_events;
DROP POLICY IF EXISTS "Service role can manage prediction events" ON public.fusion_prediction_events;

CREATE POLICY "Platform admins can manage prediction events"
  ON public.fusion_prediction_events FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND (profiles.is_platform_admin = TRUE OR profiles.role = 'platform_admin')
    )
  );

CREATE POLICY "Operators can view prediction events"
  ON public.fusion_prediction_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('operator', 'admin', 'manager')
    )
  );

CREATE POLICY "End users can view own org prediction events"
  ON public.fusion_prediction_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('end_user', 'user')
    )
  );

CREATE POLICY "Service role can manage prediction events"
  ON public.fusion_prediction_events FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Platform admins can view calibration events" ON public.fusion_calibration_events;
DROP POLICY IF EXISTS "Operators can view calibration events" ON public.fusion_calibration_events;
DROP POLICY IF EXISTS "Service role can manage calibration events" ON public.fusion_calibration_events;

CREATE POLICY "Platform admins can manage calibration events"
  ON public.fusion_calibration_events FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND (profiles.is_platform_admin = TRUE OR profiles.role = 'platform_admin')
    )
  );

CREATE POLICY "Operators can view calibration events"
  ON public.fusion_calibration_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('operator', 'admin', 'manager')
    )
  );

CREATE POLICY "Service role can manage calibration events"
  ON public.fusion_calibration_events FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Platform admins can view audit log" ON public.fusion_audit_log;
DROP POLICY IF EXISTS "Operators can view audit log" ON public.fusion_audit_log;
DROP POLICY IF EXISTS "Service role can manage audit log" ON public.fusion_audit_log;

CREATE POLICY "Platform admins can manage audit log"
  ON public.fusion_audit_log FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND (profiles.is_platform_admin = TRUE OR profiles.role = 'platform_admin')
    )
  );

CREATE POLICY "Operators can view audit log"
  ON public.fusion_audit_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('operator', 'admin', 'manager')
    )
  );

CREATE POLICY "Service role can manage audit log"
  ON public.fusion_audit_log FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Platform admins can view orchestrator events" ON public.fusion_orchestrator_events;
DROP POLICY IF EXISTS "Operators can view orchestrator events" ON public.fusion_orchestrator_events;
DROP POLICY IF EXISTS "Service role can manage orchestrator events" ON public.fusion_orchestrator_events;

CREATE POLICY "Platform admins can manage orchestrator events"
  ON public.fusion_orchestrator_events FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND (profiles.is_platform_admin = TRUE OR profiles.role = 'platform_admin')
    )
  );

CREATE POLICY "Operators can view orchestrator events"
  ON public.fusion_orchestrator_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('operator', 'admin', 'manager')
    )
  );

CREATE POLICY "Service role can manage orchestrator events"
  ON public.fusion_orchestrator_events FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Platform admins can view system insights" ON public.fusion_system_insights;
DROP POLICY IF EXISTS "Operators can view system insights" ON public.fusion_system_insights;
DROP POLICY IF EXISTS "End users can view system insights" ON public.fusion_system_insights;
DROP POLICY IF EXISTS "Service role can manage system insights" ON public.fusion_system_insights;

CREATE POLICY "Platform admins can manage system insights"
  ON public.fusion_system_insights FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND (profiles.is_platform_admin = TRUE OR profiles.role = 'platform_admin')
    )
  );

CREATE POLICY "Operators can view system insights"
  ON public.fusion_system_insights FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('operator', 'admin', 'manager')
    )
  );

CREATE POLICY "End users can view system insights"
  ON public.fusion_system_insights FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('end_user', 'user')
    )
  );

CREATE POLICY "Service role can manage system insights"
  ON public.fusion_system_insights FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

CREATE OR REPLACE FUNCTION public.check_user_role(required_role TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_role TEXT;
  is_platform_admin BOOLEAN;
BEGIN
  SELECT role, is_platform_admin INTO user_role, is_platform_admin
  FROM public.profiles
  WHERE id = auth.uid();
  
  IF is_platform_admin = TRUE OR user_role = 'platform_admin' THEN
    RETURN TRUE;
  END IF;
  
  IF required_role = 'operator' THEN
    RETURN user_role IN ('operator', 'admin', 'manager');
  ELSIF required_role = 'end_user' THEN
    RETURN user_role IN ('end_user', 'user');
  ELSE
    RETURN user_role = required_role;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_organization()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  org_id UUID;
BEGIN
  SELECT organization_id INTO org_id
  FROM public.profiles
  WHERE id = auth.uid();
  
  RETURN org_id;
END;
$$;

COMMENT ON COLUMN public.profiles.role IS 
  'User role: platform_admin (full access), operator (read-only AI metrics), end_user (own org data only), admin/manager/user (legacy roles)';

COMMENT ON COLUMN public.profiles.organization_id IS 
  'Organization membership for data isolation - end_users can only see their own organization data';

COMMENT ON COLUMN public.fusion_audit_log.user_id IS 
  'Phase 41: User who triggered the audited action';

COMMENT ON COLUMN public.fusion_audit_log.user_role IS 
  'Phase 41: Role of user who triggered the audited action';

COMMENT ON FUNCTION public.check_user_role(TEXT) IS 
  'Phase 41: Helper function to check if current user has required role';

COMMENT ON FUNCTION public.get_user_organization() IS 
  'Phase 41: Helper function to get current user organization ID';

-- ============================================================================
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '=== Phase 41 Migration Complete ===';
  RAISE NOTICE 'Role constraint updated: profiles_role_check_phase41';
  RAISE NOTICE 'Allowed roles: admin, manager, user, platform_admin, operator, end_user';
  RAISE NOTICE 'Organization column added: profiles.organization_id';
  RAISE NOTICE 'Audit tracking columns added: fusion_audit_log.user_id, fusion_audit_log.user_role';
  RAISE NOTICE 'RLS policies created for 7 AI subsystem tables';
  RAISE NOTICE 'Helper functions created: check_user_role(), get_user_organization()';
END
$$;
