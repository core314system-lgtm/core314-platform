import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";

/**
 * Netlify Function to provide Sentry configuration at runtime.
 * This prevents DSN values from being embedded in the client-side bundle.
 * 
 * The DSN is stored as a Netlify environment variable (SENTRY_DSN_ADMIN)
 * and only accessed server-side through this function.
 */
const handler: Handler = async (event: HandlerEvent, _context: HandlerContext) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers,
      body: "",
    };
  }

  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  const dsn = process.env.SENTRY_DSN_ADMIN;
  const environment = process.env.SENTRY_ENVIRONMENT || "production";

  if (!dsn) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        enabled: false,
        message: "Sentry DSN not configured",
      }),
    };
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      enabled: true,
      dsn,
      environment,
    }),
  };
};

export { handler };
