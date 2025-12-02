import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { withSentry, breadcrumb, handleSentryTest, jsonError } from "../_shared/sentry.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(withSentry(async (req) => {
  const testResponse = await handleSentryTest(req);
  if (testResponse) return testResponse;

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

    const { data: providerConfig, error: providerError } = await supabaseAdmin
      .from('integration_registry')
      .select('id, service_name, display_name')
      .eq('service_name', provider.toLowerCase())
      .eq('is_enabled', true)
      .single();

    if (providerError || !providerConfig) {
      return new Response(
        JSON.stringify({
          connected: false,
          error: `Provider not found: ${provider}`
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const { data: userIntegration, error: fetchError } = await supabaseAdmin
      .from('user_integrations')
      .select('status, last_verified_at, error_message, config')
      .eq('user_id', user.id)
      .eq('provider_id', providerConfig.id)
      .maybeSingle();

    if (fetchError) {
      throw new Error('Failed to fetch integration status');
    }

    if (!userIntegration) {
      return new Response(
        JSON.stringify({
          connected: false,
          status: 'inactive',
          provider: provider.toLowerCase(),
          provider_name: providerConfig.display_name,
          last_verified_at: null,
          error_message: null
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const config = userIntegration.config as any;
    const publicConfig: Record<string, any> = {};
    
    if (config) {
      for (const [key, value] of Object.entries(config)) {
        if (key !== 'credentials' && typeof value !== 'object') {
          publicConfig[key] = value;
        }
      }
    }

    return new Response(
      JSON.stringify({
        connected: userIntegration.status === 'active',
        status: userIntegration.status,
        provider: provider.toLowerCase(),
        provider_name: providerConfig.display_name,
        last_verified_at: userIntegration.last_verified_at,
        error_message: userIntegration.error_message,
        ...publicConfig
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
}), { name: "get-integration-status" }));