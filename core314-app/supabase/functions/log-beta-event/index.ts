
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { withSentry, breadcrumb, handleSentryTest, jsonError } from "../_shared/sentry.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BetaEventPayload {
  event_type: string;
  event_name: string;
  metadata?: Record<string, unknown>;
}

serve(withSentry(async (req) => {
  const testResponse = await handleSentryTest(req);
  if (testResponse) return testResponse;

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Valid authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { event_type, event_name, metadata } = body as BetaEventPayload;

    if (!event_type || typeof event_type !== 'string' || event_type.trim() === '') {
      return new Response(
        JSON.stringify({ error: 'Invalid event_type: must be a non-empty string' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!event_name || typeof event_name !== 'string' || event_name.trim() === '') {
      return new Response(
        JSON.stringify({ error: 'Invalid event_name: must be a non-empty string' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (metadata && JSON.stringify(metadata).length > 10000) {
      return new Response(
        JSON.stringify({ error: 'Metadata too large: maximum 10KB' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { error: insertError } = await supabase
      .from('beta_events')
      .insert({
        user_id: user.id,
        event_type: event_type.trim(),
        event_name: event_name.trim(),
        metadata: metadata || {},
      });

    if (insertError) {
      console.error('Failed to insert beta event:', insertError);
      return new Response(
        JSON.stringify({ error: `Failed to log event: ${insertError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (event_type === 'feature_usage' || event_type === 'navigation') {
      const featureName = event_name.replace(/_open$/, '').replace(/_accessed$/, '');
      
      const { error: usageError } = await supabase
        .from('beta_feature_usage')
        .upsert(
          {
            user_id: user.id,
            feature_name: featureName,
            usage_count: 1,
            last_used_at: new Date().toISOString(),
          },
          {
            onConflict: 'user_id,feature_name',
            ignoreDuplicates: false,
          }
        );

      if (usageError) {
        console.error('Failed to update feature usage:', usageError);
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Event logged successfully' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error in log-beta-event:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}), { name: "log-beta-event" }));