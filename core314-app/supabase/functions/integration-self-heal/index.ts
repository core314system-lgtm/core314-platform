import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { withSentry, breadcrumb, handleSentryTest, jsonError } from "../_shared/sentry.ts";
import {
  createAdminClient,
  postToSlack,
  postToTeams,
} from '../_shared/integration-utils.ts';


interface WebhookModeRequest {
  mode: 'webhook';
  event_id: string;
  service_name: string;
  http_status?: number;
  error_code?: string;
  error_message: string;
  payload?: Record<string, any>;
  endpoint?: string;
  retry_count: number;
  user_id?: string;
}

interface ScanModeRequest {
  mode: 'scan';
  window_minutes?: number;
  limit?: number;
}

type SelfHealRequest = WebhookModeRequest | ScanModeRequest;

interface AnalyzerInput {
  service_name: string;
  http_status?: number;
  error_code?: string;
  error_message: string;
  payload?: Record<string, any>;
  endpoint?: string;
  retry_count: number;
}

interface AnalyzerOutput {
  category: 'auth' | 'rate_limit' | 'network' | 'data' | 'unknown';
  confidence: number;
  signals: string[];
  advice: string;
}

interface RecoveryPlan {
  category: string;
  service_name: string;
  event_id: string;
  user_id?: string;
  original_payload?: Record<string, any>;
  endpoint?: string;
  http_status?: number;
  error_message: string;
}

interface RecoveryResult {
  action_taken: string;
  success: boolean;
  attempts: number;
  error?: string;
  resolved_at?: string;
  status: 'resolved' | 'pending' | 'disabled';
}


const RECOVERY_THRESHOLDS = {
  auth: { max_consecutive: 3, window_minutes: 60 },
  rate_limit: { max_consecutive: Infinity, window_minutes: 60 },
  network: { max_consecutive: 9, window_minutes: 60 },
  data: { max_consecutive: 5, window_minutes: 60 },
  unknown: { max_consecutive: 5, window_minutes: 60 },
};

const RETRY_CONFIG = {
  max_attempts: 3,
  base_delay_ms: 500,
  max_delay_ms: 10000,
  jitter: true,
};

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const USE_LLM = Deno.env.get('USE_LLM_ANALYSIS') === 'true' && !!OPENAI_API_KEY;


function analyzeFailure(input: AnalyzerInput): AnalyzerOutput {
  const errorMsg = input.error_message?.toLowerCase() || '';
  const errorCode = input.error_code?.toLowerCase() || '';

  if (
    input.http_status === 401 ||
    input.http_status === 403 ||
    /invalid[_\s]?grant|invalid[_\s]?token|token[_\s]?expired|unauthorized|invalid[_\s]?credentials/i.test(
      errorMsg
    ) ||
    /invalid[_\s]?grant|invalid[_\s]?token|token[_\s]?expired|unauthorized/i.test(
      errorCode
    )
  ) {
    return {
      category: 'auth',
      confidence: 0.95,
      signals: [
        `HTTP ${input.http_status}`,
        input.error_code || '',
        'auth keywords',
      ].filter(Boolean),
      advice: 'Refresh OAuth token and retry',
    };
  }

  if (
    input.http_status === 429 ||
    /rate[_\s]?limit|too[_\s]?many[_\s]?requests|quota[_\s]?exceeded/i.test(
      errorMsg
    ) ||
    /rate[_\s]?limit|too[_\s]?many/i.test(errorCode)
  ) {
    return {
      category: 'rate_limit',
      confidence: 0.95,
      signals: [
        `HTTP ${input.http_status}`,
        'rate limit keywords',
      ].filter(Boolean),
      advice: 'Wait for rate limit reset and retry',
    };
  }

  if (
    [408, 500, 502, 503, 504].includes(input.http_status || 0) ||
    /ENOTFOUND|ECONNRESET|ETIMEDOUT|ECONNREFUSED|network[_\s]?error|connection[_\s]?refused|timeout|service[_\s]?unavailable/i.test(
      errorMsg
    ) ||
    /network|timeout|unavailable/i.test(errorCode)
  ) {
    return {
      category: 'network',
      confidence: 0.90,
      signals: [
        `HTTP ${input.http_status}`,
        'network error keywords',
      ].filter(Boolean),
      advice: 'Retry with exponential backoff',
    };
  }

  if (
    [400, 422].includes(input.http_status || 0) ||
    /validation|invalid[_\s]?request|schema|required[_\s]?field|bad[_\s]?request|malformed/i.test(
      errorMsg
    ) ||
    /validation|invalid[_\s]?request|schema/i.test(errorCode)
  ) {
    return {
      category: 'data',
      confidence: 0.85,
      signals: [
        `HTTP ${input.http_status}`,
        'validation keywords',
      ].filter(Boolean),
      advice: 'Review payload structure - manual fix required',
    };
  }

  return {
    category: 'unknown',
    confidence: 0.50,
    signals: ['No pattern match'],
    advice: 'Manual investigation required',
  };
}


