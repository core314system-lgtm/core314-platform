import * as Sentry from "https://deno.land/x/sentry@7.119.0/index.mjs";

const SENTRY_DSN = Deno.env.get('SENTRY_DSN_EDGE');
const SENTRY_ENVIRONMENT = Deno.env.get('SENTRY_ENVIRONMENT') || 'beta-test';

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: SENTRY_ENVIRONMENT,
    tracesSampleRate: 0.2,
  });
}

export const breadcrumb = {
  supabase: (operation: string, detail?: Record<string, unknown>) => {
    if (!SENTRY_DSN) return;
    Sentry.addBreadcrumb({
      category: 'supabase',
      message: operation,
      data: detail,
      level: 'info',
    });
  },

  stripe: (endpoint: string, status?: number, detail?: Record<string, unknown>) => {
    if (!SENTRY_DSN) return;
    Sentry.addBreadcrumb({
      category: 'stripe',
      message: `${endpoint} - ${status || 'pending'}`,
      data: detail,
      level: 'info',
    });
  },

  openai: (endpoint: string, status?: number, model?: string) => {
    if (!SENTRY_DSN) return;
    Sentry.addBreadcrumb({
      category: 'openai',
      message: `${endpoint} - ${model || 'unknown'}`,
      data: { status, model },
      level: 'info',
    });
  },

  anomaly: (description: string, severity?: string) => {
    if (!SENTRY_DSN) return;
    Sentry.addBreadcrumb({
      category: 'anomaly',
      message: description,
      data: { severity },
      level: severity === 'high' ? 'warning' : 'info',
    });
  },

  optimization: (trigger: string, detail?: Record<string, unknown>) => {
    if (!SENTRY_DSN) return;
    Sentry.addBreadcrumb({
      category: 'optimization',
      message: trigger,
      data: detail,
      level: 'info',
    });
  },

  billing: (event: string, detail?: Record<string, unknown>) => {
    if (!SENTRY_DSN) return;
    Sentry.addBreadcrumb({
      category: 'billing',
      message: event,
      data: detail,
      level: 'info',
    });
  },

  custom: (category: string, message: string, data?: Record<string, unknown>) => {
    if (!SENTRY_DSN) return;
    Sentry.addBreadcrumb({
      category,
      message,
      data,
      level: 'info',
    });
  },
};

/**
 * Normalize error messages to reduce duplicate issues
 * Strips UUIDs, IDs, timestamps, and other dynamic values
 */
function normalizeErrorMessage(message: string): string {
  return message
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<uuid>')
    .replace(/\b\d{6,}\b/g, '<id>')
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/g, '<timestamp>')
    .replace(/\d{13,}/g, '<timestamp_ms>')
    .replace(/0x[0-9a-f]+/gi, '<hex>');
}

/**
 * Extract user ID from JWT Authorization header
 * Decodes without verification (trusts Supabase)
 */
function extractUserIdFromJWT(req: Request): string | undefined {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return undefined;
    }
    
    const token = authHeader.substring(7);
    const parts = token.split('.');
    if (parts.length !== 3) {
      return undefined;
    }
    
    const payload = JSON.parse(atob(parts[1]));
    return payload.sub;
  } catch {
    return undefined;
  }
}

/**
 * Get size from Content-Length header
 * Does not read body to avoid consuming the stream
 */
function getSizeFromHeaders(data: Request | Response): number {
  try {
    const contentLength = data.headers.get('Content-Length');
    if (contentLength) {
      return parseInt(contentLength, 10);
    }
    return 0;
  } catch {
    return 0;
  }
}

