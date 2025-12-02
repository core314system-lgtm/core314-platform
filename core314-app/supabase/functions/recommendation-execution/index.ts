
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { withSentry, breadcrumb, handleSentryTest } from "../_shared/sentry.ts";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY');
const SLACK_WEBHOOK_URL = Deno.env.get('SLACK_WEBHOOK_URL');

interface ExecutionRequest {
  user_id?: string;
  recommendation_id: string;
  execution_mode?: 'immediate' | 'scheduled' | 'manual_trigger';
  override_approval?: boolean;
}

interface ExecutionResult {
  success: boolean;
  recommendation_id: string;
  execution_status: 'completed' | 'failed' | 'partial';
  execution_details: Record<string, any>;
  actions_performed: Array<{
    action_type: string;
    target: string;
    status: 'success' | 'failed';
    message?: string;
  }>;
  error?: string;
}

async function authenticateRequest(req: Request): Promise<{ userId: string; supabase: any }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    throw new Error('Missing Authorization header');
  }

  const token = authHeader.replace('Bearer ', '');
  
  const userSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: authHeader } }
  });
  
  const { data: { user }, error: userError } = await userSupabase.auth.getUser(token);
  
  if (user && !userError) {
    return { userId: user.id, supabase: userSupabase };
  }
  
  if (token === SUPABASE_SERVICE_ROLE_KEY) {
    const body = await req.json();
    if (!body.user_id) {
      throw new Error('user_id required when using service role key');
    }
    
    const serviceSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    return { userId: body.user_id, supabase: serviceSupabase };
  }
  
  throw new Error('Invalid authentication token');
}

async function sendEmailNotification(
  to: string,
  subject: string,
  content: string
): Promise<{ success: boolean; message?: string }> {
  if (!SENDGRID_API_KEY) {
    return { success: false, message: 'SendGrid API key not configured' };
  }
  
  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: 'notifications@core314.com', name: 'Core314 AI' },
        subject,
        content: [{ type: 'text/html', value: content }],
      }),
    });
    
    if (response.ok) {
      return { success: true };
    } else {
      const error = await response.text();
      return { success: false, message: `SendGrid error: ${error}` };
    }
  } catch (error) {
    return { success: false, message: `Email send failed: ${error.message}` };
  }
}

async function sendSlackNotification(
  message: string,
  channel?: string
): Promise<{ success: boolean; message?: string }> {
  if (!SLACK_WEBHOOK_URL) {
    return { success: false, message: 'Slack webhook URL not configured' };
  }
  
  try {
    const response = await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: message,
        channel: channel || '#core314-alerts',
      }),
    });
    
    if (response.ok) {
      return { success: true };
    } else {
      const error = await response.text();
      return { success: false, message: `Slack error: ${error}` };
    }
  } catch (error) {
    return { success: false, message: `Slack send failed: ${error.message}` };
  }
}

async function sendTeamsNotification(
  message: string
): Promise<{ success: boolean; message?: string }> {
  return { success: false, message: 'Teams integration not yet implemented' };
}

async function createInternalTask(
  supabase: any,
  userId: string,
  taskDetails: Record<string, any>
): Promise<{ success: boolean; message?: string }> {
  try {
    const { error } = await supabase
      .from('insight_logs')
      .insert({
        user_id: userId,
        insight_text: taskDetails.title || 'AI-generated task',
        insight_category: 'automation',
        confidence_score: taskDetails.confidence || 0.8,
        impact_score: taskDetails.impact || 0.7,
        related_metrics: taskDetails.related_metrics || [],
        context_data: taskDetails,
      });
    
    if (error) {
      return { success: false, message: `Failed to create task: ${error.message}` };
    }
    
    return { success: true };
  } catch (error) {
    return { success: false, message: `Task creation failed: ${error.message}` };
  }
}

async function adjustThreshold(
  supabase: any,
  userId: string,
  thresholdDetails: Record<string, any>
): Promise<{ success: boolean; message?: string }> {
  try {
    const { metric_name, new_threshold } = thresholdDetails;
    
    const { error } = await supabase
      .from('metric_thresholds')
      .upsert({
        user_id: userId,
        metric_name,
        threshold_value: new_threshold,
        threshold_type: 'upper',
        updated_at: new Date().toISOString(),
      });
    
    if (error) {
      return { success: false, message: `Failed to adjust threshold: ${error.message}` };
    }
    
    return { success: true };
  } catch (error) {
    return { success: false, message: `Threshold adjustment failed: ${error.message}` };
  }
}

