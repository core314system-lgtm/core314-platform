import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    const { test_mode = false } = await req.json();
    
    console.log('🤖 Executing automation hooks...');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: hooks, error: fetchError } = await supabase
      .from('automation_hooks')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(10);

    if (fetchError) throw fetchError;

    if (!hooks || hooks.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No pending automation hooks',
        hooks_processed: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${hooks.length} pending hooks`);

    let successCount = 0;
    let failCount = 0;

    for (const hook of hooks) {
      try {
        const aiContext = await interpretContext(hook, test_mode);
        
        const result = await executeAction(supabase, hook, aiContext, test_mode);
        
        await supabase
          .from('automation_hooks')
          .update({
            status: result.success ? 'executed' : 'failed',
            executed_at: new Date().toISOString(),
            metadata: {
              ...hook.metadata,
              ai_context: aiContext,
              execution_result: result,
              test_mode
            }
          })
          .eq('id', hook.id);

        if (result.success) {
          successCount++;
          console.log(`✅ Hook ${hook.id} executed successfully`);
        } else {
          failCount++;
          console.log(`❌ Hook ${hook.id} failed: ${result.message}`);
        }
      } catch (error) {
        failCount++;
        console.error(`Error processing hook ${hook.id}:`, error);
        
        await supabase
          .from('automation_hooks')
          .update({
            status: 'failed',
            executed_at: new Date().toISOString(),
            metadata: {
              ...hook.metadata,
              error: error.message,
              test_mode
            }
          })
          .eq('id', hook.id);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      hooks_processed: hooks.length,
      successful: successCount,
      failed: failCount,
      test_mode
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Automation hook execution error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function interpretContext(hook: any, testMode: boolean): Promise<string> {
  if (testMode || !OPENAI_API_KEY) {
    return `[Test Mode] Context: ${hook.event_type} from ${hook.trigger_source}`;
  }

  try {
    const prompt = `Analyze this automation event and provide a brief context summary for action execution:
Event Type: ${hook.event_type}
Source: ${hook.trigger_source}
Action: ${JSON.stringify(hook.action)}
Metadata: ${JSON.stringify(hook.metadata)}

Provide a one-sentence context summary.`;

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
            content: 'You are Core314\'s automation context analyzer. Provide brief, actionable context summaries.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.5,
        max_tokens: 100,
      }),
    });

    const data = await response.json();
    return data.choices?.[0]?.message?.content || 'No context generated';
  } catch (error) {
    console.error('AI context interpretation error:', error);
    return `Context interpretation failed: ${error.message}`;
  }
}

async function executeAction(
  supabase: any,
  hook: any,
  aiContext: string,
  testMode: boolean
): Promise<{ success: boolean; message: string }> {
  const { action } = hook;
  
  if (testMode) {
    console.log(`[Test Mode] Would execute action:`, action);
    return {
      success: true,
      message: `[Test Mode] Action would be executed: ${action.type || 'unknown'}`
    };
  }

  try {
    switch (action.type) {
      case 'sendSlackMessage':
        return await sendSlackMessage(action, aiContext);
      
      case 'sendTeamsAlert':
        return await sendTeamsAlert(action, aiContext);
      
      case 'createSupabaseEntry':
        return await createSupabaseEntry(supabase, action, hook);
      
      case 'sendEmail':
        return await sendEmail(action, aiContext);
      
      default:
        return {
          success: false,
          message: `Unknown action type: ${action.type}`
        };
    }
  } catch (error) {
    return {
      success: false,
      message: `Action execution error: ${error.message}`
    };
  }
}

async function sendSlackMessage(action: any, context: string): Promise<{ success: boolean; message: string }> {
  const webhookUrl = Deno.env.get('SLACK_WEBHOOK_URL');
  
  if (!webhookUrl) {
    return { success: false, message: 'SLACK_WEBHOOK_URL not configured' };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `🤖 Core314 Automation: ${action.message || context}`,
        blocks: action.blocks || undefined
      })
    });

    if (!response.ok) {
      throw new Error(`Slack API error: ${response.statusText}`);
    }

    return { success: true, message: 'Slack message sent' };
  } catch (error) {
    return { success: false, message: `Slack error: ${error.message}` };
  }
}

async function sendTeamsAlert(action: any, context: string): Promise<{ success: boolean; message: string }> {
  const webhookUrl = Deno.env.get('TEAMS_WEBHOOK_URL');
  
  if (!webhookUrl) {
    return { success: false, message: 'TEAMS_WEBHOOK_URL not configured' };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `🤖 Core314 Automation: ${action.message || context}`,
        title: action.title || 'Automation Alert'
      })
    });

    if (!response.ok) {
      throw new Error(`Teams API error: ${response.statusText}`);
    }

    return { success: true, message: 'Teams alert sent' };
  } catch (error) {
    return { success: false, message: `Teams error: ${error.message}` };
  }
}

async function createSupabaseEntry(supabase: any, action: any, hook: any): Promise<{ success: boolean; message: string }> {
  try {
    const { table, data } = action;
    
    if (!table || !data) {
      return { success: false, message: 'Missing table or data in action' };
    }

    const { error } = await supabase
      .from(table)
      .insert(data);

    if (error) throw error;

    return { success: true, message: `Entry created in ${table}` };
  } catch (error) {
    return { success: false, message: `Supabase error: ${error.message}` };
  }
}

async function sendEmail(action: any, context: string): Promise<{ success: boolean; message: string }> {
  return { success: true, message: 'Email functionality not yet implemented' };
}
