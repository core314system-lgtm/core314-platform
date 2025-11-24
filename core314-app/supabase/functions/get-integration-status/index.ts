import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const token = authHeader.replace('Bearer ', '');
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });
    
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const url = new URL(req.url);
    const provider = url.searchParams.get('provider');

    if (!provider) {
      throw new Error('Provider query parameter is required');
    }

    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: integration, error: integrationError } = await supabaseAdmin
      .from('integrations_master')
      .select('id')
      .eq('integration_type', provider.toLowerCase())
      .single();

    if (integrationError || !integration) {
      throw new Error(`Integration type not found: ${provider}`);
    }

    const { data: userIntegration, error: fetchError } = await supabaseAdmin
      .from('user_integrations')
      .select('status, last_verified_at, error_message, config')
      .eq('user_id', user.id)
      .eq('integration_id', integration.id)
      .maybeSingle();

    if (fetchError) {
      throw new Error('Failed to fetch integration status');
    }

    if (!userIntegration) {
      return new Response(
        JSON.stringify({
          connected: false,
          status: null,
          last_verified_at: null,
          error_message: null,
          from_email: null
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const config = userIntegration.config as any;
    const fromEmail = config?.from_email || null;

    return new Response(
      JSON.stringify({
        connected: userIntegration.status === 'active',
        status: userIntegration.status,
        last_verified_at: userIntegration.last_verified_at,
        error_message: userIntegration.error_message,
        from_email: fromEmail
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Get integration status error:', error);
    return new Response(
      JSON.stringify({
        connected: false,
        error: error.message || 'Internal server error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
