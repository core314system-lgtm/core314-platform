// Smoke test: 1 VU, verifies every public route responds 200 with the SPA shell.
// Run before any heavier test to confirm the target is healthy.
//
//   k6 run load-tests/smoke.js
//   k6 run -e BASE_URL=https://deploy-preview-XXX--core314-taskorder.netlify.app load-tests/smoke.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { PUBLIC_PAGES, STATS_ENDPOINT, pageUrl } from './lib/config.js';

export const options = {
  vus: 1,
  iterations: PUBLIC_PAGES.length + 1,
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<2000'],
  },
};

export default function () {
  for (const path of PUBLIC_PAGES) {
    const res = http.get(pageUrl(path));
    check(res, {
      [`${path} status 200`]: (r) => r.status === 200,
      [`${path} returns html`]: (r) => (r.headers['Content-Type'] || '').includes('text/html'),
    });
    sleep(0.5);
  }

  const stats = http.get(pageUrl(STATS_ENDPOINT));
  check(stats, {
    'network-stats status 200': (r) => r.status === 200,
    'network-stats returns total': (r) => {
      try { return typeof r.json('total') === 'number'; } catch { return false; }
    },
  });
}
