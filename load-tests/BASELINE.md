# Load Test Baseline — 2026-06-15

Target: `https://procuvex.com` (production). Tool: k6 v0.54.0 from a single
source IP. Public/unauthenticated routes only.

## Results

### Smoke (1 VU)
All public routes healthy.

| Metric | Value |
|--------|-------|
| Routes checked | `/`, `/pricing`, `/founding-partners`, `/login`, `/privacy`, `/terms`, `network-stats` |
| Checks passed | 100% (98/98) |
| Failed requests | 0% (0/49) |
| p95 latency | 92 ms |
| median latency | 26 ms |

### Baseline browse (ramp 0→20→50 VUs, ~3.5 min, CDN-served SPA routes)

| Metric | Value |
|--------|-------|
| Requests | 3,162 |
| **Latency of served requests** | p95 **27.7 ms**, p99 ~28 ms, max 206 ms |
| Successful responses | ~52% returned 200; remainder blocked by edge (see below) |
| Throughput | ~15 req/s sustained |

Latency of *served* requests stayed essentially flat (~27 ms p95) from 1 to 50
VUs — the CDN/static tier shows no degradation under this concurrency.

### Edge abuse-protection behavior (key finding)
Netlify's edge progressively throttled sustained traffic from the single test IP:

- Short bursts (≤100 concurrent one-shot requests): **100% HTTP 200**.
- 20 s sustained @ 50 VUs: ~97.7% 200, ~2.2% **HTTP 403**, <0.1% dial timeouts.
- 3.5 min sustained @ up to 50 VUs: 403 rate climbed to ~48% as protection escalated.
- Immediately after: the test IP was **connection-blocked** (dial i/o timeouts
  on even a single request) for a cooldown period.

This is Netlify's DDoS/abuse protection working as intended. It also means a
single machine **cannot** produce a valid high-concurrency capacity baseline for
the app — the edge blocks it as abuse before the origin is stressed.

## Interpretation

- **Static / CDN tier:** Excellent. Sub-30 ms p95 under 50 concurrent browsers,
  no latency growth. Comfortably meets enterprise expectations for page loads.
- **Edge protection:** Confirmed active and effective against single-source floods.
- **Not yet measured:** True origin/Function/DB capacity under high concurrency,
  and authenticated workflows (AI analysis, project/RFQ creation). These need
  distributed load (k6 Cloud) or a staging environment, plus seeded test auth.

## Recommendations (ranked)

1. Stand up the **staging environment** (separate Netlify site + Supabase branch)
   so heavy and authenticated load tests can run without prod DB impact or edge
   blocking. This unblocks a real capacity baseline.
2. Run `api-stats.js` and future authenticated scenarios against staging with
   distributed load to baseline Function cold-start, DB connection pooling, and
   the AI/API rate limiter under concurrency.
3. Keep single-IP prod runs limited to smoke checks; anything heavier should use
   k6 Cloud so load originates from many IPs.