// Default CORS headers for error responses
const DEFAULT_CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export function withSentry<T>(
  handler: (req: Request) => Promise<Response> | Response,
  options?: { name?: string }
): (req: Request) => Promise<Response> {
  const functionName = options?.name || 'unknown';
  
  return async (req: Request): Promise<Response> => {
    if (!SENTRY_DSN) {
      try {
        return await handler(req);
      } catch (error) {
        // Even without Sentry, return a CORS-safe error response
        const errorMessage = error instanceof Error ? error.message : String(error);
        return new Response(
          JSON.stringify({ error: errorMessage, success: false }),
          {
            status: 500,
            headers: { ...DEFAULT_CORS_HEADERS, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    const requestId = crypto.randomUUID();
    const startTime = performance.now();
    
    try {
      Sentry.setTag('function_name', functionName);
      Sentry.setTag('request_id', requestId);
      Sentry.setTag('environment', SENTRY_ENVIRONMENT);
      
      const userId = extractUserIdFromJWT(req);
      if (userId) {
        Sentry.setUser({ id: userId });
      }
      
      const inputSize = getSizeFromHeaders(req);
      if (inputSize > 0) {
        Sentry.setTag('input_size_bytes', inputSize.toString());
      }

      Sentry.addBreadcrumb({
        category: 'http',
        message: `${req.method} ${new URL(req.url).pathname}`,
        data: {
          method: req.method,
          url: req.url,
          request_id: requestId,
          input_size: inputSize,
        },
        level: 'info',
      });

      const response = await handler(req);
      const duration = performance.now() - startTime;
      
      const outputSize = getSizeFromHeaders(response);
      if (outputSize > 0) {
        Sentry.setTag('output_size_bytes', outputSize.toString());
      }
      Sentry.setTag('duration_ms', Math.round(duration).toString());

      Sentry.addBreadcrumb({
        category: 'http',
        message: `Response ${response.status}`,
        data: {
          status: response.status,
          request_id: requestId,
          duration_ms: Math.round(duration),
          output_size: outputSize,
        },
        level: response.status >= 400 ? 'warning' : 'info',
      });

      return response;
    } catch (error) {
      const duration = performance.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      const normalizedMessage = normalizeErrorMessage(errorMessage);
      
      Sentry.captureException(error, {
        tags: {
          function_name: functionName,
          request_id: requestId,
          environment: SENTRY_ENVIRONMENT,
          duration_ms: Math.round(duration).toString(),
        },
        extra: {
          method: req.method,
          url: req.url,
          headers: Object.fromEntries(req.headers.entries()),
          normalized_message: normalizedMessage,
        },
        fingerprint: ['edge', functionName, normalizedMessage],
      });

      await Sentry.flush(2000);
      
      // Return a CORS-safe error response instead of re-throwing
      // This prevents "Failed to fetch" errors in the browser
      return new Response(
        JSON.stringify({ error: errorMessage, success: false }),
        {
          status: 500,
          headers: { ...DEFAULT_CORS_HEADERS, 'Content-Type': 'application/json' },
        }
      );
    }
  };
}

export async function captureException(
  error: Error,
  context?: {
    user_id?: string;
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
  }
) {
  if (!SENTRY_DSN) return;

  Sentry.captureException(error, {
    user: context?.user_id ? { id: context.user_id } : undefined,
    tags: context?.tags,
    extra: context?.extra,
  });

  await Sentry.flush(2000);
}

export async function captureMessage(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
  context?: {
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
  }
) {
  if (!SENTRY_DSN) return;

  Sentry.captureMessage(message, {
    level,
    tags: context?.tags,
    extra: context?.extra,
  });

  await Sentry.flush(2000);
}

export async function handleSentryTest(req: Request): Promise<Response | null> {
  if (
    SENTRY_ENVIRONMENT === 'beta-test' &&
    req.headers.get('x-sentry-test') === '1'
  ) {
    try {
      throw new Error('Sentry test event - Edge Function');
    } catch (error) {
      await captureException(error as Error, {
        tags: { test: 'true' },
        extra: { message: 'This is a test event from Edge Function' },
      });
      
      return new Response(
        JSON.stringify({ ok: true, message: 'Sentry test event sent' }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  }
  
  return null;
}

/**
 * Helper to create consistent error responses for Edge Functions.
 * Includes multiple error fields (error, message, msg, code) to ensure supabase-js
 * can surface the error code in error.message regardless of which field it prefers.
 * 
 * @param status HTTP status code (400, 401, 403, 404, 500, etc.)
 * @param code Error code string (e.g., 'empty_prompt', 'unauthorized', 'invalid_json')
 * @param message Human-readable error message (defaults to code if not provided)
 * @param extraHeaders Additional headers to include (e.g., CORS headers)
 * @returns Response object with consistent error format
 */
export function jsonError(
  status: number,
  code: string,
  message?: string,
  extraHeaders?: Record<string, string>
): Response {
  const errorMessage = message || code;
  const body = {
    error: code,
    message: errorMessage,
    msg: errorMessage,  // supabase-js may prefer this field
    code: code,         // redundant but ensures code is always available
  };
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extraHeaders,
  };
  
  return new Response(
    JSON.stringify(body),
    {
      status,
      statusText: code, // Best-effort (HTTP/2 may drop this)
      headers,
    }
  );
}
