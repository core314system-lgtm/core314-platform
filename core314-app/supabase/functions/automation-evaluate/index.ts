import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function evaluateCondition(condition: { metric: string; operator: string; value: number }, metric: string, value: number): boolean {
  if (!condition || condition.metric !== metric) {
    return false;
  }

  const { operator, value: threshold } = condition;
  
  switch (operator) {
    case '<':
      return value < threshold;
    case '>':
      return value > threshold;
    case '<=':
      return value <= threshold;
    case '>=':
      return value >= threshold;
    case '==':
    case '=':
      return value === threshold;
    case '!=':
      return value !== threshold;
    default:
      return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { organization_id, event_type, metric, value } = await req.json();
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: rules, error: rulesError } = await supabase
      .from('automation_rules')
      .select('*')
      .eq('organization_id', organization_id)
      .eq('status', 'active')
      .eq('trigger_type', event_type);

    if (rulesError) throw rulesError;

    const triggeredRules = [];

    for (const rule of rules || []) {
      const conditionMet = evaluateCondition(rule.condition, metric, value);
      
      await supabase.from('automation_logs').insert({
        organization_id,
        rule_id: rule.id,
        event_type: 'trigger_detected',
        details: { metric, value, condition_met: conditionMet },
        status: conditionMet ? 'success' : 'failed',
      });

      if (conditionMet) {
        triggeredRules.push(rule);
        
        const executeResponse = await fetch(
          `${Deno.env.get('SUPABASE_URL')}/functions/v1/automation-execute`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              organization_id,
              rule_id: rule.id,
              action: rule.action,
            }),
          }
        );

        if (!executeResponse.ok) {
          console.error('Failed to execute rule:', rule.id);
        }

        await supabase
          .from('automation_rules')
          .update({ last_triggered_at: new Date().toISOString() })
          .eq('id', rule.id);
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      evaluated: rules?.length || 0,
      triggered: triggeredRules.length 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
