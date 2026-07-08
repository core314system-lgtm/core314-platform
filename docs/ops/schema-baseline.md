# Schema baseline & reproducibility

## The gap

The foundational tables that the entire app depends on —
`organizations`, `user_profiles`, `master_subcontractors`,
`organization_members`, `company_profile`, `sow_quotes`, and others — are **not
created by any file in `supabase/migrations/`**. They were applied directly to
the production database (via the SQL editor / ad‑hoc `MIGRATION_*.sql` files at
the repo root) outside version control.

Consequence: running the 25 files in `supabase/migrations/` against an empty
database fails immediately, because they `ALTER`/reference tables that were
never `CREATE`d in the migration set. The production schema is therefore **not
reproducible from code** — a real disaster‑recovery risk (recovery depends on
Supabase backups, not on the repository).

## The baseline

`supabase/baseline/prod_public_schema.sql` is a `pg_dump --schema-only
--schema=public --no-owner` snapshot of the **production** `public` schema. It
is the authoritative, reproducible definition of the current schema (64 tables,
125 RLS policies, all helper functions, and the RLS hardening from #792/#794).
It contains **no data and no secrets**.

This baseline has been verified: the `procuvex-staging` Supabase project was
rebuilt from this exact dump and passed a full signup → AI‑proxy →
rate‑limit E2E.

## Rebuild a fresh environment

```bash
# 1) load the baseline (public schema)
psql "$TARGET_DB_URL" -f supabase/baseline/prod_public_schema.sql

# 2) recreate the new‑user trigger (it lives in the auth schema, which the
#    public‑only dump does not include)
psql "$TARGET_DB_URL" -c "CREATE TRIGGER on_auth_user_created \
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();"

# 3) apply any migrations dated AFTER this snapshot
```

## Recommended follow‑up (needs a decision)

To make `supabase/migrations` self‑consistent going forward, **squash**: replace
the 25 partial migrations with this baseline as migration `0000`, then start new
migrations after it. That is a workflow change affecting how schema is applied,
so it is intentionally left as a separate, reviewed step rather than bundled
here.

## Regenerating the baseline

After a schema change reaches production, refresh the snapshot:

```bash
pg_dump --schema-only --schema=public --no-owner \
  -h aws-1-us-west-2.pooler.supabase.com -p 5432 \
  -U postgres.psmicdfnvgwsjkhkwoub -d postgres \
  -f supabase/baseline/prod_public_schema.sql
```
