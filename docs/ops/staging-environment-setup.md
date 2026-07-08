# Staging Environment Setup

Goal: a pre-production environment that **mirrors production but uses a separate
database**, so changes (and load tests / authenticated test flows) can be
validated without risking prod data or tripping edge protection.

Today: PRs → deploy previews → prod. Deploy previews build the frontend per-PR
but their Netlify Functions talk to the **production** Supabase project
(`psmicdfnvgwsjkhkwoub`). So previews are **not** a safe place for destructive or
high-volume testing. Staging fixes that by pointing a dedicated site at a
dedicated database.

- **Prod Netlify site:** `core314-taskorder`
- **Prod Supabase project:** `psmicdfnvgwsjkhkwoub`

## Option A — Supabase Branching (recommended, lowest effort)

Supabase "branches" spin up an isolated Postgres per git branch and run your
migrations automatically.

1. **Enable branching** — Supabase Dashboard → project `psmicdfnvgwsjkhkwoub` →
   **Branches** → enable (requires Pro plan + GitHub integration).
2. **Create a persistent `staging` branch** in Supabase pointing at the repo's
   `staging` git branch. Supabase applies migrations from `supabase/migrations`.
3. **Create the `staging` git branch** and set it as the base for pre-prod work.
4. It provisions a branch DB with its own URL + anon/service keys.

## Option B — Separate Supabase project (max isolation)

1. Create a new project `procuvex-staging` (same region as prod).
2. Apply all migrations:
   ```bash
   supabase link --project-ref <STAGING_REF>
   supabase db push        # or run supabase/migrations/*.sql in order
   ```
3. Seed representative (non-PII) test data — a few orgs across each plan tier,
   sample projects, and a handful of `master_subcontractors`.

## Netlify staging site

1. Netlify → **Add new site → Import** the same repo.
2. Set **Production branch = `staging`** so pushes to `staging` deploy here.
3. Build settings identical to prod (same build command / publish dir /
   functions dir as `core314-taskorder`).
4. **Environment variables** — copy prod's set but repoint the DB ones at the
   staging DB/branch:
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` → staging values
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` → staging values
   - `OPENAI_API_KEY` → a **separate key with a low budget cap** (so load/AI
     tests can't drain the prod key)
   - Email (Mailgun/SendGrid) → sandbox/test domain or a suppressed sender so
     staging never emails real people
   - Stripe → **test-mode** keys + test price IDs (never live Stripe in staging)
5. Custom domain (optional): `staging.procuvex.com`.

## Guardrails (do not skip)
- [ ] Staging uses a **different** Supabase project/branch than prod (verify the
      URL differs from `psmicdfnvgwsjkhkwoub`).
- [ ] Stripe in **test mode** only.
- [ ] Email routed to a sandbox/suppressed sender.
- [ ] Separate, budget-capped `OPENAI_API_KEY`.
- [ ] `robots` noindex + optional basic-auth on the staging site so it isn't
      publicly discoverable/indexed.

## Verify it mirrors prod
- [ ] Sign up / log in works against the staging DB.
- [ ] Create a project + run an AI analysis (hits staging DB + budget-capped key).
- [ ] Confirm no rows appear in the **prod** DB during the above.
- [ ] Run the load tests against staging:
      `k6 run -e BASE_URL=https://staging.procuvex.com load-tests/api-stats.js`
      (now safe to push harder, since it's an isolated DB).

## What this unblocks
- Heavy / authenticated **load testing** (item 2) against a real DB without prod
  impact or single-IP edge blocking.
- A safe target for the **backup restore drill** and future migration rehearsals.
- Regression catching before prod for every future change.