async function executeAction(
  actionType: string,
  actionTarget: string,
  actionPayload: Record<string, any>,
  supabase: any,
  userId: string
): Promise<{ status: 'success' | 'failed'; message?: string }> {
  
  switch (actionType) {
    case 'send_notification':
      if (actionTarget === 'email') {
        const result = await sendEmailNotification(
          actionPayload.to || actionPayload.email,
          actionPayload.subject || 'Core314 AI Recommendation',
          actionPayload.content || actionPayload.message
        );
        return { status: result.success ? 'success' : 'failed', message: result.message };
      } else if (actionTarget === 'slack') {
        const result = await sendSlackNotification(
          actionPayload.message,
          actionPayload.channel
        );
        return { status: result.success ? 'success' : 'failed', message: result.message };
      } else if (actionTarget === 'teams') {
        const result = await sendTeamsNotification(actionPayload.message);
        return { status: result.success ? 'success' : 'failed', message: result.message };
      }
      return { status: 'failed', message: `Unknown notification target: ${actionTarget}` };
    
    case 'create_task':
      const taskResult = await createInternalTask(supabase, userId, actionPayload);
      return { status: taskResult.success ? 'success' : 'failed', message: taskResult.message };
    
    case 'adjust_threshold':
      const thresholdResult = await adjustThreshold(supabase, userId, actionPayload);
      return { status: thresholdResult.success ? 'success' : 'failed', message: thresholdResult.message };
    
    case 'trigger_workflow':
      return { status: 'success', message: 'Workflow triggered (placeholder)' };
    
    default:
      return { status: 'failed', message: `Unknown action type: ${actionType}` };
  }
}

serve(withSentry(async (req) => {
  const testResponse = await handleSentryTest(req);
  if (testResponse) return testResponse;

  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    });
  }

  try {
    const { userId, supabase } = await authenticateRequest(req);
    const body: ExecutionRequest = await req.json();
    const { recommendation_id, execution_mode = 'immediate', override_approval = false } = body;
    
    if (!recommendation_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required field: recommendation_id' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    const startTime = Date.now();
    
    const { data: recommendation, error: fetchError } = await supabase
      .from('recommendation_queue')
      .select('*, decision_events(*)')
      .eq('id', recommendation_id)
      .eq('user_id', userId)
      .single();
    
    if (fetchError || !recommendation) {
      throw new Error('Recommendation not found or access denied');
    }
    
    if (recommendation.requires_approval && 
        recommendation.approval_status === 'pending' && 
        !override_approval) {
      throw new Error('Recommendation requires approval before execution');
    }
    
    if (recommendation.execution_status === 'completed') {
      throw new Error('Recommendation has already been executed');
    }
    
    if (recommendation.expires_at && new Date(recommendation.expires_at) < new Date()) {
      await supabase
        .from('recommendation_queue')
        .update({ execution_status: 'expired', updated_at: new Date().toISOString() })
        .eq('id', recommendation_id);
      throw new Error('Recommendation has expired');
    }
    
    await supabase
      .from('recommendation_queue')
      .update({
        execution_status: 'in_progress',
        last_execution_attempt: new Date().toISOString(),
        execution_attempts: (recommendation.execution_attempts || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', recommendation_id);
    
    const actionResult = await executeAction(
      recommendation.action_type,
      recommendation.action_target,
      recommendation.action_payload,
      supabase,
      userId
    );
    
    const executionDuration = Date.now() - startTime;
    const executionSuccess = actionResult.status === 'success';
    
    await supabase
      .from('recommendation_queue')
      .update({
        execution_status: executionSuccess ? 'completed' : 'failed',
        execution_result: {
          action_type: recommendation.action_type,
          target: recommendation.action_target,
          status: actionResult.status,
          message: actionResult.message,
          duration_ms: executionDuration,
        },
        execution_error: executionSuccess ? null : actionResult.message,
        completed_at: executionSuccess ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', recommendation_id);
    
    if (recommendation.decision_event_id) {
      await supabase
        .from('decision_events')
        .update({
          status: executionSuccess ? 'executed' : 'failed',
          executed_at: new Date().toISOString(),
          executed_by: userId,
          execution_result: {
            recommendation_id,
            status: actionResult.status,
            duration_ms: executionDuration,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', recommendation.decision_event_id);
    }
    
    await supabase.rpc('log_decision_event', {
      p_user_id: userId,
      p_decision_event_id: recommendation.decision_event_id,
      p_event_type: 'recommendation_executed',
      p_event_category: 'execution',
      p_event_description: `Executed ${recommendation.action_type} action: ${actionResult.status}`,
      p_actor_id: userId,
      p_actor_type: execution_mode === 'manual_trigger' ? 'user' : 'automation',
      p_previous_state: { execution_status: 'in_progress' },
      p_new_state: { execution_status: executionSuccess ? 'completed' : 'failed' },
      p_metadata: {
        recommendation_id,
        action_type: recommendation.action_type,
        duration_ms: executionDuration,
      },
    });
    
    const response: ExecutionResult = {
      success: true,
      recommendation_id,
      execution_status: executionSuccess ? 'completed' : 'failed',
      execution_details: {
        duration_ms: executionDuration,
        action_type: recommendation.action_type,
        target: recommendation.action_target,
      },
      actions_performed: [
        {
          action_type: recommendation.action_type,
          target: recommendation.action_target,
          status: actionResult.status,
          message: actionResult.message,
        },
      ],
    };
    
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
    
  } catch (error) {
    console.error('Recommendation Execution error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
}), { name: "recommendation-execution" }));