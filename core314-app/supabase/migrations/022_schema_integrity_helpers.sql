
CREATE OR REPLACE FUNCTION public.get_public_tables()
RETURNS TABLE(schemaname text, tablename text)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT schemaname::text, tablename::text
  FROM pg_tables
  WHERE schemaname = 'public'
  ORDER BY tablename;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_tables() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_tables() TO service_role;

CREATE TABLE IF NOT EXISTS public.system_schema_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  change_type TEXT NOT NULL,
  change_sql TEXT,
  status TEXT NOT NULL,
  applied_at TIMESTAMPTZ DEFAULT NOW(),
  error_message TEXT
);

ALTER TABLE public.system_schema_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "system_schema_audit_log_service_role" ON public.system_schema_audit_log;
CREATE POLICY "system_schema_audit_log_service_role" 
ON public.system_schema_audit_log
FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

COMMENT ON FUNCTION public.get_public_tables() IS 'Returns all tables in the public schema for schema integrity monitoring';
COMMENT ON TABLE public.system_schema_audit_log IS 'Tracks all schema changes and integrity checks performed on the database';