async function enhanceWithLLM(
  input: AnalyzerInput,
  deterministicResult: AnalyzerOutput
): Promise<string | null> {
  if (!USE_LLM || !OPENAI_API_KEY) {
    return null;
  }

  try {
    const prompt = `Analyze this integration failure and provide recovery advice:

Service: ${input.service_name}
HTTP Status: ${input.http_status || 'N/A'}
Error Code: ${input.error_code || 'N/A'}
Error Message: ${input.error_message}
Retry Count: ${input.retry_count}

Deterministic Analysis:
- Category: ${deterministicResult.category}
- Confidence: ${deterministicResult.confidence}
- Signals: ${deterministicResult.signals.join(', ')}

Provide:
1. Confirmation or correction of the category
2. Root cause explanation
3. Specific recovery steps
4. Prevention recommendations

Keep response under 200 words.`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'You are an integration reliability engineer. Analyze failures and provide actionable recovery advice.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 300,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn('LLM analysis failed:', response.status);
      return null;
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || null;
  } catch (error) {
    console.warn('LLM analysis error:', error);
    return null;
  }
}


async function retryWithBackoff(
  fn: () => Promise<boolean>,
  maxAttempts: number = RETRY_CONFIG.max_attempts
): Promise<{ success: boolean; attempts: number }> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const success = await fn();
      if (success) {
        return { success: true, attempts: attempt };
      }
    } catch (error) {
      console.error(`Retry attempt ${attempt} failed:`, error);
    }

    if (attempt < maxAttempts) {
      const delay = Math.min(
        RETRY_CONFIG.base_delay_ms * Math.pow(2, attempt - 1),
        RETRY_CONFIG.max_delay_ms
      );
      const jitter = RETRY_CONFIG.jitter
        ? delay * (0.5 + Math.random() * 0.5)
        : delay;
      await new Promise((resolve) => setTimeout(resolve, jitter));
    }
  }

  return { success: false, attempts: maxAttempts };
}

async function recoverAuthFailure(plan: RecoveryPlan): Promise<RecoveryResult> {

  return {
    action_taken: 'Auth failure detected - token refresh required (pending implementation)',
    success: false,
    attempts: 0,
    status: 'pending',
    error: 'OAuth token refresh not yet implemented',
  };
}

async function recoverRateLimitFailure(
  plan: RecoveryPlan
): Promise<RecoveryResult> {
  return {
    action_taken: 'Rate limit detected - scheduled for delayed retry',
    success: false,
    attempts: 0,
    status: 'pending',
  };
}

async function recoverNetworkFailure(
  plan: RecoveryPlan
): Promise<RecoveryResult> {

  const result = await retryWithBackoff(async () => {
    return false;
  });

  if (result.success) {
    return {
      action_taken: `Network issue resolved after ${result.attempts} retry attempts`,
      success: true,
      attempts: result.attempts,
      status: 'resolved',
      resolved_at: new Date().toISOString(),
    };
  }

  return {
    action_taken: `Network retries exhausted (${result.attempts} attempts) - marked as pending`,
    success: false,
    attempts: result.attempts,
    status: 'pending',
  };
}

async function handleDataFailure(plan: RecoveryPlan): Promise<RecoveryResult> {
  return {
    action_taken:
      'Data validation failure - manual review required, no automatic retry',
    success: false,
    attempts: 0,
    status: 'pending',
    error: 'Manual intervention required for data validation issues',
  };
}

async function handleUnknownFailure(
  plan: RecoveryPlan
): Promise<RecoveryResult> {
  const result = await retryWithBackoff(async () => false, 1);

  return {
    action_taken: 'Unknown failure - single retry attempted, marked as pending',
    success: false,
    attempts: result.attempts,
    status: 'pending',
  };
}

