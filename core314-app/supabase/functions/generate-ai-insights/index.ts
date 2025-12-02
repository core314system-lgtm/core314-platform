import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { withSentry, breadcrumb, handleSentryTest } from "../_shared/sentry.ts";

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') || '';

serve(withSentry(async (req) => {
  const testResponse = await handleSentryTest(req);
  if (testResponse) return testResponse;

  try {
    const { userId, integrationId } = await req.json();

    const authHeader = req.headers.get('Authorization')!;
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.id !== userId) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { data: metrics } = await supabase
      .from('fusion_metrics')
      .select('metric_name, raw_value, metric_type, normalized_value')
      .eq('user_id', userId)
      .eq('integration_id', integrationId)
      .order('synced_at', { ascending: false })
      .limit(10);

    if (!metrics || metrics.length === 0) {
      return new Response(JSON.stringify({ summary: 'No metrics available' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { data: integration } = await supabase
      .from('integrations_master')
      .select('integration_name')
      .eq('id', integrationId)
      .single();

    const prompt = `Analyze these metrics from ${integration?.integration_name || 'the integration'} and provide ONE actionable sentence summarizing the current status:

${metrics.map(m => `- ${m.metric_name}: ${m.raw_value} (normalized: ${m.normalized_value.toFixed(2)})`).join('\n')}

Provide a brief, actionable insight in one sentence.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
            content: 'You are a business operations analyst. Provide brief, actionable insights.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 100,
      }),
    });

    const data = await response.json();
    const summary = data.choices[0].message.content;

    return new Response(JSON.stringify({ summary }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}), { name: "generate-ai-insights" }));