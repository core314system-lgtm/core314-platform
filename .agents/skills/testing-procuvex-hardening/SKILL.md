---
name: testing-procuvex-hardening
description: Test platform hardening features (404 page, error boundaries, input sanitization, rate limiting) on procuvex.com. Use when verifying security and resilience changes.
---

# Testing Procuvex Hardening Features

## Devin Secrets Needed
- `TASKORDER_SUPABASE_SERVICE_ROLE_KEY` — for direct DB queries if needed
- `TASKORDER_SUPABASE_ANON_KEY` — for API calls
- `TASKORDER_OPENAI_API_KEY` — AI proxy uses this
- `TASKORDER_SENDGRID_API_KEY` — email functions use this
- Login credentials for the test account (freshsaltyair@gmail.com)

## Test Environment
- Production: https://procuvex.com
- API base: https://procuvex.com/.netlify/functions/
- Netlify functions are at `netlify/functions/*.mts`
- Shared utilities at `netlify/functions/_shared/` (rate-limiter.ts, sanitize.ts)

## Key Endpoints for Hardening Tests
- `POST /ai-proxy` — AI calls, accepts `org_id` for rate limiting, `messages` array
- `POST /submit-question` — question submission, requires `task_order_id` (UUID validated)
- `POST /send-invite` — invitations, requires `org_id` (UUID validated), `email` (format validated)
- `POST /send-rfq` — RFQ emails, requires `task_order_id` (UUID validated), `sow_subcontractor_ids` array

## Testing the 404 Page
1. Navigate to any non-existent path (e.g., `/this-page-does-not-exist-xyz`)
2. Verify: `<h1>404</h1>`, `<h2>Page not found</h2>`, "Go to Dashboard" link, "Go Back" button
3. Click "Go to Dashboard" — should navigate to `/dashboard`
4. The old behavior was a silent redirect to `/` — if you see that, the 404 page is broken

## Testing Error Boundaries
The ErrorBoundary is a React class component. To trigger it in production:

1. Find the React 18 container key (changes on each page load):
   ```js
   const rootEl = document.getElementById('root');
   const containerKey = Object.keys(rootEl).find(k => k.includes('__reactContainer'));
   ```
2. Walk the fiber tree to find ErrorBoundary nodes (look for `getDerivedStateFromError`):
   ```js
   const fiber = rootEl[containerKey];
   let innerEB = null;
   function walk(n, depth) {
     if (!n || depth > 300) return;
     const t = n.type;
     if (t && typeof t === 'function' && (t.getDerivedStateFromError || (t.prototype && t.prototype.componentDidCatch))) {
       if (depth > 10) innerEB = n;
     }
     if (n.child) walk(n.child, depth + 1);
     if (n.sibling) walk(n.sibling, depth + 1);
   }
   walk(fiber, 0);
   ```
3. Trigger the error state: `innerEB.stateNode.setState({ hasError: true, error: new Error('Test') })`
4. Verify fallback: "Something went wrong" heading, "Try Again" + "Go to Dashboard" buttons, "Technical details" collapsible
5. Click "Try Again" to verify recovery

**Important:** The React container key changes on every page navigation. Always re-discover it before walking the tree. Previous key format was `__reactContainer$mkdd0lciv9`, but it can be any random suffix.

There should be 2 ErrorBoundary instances: one at depth ~2 (top-level App wrapper in main.tsx) and one at depth ~24 (ProtectedRoute wrapper in App.tsx).

## Testing Input Sanitization
Use curl to test API endpoints:

```bash
# UUID validation — expect 400 with specific error messages
curl -s -w "\nHTTP: %{http_code}" -X POST https://procuvex.com/.netlify/functions/submit-question \
  -H "Content-Type: application/json" \
  -d '{"question_text": "test", "task_order_id": "not-a-uuid"}'
# Expected: {"error":"Invalid task order ID"} HTTP 400

# XSS stripping — expect AI to respond to clean text
curl -s -X POST https://procuvex.com/.netlify/functions/ai-proxy \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "<script>alert(1)</script>What is 2+2?"}]}'
# Expected: AI responds about "2+2", script tags stripped

# Email validation — expect 400
curl -s -X POST https://procuvex.com/.netlify/functions/send-invite \
  -H "Content-Type: application/json" \
  -d '{"org_id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", "email": "<script>alert(1)</script>notanemail", "role": "member"}'
# Expected: {"error":"Invalid email address"} HTTP 400
```

**Note on send-rfq:** The required field is `sow_subcontractor_ids` (not `subcontractor_ids`). If you pass the wrong field name, you'll get "Missing required fields" before UUID validation runs.

## Testing Rate Limiting
Rate limiting requires the `account_usage` table in Supabase. If the table doesn't exist:
- The rate limiter catches the "42P01" (relation not found) error
- It gracefully returns `allowed: true` — all requests pass through
- This is the designed behavior, NOT a bug

To verify graceful degradation: make 7+ rapid calls and confirm no 500 errors.

To test actual 429 enforcement (after migration):
- `no_subscription` tier: 5 AI calls/hr, 10 emails/hr
- Use a non-existent org_id to force `no_subscription` tier
- Make 6+ rapid calls to `/ai-proxy` with `org_id` parameter
- Call 6 should return HTTP 429 with `Retry-After` header

## Testing Stripe Checkout / Payment Features

### Generating a Stripe Checkout Session
The `create-checkout` endpoint does NOT require authentication — it only needs `plan_id`, `user_email`, and `org_id` in the POST body. Use curl for clearer output:

```bash
curl -s -X POST https://procuvex.com/.netlify/functions/create-checkout \
  -H 'Content-Type: application/json' \
  -d '{"plan_id": "growth_monthly", "user_email": "test@example.com", "org_id": "test"}' | python3 -m json.tool
```

