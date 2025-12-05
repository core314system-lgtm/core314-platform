/**
 * Netlify Function to serve Sentry configuration at runtime
 * This keeps the DSN out of the client bundle
 */

import { Handler } from '@netlify/functions';

export const handler: Handler = async () => {
  const dsn = process.env.SENTRY_DSN_APP;
  
  if (!dsn) {
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600',
      },
      body: JSON.stringify({ dsn: null }),
    };
  }

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
    body: JSON.stringify({ dsn }),
  };
};
