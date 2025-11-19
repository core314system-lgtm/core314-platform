
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OptimizationRequest {
  user_id: string;
  rule_id?: string;
  metric_type: string;
  metric_value: number;
  threshold_value: number;
  optimization_type?: 'auto' | 'manual' | 'scheduled';
  target_metric?: string;
}

serve(async (req) => {
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
    }


    return new Response(
      JSON.stringify({
        success: true,
        optimization_event_id: optimizationEvent.id,
        strategy: optimizationStrategy,
        recommended_actions: recommendedActions,
        message: 'Optimization triggered successfully',
        note: 'Optimization event created. Actual execution requires fusion_optimization_engine integration.',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
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
});