Valid `plan_id` values: `growth_monthly`, `growth_annual`, `enterprise_monthly`, `enterprise_annual`.

### Navigating to Stripe Checkout URLs
Stripe checkout URLs are very long (500+ chars) with fragment identifiers that are required for authentication. The browser navigate tool may fail with these long URLs. Workarounds:

1. **Best approach:** Create the checkout session from the browser console using `fetch()` and redirect with `window.location.href`:
   ```js
   (async function() {
     const r = await fetch('/.netlify/functions/create-checkout', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ plan_id: 'growth_monthly', user_email: 'test@example.com', org_id: 'test' })
     });
     const d = await r.json();
     if (d.checkout_url) window.location.href = d.checkout_url;
   })();
   ```
2. The redirect may take 5+ seconds. Use `wait` then `browser view` to check the page.
3. Without the fragment identifier (`#fid...`), Stripe shows "Something went wrong".

### What to Verify on Stripe Checkout
- **"Enter payment details"** heading — confirms payment is mandatory
- **Payment method options:** Card (Visa, MC, Amex, Discover) + US bank account
- **"Start trial"** button — cannot proceed without payment details
- **No skip/bypass button** — `payment_method_collection: 'always'` enforced
- **"Total due today: $0.00"** — no charge during trial
- **Plan name and trial info** shown in left panel

### Test Account Limitations
The test account (`freshsaltyair@gmail.com`) may already have an active subscription. When this happens:
- Billing page shows "Current Plan: Growth / Trial active — X days remaining" instead of trial signup buttons
- CTA subtext ("Credit card required — no charge during trial") only renders when `!hasActiveSubscription` (Billing.tsx line 188)
- You can still test Stripe checkout by calling the API directly (see above)
- To test the Billing page CTA, you would need a fresh account without a subscription

### Stripe Link Authentication
If the email has been used with Stripe before, Stripe may show a "Link" verification prompt (SMS code) before showing the card form. Click "Pay without Link" to see the raw payment method form.

## Testing Global Admin Access Control

The platform has a `is_global_admin` boolean on `user_profiles` that gates access to `/admin/*` routes (Beta Analytics, Global Admin management).

### Key Components
- **Route gate:** `GlobalAdminRoute` in `src/App.tsx` — redirects to `/dashboard` if `!profile?.is_global_admin`
- **Sidebar filter:** `Layout.tsx` — `!item.path.startsWith('/admin/') || profile?.is_global_admin` hides all admin links
- **Server-side:** `netlify/functions/manage-global-admin.mts` — validates caller is global admin before allowing GET (list users) or POST (grant/revoke)
- **Self-revoke prevention:** Both UI (disabled button) and API (returns 400) prevent users from removing their own admin access

### Testing Approach
1. **Admin access test:** Log in as a global admin, verify sidebar shows "Beta Analytics" and "Global Admin" links, navigate to both pages
2. **Non-admin denial test:** Temporarily revoke admin via the API using another global admin's `caller_id`, reload page, verify sidebar hides links and direct URL navigation redirects to `/dashboard`. Restore access after test.
3. **API protection test:** Use curl with a non-admin `x-user-id` header for GET, and non-admin `caller_id` for POST — both should return 403
4. **Grant/revoke UI test:** Click "Grant Access" on a test user, verify count increases and shield turns green. Click "Revoke" to reverse.

### How to Temporarily Revoke Admin for Testing
Use the manage-global-admin API with another global admin's ID as the caller:
```bash
# Revoke (use admin@core314.com's ID as caller to revoke freshsaltyair)
curl -s -X POST "https://procuvex.com/.netlify/functions/manage-global-admin" \
  -H "Content-Type: application/json" \
  -d '{"caller_id":"<other_admin_user_id>","target_user_id":"<target_user_id>","is_global_admin":false}'

# Restore
curl -s -X POST "https://procuvex.com/.netlify/functions/manage-global-admin" \
  -H "Content-Type: application/json" \
  -d '{"caller_id":"<other_admin_user_id>","target_user_id":"<target_user_id>","is_global_admin":true}'
```

### Getting User IDs
The manage-global-admin GET endpoint returns all user IDs when called by a global admin:
```bash
curl -s "https://procuvex.com/.netlify/functions/manage-global-admin" \
  -H "x-user-id: <global_admin_user_id>" | python3 -m json.tool
```

You can also get the current user's ID from the browser console:
```js
const keys = Object.keys(localStorage).filter(k => k.includes('sb-'));
const session = JSON.parse(localStorage.getItem(keys[0]));
session?.user?.id;
```

### Supabase Service Role Key Note
The `TASKORDER_SUPABASE_SERVICE_ROLE_KEY` env var is NOT a valid JWT — it's a short key (42 chars). For direct Supabase REST API calls, you cannot use it as a Bearer token. Instead, use the Netlify functions (which have the proper service role key configured on the Netlify site) or use the `SUPABASE_SERVICE_ROLE_KEY` env var (which is a JWT but for a different project).

## CI Notes
- The repo has 4 optional Netlify deploy-preview checks (`polite-mochi-fc5be5`) that fail on every PR. These are pre-existing and not related to any code changes.
- Code is deployed to production via `netlify deploy --prod` from the branch, not via the PR merge.

## Common Gotchas
- The `ai-proxy` endpoint only rate-limits when `org_id` is passed in the request body. Without it, no rate limiting occurs.
- Rate limiter uses service role key for Supabase, so it bypasses RLS.
- The sanitize functions return empty string for invalid input (not null), so downstream checks may need to handle empty strings.
- Error boundaries only catch errors during React rendering, not in event handlers or async code.
