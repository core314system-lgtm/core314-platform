import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";

/**
 * Netlify Function to provide Supabase configuration at runtime.
 * This prevents Supabase URL and anon key from being embedded in the client-side bundle.
 * 
 * The values are stored as Netlify environment variables (SUPABASE_URL, SUPABASE_ANON_KEY)
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

  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;

  if (!url || !anon) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        configured: false,
        message: "Supabase environment configuration missing",
      }),
    };
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      configured: true,
      url,
      anon,
    }),
  };
};

export { handler };
