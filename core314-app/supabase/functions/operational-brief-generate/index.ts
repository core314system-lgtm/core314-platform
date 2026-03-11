import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

/**
 * Operational Brief Generator
 * 
 * Generates AI-driven operational narratives by:
 * 1. Checking subscription plan brief limits
 * 2. Aggregating active operational signals
 * 3. Pulling recent integration metrics
 * 4. Fetching latest health score
 * 5. Sending structured prompt to GPT-4o
 * 6. Storing the generated brief
 * 
 * Works even with minimal or no data — briefs always include
 * reasoning about what is (or isn't) happening.
 * 
 * Brief limits per plan (from shared/pricing.ts):
 *   Monitor:        10 / month
 *   Intelligence:   Unlimited
 *   Command Center: Unlimited
 *   Enterprise:     Unlimited
 *   Free:           3 / month
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') || '';

// Brief limits per plan name (matching plan_name from user_subscriptions / plan_limits)
const BRIEF_LIMITS: Record<string, number> = {
  'Free': 3,
  'Monitor': 10,
  'Intelligence': -1, // unlimited
  'Command Center': -1,
  'Enterprise': -1,
};

function getBriefLimit(planName: string): number {
  return BRIEF_LIMITS[planName] ?? 3; // default to Free tier limit
}

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

    // ── Step 0: Check subscription plan and brief limits ──────────────
    const { data: subscriptionData } = await supabase.rpc(
      'get_user_subscription_summary',
      { p_user_id: user.id }
    );

    const planName = subscriptionData?.subscription?.plan_name
      ?? subscriptionData?.plan_limits?.plan_name
      ?? 'Free';
    const briefLimit = getBriefLimit(planName);

    // Count briefs generated this calendar month
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const { count: briefsThisMonth, error: countError } = await supabase
      .from('operational_briefs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', monthStart);

    if (countError) {
      console.error('[operational-brief] Error counting briefs:', countError);
    }

    const currentCount = briefsThisMonth ?? 0;

    if (briefLimit !== -1 && currentCount >= briefLimit) {
      return new Response(JSON.stringify({
        error: 'brief_limit_reached',
        message: `You have used all ${briefLimit} operational briefs for this month on the ${planName} plan. Upgrade your plan for more briefs.`,
        plan: planName,
        limit: briefLimit,
        used: currentCount,
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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

    // ── Step 2: Fetch active operational signals ──────────────────────
    const { data: signals } = await supabase
      .from('operational_signals')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('severity', { ascending: true }) // critical first
      .limit(20);

    // ── Step 3: Fetch latest health score ─────────────────────────────
    const { data: healthScoreData } = await supabase
      .from('operational_health_scores')
      .select('*')
      .eq('user_id', user.id)
      .order('calculated_at', { ascending: false })
      .limit(1)
      .single();

    // ── Step 4: Fetch connected integrations ──────────────────────────
    const { data: connectedIntegrations } = await supabase
      .from('user_integrations')
      .select('service_name, status, connected_at')
      .eq('user_id', user.id)
      .eq('status', 'active');

    const connectedServices = (connectedIntegrations || []).map(i => i.service_name);

    // ── Step 5: Fetch recent integration events for context ───────────
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

    // ── Step 6: Build context for GPT ─────────────────────────────────
    const activeSignals = signals || [];
    const healthScore = healthScoreData?.score ?? null;
    const healthLabel = healthScoreData?.label ?? 'Unknown';

    const hubspotMeta = hubspotEvents?.[0]?.metadata || {};
    const slackMeta = slackEvents?.[0]?.metadata || {};
    const qbMeta = qbEvents?.[0]?.metadata || {};

    // Determine data availability
    const hasHubspot = connectedServices.includes('hubspot');
    const hasSlack = connectedServices.includes('slack');
    const hasQuickbooks = connectedServices.includes('quickbooks');
    const hasHubspotData = !!hubspotEvents?.[0];
    const hasSlackData = !!slackEvents?.[0];
    const hasQbData = !!qbEvents?.[0];
    const hasAnyData = hasHubspotData || hasSlackData || hasQbData || activeSignals.length > 0;
    const connectedCount = connectedServices.length;

    // Build CRM summary
    const crmSummary = hasHubspotData && hubspotMeta.total_deals !== undefined
      ? `${hubspotMeta.open_deals || 0} open deals ($${((hubspotMeta.open_pipeline_value as number) || 0).toLocaleString()} pipeline), ${hubspotMeta.stalled_deals || 0} stalled, ${hubspotMeta.won_deals || 0} won, ${hubspotMeta.lost_deals || 0} lost, ${hubspotMeta.total_contacts || 0} contacts`
      : hasHubspot
        ? 'HubSpot is connected but no CRM data has been collected yet. This typically means the first data sync has not completed or the HubSpot account has no recent deal/contact activity.'
        : 'HubSpot is not connected. CRM data (deals, contacts, pipeline) is not available for analysis.';

    // Build communication summary
    const commSummary = hasSlackData && slackMeta.message_count !== undefined
      ? `${slackMeta.message_count || 0} messages across ${slackMeta.active_channels || 0} active channels (${slackMeta.total_channels || 0} total)`
      : hasSlack
        ? 'Slack is connected but no communication data has been collected yet. This typically means the first data sync has not completed or there is minimal recent Slack activity.'
        : 'Slack is not connected. Communication data (messages, channels, response times) is not available for analysis.';

    // Build financial summary
    const financialSummary = hasQbData && qbMeta.invoice_count !== undefined
      ? `${qbMeta.invoice_count || 0} invoices ($${((qbMeta.invoice_total as number) || 0).toLocaleString()}), ${qbMeta.overdue_invoices || 0} overdue, ${qbMeta.payment_count || 0} payments ($${((qbMeta.payment_total as number) || 0).toLocaleString()}), ${qbMeta.expense_count || 0} expenses ($${((qbMeta.expense_total as number) || 0).toLocaleString()})`
      : hasQuickbooks
        ? 'QuickBooks is connected but no financial data has been collected yet. This typically means the first data sync has not completed or the QuickBooks account has no recent financial activity.'
        : 'QuickBooks is not connected. Financial data (invoices, payments, expenses) is not available for analysis.';

    // Format signals for prompt
    const signalSummary = activeSignals.length > 0
      ? activeSignals.map(s => `- [${s.severity.toUpperCase()}] ${s.description} (source: ${s.source_integration}, confidence: ${s.confidence}%)`).join('\n')
      : 'No active signals detected.';

    // Build integration status summary
    const integrationStatus = `Connected integrations: ${connectedCount > 0 ? connectedServices.join(', ') : 'None'}
Data availability: HubSpot ${hasHubspotData ? 'has data' : hasHubspot ? 'connected, no data yet' : 'not connected'} | Slack ${hasSlackData ? 'has data' : hasSlack ? 'connected, no data yet' : 'not connected'} | QuickBooks ${hasQbData ? 'has data' : hasQuickbooks ? 'connected, no data yet' : 'not connected'}`;

    // ── Step 7: Generate narrative via GPT-4o ─────────────────────────
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const gptPrompt = `You are Core314, an AI operations analyst. Generate a clear, executive-friendly Operational Brief for ${orgName}.

Date: ${today}
Operational Health Score: ${healthScore !== null ? `${healthScore}/100 (${healthLabel})` : 'Not yet calculated'}

INTEGRATION STATUS:
${integrationStatus}

DETECTED OPERATIONAL SIGNALS:
${signalSummary}

RAW METRICS:
CRM (HubSpot): ${crmSummary}
Communication (Slack): ${commSummary}
Financial (QuickBooks): ${financialSummary}

INSTRUCTIONS:
- Write as if you are a senior business analyst presenting to the CEO
- Be specific — use exact numbers from the data when available
- Do NOT invent data that isn't provided above
- IMPORTANT: If data is limited or missing, you MUST still produce a meaningful brief:
  - Explain what data sources ARE connected and what they show (even if it's minimal)
  - Explain what data sources are NOT connected and what visibility that costs the business
  - Provide reasoning about what the current state means (e.g., "No signals detected could mean operations are stable, or it could mean we lack sufficient data coverage")
  - Recommend specific next steps to improve data coverage and operational visibility
- Focus on what the data MEANS for the business, not just what the numbers are
- Identify patterns across data sources when possible
- If this is a first brief with minimal data, frame it as an "Initial Operational Assessment" and focus on onboarding recommendations

Generate a JSON response with these exact fields:
1. "title": Concise brief title (e.g., "Weekly Operations Summary — ${today}" or "Initial Operational Assessment — ${today}" if data is sparse)
2. "detected_signals": Array of signal summary strings in plain business English. If no signals, include at least one entry explaining why (e.g., "No operational anomalies detected — monitoring is active across N connected systems")
3. "business_impact": 1-2 paragraph analysis of what the current operational state means for the business. Always provide reasoning, even with minimal data.
4. "recommended_actions": Array of 3-5 specific, actionable recommendations. Include data coverage improvements if integrations are missing.
5. "risk_assessment": Brief risk outlook (1-2 sentences). If data is sparse, note that limited visibility is itself a risk.
6. "confidence": Score 0-100 based on data quality and coverage. Lower if data sources are missing (e.g., 20-30 with no data, 40-60 with partial data, 70-90 with full data).`;

    console.log('[operational-brief] Generating brief for user:', user.id, {
      plan: planName,
      briefsUsed: currentCount,
      briefLimit,
      signals: activeSignals.length,
      healthScore,
      connectedIntegrations: connectedServices,
      hasCRM: hasHubspotData,
      hasComm: hasSlackData,
      hasFinancial: hasQbData,
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
            content: 'You are Core314, an expert AI operations analyst specializing in business intelligence. You produce clear, data-driven operational briefs that help leadership understand what is happening in their business. You ALWAYS produce a brief, even when data is minimal — in those cases you explain what is known, what is unknown, and what that means for the business. Always return valid JSON. Never fabricate data.',
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

    // ── Step 8: Save the operational brief ─────────────────────────────
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
          connected_integrations: connectedServices,
          has_data: hasAnyData,
        },
      })
      .select()
      .single();

    if (insertError) {
      console.error('[operational-brief] Insert error:', insertError);
      throw insertError;
    }

    console.log('[operational-brief] Brief generated:', savedBrief?.id);

    const remaining = briefLimit === -1 ? -1 : briefLimit - (currentCount + 1);

    return new Response(JSON.stringify({ 
      success: true, 
      brief: savedBrief,
      usage: {
        plan: planName,
        used: currentCount + 1,
        limit: briefLimit,
        remaining,
      },
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
