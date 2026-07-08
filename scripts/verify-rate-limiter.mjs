#!/usr/bin/env node
/**
 * Rate-limiter production verification.
 *
 * Exercises the REAL production rate limiter (netlify/functions/_shared/rate-limiter.ts)
 * by calling the ai-proxy Function repeatedly for a given org until it returns 429.
 * ai-proxy checks checkRateLimit(org_id, "ai_call") BEFORE calling OpenAI, so once the
 * limit is reached the blocked calls cost nothing. Allowed calls below the limit DO make
 * a tiny gpt-4o-mini request (max_tokens=1), costing a fraction of a cent each.
 *
 * REQUIREMENTS / SAFETY:
 *   - Use a DEDICATED TEST org_id. Every allowed call consumes that org's real hourly
 *     quota and writes to account_usage. Never run against a paying customer's org.
 *   - The hourly window is rolling; if the org already has usage this hour the 429 will
 *     arrive sooner. For a clean run use an org with no recent ai_call usage.
 *
 * USAGE:
 *   ORG_ID=<test-org-uuid> node scripts/verify-rate-limiter.mjs
 *   ORG_ID=<uuid> BASE_URL=https://deploy-preview-XXX--core314-taskorder.netlify.app \
 *     EXPECTED_LIMIT=5 node scripts/verify-rate-limiter.mjs
 *
 * ENV:
 *   ORG_ID          (required) test organization UUID
 *   BASE_URL        (default https://procuvex.com)
 *   EXPECTED_LIMIT  (optional) assert the 429 fires at this count; else just reports it
 *   MAX_CALLS       (default = EXPECTED_LIMIT+3 or 40) safety cap on total requests
 */

const BASE_URL = process.env.BASE_URL || 'https://procuvex.com';
const ORG_ID = process.env.ORG_ID;
const EXPECTED_LIMIT = process.env.EXPECTED_LIMIT ? Number(process.env.EXPECTED_LIMIT) : null;
const MAX_CALLS = process.env.MAX_CALLS
  ? Number(process.env.MAX_CALLS)
  : (EXPECTED_LIMIT ? EXPECTED_LIMIT + 3 : 40);

if (!ORG_ID) {
  console.error('ERROR: ORG_ID env var is required (a dedicated TEST org UUID).');
  process.exit(2);
}

const endpoint = `${BASE_URL}/.netlify/functions/ai-proxy`;

async function callOnce() {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      org_id: ORG_ID,
      model: 'gpt-4o-mini',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'ok' }],
    }),
  });
  let payload = null;
  try { payload = await res.json(); } catch { /* streamed/non-json body */ }
  return { status: res.status, payload };
}

(async () => {
  console.log(`Verifying rate limiter at ${endpoint}`);
  console.log(`Org: ${ORG_ID}  Expected limit: ${EXPECTED_LIMIT ?? '(auto-detect)'}  Max calls: ${MAX_CALLS}\n`);

  let firstBlockAt = null;
  let allowed = 0;

  for (let i = 1; i <= MAX_CALLS; i++) {
    const { status, payload } = await callOnce();
    const tag = status === 429 ? 'BLOCKED (429)' : status === 200 ? 'allowed (200)' : `status ${status}`;
    const detail = payload?.limit != null ? `  limit=${payload.limit} current=${payload.current ?? '?'}` : '';
    console.log(`  call #${i}: ${tag}${detail}`);

    if (status === 429) { firstBlockAt = i; break; }
    if (status === 200) allowed++;
    if (status >= 500) {
      console.error(`\nFAIL: server error ${status} — cannot verify. Body: ${JSON.stringify(payload)}`);
      process.exit(1);
    }
  }

  console.log('');
  if (firstBlockAt == null) {
    console.error(`FAIL: no 429 after ${MAX_CALLS} calls. Limiter may not be enforcing, or the org's limit is > MAX_CALLS.`);
    process.exit(1);
  }

  console.log(`RESULT: first 429 at call #${firstBlockAt} (after ${allowed} allowed calls this window).`);

  if (EXPECTED_LIMIT != null) {
    // Blocked call index should be limit+1 on a clean window; allow slack for pre-existing usage.
    if (firstBlockAt <= EXPECTED_LIMIT) {
      console.log(`NOTE: blocked earlier than expected (limit ${EXPECTED_LIMIT}) — org likely had prior usage this hour.`);
    }
    if (allowed <= EXPECTED_LIMIT) {
      console.log(`PASS: limiter enforced at or below the ${EXPECTED_LIMIT}/hr limit.`);
      process.exit(0);
    }
    console.error(`FAIL: allowed ${allowed} calls but limit is ${EXPECTED_LIMIT}.`);
    process.exit(1);
  }

  console.log('PASS: limiter returned 429 (enforcing).');
  process.exit(0);
})();
