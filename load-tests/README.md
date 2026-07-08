# Load Tests (k6)

Baseline load/performance tests for Procuvex, part of the pre-public-launch
hardening work. Uses [k6](https://k6.io/).

## Install k6

```bash
# macOS
brew install k6
# Linux
sudo gpg -k && sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6
```

## Scripts

| Script | Purpose | Load | Touches DB? |
|--------|---------|------|-------------|
| `smoke.js` | Sanity — every public route returns 200 | 1 VU | Light (1 stats call) |
| `baseline.js` | Concurrent browse of public SPA routes | ramp 0→50 VUs | No (CDN only) |
| `api-stats.js` | Public `network-stats` function under load | 10 VUs / 30s | **Yes (COUNT queries)** |

## Running

```bash
# Against production (default)
k6 run load-tests/smoke.js

# Against a deploy-preview or staging environment
k6 run -e BASE_URL=https://deploy-preview-XXX--core314-taskorder.netlify.app load-tests/baseline.js
```

## Important caveats

1. **Deploy-preview Functions share the PRODUCTION Supabase database.** Any
   test that hits `/.netlify/functions/*` (i.e. `api-stats.js`) adds real load
   to the prod DB even when run against a preview URL. Keep it modest. Run
   heavy/soak API tests only against a dedicated staging DB (see the staging
   environment work).

2. **Netlify edge abuse protection blocks sustained single-IP load.** A single
   machine ramping to 50 VUs for several minutes gets progressively rate-limited
   (HTTP 403) and eventually connection-blocked (dial timeouts) at the edge.
   This is expected and desirable, but it means a single box cannot produce a
   true high-concurrency capacity baseline. For real capacity numbers use
   distributed load (k6 Cloud / multiple source IPs) or run against staging with
   edge protection relaxed.

3. **Only public, unauthenticated routes are covered.** Authenticated flows
   (project creation, AI analysis, RFQ) require a test JWT and are intentionally
   out of scope here to avoid generating cost/side-effects against prod. Add
   those scenarios once a staging environment with seed data exists.

See `BASELINE.md` for the recorded baseline results and analysis.
