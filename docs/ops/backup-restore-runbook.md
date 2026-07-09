# Backup & Restore Runbook (Supabase daily backups)

Verifies that we can actually **recover** the Procuvex database — not just that
backups exist. "Have backups" ≠ "verified we can restore." This drill must be
performed once before the paid launch and re-run quarterly.

- **Production project ref:** `psmicdfnvgwsjkhkwoub`
- **Backup mechanism:** Supabase automated **daily** physical backups (WAL-G). PITR add-on is **NOT enabled** (`pitr_enabled: false`), so the effective recovery granularity is the daily backup cadence, not arbitrary point-in-time.
- **Retention:** ~7 days of daily backups.
- **Owner:** (assign) · **Last drill:** **2026-07-09 — PASS** (see "Drill results" below).

## Drill results — 2026-07-09

Method: logical dump/restore into a throwaway Supabase **free-tier** project
(`procuvex-restore-drill`), then row-count / timestamp / RLS parity checks, then
teardown. No production data was modified.

| Metric | Result |
| --- | --- |
| Public tables restored | 64 / 64, **row counts identical** to prod |
| `auth.users` | 30 / 30 restored |
| RLS policies (`public`) | 125 / 125 present |
| Latest `created_at` parity | identical on `organizations`, `master_subcontractors`, `account_usage`, `audit_events` |
| Security fixes present | `account_usage`→orgs FK absent (#794); admin-only `master_subcontractors` read (#792/#785); `shares_org_with()` present |
| **RTO** (dump + restore, ~28 MB / 176k+ rows) | **~40 s** (+ ~1 min one-time to provision a fresh target) |
| **RPO** (real prod posture) | **up to 24 h** — daily backups, no PITR. If sub-daily RPO is ever required, enable the paid PITR add-on and update the SLA text accordingly. |

### Gotchas discovered (bake into any future restore)
- Connect via the **session pooler** (`aws-1-us-west-2.pooler.supabase.com:5432`,
  user `postgres.<ref>`). The direct `db.<ref>.supabase.co` host is IPv6-only and
  unreachable from most CI/dev boxes; the transaction pooler (`:6543`) breaks `pg_dump`.
- The Supabase `postgres` role is **not a superuser**, so
  `pg_restore --disable-triggers` fails (`permission denied: "RI_ConstraintTrigger..." is a system trigger`).
  Instead load data in a **single session** with `SET session_replication_role = replica;`
  prepended — the `postgres` role IS allowed to set this, and it bypasses FK/RI
  and normal triggers during bulk load.
- A `--data-only` restore fails FK checks against `auth.users` unless auth data is
  present. Dump+load `auth.users` (data-only) **before** the public data.

> ⚠️ Do the drill by restoring into a **separate throwaway project**, never by
> rolling back production. A production PITR restore is destructive and
> overwrites current data.

## 0. Confirm backup posture (5 min)

Supabase Dashboard → Project `psmicdfnvgwsjkhkwoub` → **Database → Backups**.

- [ ] Confirm **daily backups** are current (most recent should be < 24 h old).
- [ ] Note the **retention window** (~7 days). This is the real max age we can
      recover to. Recovery granularity is the daily cadence — **PITR is not
      enabled**, so there is no arbitrary point-in-time restore.
- [ ] Reconcile with SLA text: `/sla` and the Security page must NOT promise
      "point-in-time recovery" while the PITR add-on is off (fixed in #796).

## 1. Prepare a restore target (10 min)

Two options — pick one:

**A. New Supabase project (cleanest, fully isolated).**
1. Create a new project in the same org/region (name it `procuvex-restore-drill`).
2. You'll restore a backup *into* this project (physical restore) if the plan
   supports cross-project restore, OR use the logical approach in step 2B.

**B. Logical dump/restore into throwaway project (works on any plan).**
Use `pg_dump`/`pg_restore` against a chosen point using a fresh project.

## 2. Perform the restore

### 2A. Dashboard PITR restore (if available on plan)
1. Dashboard → Database → Backups → **Point in Time**.
2. Choose a target timestamp a few minutes in the past.
3. Trigger the restore into the drill project (or a clone) — **not** production.
4. Wait for completion; note wall-clock time (this is our real RTO).

### 2B. Logical restore (portable, always works)
```bash
# 1. Dump current production schema+data (read-only; safe).
#    Get the DB connection string from Dashboard → Project Settings → Database.
pg_dump "postgresql://postgres:[PW]@db.psmicdfnvgwsjkhkwoub.supabase.co:5432/postgres" \
  --no-owner --no-privileges -Fc -f /tmp/procuvex-prod.dump

# 2. Restore into the throwaway drill project.
pg_restore --no-owner --no-privileges --clean --if-exists \
  -d "postgresql://postgres:[PW]@db.<DRILL_REF>.supabase.co:5432/postgres" \
  /tmp/procuvex-prod.dump
```

## 3. Verify data integrity (15 min)

Run against the **restored** project and compare to production counts.

```sql
-- Row counts on the tables that matter most.
select 'organizations' t, count(*) from organizations
union all select 'user_profiles', count(*) from user_profiles
union all select 'projects', count(*) from projects
union all select 'master_subcontractors', count(*) from master_subcontractors
union all select 'sub_connections', count(*) from sub_connections
union all select 'account_usage', count(*) from account_usage
order by t;

-- Spot-check referential integrity + a known recent record.
select id, name, subscription_plan, created_at
from organizations order by created_at desc limit 5;

-- Confirm RLS policies came across.
select tablename, count(*) policies
from pg_policies where schemaname = 'public'
group by tablename order by tablename;
```

Checklist:
- [ ] Row counts match production (± records written after the restore point).
- [ ] Newest records present up to the chosen recovery timestamp.
- [ ] RLS policies exist on `master_subcontractors`, `sub_connections`,
      `sub_access_log`, `account_usage`.
- [ ] Auth/storage: note that `auth.users` and Storage objects are backed up
      separately by Supabase — confirm they are included or documented as a gap.

## 4. Record results

Fill in and commit (or store in the ops log):
- Restore method used: ______
- **RTO** (time to a usable restored DB): ______
- **RPO** (data loss window at chosen point): ______
- Integrity check: PASS / FAIL — notes: ______
- Gaps found (e.g. storage objects, auth users, retention shorter than SLA): ______

## 5. Tear down
- [ ] Delete the drill project / throwaway DB.
- [ ] Delete local dump: `rm -f /tmp/procuvex-prod.dump`.

## Known gaps to close before relying on this
- SLA (`/sla`) claims PITR — confirm the enabled retention window matches the
  promise, and that a real restore has been completed (this drill).
- Confirm **Storage bucket** contents (uploaded documents, capability statements)
  are covered by a backup/restore path — PITR covers Postgres, not necessarily
  Storage objects.

## Nightly logical backup (GitHub Actions → Supabase Storage)

To reduce the effective RPO and keep a portable, downloadable copy of the
database, a nightly logical dump is uploaded to a **private** Supabase Storage
bucket (`db-backups`). This protects against the most common risks — accidental
deletes, bad migrations, logical corruption — and gives a copy you can pull down
and restore anywhere. (Note: it lives in the same Supabase project, so it is not
isolated from a project-level Supabase incident; that trade-off was accepted to
avoid a second vendor.)

- **Workflow:** `.github/workflows/db-backup.yml` (cron `10 7 * * *` UTC, plus
  `workflow_dispatch` for manual runs). Installs the pg17 client (prod is 17.x).
- **Script:** `scripts/db-backup.sh` — `pg_dump --format=custom` via the session
  pooler, uploaded to `db-backups/daily/procuvex-db-<ts>.dump` via the Storage
  REST API, then prunes archives older than `RETENTION_DAYS` (default 14).
- **Destination:** private bucket (not public), encrypted at rest by Supabase.
  The project's global Storage file-size limit was raised to 500 MB to allow for
  growth (dump is ~28 MB today).
- **Required GitHub Actions secrets:** `SUPABASE_DB_URL`,
  `SUPABASE_SERVICE_ROLE_KEY`. (`SUPABASE_URL`, bucket, and retention are set
  inline in the workflow.)

### Restore from a Supabase Storage dump

```bash
# Download the dump (service-role key required — the bucket is private):
curl -s "$SUPABASE_URL/storage/v1/object/db-backups/daily/<file>.dump" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -o restore.dump
# Restore into a throwaway/target project:
pg_restore --no-owner --no-privileges --dbname "$TARGET_DB_URL" restore.dump
```

Note: this dump is Postgres only. Storage objects and `auth.users` handling
follow the same caveats documented above (load `auth.users` before public data
when doing a full cross-project restore).
