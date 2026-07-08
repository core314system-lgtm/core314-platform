// Shared config for k6 load tests.
//
// BASE_URL selects the target. Default is the production deploy-preview alias.
// Override per run, e.g.:
//   k6 run -e BASE_URL=https://deploy-preview-790--core314-taskorder.netlify.app load-tests/baseline.js
//
// IMPORTANT: Netlify deploy-preview Functions share the PRODUCTION Supabase
// database. Keep DB-touching load (api-stats.js) modest. Run heavy/soak tests
// only against a dedicated staging environment with its own database.

export const BASE_URL = __ENV.BASE_URL || 'https://procuvex.com';

// Public, unauthenticated routes served by the SPA/CDN (no DB access).
export const PUBLIC_PAGES = [
  '/',
  '/pricing',
  '/founding-partners',
  '/login',
  '/privacy',
  '/terms',
];

// Public read-only API endpoint (touches DB — use sparingly).
export const STATS_ENDPOINT = '/.netlify/functions/network-stats';

export function pageUrl(path) {
  return `${BASE_URL}${path}`;
}
