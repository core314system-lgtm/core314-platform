import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface AggregatedMetrics {
  message_volume: number;
  activity_frequency: number;
  response_timing: number;
  channel_activity: number;
  meeting_activity: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const { data: activeIntegrations, error: intError } = await supabase
      .from('user_integrations')
      .select(`
        id,
        user_id,
        integration_id,
        provider_id,
        status,
        integration_registry (
          service_name
        )
      `)
      .eq('status', 'active')
      .eq('added_by_user', true);

    if (intError) {
      console.error('[aggregate-metrics] Error fetching integrations:', intError);
      return new Response(JSON.stringify({ error: 'Failed to fetch integrations' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!activeIntegrations || activeIntegrations.length === 0) {
      return new Response(JSON.stringify({ message: 'No active integrations found', processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let processedCount = 0;
    const errors: string[] = [];

    for (const integration of activeIntegrations) {
      try {
        const registryData = integration.integration_registry;
        const registry = Array.isArray(registryData) ? registryData[0] : registryData;
        const serviceName = registry?.service_name;

        if (!serviceName || (serviceName !== 'slack' && serviceName !== 'microsoft_teams')) {
          continue;
        }

        const { data: recentEvents } = await supabase
          .from('integration_events')
          .select('event_type, occurred_at, metadata')
          .eq('user_id', integration.user_id)
          .eq('service_name', serviceName)
          .gte('occurred_at', dayAgo.toISOString())
          .order('occurred_at', { ascending: false });

        const { data: weeklyEvents } = await supabase
          .from('integration_events')
          .select('event_type, occurred_at, metadata')
          .eq('user_id', integration.user_id)
          .eq('service_name', serviceName)
          .gte('occurred_at', weekAgo.toISOString());

        const metrics = calculateMetrics(recentEvents || [], weeklyEvents || [], serviceName);

        const metricMappings = [
          { name: `${serviceName}_message_volume`, type: 'count', value: metrics.message_volume },
          { name: `${serviceName}_activity_frequency`, type: 'count', value: metrics.activity_frequency },
          { name: `${serviceName}_response_timing`, type: 'average', value: metrics.response_timing },
          { name: `${serviceName}_channel_activity`, type: 'count', value: metrics.channel_activity },
        ];

        if (serviceName === 'microsoft_teams') {
          metricMappings.push({ name: 'teams_meeting_activity', type: 'count', value: metrics.meeting_activity });
        }

        for (const metric of metricMappings) {
          if (metric.value > 0) {
            const { data: historical } = await supabase
              .from('fusion_metrics')
              .select('raw_value')
              .eq('user_id', integration.user_id)
              .eq('integration_id', integration.integration_id)
              .eq('metric_name', metric.name)
              .order('synced_at', { ascending: false })
              .limit(10);

            const historicalValues = historical?.map((h: any) => h.raw_value) || [];
            const normalizedValue = normalizeMetric(metric.value, historicalValues);

            await supabase.from('fusion_metrics').upsert({
              user_id: integration.user_id,
              integration_id: integration.integration_id,
              metric_name: metric.name,
              metric_type: metric.type,
              raw_value: metric.value,
              normalized_value: normalizedValue,
              weight: getMetricWeight(metric.type),
              data_source: { source: 'integration_events', service: serviceName },
              synced_at: now.toISOString(),
            }, { onConflict: 'user_id,integration_id,metric_name' });
          }
        }

        processedCount++;
        console.log('[aggregate-metrics] Processed:', integration.user_id, serviceName, metrics);
      } catch (userError: any) {
        console.error('[aggregate-metrics] Error processing integration:', integration.id, userError);
        errors.push(`Error for integration ${integration.id}: ${userError.message}`);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      processed: processedCount,
      total: activeIntegrations.length,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[aggregate-metrics] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function calculateMetrics(recentEvents: any[], weeklyEvents: any[], serviceName: string): AggregatedMetrics {
  const metrics: AggregatedMetrics = {
    message_volume: 0,
    activity_frequency: 0,
    response_timing: 50,
    channel_activity: 0,
    meeting_activity: 0,
  };

  if (serviceName === 'slack') {
    const messageEvents = recentEvents.filter(e => 
      e.event_type === 'slack.message' || 
      e.event_type === 'slack.message.channels' || 
      e.event_type === 'slack.message.groups'
    );
    metrics.message_volume = messageEvents.length;

    const reactionEvents = recentEvents.filter(e => 
      e.event_type === 'slack.reaction_added' || 
      e.event_type === 'slack.reaction_removed'
    );
    metrics.activity_frequency = messageEvents.length + reactionEvents.length;

    const channelEvents = new Set(recentEvents.map(e => e.metadata?.channel).filter(Boolean));
    metrics.channel_activity = channelEvents.size;

    if (messageEvents.length > 1) {
      const timestamps = messageEvents
        .map(e => new Date(e.occurred_at).getTime())
        .sort((a, b) => a - b);
      const gaps = [];
      for (let i = 1; i < timestamps.length; i++) {
        gaps.push(timestamps[i] - timestamps[i - 1]);
      }
      if (gaps.length > 0) {
        const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
        metrics.response_timing = Math.min(100, Math.max(0, 100 - (avgGap / 60000)));
      }
    }
  } else if (serviceName === 'microsoft_teams') {
    const chatEvents = recentEvents.filter(e => e.event_type === 'teams.chat_activity');
    const channelEvents = recentEvents.filter(e => e.event_type === 'teams.channel_activity');
    const meetingEvents = weeklyEvents.filter(e => e.event_type === 'teams.meeting_activity');

    metrics.message_volume = chatEvents.reduce((sum, e) => sum + (e.metadata?.chat_count || 0), 0);
    metrics.channel_activity = channelEvents.reduce((sum, e) => sum + (e.metadata?.channel_count || 0), 0);
    metrics.meeting_activity = meetingEvents.reduce((sum, e) => sum + (e.metadata?.meeting_count || 0), 0);
    metrics.activity_frequency = metrics.message_volume + metrics.channel_activity;

    if (metrics.activity_frequency > 0) {
      metrics.response_timing = Math.min(100, 50 + (metrics.activity_frequency / 10));
    }
  }

  return metrics;
}

function normalizeMetric(rawValue: number, historicalData: number[]): number {
  if (!historicalData || historicalData.length === 0) {
    return Math.min(rawValue / 100, 1);
  }

  const min = Math.min(...historicalData);
  const max = Math.max(...historicalData);
  
  if (max === min) return 0.5;
  
  return Math.max(0, Math.min(1, (rawValue - min) / (max - min)));
}

function getMetricWeight(type: string): number {
  const weights: Record<string, number> = {
    count: 0.2,
    sum: 0.3,
    average: 0.25,
    percentage: 0.15,
    trend: 0.1,
  };
  return weights[type] || 0.2;
}
