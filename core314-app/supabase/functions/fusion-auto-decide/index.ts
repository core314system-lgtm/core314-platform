import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { withSentry, breadcrumb, handleSentryTest } from "../_shared/sentry.ts";

interface AutoDecideRequest {
  manual?: boolean;
}

serve(withSentry(async (req) => {
  const testResponse = await handleSentryTest(req);
  if (testResponse) return testResponse;

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const authHeader = req.headers.get('Authorization')!;
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { manual = false }: AutoDecideRequest = await req.json();
    const startTime = Date.now();

    const { data: rules, error: rulesError } = await supabase
      .from('fusion_automation_rules')
      .select('*')
      .eq('enabled', true);

    if (rulesError) throw rulesError;
    if (!rules || rules.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No active rules found',
        actionsExecuted: 0
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: insights, error: insightsError } = await supabase
      .from('fusion_insights')
      .select('*')
      .gte('created_at', twentyFourHoursAgo)
      .order('created_at', { ascending: false });

    if (insightsError) throw insightsError;
    if (!insights || insights.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No recent insights found',
        actionsExecuted: 0
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let actionsExecuted = 0;
    let actionsSucceeded = 0;
    let actionsFailed = 0;

    for (const rule of rules) {
      for (const insight of insights) {
        if (insight.integration_name !== rule.integration_name) continue;
        if (insight.insight_type !== rule.condition_type) continue;

        const matches = evaluateCondition(
          insight.message,
          insight.metadata,
          rule.condition_operator,
          rule.condition_value
        );

        if (matches) {
          const result = await executeAction(supabase, rule, insight);
          actionsExecuted++;
          
          if (result.success) {
            actionsSucceeded++;
          } else {
            actionsFailed++;
          }

          await supabase.from('fusion_action_log').insert({
            rule_id: rule.id,
            integration_name: insight.integration_name,
            insight_id: insight.id,
            action_type: rule.action_type,
            action_result: result.message,
            status: result.success ? 'success' : 'failed'
          });
        }
      }
    }

    await supabase.from('fusion_audit_log').insert({
      user_id: null,
      integration_id: null,
      event_type: 'automated_action',
      metrics_count: actionsExecuted,
      triggered_by: manual ? 'user' : 'scheduled',
      execution_time_ms: Date.now() - startTime,
      status: 'success'
    });

    return new Response(JSON.stringify({
      success: true,
      actionsExecuted,
      actionsSucceeded,
      actionsFailed,
      executionTimeMs: Date.now() - startTime
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error.message,
      success: false
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

function evaluateCondition(
  message: string,
  metadata: Record<string, unknown> | null | undefined,
  operator: string,
  value: string
): boolean {
  switch (operator) {
    case 'contains':
      return message.toLowerCase().includes(value.toLowerCase());
    case '=':
      return message.toLowerCase() === value.toLowerCase();
    case '>': {
      const numValue = parseFloat(value);
      if (metadata && typeof metadata.variance === 'number') return metadata.variance > numValue;
      if (metadata && typeof metadata.trend_value === 'number') return metadata.trend_value > numValue;
      return false;
    }
    case '<': {
      const numValueLt = parseFloat(value);
      if (metadata && typeof metadata.variance === 'number') return metadata.variance < numValueLt;
      if (metadata && typeof metadata.trend_value === 'number') return metadata.trend_value < numValueLt;
      return false;
    }
    default:
      return false;
  }
}

interface AutomationRule {
  id: string;
  rule_name: string;
  integration_name: string;
  condition_type: string;
  condition_operator: string;
  condition_value: string;
  action_type: string;
  action_target: string;
  enabled: boolean;
  created_at: string;
}

interface FusionInsight {
  id: string;
  user_id: string;
  integration_id: string;
  integration_name: string;
  insight_type: string;
  message: string;
  confidence: number;
  metadata?: Record<string, unknown>;
  created_at: string;
}

async function executeAction(
  supabase: ReturnType<typeof createClient>,
  rule: AutomationRule,
  insight: FusionInsight
): Promise<{ success: boolean; message: string }> {
  try {
    switch (rule.action_type) {
      case 'notify_slack':
        return await sendSlackNotification(rule.action_target, rule, insight);
      
      case 'notify_email':
        return await sendEmailNotification(rule.action_target, rule, insight);
      
      case 'adjust_weight':
        return await adjustWeight(supabase, insight, rule);
      
      case 'trigger_function':
        return await triggerFunction(rule.action_target);
      
      default:
        return { success: false, message: 'Unknown action type' };
    }
  } catch (error) {
    return { success: false, message: error.message };
  }
}

async function sendSlackNotification(
  webhookUrl: string,
  rule: AutomationRule,
  insight: FusionInsight
): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `⚠️ Core314 Alert: ${insight.integration_name} triggered rule "${rule.rule_name}".\n\nInsight: ${insight.message}\nConfidence: ${(insight.confidence * 100).toFixed(0)}%`
      })
    });

    if (!response.ok) {
      throw new Error(`Slack API error: ${response.statusText}`);
    }

    return { success: true, message: 'Slack notification sent' };
  } catch (error) {
    return { success: false, message: `Slack error: ${error.message}` };
  }
}

async function sendEmailNotification(
  emailConfig: string,
  rule: AutomationRule,
  insight: FusionInsight
): Promise<{ success: boolean; message: string }> {
  try {
    const config = JSON.parse(emailConfig);
    
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        personalizations: [{
          to: [{ email: config.to }]
        }],
        from: { email: 'noreply@core314.com', name: 'Core314 Automation' },
        subject: `Core314 Alert: ${rule.rule_name}`,
        content: [{
          type: 'text/plain',
          value: `Fusion Intelligence detected an event in ${insight.integration_name}.\n\nRule: ${rule.rule_name}\nInsight: ${insight.message}\nConfidence: ${(insight.confidence * 100).toFixed(0)}%`
        }]
      })
    });

    if (!response.ok) {
      throw new Error(`SendGrid API error: ${response.statusText}`);
    }

    return { success: true, message: 'Email notification sent' };
  } catch (error) {
    return { success: false, message: `Email error: ${error.message}` };
  }
}

async function adjustWeight(
  supabase: ReturnType<typeof createClient>,
  insight: FusionInsight,
  rule: AutomationRule
): Promise<{ success: boolean; message: string }> {
  try {
    const { data: weights } = await supabase
      .from('fusion_weightings')
      .select('*')
      .eq('integration_id', insight.integration_id)
      .limit(1);

    if (!weights || weights.length === 0) {
      return { success: false, message: 'No weights found for integration' };
    }

    const weight = weights[0];
    const adjustmentPercent = parseFloat(rule.condition_value) || 0.1;
    const newWeight = Math.max(0.1, Math.min(2.0, weight.final_weight * (1 + adjustmentPercent)));

    await supabase
      .from('fusion_weightings')
      .update({ 
        final_weight: newWeight,
        last_updated: new Date().toISOString()
      })
      .eq('id', weight.id);

    return { success: true, message: `Weight adjusted from ${weight.final_weight.toFixed(2)} to ${newWeight.toFixed(2)}` };
  } catch (error) {
    return { success: false, message: `Weight adjustment error: ${error.message}` };
  }
}

async function triggerFunction(
  functionUrl: string
): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`Function trigger error: ${response.statusText}`);
    }

    return { success: true, message: 'Function triggered successfully' };
  } catch (error) {
    return { success: false, message: `Function trigger error: ${error.message}` };
  }
}
