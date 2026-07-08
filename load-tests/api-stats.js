// API load test: hits the public read-only network-stats function.
//
// WARNING: this endpoint runs COUNT queries against the PRODUCTION Supabase
// database (deploy-preview shares prod DB). Kept intentionally modest (10 VUs,
// short duration). Do NOT scale this up against prod/deploy-preview — run
// heavier API load only against a dedicated staging DB.
//
//   k6 run load-tests/api-stats.js
//   k6 run -e BASE_URL=https://deploy-preview-XXX--core314-taskorder.netlify.app load-tests/api-stats.js

import http from 'k6/http';
import { check } from 'k6';
import { STATS_ENDPOINT, pageUrl } from './lib/config.js';

export const options = {
  scenarios: {
    api: {
      executor: 'constant-vus',
      vus: 10,
      duration: '30s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.02'],
    // Cold function + DB count is slower than CDN; allow more headroom.
    http_req_duration: ['p(95)<3000'],
  },
};

export default function () {
  const res = http.get(pageUrl(STATS_ENDPOINT));
  check(res, {
    'status 200': (r) => r.status === 200,
    'has numeric total': (r) => {
      try { return typeof r.json('total') === 'number'; } catch { return false; }
    },
  });
}
