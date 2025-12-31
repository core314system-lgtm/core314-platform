
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as Sentry from 'https://deno.land/x/sentry@7.119.0/index.mjs';
import { withSentry, breadcrumb, handleSentryTest, jsonError } from "../_shared/sentry.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SENTRY_DSN = Deno.env.get('SENTRY_DSN');
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: Deno.env.get('ENVIRONMENT') || 'production',
    release: 'phase59-action-debug',
    tracesSampleRate: 0.1,
  });
}

interface OptimizationRequest {
  user_id: string;
  rule_id?: string;
  metric_type: string;
  metric_value: number;
  threshold_value: number;
  optimization_type?: 'auto' | 'manual' | 'scheduled';
  target_metric?: string;
  email_to?: string;
}

serve(withSentry(async (req) => {
  const testResponse = await handleSentryTest(req);
  if (testResponse) return testResponse;

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const optimizationData: OptimizationRequest = await req.json();

    if (!optimizationData.user_id) {
      return new Response(
        JSON.stringify({ error: 'user_id is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('Optimization triggered:', {
      user_id: optimizationData.user_id,
      metric_type: optimizationData.metric_type,
      metric_value: optimizationData.metric_value,
      threshold: optimizationData.threshold_value,
    });

    const { data: optimizationEvent, error: eventError } = await supabaseClient
      .from('fusion_optimization_events')
      .insert({
        source_event_type: `smart_agent_${optimizationData.metric_type}`,
        efficiency_index: optimizationData.metric_value,
        optimization_action: optimizationData.optimization_type || 'auto',
        parameter_delta: {
          triggered_by: 'smart_agent',
          rule_id: optimizationData.rule_id,
          metric_type: optimizationData.metric_type,
          threshold: optimizationData.threshold_value,
          current_value: optimizationData.metric_value,
        },
        applied: false,
      })
      .select()
      .single();

    if (eventError) {
      console.error('Error creating optimization event:', eventError);
      
      if (SENTRY_DSN) {
        Sentry.captureException(eventError, {
          extra: {
            function: 'fusion_live_optimizer',
            user_id: optimizationData.user_id,
            metric_type: optimizationData.metric_type,
            optimization_type: optimizationData.optimization_type,
            error_code: eventError.code,
            error_details: eventError.details,
            error_hint: eventError.hint,
          },
          tags: {
            function: 'fusion_live_optimizer',
            error_type: 'database_insert_event',
          },
        });
        await Sentry.flush(2000);
      }
      
      return new Response(
        JSON.stringify({ 
          error: 'Failed to create optimization event',
          details: eventError.message 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    let optimizationStrategy = 'general';
    let recommendedActions: string[] = [];

    if (optimizationData.metric_type === 'efficiency_index') {
      optimizationStrategy = 'efficiency_boost';
      recommendedActions = [
        'Analyze slow-running queries and optimize indexes',
        'Review integration sync frequencies and adjust',
        'Check for redundant data processing',
        'Optimize fusion score calculation weights',
      ];
    } else if (optimizationData.metric_type === 'fusion_score') {
      optimizationStrategy = 'fusion_enhancement';
      recommendedActions = [
        'Review integration health and reconnect failed integrations',
        'Analyze data quality and fix inconsistencies',
        'Adjust fusion weighting factors based on recent patterns',
        'Trigger data refresh for stale integrations',
      ];
    } else if (optimizationData.metric_type === 'integration_health') {
      optimizationStrategy = 'integration_recovery';
      recommendedActions = [
        'Retry failed integration connections',
        'Refresh OAuth tokens for expired integrations',
        'Check API rate limits and adjust sync schedules',
        'Validate integration credentials',
      ];
    }

    const { error: actionLogError } = await supabaseClient
      .from('fusion_action_log')
      .insert({
        user_id: optimizationData.user_id,
        action_type: 'optimization_triggered',
        action_details: {
          strategy: optimizationStrategy,
          recommended_actions: recommendedActions,
          optimization_event_id: optimizationEvent.id,
          triggered_by: 'smart_agent',
          rule_id: optimizationData.rule_id,
        },
        status: 'completed',
      });

    if (actionLogError) {
      console.warn('Failed to log action:', actionLogError);
      
      if (SENTRY_DSN) {
        Sentry.captureMessage('Failed to log action to fusion_action_log', {
          level: 'warning',
          extra: {
            function: 'fusion_live_optimizer',
            user_id: optimizationData.user_id,
            error_message: actionLogError.message,
          },
        });
      }
    }

    const { data: optimizationResult, error: resultError } = await supabaseClient
      .from('fusion_optimization_results')
      .insert({
        user_id: optimizationData.user_id,
        rule_id: optimizationData.rule_id || null,
        optimization_event_id: optimizationEvent.id,
        strategy: optimizationStrategy,
        recommended_actions: recommendedActions,
        result: {
          metric_type: optimizationData.metric_type,
          metric_value: optimizationData.metric_value,
          threshold_value: optimizationData.threshold_value,
          optimization_type: optimizationData.optimization_type || 'auto',
          triggered_at: new Date().toISOString(),
        },
        status: 'pending',
      })
      .select()
      .single();

    if (resultError) {
      console.warn('Failed to create optimization result:', resultError);
      
      if (SENTRY_DSN) {
        Sentry.captureMessage('Failed to create optimization result', {
          level: 'warning',
          extra: {
            function: 'fusion_live_optimizer',
            user_id: optimizationData.user_id,
            error_message: resultError.message,
          },
        });
      }
    }

    const emailTo = optimizationData.email_to || Deno.env.get('ADMIN_EMAIL') || 'admin@core314.com';
    const emailNotificationResponse = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/core_notifications_gateway`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: optimizationData.user_id,
          type: 'info',
          title: `Optimization Triggered: ${optimizationStrategy}`,
          message: `Optimization has been triggered for ${optimizationData.metric_type}.\n\nRecommended Actions:\n${recommendedActions.map((a, i) => `${i + 1}. ${a}`).join('\n')}`,
          delivery: 'email',
          email_to: emailTo,
          metadata: {
            optimization_event_id: optimizationEvent.id,
            optimization_result_id: optimizationResult?.id,
            strategy: optimizationStrategy
          }
        })
      }
    );

    let emailDeliveryStatus = 'not_attempted';
    if (emailNotificationResponse.ok) {
      const emailResult = await emailNotificationResponse.json();
      emailDeliveryStatus = emailResult.external_delivery?.[0]?.success ? 'success' : 'failed';
    } else {
      emailDeliveryStatus = 'failed';
    }

    return new Response(
      JSON.stringify({
        success: true,
        optimization_event_id: optimizationEvent.id,
        optimization_result_id: optimizationResult?.id || null,
        strategy: optimizationStrategy,
        recommended_actions: recommendedActions,
        email_delivery_status: emailDeliveryStatus,
        message: 'Optimization triggered successfully',
        note: 'Optimization event and result created. Email notification sent. Actual execution requires fusion_optimization_engine integration.',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    
    if (SENTRY_DSN) {
      Sentry.captureException(error, {
        extra: {
          function: 'fusion_live_optimizer',
          error_message: error.message,
          error_stack: error.stack,
        },
        tags: {
          function: 'fusion_live_optimizer',
          error_type: 'unexpected',
        },
      });
      await Sentry.flush(2000);
    }
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}, { name: "fusion_live_optimizer" }));