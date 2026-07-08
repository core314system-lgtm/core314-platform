# Backup & Restore Runbook (Supabase PITR)

Verifies that we can actually **recover** the Procuvex database — not just that
backups exist. "Have backups" ≠ "verified we can restore." This drill must be
performed once before the paid launch and re-run quarterly.

- **Production project ref:** `psmicdfnvgwsjkhkwoub`
- **Backup mechanism:** Supabase automated backups + Point-in-Time Recovery (PITR)
- **Owner:** (assign) · **Last drill:** _not yet performed_

> ⚠️ Do the drill by restoring into a **separate throwaway project**, never by
> rolling back production. A production PITR restore is destructive and
> overwrites current data.

## 0. Confirm backup posture (5 min)

Supabase Dashboard → Project `psmicdfnvgwsjkhkwoub` → **Database → Backups**.

- [ ] PITR is **enabled** (requires at least the Pro plan + PITR add-on).
- [ ] Note the **retention window** (e.g. 7 days). This is the real max age we
      can recover to — reconcile it with the SLA text (`/sla` promises "point-in-time
      recovery"; make sure the promised window matches what's actually enabled).
- [ ] Note the earliest restorable timestamp and that WAL is current.

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
