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

    const { data: org } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', organization_id)
      .single();

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: fusionScores } = await supabase
      .from('fusion_scores')
      .select('fusion_score, integration_id')
      .eq('organization_id', organization_id)
      .gte('calculated_at', thirtyDaysAgo)
      .order('calculated_at', { ascending: false });

    const avgFusionScore = fusionScores?.length 
      ? fusionScores.reduce((sum, s) => sum + (s.fusion_score || 0), 0) / fusionScores.length
      : undefined;

    const { data: integrations } = await supabase
      .from('integrations_master')
      .select('id, integration_name')
      .eq('organization_id', organization_id)
      .eq('status', 'active');

    const topIntegrations = await Promise.all(
      (integrations || []).slice(0, 3).map(async (int) => {
        const { data: score } = await supabase
          .from('fusion_scores')
          .select('fusion_score')
          .eq('integration_id', int.id)
          .eq('organization_id', organization_id)
          .order('calculated_at', { ascending: false })
          .limit(1)
          .single();
        
        return {
          name: int.integration_name,
          score: score?.fusion_score || 0,
        };
      })
    );

    const { count: rulesCount } = await supabase
      .from('automation_rules')
      .select('id', { count: 'exact' })
      .eq('organization_id', organization_id)
      .eq('status', 'active');

    const { count: logsCount } = await supabase
      .from('automation_logs')
      .select('id', { count: 'exact' })
      .eq('organization_id', organization_id)
      .gte('created_at', thirtyDaysAgo);

    const { data: insights } = await supabase
      .from('fusion_insights')
      .select('message, confidence')
      .eq('organization_id', organization_id)
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: false })
      .limit(5);

    const dataContext = {
      fusion_score: avgFusionScore,
      top_integrations: topIntegrations,
      automation_activity: {
        total_rules: rulesCount || 0,
        total_executions: logsCount || 0,
      },
      key_insights: insights?.map(i => i.message) || [],
    };

    const gptPrompt = `You are an AI operations analyst. Analyze the following data for ${org?.name || 'this organization'} and generate a comprehensive executive brief.

Time Period: Last 30 days
Fusion Confidence Score: ${avgFusionScore !== undefined ? avgFusionScore.toFixed(1) : 'N/A'}
Top Integrations: ${topIntegrations.map(i => `${i.name} (${i.score.toFixed(1)})`).join(', ') || 'None'}
Automation Activity: ${rulesCount || 0} rules, ${logsCount || 0} executions
Recent Insights: ${insights?.map(i => i.message).join('; ') || 'No recent insights'}

Generate a comprehensive narrative with:
1. "title": A concise, executive-friendly title (5-10 words)
2. "summary": A 2-3 paragraph summary of the current state, trends, and key findings
3. "recommendations": 3-5 specific, actionable recommendations formatted as a markdown list
4. "confidence": A confidence score (0-100) based on data availability and quality

Return as JSON with these exact fields.`;

    const gptResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are an expert AI operations analyst specializing in business intelligence and executive reporting. Always return valid JSON.',
          },
          {
            role: 'user',
            content: gptPrompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 1500,
      }),
    });

    const gptData = await gptResponse.json();
    const narrative = JSON.parse(gptData.choices[0].message.content || '{}');

    const { data: savedNarrative, error: insertError } = await supabase
      .from('fusion_narratives')
      .insert({
        organization_id,
        title: narrative.title || 'Operations Summary',
        summary: narrative.summary || 'No summary available.',
        recommendations: narrative.recommendations || 'No recommendations at this time.',
        data_context: dataContext,
        ai_confidence: narrative.confidence || 50,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    await supabase.from('fusion_audit_log').insert({
      organization_id,
      user_id: user.id,
      event_type: 'ai_narrative_generated',
      event_data: { narrative_id: savedNarrative.id, confidence: narrative.confidence },
    });

    return new Response(JSON.stringify({ success: true, narrative: savedNarrative }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Narrative generation error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}), { name: "narrative-generate" }));