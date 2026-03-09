import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

/**
 * Operational Brief Generator
 * 
 * Generates AI-driven operational narratives by:
 * 1. Aggregating active operational signals
 * 2. Pulling recent integration metrics
 * 3. Fetching latest health score
 * 4. Sending structured prompt to GPT-4o
 * 5. Storing the generated brief
 * 
 * Output: A written business intelligence report explaining
 * what is happening inside the business.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') || '';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    // Get organization context
    let organizationId: string | null = null;
    let orgName = 'your organization';

    try {
      const body = await req.json();
      organizationId = body.organization_id || null;
    } catch {
      // No body
    }

    if (organizationId) {
      const { data: org } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', organizationId)
        .single();
      if (org?.name) orgName = org.name;
    } else {
      // Find user's primary organization
      const { data: memberData } = await supabase
        .from('organization_members')
        .select('organization_id, organizations(name)')
        .eq('user_id', user.id)
        .limit(1)
        .single();

      if (memberData) {
        organizationId = memberData.organization_id;
        const orgData = memberData.organizations as { name: string } | null;
        if (orgData?.name) orgName = orgData.name;
      }
    }

    // 1. Fetch active operational signals
    const { data: signals } = await supabase
      .from('operational_signals')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('severity', { ascending: true }) // critical first
      .limit(20);

    // 2. Fetch latest health score
    const { data: healthScoreData } = await supabase
      .from('operational_health_scores')
      .select('*')
      .eq('user_id', user.id)
      .order('calculated_at', { ascending: false })
      .limit(1)
      .single();

    // 3. Fetch recent integration events for context
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: hubspotEvents } = await supabase
      .from('integration_events')
      .select('metadata, created_at')
      .eq('user_id', user.id)
      .eq('service_name', 'hubspot')
      .gte('created_at', sevenDaysAgo)
      .order('created_at', { ascending: false })
      .limit(1);

    const { data: slackEvents } = await supabase
      .from('integration_events')
      .select('metadata, created_at')
      .eq('user_id', user.id)
      .eq('service_name', 'slack')
      .gte('created_at', sevenDaysAgo)
      .order('created_at', { ascending: false })
      .limit(1);

    const { data: qbEvents } = await supabase
      .from('integration_events')
      .select('metadata, created_at')
      .eq('user_id', user.id)
      .eq('service_name', 'quickbooks')
      .gte('created_at', sevenDaysAgo)
      .order('created_at', { ascending: false })
      .limit(1);

    // 4. Build context for GPT
    const activeSignals = signals || [];
    const healthScore = healthScoreData?.score ?? null;
    const healthLabel = healthScoreData?.label ?? 'Unknown';

    const hubspotMeta = hubspotEvents?.[0]?.metadata || {};
    const slackMeta = slackEvents?.[0]?.metadata || {};
    const qbMeta = qbEvents?.[0]?.metadata || {};

    // Build CRM summary
    const crmSummary = hubspotMeta.total_deals !== undefined
      ? `${hubspotMeta.open_deals || 0} open deals ($${((hubspotMeta.open_pipeline_value as number) || 0).toLocaleString()} pipeline), ${hubspotMeta.stalled_deals || 0} stalled, ${hubspotMeta.won_deals || 0} won, ${hubspotMeta.lost_deals || 0} lost, ${hubspotMeta.total_contacts || 0} contacts`
      : 'No CRM data available';

    // Build communication summary
    const commSummary = slackMeta.message_count !== undefined
      ? `${slackMeta.message_count || 0} messages across ${slackMeta.active_channels || 0} active channels (${slackMeta.total_channels || 0} total)`
      : 'No communication data available';

    // Build financial summary
    const financialSummary = qbMeta.invoice_count !== undefined
      ? `${qbMeta.invoice_count || 0} invoices ($${((qbMeta.invoice_total as number) || 0).toLocaleString()}), ${qbMeta.overdue_invoices || 0} overdue, ${qbMeta.payment_count || 0} payments ($${((qbMeta.payment_total as number) || 0).toLocaleString()}), ${qbMeta.expense_count || 0} expenses ($${((qbMeta.expense_total as number) || 0).toLocaleString()})`
      : 'No financial data available';

    // Format signals for prompt
    const signalSummary = activeSignals.length > 0
      ? activeSignals.map(s => `- [${s.severity.toUpperCase()}] ${s.description} (source: ${s.source_integration}, confidence: ${s.confidence}%)`).join('\n')
      : 'No active signals detected.';

    // 5. Generate narrative via GPT-4o
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const gptPrompt = `You are Core314, an AI operations analyst. Generate a clear, executive-friendly Operational Brief for ${orgName}.

Date: ${today}
Operational Health Score: ${healthScore !== null ? `${healthScore}/100 (${healthLabel})` : 'Not yet calculated'}

DETECTED OPERATIONAL SIGNALS:
${signalSummary}

RAW METRICS:
CRM (HubSpot): ${crmSummary}
Communication (Slack): ${commSummary}
Financial (QuickBooks): ${financialSummary}

INSTRUCTIONS:
- Write as if you are a senior business analyst presenting to the CEO
- Be specific — use exact numbers from the data
- Do NOT invent data that isn't provided above
- If data is missing for a category, acknowledge it and note the limitation
- Focus on what the data MEANS for the business, not just what the numbers are
- Identify patterns across data sources when possible (e.g., stalled deals + increased legal communication = contract bottleneck)

Generate a JSON response with these exact fields:
1. "title": Concise brief title (e.g., "Weekly Operations Summary — ${today}")
2. "detected_signals": Array of signal summary strings in plain business English
3. "business_impact": 1-2 paragraph analysis of what these signals mean for the business. Be specific and data-driven.
4. "recommended_actions": Array of 3-5 specific, actionable recommendations. Each should be a clear action item.
5. "risk_assessment": Brief risk outlook (1-2 sentences) about what happens if current trends continue.
6. "confidence": Score 0-100 based on data quality and coverage (lower if data sources are missing)`;

    console.log('[operational-brief] Generating brief for user:', user.id, {
      signals: activeSignals.length,
      healthScore,
      hasCRM: !!hubspotEvents?.[0],
      hasComm: !!slackEvents?.[0],
      hasFinancial: !!qbEvents?.[0],
    });

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
            content: 'You are Core314, an expert AI operations analyst specializing in business intelligence. You produce clear, data-driven operational briefs that help leadership understand what is happening in their business. Always return valid JSON. Never fabricate data.',
          },
          {
            role: 'user',
            content: gptPrompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!gptResponse.ok) {
      const errText = await gptResponse.text();
      console.error('[operational-brief] OpenAI error:', gptResponse.status, errText);
      throw new Error(`OpenAI API error: ${gptResponse.status}`);
    }

    const gptData = await gptResponse.json();
    const narrative = JSON.parse(gptData.choices[0].message.content || '{}');

    // 6. Save the operational brief
    const signalIds = activeSignals.map(s => s.id);

    const { data: savedBrief, error: insertError } = await supabase
      .from('operational_briefs')
      .insert({
        user_id: user.id,
        organization_id: organizationId,
        title: narrative.title || `Operations Summary — ${today}`,
        detected_signals: narrative.detected_signals || [],
        business_impact: narrative.business_impact || 'Insufficient data for impact analysis.',
        recommended_actions: narrative.recommended_actions || [],
        risk_assessment: narrative.risk_assessment || 'Insufficient data for risk assessment.',
        summary: narrative.business_impact || '',
        confidence: narrative.confidence || 50,
        health_score: healthScore,
        signal_ids: signalIds,
        brief_type: 'operational',
        data_context: {
          crm: hubspotMeta,
          communication: slackMeta,
          financial: qbMeta,
          signal_count: activeSignals.length,
          health_score: healthScore,
          health_label: healthLabel,
        },
      })
      .select()
      .single();

    if (insertError) {
      console.error('[operational-brief] Insert error:', insertError);
      throw insertError;
    }

    console.log('[operational-brief] Brief generated:', savedBrief?.id);

    return new Response(JSON.stringify({ 
      success: true, 
      brief: savedBrief,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[operational-brief] Error:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
