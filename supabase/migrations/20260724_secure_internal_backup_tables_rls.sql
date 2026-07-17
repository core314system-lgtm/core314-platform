-- Secure internal maintenance/backup tables so they are not readable by anon
-- or authenticated clients via PostgREST.
--
-- These tables were created by one-off cleanup/bookkeeping operations and hold
-- pre-change snapshots (some containing PII) plus migration bookkeeping. They
-- must only be reachable via the service_role (which bypasses RLS). Enabling RLS
-- with no policy denies all client roles; REVOKE removes the PostgREST grant as
-- defense in depth. Statements are idempotent so this is safe to re-run.

DO $$
DECLARE
  t text;
  tbls text[] := ARRAY[
    'master_subcontractors_trade_backup',
    'founding_partner_cleanup_backup',
    'session_test_accounts_backup',
    '_ci_schema_migrations'
  ];
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    IF to_regclass('public.' || quote_ident(t)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
      EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated;', t);
    END IF;
  END LOOP;
END $$;
