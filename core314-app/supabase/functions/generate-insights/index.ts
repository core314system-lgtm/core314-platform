
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { withSentry, breadcrumb, handleSentryTest, jsonError } from "../_shared/sentry.ts";
import { fetchUserExecutionMode, getBaselineInsightsResponse } from "../_shared/execution_mode.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MetricSummary {
  metric_name: string;
  current_value: number;
  previous_value: number;
  trend_percentage: number;
  trend_direction: string;
  metric_unit?: string;
}

serve(withSentry(async (req) => {
  const testResponse = await handleSentryTest(req);
  if (testResponse) return testResponse;

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const startTime = Date.now();

    const body = await req.json().catch(() => ({}));
    const metricGroup = body.metric_group || 'general';
    const timeWindow = body.time_window || '7 days';
    const specificMetrics = body.metrics || null; // Optional: specific metrics to analyze

    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseClient = createClient(supabaseUrl, serviceKey);

    let actingUserId: string | null = null;

    if (token && token === serviceKey) {
      if (!body?.user_id) {
        throw new Error('user_id required in request body when using service role key');
      }
      actingUserId = body.user_id;
    } else {
      if (!token) {
        throw new Error('Missing authorization header');
      }
      const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
      if (authError || !user) {
        throw new Error('Invalid authentication token');
      }
      actingUserId = user.id;
    }

    // ============================================================
    // BASELINE MODE GATE - MUST BE BEFORE ANY AI PROCESSING
    // ============================================================
    const executionMode = await fetchUserExecutionMode(supabaseClient, actingUserId);
    if (executionMode === 'baseline') {
      return new Response(JSON.stringify(getBaselineInsightsResponse()), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    // ============================================================

    const { data: latestMetrics, error: metricsError } = await supabaseClient
      .rpc('get_latest_metrics', {
        p_user_id: actingUserId,
        p_limit: 20,
      });

    if (metricsError) {
      throw new Error(`Failed to fetch metrics: ${metricsError.message}`);
    }

    if (!latestMetrics || latestMetrics.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'No metrics available for analysis',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const metricSummaries: MetricSummary[] = await Promise.all(
      latestMetrics.map(async (metric: any) => {
        try {
          const { data: trend, error: trendError } = await supabaseClient
            .rpc('calculate_metric_trend', {
              p_user_id: actingUserId,
              p_metric_name: metric.metric_name,
              p_time_window: timeWindow,
            });

          if (trendError || !trend || trend.length === 0) {
            return {
              metric_name: metric.metric_name,
              current_value: metric.metric_value,
              previous_value: metric.metric_value,
              trend_percentage: 0,
              trend_direction: 'stable',
              metric_unit: metric.metric_unit,
            };
          }

          return {
            metric_name: metric.metric_name,
            current_value: trend[0].current_value,
            previous_value: trend[0].previous_value,
            trend_percentage: trend[0].trend_percentage,
            trend_direction: trend[0].trend_direction,
            metric_unit: metric.metric_unit,
          };
        } catch (error) {
          console.error(`Error calculating trend for ${metric.metric_name}:`, error);
          return {
            metric_name: metric.metric_name,
            current_value: metric.metric_value,
            previous_value: metric.metric_value,
            trend_percentage: 0,
            trend_direction: 'stable',
            metric_unit: metric.metric_unit,
          };
        }
      })
    );

    const metricsToAnalyze = specificMetrics
      ? metricSummaries.filter((m) => specificMetrics.includes(m.metric_name))
      : metricSummaries;

    const metricsText = metricsToAnalyze
      .map((m) => {
        const unit = m.metric_unit ? ` ${m.metric_unit}` : '';
        const trend = m.trend_percentage !== 0 
          ? ` (${m.trend_direction} ${Math.abs(m.trend_percentage).toFixed(1)}%)`
          : ' (stable)';
        return `- ${m.metric_name}: ${m.current_value}${unit}${trend}`;
      })
      .join('\n');

    const prompt = `Analyze these business metrics and provide actionable insights:

${metricsText}

Instructions:
1. Identify any anomalies or significant trends
2. Summarize overall performance in 2-3 sentences
3. Provide 2-3 specific, actionable recommendations
4. Assess the overall sentiment (positive, neutral, negative, warning, or critical)
5. Rate your confidence in this analysis (0.0 to 1.0)

Format your response as JSON:
{
  "insight": "Your 2-3 sentence summary here",
  "sentiment": "positive|neutral|negative|warning|critical",
  "confidence": 0.85,
  "recommendations": [
    "First actionable recommendation",
    "Second actionable recommendation"
  ],
  "anomalies": ["Any detected anomalies"]
}`;

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a business intelligence analyst specializing in KPI analysis and operational insights. Provide clear, actionable insights based on metric data.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 1000,
        response_format: { type: 'json_object' },
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      throw new Error(`OpenAI API error: ${openaiResponse.status} - ${errorText}`);
    }

    const openaiData = await openaiResponse.json();
    const aiResponse = JSON.parse(openaiData.choices[0].message.content);

    const { data: insertedInsight, error: insertError } = await supabaseClient
      .from('insight_logs')
      .insert({
        user_id: actingUserId,
        metric_group: metricGroup,
        insight_text: aiResponse.insight,
        sentiment: aiResponse.sentiment,
        confidence: aiResponse.confidence,
        recommendations: aiResponse.recommendations || [],
        metrics_analyzed: metricsToAnalyze.map((m) => ({
          name: m.metric_name,
          value: m.current_value,
          trend: m.trend_direction,
        })),
        model_version: 'gpt-4o',
        processing_time_ms: Date.now() - startTime,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting insight:', insertError);
      throw new Error(`Failed to store insight: ${insertError.message}`);
    }

    const totalProcessingTime = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        success: true,
        insight: {
          id: insertedInsight.id,
          text: aiResponse.insight,
          sentiment: aiResponse.sentiment,
          confidence: aiResponse.confidence,
          recommendations: aiResponse.recommendations,
          anomalies: aiResponse.anomalies || [],
          metrics_analyzed: metricsToAnalyze.length,
          created_at: insertedInsight.created_at,
        },
        processing_time_ms: totalProcessingTime,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in generate-insights:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error',
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}, { name: "generate-insights" }));
