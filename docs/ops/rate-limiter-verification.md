# Rate Limiter — Production Verification

Confirms the per-plan AI/API/email rate limiter is actually blocking requests in
production (not silently passing). Part of pre-public-launch hardening.

## Background

- Real enforcement lives in `netlify/functions/_shared/rate-limiter.ts`
  (`checkRateLimit`), used by `ai-proxy`, `send-rfq`, `submit-question`,
  `notify-modification`, `send-invite`.
- Limits (per org, per rolling window):

  | Plan | AI calls/hr | Emails/hr | API calls/min |
  |------|-------------|-----------|---------------|
  | Growth | 30 | 50 | 60 |
  | Enterprise | 999 | 200 | 120 |
  | Trialing | 30 | 50 | 60 |
  | No subscription | 5 | 10 | 20 |
  | Org with a global-admin member | treated as Enterprise | | |

- Usage is counted from the `account_usage` table (migration deployed
  2026-06 — without it the limiter silently passes everything).

## Prerequisites

1. A **dedicated test organization** UUID. Every allowed call consumes that
   org's real hourly quota and writes to `account_usage`. **Never** run against a
   paying customer's org. Easiest: use an org with **no subscription** (limit
   5/hr) so the test needs only ~6 calls.
2. The test org should have **no recent `ai_call` usage** this hour for a clean
   result (the window is rolling 1 hour).
3. Node 18+ (for global `fetch`).

### Getting / preparing a test org
```sql
-- Find a non-customer org to use, or note an existing throwaway org id:
select id, name, subscription_plan, subscription_status
from organizations
where subscription_status is null or subscription_status = 'no_subscription'
limit 10;

-- (Optional) clear this hour's ai_call usage for a clean run:
delete from account_usage
where org_id = '<TEST_ORG_UUID>'
  and action_type = 'ai_call'
  and created_at >= now() - interval '1 hour';
```

## Run

```bash
# Against production, no-subscription org (limit 5/hr)
ORG_ID=<TEST_ORG_UUID> EXPECTED_LIMIT=5 node scripts/verify-rate-limiter.mjs

# Against a deploy preview instead
ORG_ID=<TEST_ORG_UUID> EXPECTED_LIMIT=5 \
  BASE_URL=https://deploy-preview-XXX--core314-taskorder.netlify.app \
  node scripts/verify-rate-limiter.mjs
```

Expected output (clean no_subscription window):
```
  call #1: allowed (200)  limit=5 ...
  ...
  call #5: allowed (200)
  call #6: BLOCKED (429)  limit=5 current=5
RESULT: first 429 at call #6 (after 5 allowed calls this window).
PASS: limiter enforced at or below the 5/hr limit.
```

## Cost & safety notes
- Blocked (429) calls are rejected **before** any OpenAI request → $0.
- Allowed calls make a `gpt-4o-mini` request with `max_tokens: 1` → a fraction of
  a cent each (≈6 calls for a no_subscription org).
- Clean up afterward if desired:
  ```sql
  delete from account_usage where org_id = '<TEST_ORG_UUID>' and action_type = 'ai_call'
    and created_at >= now() - interval '1 hour';
  ```

## Findings to address (discovered while building this)
1. **`netlify/functions/rate-limit.mts` is orphaned** — no caller in `src/` or
   `netlify/`. It also duplicates the plan-limit table (missing `api_call`) and
   has **no auth**. Recommend deleting it or, if intended as a public pre-check,
   consolidating it onto `_shared/rate-limiter.ts` and adding auth.
2. **`ai-proxy` (and peers) accept `org_id` from the request body with no
   authentication.** Anyone who knows an org UUID can consume that org's AI quota
   / trigger AI calls. The limiter caps the blast radius, but consider requiring
   a valid Supabase JWT and deriving `org_id` from it rather than trusting the
   body. Flagged for the security backlog (out of scope for this hardening pass).
