// Baseline load test: concurrent users browsing public SPA routes (CDN-served,
// no DB). Establishes latency/error baselines under realistic browse load.
//
//   k6 run load-tests/baseline.js
//   k6 run -e BASE_URL=https://deploy-preview-XXX--core314-taskorder.netlify.app load-tests/baseline.js
//
// Stages ramp 0 -> 20 -> 50 VUs. Thresholds fail the run if the platform
// degrades past enterprise expectations.

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';
import { PUBLIC_PAGES, pageUrl } from './lib/config.js';

const pageLatency = new Trend('page_latency', true);

export const options = {
  scenarios: {
    browse: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 20 },
        { duration: '1m', target: 20 },
        { duration: '30s', target: 50 },
        { duration: '1m', target: 50 },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1500', 'p(99)<3000'],
    page_latency: ['p(95)<1500'],
  },
};

export default function () {
  // Simulate a user landing then navigating a couple pages.
  const landing = PUBLIC_PAGES[Math.floor(Math.random() * PUBLIC_PAGES.length)];
  const res = http.get(pageUrl(landing));
  pageLatency.add(res.timings.duration);
  check(res, { 'status 200': (r) => r.status === 200 });
  sleep(Math.random() * 2 + 1);

  const next = PUBLIC_PAGES[Math.floor(Math.random() * PUBLIC_PAGES.length)];
  const res2 = http.get(pageUrl(next));
  pageLatency.add(res2.timings.duration);
  check(res2, { 'status 200': (r) => r.status === 200 });
  sleep(Math.random() * 2 + 1);
}