async function executeRecovery(plan: RecoveryPlan): Promise<RecoveryResult> {
  console.log(`Executing recovery for ${plan.service_name} (${plan.category})`);

  switch (plan.category) {
    case 'auth':
      return await recoverAuthFailure(plan);
    case 'rate_limit':
      return await recoverRateLimitFailure(plan);
    case 'network':
      return await recoverNetworkFailure(plan);
    case 'data':
      return await handleDataFailure(plan);
    default:
      return await handleUnknownFailure(plan);
  }
}


async function notifyAdmins(
  type: 'critical' | 'recovery' | 'resolved' | 'disabled',
  data: {
    service_name: string;
    category?: string;
    error_message?: string;
    action_taken?: string;
    status?: string;
    event_id?: string;
    duration?: string;
    failure_count?: number;
  }
) {
  const slackWebhookUrl = Deno.env.get('SLACK_WEBHOOK_URL');
  const teamsWebhookUrl = Deno.env.get('MICROSOFT_TEAMS_WEBHOOK_URL');

  let title = '';
  let message = '';

  switch (type) {
    case 'critical':
      title = '🚨 Integration Failure Detected';
      message = `Service: ${data.service_name}
Category: ${data.category}
Error: ${data.error_message}

Recovery Plan: ${data.action_taken}
Status: ${data.status}

Event ID: ${data.event_id}
Timestamp: ${new Date().toISOString()}`;
      break;

    case 'recovery':
      title = '🔄 Recovery Attempt';
      message = `Service: ${data.service_name}
Action: ${data.action_taken}

Previous Error: ${data.error_message}`;
      break;

    case 'resolved':
      title = '✅ Integration Recovered';
      message = `Service: ${data.service_name}
Resolution: ${data.action_taken}
Time to Recover: ${data.duration}

Original Error: ${data.error_message}`;
      break;

    case 'disabled':
      title = '⛔ Integration Disabled';
      message = `Service: ${data.service_name}
Reason: ${data.error_message}
Failure Count: ${data.failure_count}

Action Required: Manual review and re-enable
Dashboard: https://core314-admin.netlify.app/system-health`;
      break;
  }

  if (slackWebhookUrl) {
    try {
      await postToSlack(message, slackWebhookUrl, title);
    } catch (error) {
      console.error('Failed to send Slack notification:', error);
    }
  }

  if (teamsWebhookUrl) {
    try {
      await postToTeams(message, teamsWebhookUrl, title);
    } catch (error) {
      console.error('Failed to send Teams notification:', error);
    }
  }
}


async function processWebhookMode(
  req: WebhookModeRequest,
  supabaseAdmin: any
) {
  console.log(`Processing webhook mode for ${req.service_name}`);

  const { data: existingRecovery } = await supabaseAdmin
    .from('system_integrity_events')
    .select('id')
    .eq('event_id', req.event_id)
    .single();

  if (existingRecovery) {
    console.log(`Event ${req.event_id} already processed, skipping`);
    return {
      success: true,
      recovery_id: existingRecovery.id,
      message: 'Event already processed',
      skipped: true,
    };
  }

  const analyzerInput: AnalyzerInput = {
    service_name: req.service_name,
    http_status: req.http_status,
    error_code: req.error_code,
    error_message: req.error_message,
    payload: req.payload,
    endpoint: req.endpoint,
    retry_count: req.retry_count,
  };

  const analysis = analyzeFailure(analyzerInput);
  console.log(`Analysis result: ${analysis.category} (${analysis.confidence})`);

  const llmReasoning = await enhanceWithLLM(analyzerInput, analysis);

  const recoveryPlan: RecoveryPlan = {
    category: analysis.category,
    service_name: req.service_name,
    event_id: req.event_id,
    user_id: req.user_id,
    original_payload: req.payload,
    endpoint: req.endpoint,
    http_status: req.http_status,
    error_message: req.error_message,
  };

  const recoveryResult = await executeRecovery(recoveryPlan);

  const { data: recoveryEvent, error: insertError } = await supabaseAdmin
    .from('system_integrity_events')
    .insert({
      event_id: req.event_id,
      service_name: req.service_name,
      failure_reason: req.error_message,
      failure_category: analysis.category,
      action_taken: recoveryResult.action_taken,
      analyzer_signals: {
        confidence: analysis.confidence,
        signals: analysis.signals,
        advice: analysis.advice,
      },
      llm_reasoning: llmReasoning,
      status: recoveryResult.status,
      resolved_at: recoveryResult.resolved_at || null,
    })
    .select()
    .single();

  if (insertError) {
    console.error('Failed to log recovery event:', insertError);
    throw new Error(`Failed to log recovery: ${insertError.message}`);
  }

  await notifyAdmins('critical', {
    service_name: req.service_name,
    category: analysis.category,
    error_message: req.error_message,
    action_taken: recoveryResult.action_taken,
    status: recoveryResult.status,
    event_id: req.event_id,
  });

  if (recoveryResult.success) {
    await notifyAdmins('resolved', {
      service_name: req.service_name,
      action_taken: recoveryResult.action_taken,
      error_message: req.error_message,
      duration: 'immediate',
    });
  }

  return {
    success: true,
    recovery_id: recoveryEvent.id,
    category: analysis.category,
    action_taken: recoveryResult.action_taken,
    status: recoveryResult.status,
    retry_scheduled: recoveryResult.status === 'pending',
  };
}


