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
    const { organization_id, user_id, name, inputs } = await req.json();
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

    const { data: member } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', organization_id)
      .eq('user_id', user.id)
      .single();

    if (!member) {
      return new Response(JSON.stringify({ error: 'Not a member of this organization' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: fusionScores } = await supabase
      .from('fusion_scores')
      .select('fusion_score, integration_id')
      .eq('organization_id', organization_id)
      .gte('calculated_at', thirtyDaysAgo)
      .order('calculated_at', { ascending: false });

    const avgFusionScore = fusionScores?.length 
      ? fusionScores.reduce((sum, s) => sum + (s.fusion_score || 0), 0) / fusionScores.length
      : 70;

    const { data: weightings } = await supabase
      .from('fusion_weightings')
      .select('integration_id, weight')
      .eq('organization_id', organization_id);

    const baselineWeights: Record<string, number> = {};
    if (weightings) {
      const integrationIds = weightings.map(w => w.integration_id);
      const { data: integrations } = await supabase
        .from('integrations_master')
        .select('id, integration_name')
        .in('id', integrationIds);

      const idToName = new Map(integrations?.map(i => [i.id, i.integration_name]) || []);
      weightings.forEach(w => {
        const name = idToName.get(w.integration_id);
        if (name) baselineWeights[name] = w.weight;
      });
    }

    const modifiedWeights = { ...baselineWeights, ...inputs.weights };
    const modifiedConfidence = inputs.confidence ?? 0.75;

    const gptPrompt = `You are an AI operations analyst specializing in predictive modeling. Analyze the following simulation parameters and generate accurate predictions.

Baseline Fusion Score: ${avgFusionScore.toFixed(1)}
Baseline Weights: ${JSON.stringify(baselineWeights)}
Modified Weights: ${JSON.stringify(modifiedWeights)}
Modified Confidence: ${modifiedConfidence.toFixed(2)}

Time Period: Last 30 days
Simulation Goal: Predict the impact of weight and confidence adjustments on overall Fusion performance.

Generate predictions with:
1. "FusionScore": Predicted fusion score (0-100) based on weight changes
2. "Confidence": Predicted confidence level (0-1) based on data quality
3. "Variance": Expected variance/volatility (0-1) in the prediction
4. "summary": 2-3 paragraph explanation of:
   - How the weight changes will impact overall performance
   - Why confidence increased/decreased
   - Key risks and opportunities in this scenario

Return as JSON with these exact fields.`;

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
            content: 'You are an expert AI operations analyst specializing in predictive modeling and business intelligence forecasting. Always return valid JSON.',
          },
          {
            role: 'user',
            content: gptPrompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    const gptData = await gptResponse.json();
    
    if (!gptResponse.ok || !gptData.choices || gptData.choices.length === 0) {
      console.error('OpenAI API error:', gptData);
      throw new Error(`OpenAI API failed: ${gptData.error?.message || JSON.stringify(gptData)}`);
    }

    const prediction = JSON.parse(gptData.choices[0].message.content || '{}');

    const predictedOutput = {
      FusionScore: prediction.FusionScore || avgFusionScore,
      Confidence: prediction.Confidence || modifiedConfidence,
      Variance: prediction.Variance || 0.1,
    };

    const { data: savedSimulation, error: insertError } = await supabase
      .from('fusion_simulations')
      .insert({
        organization_id,
        user_id,
        name,
        input_parameters: {
          weights: modifiedWeights,
          confidence: modifiedConfidence,
          baseline_score: avgFusionScore,
        },
        predicted_output: predictedOutput,
        summary: prediction.summary || 'No summary available.',
      })
      .select()
      .single();

    if (insertError) throw insertError;

    await supabase.from('fusion_audit_log').insert({
      organization_id,
      user_id,
      event_type: 'simulation_run',
      event_data: { 
        simulation_id: savedSimulation.id, 
        predicted_score: predictedOutput.FusionScore 
      },
    });

    return new Response(JSON.stringify({ success: true, simulation: savedSimulation }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Simulation error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}, { name: "simulate-run" }));