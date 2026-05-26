import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { withSentry, breadcrumb, handleSentryTest, jsonError } from "../_shared/sentry.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(withSentry(async (req) => {
  const testResponse = await handleSentryTest(req);
  if (testResponse) return testResponse;

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const url = new URL(req.url);
    const integration = url.searchParams.get('integration');

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    let timelineQuery = supabase
      .from('fusion_weightings')
      .select('integration_id, final_weight, last_updated')
      .gte('last_updated', thirtyDaysAgo)
      .order('last_updated', { ascending: true });

    if (integration) {
      const { data: integrationData } = await supabase
        .from('integrations_master')
        .select('id')
        .eq('integration_name', integration)
        .single();

      if (integrationData) {
        timelineQuery = timelineQuery.eq('integration_id', integrationData.id);
      }
    }

    const { data: timelineData, error: timelineError } = await timelineQuery;
    if (timelineError) throw timelineError;

    const timeline = (timelineData || []).map((item: { last_updated: string; final_weight: number }) => ({
      date: new Date(item.last_updated).toISOString().split('T')[0],
      fusion_score: Math.round(item.final_weight * 50),
      variance: parseFloat((Math.random() * 0.3).toFixed(2))
    }));

    let forecastsQuery = supabase
      .from('fusion_insights')
      .select('*')
      .eq('insight_type', 'prediction')
      .order('created_at', { ascending: false })
      .limit(7);

    if (integration) {
      forecastsQuery = forecastsQuery.eq('integration_name', integration);
    }

    const { data: forecastsData, error: forecastsError } = await forecastsQuery;
    if (forecastsError) throw forecastsError;

    const forecasts = (forecastsData || []).map((_item: unknown, index: number) => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + index + 1);
      const baseScore = 75;
      const confidenceRange = 10;
      
      return {
        date: futureDate.toISOString().split('T')[0],
        predicted_score: Math.round(baseScore + (Math.random() * 10 - 5)),
        confidence_low: Math.round(baseScore - confidenceRange),
        confidence_high: Math.round(baseScore + confidenceRange)
      };
    });

    let anomaliesQuery = supabase
      .from('fusion_insights')
      .select('*')
      .eq('insight_type', 'anomaly')
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: false });

    if (integration) {
      anomaliesQuery = anomaliesQuery.eq('integration_name', integration);
    }

    const { data: anomaliesData, error: anomaliesError } = await anomaliesQuery;
    if (anomaliesError) throw anomaliesError;

    const anomalies = (anomaliesData || []).map((item: { created_at: string; confidence: number; message: string }) => ({
      date: new Date(item.created_at).toISOString().split('T')[0],
      severity: item.confidence > 0.8 ? 'high' : item.confidence > 0.5 ? 'medium' : 'low',
      type: 'variance_spike',
      message: item.message
    }));

    let actionsQuery = supabase
      .from('fusion_action_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (integration) {
      actionsQuery = actionsQuery.eq('integration_name', integration);
    }

    const { data: actionsData, error: actionsError } = await actionsQuery;
    if (actionsError) throw actionsError;

    const actions = (actionsData || []).map((item: { created_at: string; action_type: string; status: string; integration_name: string }) => ({
      timestamp: item.created_at,
      rule: item.action_type,
      result: item.status,
      integration: item.integration_name
    }));

    const visualizationData = {
      timeline,
      forecasts,
      anomalies,
      actions
    };

    await supabase.from('fusion_visual_cache').upsert({
      integration_name: integration || 'all',
      data_type: 'complete_visualization',
      data: visualizationData,
      last_updated: new Date().toISOString()
    }, {
      onConflict: 'integration_name,data_type'
    });

    return new Response(JSON.stringify({
      success: true,
      data: visualizationData
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error.message,
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}, { name: "fusion-visualize" }));