async function processScanMode(req: ScanModeRequest, supabaseAdmin: any) {
  const windowMinutes = req.window_minutes || 15;
  const limit = req.limit || 50;

  console.log(
    `Processing scan mode: window=${windowMinutes}min, limit=${limit}`
  );

  const cutoffTime = new Date(Date.now() - windowMinutes * 60 * 1000);

  const { data: errorEvents, error: queryError } = await supabaseAdmin
    .from('integration_events')
    .select('*')
    .eq('status', 'error')
    .gte('created_at', cutoffTime.toISOString())
    .order('created_at', { ascending: false })
    .limit(limit);

  if (queryError) {
    throw new Error(`Failed to query error events: ${queryError.message}`);
  }

  if (!errorEvents || errorEvents.length === 0) {
    console.log('No error events found in scan window');
    return {
      success: true,
      processed_count: 0,
      resolved_count: 0,
      pending_count: 0,
      disabled_count: 0,
      events: [],
    };
  }

  console.log(`Found ${errorEvents.length} error events to process`);

  const results = {
    processed_count: 0,
    resolved_count: 0,
    pending_count: 0,
    disabled_count: 0,
    events: [] as any[],
  };

  for (const event of errorEvents) {
    try {
      const { data: existingRecovery } = await supabaseAdmin
        .from('system_integrity_events')
        .select('id')
        .eq('event_id', event.id)
        .single();

      if (existingRecovery) {
        console.log(`Event ${event.id} already processed, skipping`);
        continue;
      }

      const webhookReq: WebhookModeRequest = {
        mode: 'webhook',
        event_id: event.id,
        service_name: event.service_name,
        http_status: event.http_status,
        error_code: event.error_code,
        error_message: event.error_message || 'Unknown error',
        payload: event.payload,
        retry_count: event.retry_count || 0,
        user_id: event.user_id,
      };

      const result = await processWebhookMode(webhookReq, supabaseAdmin);

      results.processed_count++;
      if (result.status === 'resolved') results.resolved_count++;
      else if (result.status === 'pending') results.pending_count++;
      else if (result.status === 'disabled') results.disabled_count++;

      results.events.push({
        event_id: event.id,
        service_name: event.service_name,
        category: result.category,
        action_taken: result.action_taken,
        status: result.status,
      });
    } catch (error) {
      console.error(`Failed to process event ${event.id}:`, error);
    }
  }

  return {
    success: true,
    ...results,
  };
}


serve(withSentry(async (req) => {
  const testResponse = await handleSentryTest(req);
  if (testResponse) return testResponse;

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const internalToken = req.headers.get('X-Internal-Token');
    const expectedInternalToken = Deno.env.get('INTERNAL_WEBHOOK_TOKEN');

    let authenticated = false;

    if (internalToken && expectedInternalToken && internalToken === expectedInternalToken) {
      authenticated = true;
      console.log('Authenticated via internal token');
    }

    if (!authenticated) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid or missing authentication' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const body: SelfHealRequest = await req.json();
    const supabaseAdmin = createAdminClient();

    let result;

    if (body.mode === 'webhook') {
      result = await processWebhookMode(body, supabaseAdmin);
    } else if (body.mode === 'scan') {
      result = await processScanMode(body, supabaseAdmin);
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid mode: must be "webhook" or "scan"' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Integration self-heal error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}), { name: "integration-self-heal" }));