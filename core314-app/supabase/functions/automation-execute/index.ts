import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { withSentry, breadcrumb, handleSentryTest, jsonError } from "../_shared/sentry.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

async function executeAction(supabase: ReturnType<typeof createClient>, organizationId: string, action: Record<string, unknown>) {
  const { type, ...params } = action;

  switch (type) {
    case 'notify_slack':
      return { success: true, message: 'Slack notification sent (placeholder)' };
    
    case 'notify_teams':
      return { success: true, message: 'Teams notification sent (placeholder)' };
    
    case 'notify_email':
      return { success: true, message: 'Email notification sent (placeholder)' };
    
    case 'log_event':
      await supabase.from('fusion_audit_log').insert({
        organization_id: organizationId,
        event_type: 'automation_log_event',
        event_data: params,
      });
      return { success: true, message: 'Event logged' };
    
    case 'trigger_recalibration': {
      const recalResponse = await fetch(
        `${Deno.env.get('SUPABASE_URL')}/functions/v1/fusion-recalibrate`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ organization_id: organizationId }),
        }
      );
      return { success: recalResponse.ok, message: 'Fusion recalibration triggered' };
    }
    
    default:
      throw new Error(`Unknown action type: ${type}`);
  }
}

serve(withSentry(async (req) => {
  const testResponse = await handleSentryTest(req);
  if (testResponse) return testResponse;

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { organization_id, rule_id, action } = await req.json();
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let result;
    let status = 'success';
    let errorMessage = null;

    try {
      result = await executeAction(supabase, organization_id, action);
    } catch (error) {
      status = 'failed';
      errorMessage = error.message;
      result = { success: false, message: error.message };
    }

    await supabase.from('automation_logs').insert({
      organization_id,
      rule_id,
      event_type: 'action_executed',
      details: { action, result },
      status,
      error_message: errorMessage,
    });

    await supabase.from('fusion_audit_log').insert({
      organization_id,
      event_type: 'automation_action_executed',
      event_data: { rule_id, action_type: action.type, status, result },
    });

    return new Response(JSON.stringify({ success: status === 'success', result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}), { name: "automation-execute" }));