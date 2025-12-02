
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { withSentry, breadcrumb, handleSentryTest } from "../_shared/sentry.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Alert {
  alert_type: 'reliability' | 'churn' | 'onboarding' | 'signup' | 'system';
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  metadata: Record<string, any>;
  user_id?: string;
  throttle_key: string;
}

serve(withSentry(async (req) => {
  const testResponse = await handleSentryTest(req);
  if (testResponse) return testResponse;

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('Starting alert evaluation...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const alertsToCreate: Alert[] = [];
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);

    console.log('Evaluating reliability alerts...');
    
    const { data: reliabilityEvents, error: relError } = await supabase
      .from('system_reliability_events')
      .select('*')
      .gte('created_at', fiveMinutesAgo.toISOString())
      .order('created_at', { ascending: false });

    if (relError) {
      console.error('Error fetching reliability events:', relError);
    } else if (reliabilityEvents && reliabilityEvents.length > 0) {
      const criticalEvents = reliabilityEvents.filter(e => e.severity === 'critical');
      if (criticalEvents.length > 0) {
        alertsToCreate.push({
          alert_type: 'reliability',
          severity: 'critical',
          title: `${criticalEvents.length} Critical Reliability Event(s) Detected`,
          message: `Critical reliability events detected in the last 5 minutes. Modules affected: ${[...new Set(criticalEvents.map(e => e.module))].join(', ')}`,
          metadata: {
            count: criticalEvents.length,
            modules: [...new Set(criticalEvents.map(e => e.module))],
            events: criticalEvents.slice(0, 5).map(e => ({
              module: e.module,
              event_type: e.event_type,
              message: e.message,
            })),
          },
          throttle_key: 'reliability:critical:system',
        });
      }

      const errorEvents = reliabilityEvents.filter(e => e.severity === 'error');
      if (errorEvents.length > 5) {
        alertsToCreate.push({
          alert_type: 'reliability',
          severity: 'error',
          title: `High Error Rate: ${errorEvents.length} Errors in 5 Minutes`,
          message: `Detected ${errorEvents.length} error events in the last 5 minutes. This exceeds the threshold of 5 errors.`,
          metadata: {
            count: errorEvents.length,
            modules: [...new Set(errorEvents.map(e => e.module))],
            threshold: 5,
          },
          throttle_key: 'reliability:error_burst:system',
        });
      }

      const latencyEvents = reliabilityEvents.filter(e => e.latency_ms !== null && e.latency_ms > 0);
      if (latencyEvents.length > 0) {
        const avgLatency = latencyEvents.reduce((sum, e) => sum + (e.latency_ms || 0), 0) / latencyEvents.length;
        if (avgLatency > 1400) {
          alertsToCreate.push({
            alert_type: 'reliability',
            severity: 'warning',
            title: `High Average Latency: ${Math.round(avgLatency)}ms`,
            message: `Average API latency is ${Math.round(avgLatency)}ms over the last 5 minutes, exceeding the 1400ms threshold.`,
            metadata: {
              avg_latency_ms: Math.round(avgLatency),
              threshold_ms: 1400,
              sample_count: latencyEvents.length,
            },
            throttle_key: 'reliability:latency_spike:system',
          });
        }
      }
    }

    console.log('Evaluating churn alerts...');
    
    const { data: churnScores, error: churnError } = await supabase
      .from('user_churn_scores')
      .select('*, profiles(full_name, email)')
      .gte('churn_score', 0.7)
      .order('churn_score', { ascending: false });

    if (churnError) {
      console.error('Error fetching churn scores:', churnError);
    } else if (churnScores && churnScores.length > 0) {
      for (const score of churnScores) {
        const user = score.profiles as any;
        
        if (score.churn_score >= 0.9) {
          const { data: existingAlert } = await supabase
            .from('alerts')
            .select('id')
            .eq('throttle_key', `churn:critical:user_${score.user_id}`)
            .eq('is_resolved', false)
            .single();

          if (!existingAlert) {
            alertsToCreate.push({
              alert_type: 'churn',
              severity: 'critical',
              title: `Critical Churn Risk: ${user?.full_name || 'User'}`,
              message: `User ${user?.email || score.user_id} has a churn score of ${(score.churn_score * 100).toFixed(1)}%, indicating imminent churn risk.`,
              metadata: {
                churn_score: score.churn_score,
                user_email: user?.email,
                user_name: user?.full_name,
                prediction_reason: score.prediction_reason,
                sessions_last_7d: score.sessions_last_7d,
                events_last_7d: score.events_last_7d,
                streak_days: score.streak_days,
              },
              user_id: score.user_id,
              throttle_key: `churn:critical:user_${score.user_id}`,
            });
          }
        }
        else if (score.churn_score >= 0.7) {
          const { data: existingAlert } = await supabase
            .from('alerts')
            .select('id')
            .eq('throttle_key', `churn:warning:user_${score.user_id}`)
            .eq('is_resolved', false)
            .single();

          if (!existingAlert) {
            alertsToCreate.push({
              alert_type: 'churn',
              severity: 'warning',
              title: `Elevated Churn Risk: ${user?.full_name || 'User'}`,
              message: `User ${user?.email || score.user_id} has a churn score of ${(score.churn_score * 100).toFixed(1)}%, indicating elevated churn risk.`,
              metadata: {
                churn_score: score.churn_score,
                user_email: user?.email,
                user_name: user?.full_name,
                prediction_reason: score.prediction_reason,
                sessions_last_7d: score.sessions_last_7d,
                events_last_7d: score.events_last_7d,
                streak_days: score.streak_days,
              },
              user_id: score.user_id,
              throttle_key: `churn:warning:user_${score.user_id}`,
            });
          }
        }
      }
    }

    console.log('Evaluating onboarding alerts...');
    
    const { data: stuckUsers, error: onboardingError } = await supabase
      .from('beta_users')
      .select('*, profiles(full_name, email)')
      .eq('onboarding_completed', false)
      .lt('created_at', twentyFourHoursAgo.toISOString());

    if (onboardingError) {
      console.error('Error fetching stuck onboarding users:', onboardingError);
    } else if (stuckUsers && stuckUsers.length > 0) {
      for (const user of stuckUsers) {
        const profile = user.profiles as any;
        
        const { data: existingAlert } = await supabase
          .from('alerts')
          .select('id')
          .eq('throttle_key', `onboarding:stuck:user_${user.user_id}`)
          .eq('is_resolved', false)
          .single();

        if (!existingAlert) {
          const hoursSinceCreated = Math.floor((now.getTime() - new Date(user.created_at).getTime()) / (1000 * 60 * 60));
          
          alertsToCreate.push({
            alert_type: 'onboarding',
            severity: 'warning',
            title: `Onboarding Stuck: ${profile?.full_name || 'User'}`,
            message: `User ${profile?.email || user.user_id} has been stuck in onboarding for ${hoursSinceCreated} hours without completing.`,
            metadata: {
              user_email: profile?.email,
              user_name: profile?.full_name,
              hours_stuck: hoursSinceCreated,
              created_at: user.created_at,
              current_step: user.current_step,
            },
            user_id: user.user_id,
            throttle_key: `onboarding:stuck:user_${user.user_id}`,
          });
        }
      }
    }

    console.log('Evaluating signup alerts...');
    
    const { data: signupFailures, error: signupError } = await supabase
      .from('system_reliability_events')
      .select('*')
      .eq('module', 'signup')
      .eq('event_type', 'failed_attempt')
      .gte('created_at', tenMinutesAgo.toISOString());

    if (signupError) {
      console.error('Error fetching signup failures:', signupError);
    } else if (signupFailures && signupFailures.length > 3) {
      const failuresByEmail: Record<string, number> = {};
      signupFailures.forEach(f => {
        const email = f.metadata?.email || 'unknown';
        failuresByEmail[email] = (failuresByEmail[email] || 0) + 1;
      });

      for (const [email, count] of Object.entries(failuresByEmail)) {
        if (count > 3) {
          alertsToCreate.push({
            alert_type: 'signup',
            severity: 'warning',
            title: `Multiple Signup Failures: ${email}`,
            message: `Detected ${count} failed signup attempts for ${email} in the last 10 minutes.`,
            metadata: {
              email,
              failure_count: count,
              time_window_minutes: 10,
            },
            throttle_key: `signup:burst_failures:${email}`,
          });
        }
      }
    }

    console.log(`Found ${alertsToCreate.length} potential alerts. Checking throttle...`);
    
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
    const alertsToInsert: Alert[] = [];

    for (const alert of alertsToCreate) {
      const { data: throttle } = await supabase
        .from('alert_throttle')
        .select('last_sent')
        .eq('throttle_key', alert.throttle_key)
        .single();

      if (throttle && new Date(throttle.last_sent) > thirtyMinutesAgo) {
        console.log(`Throttled: ${alert.throttle_key} (last sent ${throttle.last_sent})`);
        continue;
      }

      alertsToInsert.push(alert);

      await supabase
        .from('alert_throttle')
        .upsert({
          throttle_key: alert.throttle_key,
          alert_type: alert.alert_type,
          last_sent: now.toISOString(),
        }, {
          onConflict: 'throttle_key',
        });
    }

    console.log(`Inserting ${alertsToInsert.length} alerts after throttle check...`);

    if (alertsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('alerts')
        .insert(alertsToInsert.map(a => ({
          alert_type: a.alert_type,
          severity: a.severity,
          title: a.title,
          message: a.message,
          metadata: a.metadata,
          user_id: a.user_id || null,
          throttle_key: a.throttle_key,
        })));

      if (insertError) {
        console.error('Error inserting alerts:', insertError);
        throw insertError;
      }

      await sendNotifications(alertsToInsert);
    }

    console.log('Alert evaluation complete.');

    return new Response(
      JSON.stringify({
        success: true,
        evaluated_at: now.toISOString(),
        alerts_created: alertsToInsert.length,
        alerts_throttled: alertsToCreate.length - alertsToInsert.length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Fatal error in evaluate-alerts:', error);

    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      await supabase
        .from('system_reliability_events')
        .insert({
          event_type: 'cron_failure',
          module: 'alerts_engine',
          severity: 'error',
          message: `Alert evaluation failed: ${error.message}`,
          metadata: {
            error: error.message,
            stack: error.stack,
          },
        });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});


async function sendNotifications(alerts: Alert[]) {
  for (const alert of alerts) {
    try {
      if (['warning', 'error', 'critical'].includes(alert.severity)) {
        await sendSlackNotification(alert);
      }

      if (['error', 'critical'].includes(alert.severity)) {
        await sendEmailNotification(alert);
      }
    } catch (error) {
      console.error(`Failed to send notification for alert ${alert.throttle_key}:`, error);
    }
  }
}

async function sendSlackNotification(alert: Alert) {
  const webhookUrl = Deno.env.get('ALERTS_SLACK_WEBHOOK_URL');
  if (!webhookUrl) {
    console.warn('ALERTS_SLACK_WEBHOOK_URL not configured, skipping Slack notification');
    return;
  }

  const color = {
    info: '#36a64f',
    warning: '#ffcc00',
    error: '#ff9900',
    critical: '#ff0000',
  }[alert.severity];

  const payload = {
    attachments: [{
      color,
      title: `🚨 ${alert.title}`,
      text: alert.message,
      fields: [
        { title: 'Type', value: alert.alert_type, short: true },
        { title: 'Severity', value: alert.severity.toUpperCase(), short: true },
      ],
      footer: 'Core314 Alerts',
      ts: Math.floor(Date.now() / 1000),
    }],
  };

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    console.error('Slack notification failed:', await response.text());
  } else {
    console.log(`Slack notification sent for ${alert.throttle_key}`);
  }
}

async function sendEmailNotification(alert: Alert) {
  const sendgridApiKey = Deno.env.get('SENDGRID_API_KEY');
  if (!sendgridApiKey) {
    console.warn('SENDGRID_API_KEY not configured, skipping email notification');
    return;
  }

  const payload = {
    personalizations: [{
      to: [{ email: 'support@core314.com' }],
      subject: `Core314 ALERT: ${alert.title}`,
    }],
    from: { email: 'alerts@core314.com', name: 'Core314 Alerts' },
    content: [{
      type: 'text/html',
      value: `
        <!DOCTYPE html>
        <html>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #f8f9fa; border-left: 4px solid ${alert.severity === 'critical' ? '#dc2626' : '#f97316'}; padding: 20px; margin-bottom: 20px;">
              <h2 style="margin: 0 0 10px 0; color: #1f2937;">🚨 ${alert.title}</h2>
              <p style="margin: 0; color: #6b7280; font-size: 14px;">
                <strong>Type:</strong> ${alert.alert_type} | <strong>Severity:</strong> ${alert.severity.toUpperCase()}
              </p>
            </div>
            <div style="padding: 20px; background: white; border: 1px solid #e5e7eb; border-radius: 8px;">
              <p style="color: #374151; line-height: 1.6;">${alert.message}</p>
              ${alert.metadata && Object.keys(alert.metadata).length > 0 ? `
                <div style="margin-top: 20px; padding: 15px; background: #f9fafb; border-radius: 6px;">
                  <h3 style="margin: 0 0 10px 0; font-size: 14px; color: #6b7280;">Additional Details:</h3>
                  <pre style="margin: 0; font-size: 12px; color: #4b5563; overflow-x: auto;">${JSON.stringify(alert.metadata, null, 2)}</pre>
                </div>
              ` : ''}
            </div>
            <div style="margin-top: 20px; padding: 15px; text-align: center; color: #9ca3af; font-size: 12px;">
              <p style="margin: 0;">Core314 Automated Alerts System</p>
              <p style="margin: 5px 0 0 0;">View all alerts at <a href="https://admin.core314.com" style="color: #3b82f6;">admin.core314.com</a></p>
            </div>
          </body>
        </html>
      `,
    }],
  };

  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${sendgridApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    console.error('SendGrid email failed:', await response.text());
  } else {
    console.log(`Email notification sent for ${alert.throttle_key}`);
  }
}
