
CREATE TABLE IF NOT EXISTS public.rls_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pass', 'fail')),
  details JSONB NOT NULL,
  last_checked TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rls_audit_log_table_name ON public.rls_audit_log(table_name);
CREATE INDEX idx_rls_audit_log_status ON public.rls_audit_log(status);
CREATE INDEX idx_rls_audit_log_last_checked ON public.rls_audit_log(last_checked DESC);

ALTER TABLE public.rls_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can view rls_audit_log"
  ON public.rls_audit_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_platform_admin = true
    )
  );


COMMENT ON TABLE public.rls_audit_log IS 'Logs RLS audit results for all public schema tables';
COMMENT ON COLUMN public.rls_audit_log.table_name IS 'Name of the audited table or _SUMMARY_ for run-level summary';
COMMENT ON COLUMN public.rls_audit_log.status IS 'Audit result: pass or fail';
COMMENT ON COLUMN public.rls_audit_log.details IS 'Detailed audit information including RLS status, policy count, and policies';
COMMENT ON COLUMN public.rls_audit_log.last_checked IS 'Timestamp when the audit was performed';

CREATE OR REPLACE FUNCTION public.rls_audit_check(ignore_tables TEXT[] DEFAULT ARRAY[]::TEXT[])
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  pass_count INT := 0;
  fail_count INT := 0;
  issues JSONB := '[]'::JSONB;
  pol_count INT;
  pols JSONB;
  audit_run_id UUID;
BEGIN
  audit_run_id := gen_random_uuid();
  
  FOR rec IN
    SELECT 
      c.relname AS table_name,
      c.relrowsecurity AS rls_enabled
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')  -- Regular tables and partitioned tables only
      AND c.relname <> 'rls_audit_log'  -- Don't audit the audit log itself
      AND NOT (c.relname = ANY (ignore_tables))  -- Skip ignored tables
    ORDER BY c.relname
  LOOP
    SELECT 
      COUNT(*),
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'policyname', policyname,
            'cmd', cmd,
            'roles', roles,
            'permissive', permissive,
            'qual', qual,
            'with_check', with_check
          )
        ),
        '[]'::JSONB
      )
    INTO pol_count, pols
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = rec.table_name;

    IF rec.rls_enabled AND pol_count > 0 THEN
      pass_count := pass_count + 1;
      INSERT INTO public.rls_audit_log (table_name, status, details)
      VALUES (
        rec.table_name,
        'pass',
        jsonb_build_object(
          'audit_run_id', audit_run_id,
          'rls_enabled', rec.rls_enabled,
          'policy_count', pol_count,
          'policies', pols
        )
      );
    ELSE
      fail_count := fail_count + 1;
      INSERT INTO public.rls_audit_log (table_name, status, details)
      VALUES (
        rec.table_name,
        'fail',
        jsonb_build_object(
          'audit_run_id', audit_run_id,
          'rls_enabled', rec.rls_enabled,
          'policy_count', pol_count,
          'policies', pols,
          'reason', CASE
            WHEN NOT rec.rls_enabled THEN 'RLS not enabled'
            WHEN pol_count = 0 THEN 'No policies defined'
            ELSE 'Unknown'
          END
        )
      );
      
      issues := issues || jsonb_build_array(
        jsonb_build_object(
          'table', rec.table_name,
          'rls_enabled', rec.rls_enabled,
          'policy_count', pol_count,
          'reason', CASE
            WHEN NOT rec.rls_enabled THEN 'RLS not enabled'
            WHEN pol_count = 0 THEN 'No policies defined'
            ELSE 'Unknown'
          END
        )
      );
    END IF;
  END LOOP;

  INSERT INTO public.rls_audit_log (table_name, status, details)
  VALUES (
    '_SUMMARY_',
    CASE WHEN fail_count = 0 THEN 'pass' ELSE 'fail' END,
    jsonb_build_object(
      'audit_run_id', audit_run_id,
      'pass_count', pass_count,
      'fail_count', fail_count,
      'total_tables', pass_count + fail_count,
      'ignored_tables', ignore_tables,
      'issues', issues
    )
  );

  RETURN jsonb_build_object(
    'audit_run_id', audit_run_id,
    'pass_count', pass_count,
    'fail_count', fail_count,
    'total_tables', pass_count + fail_count,
    'issues', issues,
    'timestamp', NOW()
  );
END;
$$;

COMMENT ON FUNCTION public.rls_audit_check IS 'Audits all public schema tables for RLS configuration and logs results';

GRANT EXECUTE ON FUNCTION public.rls_audit_check TO authenticated;
