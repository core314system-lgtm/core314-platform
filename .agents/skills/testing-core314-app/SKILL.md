# Testing Core314 App (Authenticated Pages)

## Overview
Core314 is a Supabase-backed React app (Vite + TypeScript) with 4 Phase 1 authenticated pages:
- `/brief` — Operational Brief (AI narrative)
- `/signals` — Signal Dashboard
- `/health` — Health Score
- `/integration-manager` — Integration Manager

## Devin Secrets Needed
- `CORE314_SUPABASE_URL` — Supabase project URL (https://ygvkegcstaowikessigx.supabase.co)
- `CORE314_SUPABASE_ANON_KEY` — Supabase anon key for frontend auth
- `CORE314_SUPABASE_SERVICE_ROLE_KEY` — Service role key for inserting test data and creating test users
- `SUPABASE_DASHBOARD_EMAIL` — Email for Supabase dashboard login (core314system@gmail.com)
- `SUPABASE_DASHBOARD_PASSWORD` — Password for Supabase dashboard (cannot log in via browser due to CAPTCHA, but useful for reference)

## Local Dev Setup
1. Navigate to `core314-app/`
2. Set environment variables:
   ```bash
   export VITE_SUPABASE_URL="$CORE314_SUPABASE_URL"
   export VITE_SUPABASE_ANON_KEY="$CORE314_SUPABASE_ANON_KEY"
   ```
3. Run `npm install && npm run dev -- --port 5174`
4. App will be at http://localhost:5174

## Creating a Test User
Use the Supabase Auth Admin API with the service role key:
```bash
curl -X POST "$CORE314_SUPABASE_URL/auth/v1/admin/users" \
  -H "apikey: $CORE314_SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $CORE314_SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email": "core314-test@example.com", "password": "TestPass123!", "email_confirm": true}'
```
Save the returned user `id` for inserting test data.

## Inserting Test Data
Use the Supabase REST API with service role key to insert into:
- `operational_signals` — 6 signals (2 per integration: HubSpot, Slack, QuickBooks)
- `operational_health_scores` — At least 2 entries for trend comparison
- `operational_briefs` — 1 brief with detected_signals, business_impact, recommended_actions, risk_assessment

Example insert pattern:
```bash
curl -X POST "$CORE314_SUPABASE_URL/rest/v1/operational_signals" \
  -H "apikey: $CORE314_SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $CORE314_SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -d '[{...signal data...}]'
```

## Known Issues

### Supabase JSONB Double-Encoding
**Critical:** Supabase JSONB columns may return JSON strings instead of parsed objects/arrays. For example, `detected_signals` might come back as `"[\"item1\", \"item2\"]"` (a string) rather than `["item1", "item2"]` (an array).

This causes `.map()` crashes like:
- `TypeError: brief.detected_signals.map is not a function`
- `TypeError: Cannot read properties of undefined (reading 'length')`

**Workaround:** The frontend uses `parseJsonArray()` and `parseJsonObject()` helper functions that try `JSON.parse()` on string values before falling back. If you see similar crashes on new pages, apply the same pattern.

### Database Migrations
Cannot connect directly to Supabase PostgreSQL from the Devin VM (network restrictions). Options:
1. Provide SQL to the user to run in the Supabase SQL Editor
2. Use the Supabase REST API for data operations (INSERT/SELECT/UPDATE)
3. The Supabase dashboard has CAPTCHA that blocks automated login

### Onboarding Modal
New test users may see an onboarding modal on first login. Click "Skip setup for now" to dismiss it.

## Testing Procedure
1. Start app server with Core314 credentials
2. Log in as test user at http://localhost:5174/login
3. Dismiss onboarding modal if shown
4. Navigate to each page via sidebar:
   - Operational Brief → verify health score, signals, business impact, actions, risk assessment
   - Signal Dashboard → verify signal count, source breakdown, severity filters
   - Health Score → verify score circle, breakdown, history
   - Integration Manager → verify 3 service cards, connection status
5. Check browser console for errors on each page

## Important Notes
- **Do NOT confuse with CashFlowAssurance project** (doaaxjlpcvqqptzctsos). Core314 uses project ygvkegcstaowikessigx.
- The `integration_registry` table in Core314 does NOT have an `icon_url` column (unlike CFA). Omit it from INSERT statements.
- Netlify deploys for the app are at: https://deploy-preview-{PR_NUMBER}--polite-mochi-fc5be5.netlify.app
- Landing page deploys separately at: core314-landing on Netlify
