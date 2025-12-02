import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { withSentry, breadcrumb, handleSentryTest } from "../_shared/sentry.ts";

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
    const { optimization_id, mode = 'apply' } = await req.json();
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

    const { data: optimization, error: optError } = await supabase
      .from('fusion_optimizations')
      .select('*')
      .eq('id', optimization_id)
      .single();

    if (optError || !optimization) {
      return new Response(JSON.stringify({ error: 'Optimization not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: member } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', optimization.organization_id)
      .eq('user_id', user.id)
      .single();

    if (!member || !['owner', 'admin'].includes(member.role)) {
      return new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (mode === 'simulate') {
      const simulateResponse = await fetch(
        `${Deno.env.get('SUPABASE_URL')}/functions/v1/simulate-run`,
        {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            organization_id: optimization.organization_id,
            user_id: user.id,
            name: `Optimization Simulation - ${optimization.id.substring(0, 8)}`,
            inputs: {
              weights: optimization.optimized_data.weights,
              confidence: optimization.optimized_data.confidence,
            },
          }),
        }
      );

      if (!simulateResponse.ok) {
        throw new Error('Failed to run simulation');
      }

      const simulateData = await simulateResponse.json();

      return new Response(JSON.stringify({ 
        success: true,
        mode: 'simulate',
        simulation: simulateData.simulation 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: weightings } = await supabase
      .from('fusion_weightings')
      .select('integration_id')
      .eq('organization_id', optimization.organization_id);

    if (!weightings) {
      throw new Error('No weightings found for organization');
    }

    const integrationIds = weightings.map(w => w.integration_id);
    const { data: integrations } = await supabase
      .from('integrations_master')
      .select('id, integration_name')
      .in('id', integrationIds);

    const nameToId = new Map(integrations?.map(i => [i.integration_name, i.id]) || []);

    for (const [integrationName, weight] of Object.entries(optimization.optimized_data.weights)) {
      const integrationId = nameToId.get(integrationName);
      if (!integrationId) continue;

      await supabase
        .from('fusion_weightings')
        .update({
          final_weight: weight,
          adjustment_reason: 'AI Optimization',
          last_updated: new Date().toISOString(),
        })
        .eq('organization_id', optimization.organization_id)
        .eq('integration_id', integrationId);
    }

    await supabase
      .from('fusion_optimizations')
      .update({
        applied: true,
        applied_at: new Date().toISOString(),
      })
      .eq('id', optimization_id);

    const confirmationPrompt = `Generate a brief confirmation message for the following optimization application:

Baseline Fusion Score: ${optimization.baseline_data.fusion_score}
Optimized Fusion Score: ${optimization.optimized_data.fusion_score}
Improvement: ${((optimization.optimized_data.fusion_score - optimization.baseline_data.fusion_score) / optimization.baseline_data.fusion_score * 100).toFixed(1)}%

Return JSON with:
{
  "message": "1-2 sentence confirmation with key metrics"
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
          { role: 'system', content: 'You are a helpful assistant. Always return valid JSON.' },
          { role: 'user', content: confirmationPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 200,
      }),
    });

    const gptData = await gptResponse.json();
    const confirmation = gptData.choices?.[0]?.message?.content 
      ? JSON.parse(gptData.choices[0].message.content) 
      : { message: 'Optimization applied successfully.' };

    await supabase.from('fusion_audit_log').insert({
      organization_id: optimization.organization_id,
      user_id: user.id,
      event_type: 'optimization_applied',
      event_data: { 
        optimization_id,
        improvement_score: optimization.improvement_score,
        weights_updated: Object.keys(optimization.optimized_data.weights).length
      },
    });

    const { data: profile } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', user.id)
      .single();

    const { data: org } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', optimization.organization_id)
      .single();

    if (profile && org) {
      try {
        await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-transactional-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          },
          body: JSON.stringify({
            type: 'optimization_success',
            to: profile.email,
            name: profile.full_name,
            data: {
              organization: org.name,
              organization_id: optimization.organization_id,
              user_id: user.id,
              new_fusion_score: optimization.optimized_data.fusion_score.toFixed(1),
              confidence_improvement: ((optimization.optimized_data.confidence - optimization.baseline_data.confidence) * 100).toFixed(1),
              optimization_type: 'AI-Driven Weight Optimization',
            },
          }),
        });
      } catch (emailError) {
        console.error('Failed to send optimization success email:', emailError);
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      mode: 'apply',
      message: confirmation.message,
      optimization
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Optimization apply error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}), { name: "optimize-apply" }));