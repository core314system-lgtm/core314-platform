import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { withSentry, breadcrumb, handleSentryTest, jsonError } from "../_shared/sentry.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RegisterRequest {
  service_name: string;
  display_name: string;
  provider_type: 'api_key' | 'oauth2' | 'webhook' | 'custom';
  base_url?: string;
  validation_endpoint?: string;
  validation_method?: 'GET' | 'POST' | 'PUT';
  validation_headers?: Record<string, string>;
  validation_body?: Record<string, any>;
  required_fields: Array<{
    name: string;
    type: string;
    label: string;
    required: boolean;
  }>;
  success_indicators?: {
    status_codes: number[];
  };
  description?: string;
  docs_url?: string;
  logo_url?: string;
}

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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const token = authHeader.replace('Bearer ', '');
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });
    
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const body: RegisterRequest = await req.json();

    if (!body.service_name || !body.display_name || !body.provider_type || !body.required_fields) {
      throw new Error('Missing required fields: service_name, display_name, provider_type, required_fields');
    }

    const serviceName = body.service_name.toLowerCase().replace(/\s+/g, '_');

    if (!/^[a-z0-9_]+$/.test(serviceName)) {
      throw new Error('Service name must contain only lowercase letters, numbers, and underscores');
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: existing } = await supabaseAdmin
      .from('integration_registry')
      .select('id, service_name, created_by')
      .eq('service_name', serviceName)
      .single();

    if (existing) {
      if (existing.created_by === user.id) {
        // Phase 16B: Set connection_type based on provider_type
        // oauth2 -> oauth2 (user OAuth flow), others -> manual (admin setup)
        const connectionType = body.provider_type === 'oauth2' ? 'oauth2' : 'manual';

        const { data: updated, error: updateError } = await supabaseAdmin
          .from('integration_registry')
          .update({
            display_name: body.display_name,
            provider_type: body.provider_type,
            auth_type: body.provider_type === 'oauth2' ? 'oauth2' : 'api_key',
            connection_type: connectionType,
            base_url: body.base_url,
            validation_endpoint: body.validation_endpoint,
            validation_method: body.validation_method || 'GET',
            validation_headers: body.validation_headers || {},
            validation_body: body.validation_body || {},
            required_fields: body.required_fields,
            success_indicators: body.success_indicators || { status_codes: [200, 201, 204] },
            description: body.description,
            docs_url: body.docs_url,
            logo_url: body.logo_url,
            oauth_required: body.provider_type === 'oauth2',
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (updateError) {
          throw new Error(`Failed to update integration: ${updateError.message}`);
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Custom integration updated successfully',
            integration: updated
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      } else {
        throw new Error('Integration name already exists');
      }
    }

    // Phase 16B: Set connection_type based on provider_type for new integrations
    // oauth2 -> oauth2 (user OAuth flow), others -> manual (admin setup)
    const newConnectionType = body.provider_type === 'oauth2' ? 'oauth2' : 'manual';

    const { data: created, error: createError } = await supabaseAdmin
      .from('integration_registry')
      .insert({
        service_name: serviceName,
        display_name: body.display_name,
        provider_type: body.provider_type,
        auth_type: body.provider_type === 'oauth2' ? 'oauth2' : 'api_key',
        connection_type: newConnectionType,
        base_url: body.base_url,
        validation_endpoint: body.validation_endpoint,
        validation_method: body.validation_method || 'GET',
        validation_headers: body.validation_headers || {},
        validation_body: body.validation_body || {},
        required_fields: body.required_fields,
        success_indicators: body.success_indicators || { status_codes: [200, 201, 204] },
        description: body.description,
        docs_url: body.docs_url,
        logo_url: body.logo_url,
        oauth_required: body.provider_type === 'oauth2',
        is_custom: true,
        is_enabled: true,
        created_by: user.id
      })
      .select()
      .single();

    if (createError) {
      throw new Error(`Failed to create integration: ${createError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Custom integration registered successfully',
        integration: created
      }),
      {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Register custom integration error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}), { name: "register-custom-integration" }));
