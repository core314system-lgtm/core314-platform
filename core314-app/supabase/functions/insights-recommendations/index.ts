import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { withSentry, breadcrumb, handleSentryTest, jsonError } from "../_shared/sentry.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') || '';

serve(withSentry(async (req) => {
  const testResponse = await handleSentryTest(req);
  if (testResponse) return testResponse;

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { organization_id } = await req.json();
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: latestInsight } = await supabase
      .from('fusion_global_insights')
      .select('*')
      .order('aggregation_date', { ascending: false })
      .limit(1)
      .single();

    if (!latestInsight) {
      return new Response(JSON.stringify({ 
        success: true,
        recommendations: [],
        message: 'No global insights available yet'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let orgMetrics: {
      avg_fusion_score: number;
      avg_confidence: number;
      avg_variance: number;
    } | null = null;
    if (organization_id) {
      const { data: orgMembers } = await supabase
        .from('organization_members')
        .select('user_id')
        .eq('organization_id', organization_id);

      if (orgMembers && orgMembers.length > 0) {
        const userIds = orgMembers.map(m => m.user_id);
        
        const { data: orgScores } = await supabase
          .from('fusion_scores')
          .select('fusion_score')
          .in('user_id', userIds)
          .order('calculated_at', { ascending: false })
          .limit(10);

        const { data: orgWeightings } = await supabase
          .from('fusion_weightings')
          .select('variance, ai_confidence')
          .in('user_id', userIds);

        if (orgScores?.length && orgWeightings?.length) {
          const avgOrgScore = orgScores.reduce((s, o) => s + (o.fusion_score || 0), 0) / orgScores.length;
          const avgOrgConfidence = orgWeightings.reduce((s, w) => s + (w.ai_confidence || 0), 0) / orgWeightings.length;
          const avgOrgVariance = orgWeightings.reduce((s, w) => s + (w.variance || 0), 0) / orgWeightings.length;

          orgMetrics = {
            avg_fusion_score: avgOrgScore,
            avg_confidence: avgOrgConfidence,
            avg_variance: avgOrgVariance,
          };
        }
      }
    }

    const gptPrompt = `You are Core314's global intelligence advisor. Based on these global performance metrics, provide actionable recommendations.

Global Benchmarks:
- Average Fusion Score: ${latestInsight.aggregated_metrics.avg_fusion_score.toFixed(1)}
- Average Confidence: ${latestInsight.aggregated_metrics.avg_confidence.toFixed(3)}
- Average Variance: ${latestInsight.aggregated_metrics.avg_variance.toFixed(3)}
- Top Performing Integrations: ${JSON.stringify(latestInsight.top_performing_integrations)}

${orgMetrics ? `Organization Context (for comparison):
- Org Fusion Score: ${orgMetrics.avg_fusion_score.toFixed(1)} (${orgMetrics.avg_fusion_score > latestInsight.aggregated_metrics.avg_fusion_score ? 'above' : 'below'} global avg)
- Org Confidence: ${orgMetrics.avg_confidence.toFixed(3)} (${orgMetrics.avg_confidence > latestInsight.aggregated_metrics.avg_confidence ? 'above' : 'below'} global avg)
- Org Variance: ${orgMetrics.avg_variance.toFixed(3)} (${orgMetrics.avg_variance < latestInsight.aggregated_metrics.avg_variance ? 'better' : 'worse'} than global avg)
` : ''}

Provide 3-5 generalized recommendations that organizations can use to improve their Fusion performance.

Return JSON with:
{
  "recommendations": [
    {
      "title": "Brief recommendation title",
      "description": "1-2 sentence explanation",
      "priority": "high|medium|low",
      "rationale": "Why this matters based on global data"
    }
  ]
}`;

    const gptResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are Core314\'s global intelligence advisor. Provide actionable, privacy-preserving recommendations based on aggregated data. Always return valid JSON.',
          },
          {
            role: 'user',
            content: gptPrompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 800,
      }),
    });

    const gptData = await gptResponse.json();
    
    if (!gptResponse.ok || !gptData.choices || gptData.choices.length === 0) {
      console.error('OpenAI API error:', gptData);
      throw new Error(`OpenAI API failed: ${gptData.error?.message || JSON.stringify(gptData)}`);
    }

    const recommendationsData = JSON.parse(gptData.choices[0].message.content || '{}');

    await supabase.from('fusion_audit_log').insert({
      organization_id: organization_id || null,
      user_id: user.id,
      event_type: 'recommendation_generated',
      event_data: { 
        insight_id: latestInsight.id,
        recommendation_count: recommendationsData.recommendations?.length || 0
      },
    });

    return new Response(JSON.stringify({ 
      success: true,
      recommendations: recommendationsData.recommendations || [],
      global_benchmarks: latestInsight.aggregated_metrics,
      organization_metrics: orgMetrics
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Insights recommendations error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}), { name: "insights-recommendations" }));