
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { withSentry, breadcrumb, handleSentryTest, jsonError } from "../_shared/sentry.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-token',
};

interface AuditLogEntry {
  user_id?: string;
  event_type: string;
  event_source: string;
  event_payload?: Record<string, any>;
  stability_score?: number;
  reinforcement_delta?: number;
}

serve(withSentry(async (req) => {
  const testResponse = await handleSentryTest(req);
  if (testResponse) return testResponse;

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('[Fusion Audit Trail] Request received');

    const internalToken = req.headers.get('x-internal-token');
    const expectedToken = Deno.env.get('INTERNAL_WEBHOOK_TOKEN');
    
    if (internalToken !== expectedToken) {
      console.error('[Fusion Audit Trail] Invalid internal token');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: AuditLogEntry = await req.json();
    console.log('[Fusion Audit Trail] Logging event:', body.event_type, 'from', body.event_source);

    if (!body.event_type || !body.event_source) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: event_type, event_source' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await supabase
      .from('fusion_audit_log')
      .insert({
        user_id: body.user_id || null,
        event_type: body.event_type,
        event_source: body.event_source,
        event_payload: body.event_payload || {},
        stability_score: body.stability_score || null,
        reinforcement_delta: body.reinforcement_delta || null,
        anomaly_flag: false, // Will be set by anomaly detector
        anomaly_reason: null,
      })
      .select()
      .single();

    if (error) {
      console.error('[Fusion Audit Trail] Database error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to insert audit log', details: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[Fusion Audit Trail] Audit log created:', data.id);

    return new Response(
      JSON.stringify({
        success: true,
        audit_log_id: data.id,
        message: 'Audit log entry created successfully',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Fusion Audit Trail] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}), { name: "fusion-audit-trail" }));