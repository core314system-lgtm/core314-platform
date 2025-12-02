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

export function withSentry<T>(
  handler: (req: Request) => Promise<Response> | Response,
  options: { name: string }
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    if (!SENTRY_DSN) {
      return await handler(req);
    }

    const requestId = crypto.randomUUID();
    
    try {
      Sentry.setTag('function_name', options.name);
      Sentry.setTag('request_id', requestId);
      Sentry.setTag('environment', SENTRY_ENVIRONMENT);

      Sentry.addBreadcrumb({
        category: 'http',
        message: `${req.method} ${new URL(req.url).pathname}`,
        data: {
          method: req.method,
          url: req.url,
          request_id: requestId,
        },
        level: 'info',
      });

      const response = await handler(req);

      Sentry.addBreadcrumb({
        category: 'http',
        message: `Response ${response.status}`,
        data: {
          status: response.status,
          request_id: requestId,
        },
        level: response.status >= 400 ? 'warning' : 'info',
      });

      return response;
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          function_name: options.name,
          request_id: requestId,
          environment: SENTRY_ENVIRONMENT,
        },
        extra: {
          method: req.method,
          url: req.url,
          headers: Object.fromEntries(req.headers.entries()),
        },
      });

      await Sentry.flush(2000);
      throw error;
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
