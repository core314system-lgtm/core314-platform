import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withSentry, breadcrumb, handleSentryTest, jsonError } from "../_shared/sentry.ts";

/**
 * Monitor AI Generate Function
 * 
 * Scheduled Edge Function that runs hourly to:
 * - Check error rates for the ai-generate function
 * - Send Slack alerts if error threshold is exceeded
 * - Clean up old rate limit and error event records
 */

const ERROR_THRESHOLD = 5; // Alert if more than 5 errors in the last hour
const SLACK_WEBHOOK_URL = Deno.env.get('SLACK_ALERT_WEBHOOK');

interface ErrorStats {
  total_errors: number;
  error_4xx: number;
  error_5xx: number;
  recent_errors: Array<{
    status_code: number;
    error_type: string;
    error_message: string;
    created_at: string;
  }>;
}

serve(withSentry(async (req) => {
  const testResponse = await handleSentryTest(req);
  if (testResponse) return testResponse;

  try {
    console.log('🔍 Starting AI function monitoring check...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase credentials');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    const { data: errorEvents, error: queryError } = await supabase
      .from('function_error_events')
      .select('status_code, error_type, error_message, created_at')
      .eq('function_name', 'ai-generate')
      .gte('created_at', oneHourAgo)
      .order('created_at', { ascending: false });

    if (queryError) {
      throw new Error(`Failed to query error events: ${queryError.message}`);
    }

    const stats: ErrorStats = {
      total_errors: errorEvents?.length || 0,
      error_4xx: errorEvents?.filter(e => e.status_code >= 400 && e.status_code < 500).length || 0,
      error_5xx: errorEvents?.filter(e => e.status_code >= 500).length || 0,
      recent_errors: errorEvents?.slice(0, 10) || []
    };

    console.log(`📊 Error stats: ${stats.total_errors} total, ${stats.error_4xx} 4xx, ${stats.error_5xx} 5xx`);

    if (stats.total_errors > ERROR_THRESHOLD) {
      console.log(`⚠️  Error threshold exceeded! ${stats.total_errors} > ${ERROR_THRESHOLD}`);
      
      if (SLACK_WEBHOOK_URL) {
        await sendSlackAlert(stats);
        console.log('✅ Slack alert sent');
      } else {
        console.warn('⚠️  SLACK_ALERT_WEBHOOK not configured - skipping alert');
      }
    } else {
      console.log(`✅ Error rate within threshold (${stats.total_errors}/${ERROR_THRESHOLD})`);
    }

    console.log('🧹 Running cleanup tasks...');
    
    const { data: rateLimitCleanup, error: rateLimitError } = await supabase
      .rpc('cleanup_old_rate_limits');
    
    if (rateLimitError) {
      console.error('Failed to cleanup rate limits:', rateLimitError);
    } else {
      console.log(`✅ Cleaned up ${rateLimitCleanup || 0} old rate limit records`);
    }

    const { data: errorCleanup, error: errorCleanupError } = await supabase
      .rpc('cleanup_old_error_events');
    
    if (errorCleanupError) {
      console.error('Failed to cleanup error events:', errorCleanupError);
    } else {
      console.log(`✅ Cleaned up ${errorCleanup || 0} old error event records`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        stats,
        alert_sent: stats.total_errors > ERROR_THRESHOLD && !!SLACK_WEBHOOK_URL,
        cleanup: {
          rate_limits_removed: rateLimitCleanup || 0,
          error_events_removed: errorCleanup || 0
        }
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('❌ Monitor function error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
});

/**
 * Send alert to Slack webhook
 */
async function sendSlackAlert(stats: ErrorStats): Promise<void> {
  if (!SLACK_WEBHOOK_URL) {
    throw new Error('SLACK_ALERT_WEBHOOK not configured');
  }

  const errorBreakdown = [
    `• Total errors: ${stats.total_errors}`,
    `• 4xx errors: ${stats.error_4xx}`,
    `• 5xx errors: ${stats.error_5xx}`
  ].join('\n');

  const recentErrorsList = stats.recent_errors
    .slice(0, 5)
    .map(e => `• [${e.status_code}] ${e.error_type}: ${e.error_message}`)
    .join('\n');

  const message = {
    text: `🚨 *AI Function Error Rate Alert*`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🚨 AI Function Error Rate Alert',
          emoji: true
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `The \`ai-generate\` Edge Function has exceeded the error threshold in the last hour.`
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Error Count:*\n${stats.total_errors}`
          },
          {
            type: 'mrkdwn',
            text: `*Threshold:*\n${ERROR_THRESHOLD}`
          }
        ]
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Error Breakdown:*\n${errorBreakdown}`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Recent Errors:*\n${recentErrorsList || 'No recent errors'}`
        }
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `🕐 ${new Date().toISOString()} | <https://supabase.com/dashboard/project/ygvkegcstaowikessigx/functions|View Dashboard>`
          }
        ]
      }
    ]
  };

  const response = await fetch(SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message)
  });

  if (!response.ok) {
    throw new Error(`Slack webhook failed: ${response.status} ${response.statusText}`);
  }
}
