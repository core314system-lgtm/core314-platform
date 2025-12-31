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
    const { query, mode = 'support' } = await req.json();
    
    const authHeader = req.headers.get('Authorization');
    let user = null;
    let organizationId = null;

    if (authHeader) {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } }
      );

      const { data: { user: authUser } } = await supabaseClient.auth.getUser();
      user = authUser;

      if (user) {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const { data: member } = await supabase
          .from('organization_members')
          .select('organization_id')
          .eq('user_id', user.id)
          .limit(1)
          .single();

        organizationId = member?.organization_id || null;
      }
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let recentMessages = [];
    if (user) {
      const { data: logs } = await supabase
        .from('ai_support_logs')
        .select('query, response')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      recentMessages = logs || [];
    }

    const conversationContext = recentMessages
      .reverse()
      .map(m => `User: ${m.query}\nAssistant: ${m.response}`)
      .join('\n\n');

    const systemPrompt = mode === 'onboarding'
      ? `You are Core314's AI Onboarding Assistant. Guide new users through 4 onboarding steps:
1. Connect your first integration (Slack, Teams, Gmail, etc.)
2. Set up your dashboard with key metrics
3. Configure automation rules for your workflow
4. Review your Fusion Score and insights

Provide clear, actionable guidance. Keep responses concise (2-3 sentences). Be encouraging and helpful.`
      : `You are Core314's AI Support Assistant. Help users with:
- Understanding Fusion Scores and metrics
- Configuring integrations and automations
- Troubleshooting issues
- Navigating the platform

Keep responses concise (2-3 sentences). If the user is frustrated or explicitly requests human help, acknowledge their request warmly.`;

    const userPrompt = conversationContext
      ? `${conversationContext}\n\nUser: ${query}`
      : `User: ${query}`;

    const gptResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 200,
      }),
    });

    const gptData = await gptResponse.json();
    const aiResponse = gptData.choices?.[0]?.message?.content || 'I apologize, I encountered an error. Please try again.';

    const frustrationPhrases = [
      'need help from a person',
      'speak to someone',
      'talk to human',
      'this isn\'t working',
      'not helpful',
      'frustrated',
      'escalate',
    ];

    const isFrustrated = frustrationPhrases.some(phrase => 
      query.toLowerCase().includes(phrase)
    );

    const hedgingWords = ['maybe', 'perhaps', 'might', 'could', 'possibly', 'sorry'];
    const hedgingCount = hedgingWords.filter(word => 
      aiResponse.toLowerCase().includes(word)
    ).length;
    const confidence = Math.max(0.3, 1.0 - (hedgingCount * 0.15));

    let escalationTriggered = false;
    let ticketId = null;

    if (isFrustrated || confidence < 0.5) {
      escalationTriggered = true;

      const { data: profile } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('id', user?.id)
        .single();

      const { data: ticket } = await supabase
        .from('support_tickets')
        .insert({
          user_id: user?.id || null,
          organization_id: organizationId,
          subject: `Support Request: ${query.substring(0, 50)}...`,
          description: `User query: ${query}\n\nAI response: ${aiResponse}\n\nRecent conversation:\n${conversationContext}`,
          status: 'open',
          priority: isFrustrated ? 'high' : 'medium',
        })
        .select()
        .single();

      ticketId = ticket?.id;

      if (profile) {
        try {
          await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-transactional-email`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            },
            body: JSON.stringify({
              type: 'support_escalation',
              to: 'support@core314.com',
              name: 'Core314 Support Team',
              data: {
                user_name: profile.full_name,
                user_email: profile.email,
                query,
                ai_response: aiResponse,
                ticket_id: ticketId,
                conversation_history: recentMessages.slice(0, 3).map(m => 
                  `User: ${m.query}\nAssistant: ${m.response}`
                ).join('\n\n'),
              },
            }),
          });
        } catch (emailError) {
          console.error('Failed to send escalation email:', emailError);
        }
      }
    }

    const { data: savedLog } = await supabase
      .from('ai_support_logs')
      .insert({
        user_id: user?.id || null,
        organization_id: organizationId,
        query,
        response: aiResponse,
        mode,
        metadata: { confidence, escalation_triggered: escalationTriggered },
      })
      .select()
      .single();

    if (user) {
      await supabase.from('fusion_audit_log').insert({
        organization_id: organizationId,
        user_id: user.id,
        event_type: 'ai_support_query',
        event_data: { 
          log_id: savedLog?.id,
          mode,
          escalation_triggered: escalationTriggered,
        },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      response: aiResponse,
      log_id: savedLog?.id,
      mode,
      escalation_triggered: escalationTriggered,
      ticket_id: ticketId,
      confidence,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('AI support handler error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      response: 'I apologize, I encountered an error. Please try refreshing the page or contact support@core314.com.',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}, { name: "ai-support-handler" }));