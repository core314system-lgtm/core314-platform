import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ConnectRequest {
  service_name: string;
  secrets: Record<string, string>;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Authenticate user
    const token = authHeader.replace('Bearer ', '');
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body: ConnectRequest = await req.json();
    const { service_name, secrets } = body;

    if (!service_name) {
      return new Response(
        JSON.stringify({ error: 'Missing service_name' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!secrets || Object.keys(secrets).length === 0) {
      return new Response(
        JSON.stringify({ error: 'Missing secrets' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role client for database operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get integration from registry
    const { data: integration, error: integrationError } = await supabaseAdmin
      .from('integration_registry')
      .select('id, service_name, display_name, auth_type, connection_type, credential_entry_mode, is_enabled')
      .eq('service_name', service_name)
      .single();

    if (integrationError || !integration) {
      console.error('[connect-api-key] Integration not found:', service_name);
      return new Response(
        JSON.stringify({ error: 'Integration not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate connection_type is api_key
    if (integration.connection_type !== 'api_key') {
      console.error('[connect-api-key] Invalid connection_type:', integration.connection_type);
      return new Response(
        JSON.stringify({ 
          error: 'This integration does not use API key authentication',
          connection_type: integration.connection_type
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate credential_entry_mode is user_supplied
    if (integration.credential_entry_mode === 'admin_supplied') {
      console.error('[connect-api-key] Admin-supplied integration:', service_name);
      return new Response(
        JSON.stringify({ error: 'This integration requires admin configuration' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if integration is enabled
    if (!integration.is_enabled) {
      return new Response(
        JSON.stringify({ error: 'This integration is currently disabled' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[connect-api-key] Connecting integration:', {
      service_name,
      user_id: user.id,
      integration_id: integration.id,
    });

    // Store secrets in Vault using the integration_store_secret function
    for (const [secretName, secretValue] of Object.entries(secrets)) {
      if (!secretValue || secretValue.trim() === '') {
        continue; // Skip empty secrets
      }

      const { error: storeError } = await supabaseAdmin.rpc('integration_store_secret', {
        p_user_id: user.id,
        p_integration_id: integration.id,
        p_secret_name: secretName,
        p_secret_value: secretValue,
      });

      if (storeError) {
        console.error('[connect-api-key] Failed to store secret:', secretName, storeError);
        return new Response(
          JSON.stringify({ error: 'Failed to store credentials securely' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Create or update user_integrations record
    const { data: existingIntegration } = await supabaseAdmin
      .from('user_integrations')
      .select('id')
      .eq('user_id', user.id)
      .eq('integration_registry_id', integration.id)
      .single();

    let userIntegrationId: string;

    if (existingIntegration) {
      // Update existing record
      const { data: updated, error: updateError } = await supabaseAdmin
        .from('user_integrations')
        .update({
          status: 'active',
          provider_type: 'api_key',
          added_by_user: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingIntegration.id)
        .select('id')
        .single();

      if (updateError) {
        console.error('[connect-api-key] Failed to update user_integrations:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to update integration connection' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      userIntegrationId = updated.id;
    } else {
      // Create new record
      const { data: created, error: createError } = await supabaseAdmin
        .from('user_integrations')
        .insert({
          user_id: user.id,
          integration_registry_id: integration.id,
          provider_id: service_name,
          provider_type: 'api_key',
          status: 'active',
          added_by_user: true,
        })
        .select('id')
        .single();

      if (createError) {
        console.error('[connect-api-key] Failed to create user_integrations:', createError);
        return new Response(
          JSON.stringify({ error: 'Failed to create integration connection' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      userIntegrationId = created.id;
    }

    // Update integration_secrets with user_integration_id reference
    await supabaseAdmin
      .from('integration_secrets')
      .update({ user_integration_id: userIntegrationId })
      .eq('user_id', user.id)
      .eq('integration_registry_id', integration.id);

    console.log('[connect-api-key] Successfully connected:', {
      service_name,
      user_integration_id: userIntegrationId,
    });

    return new Response(
      JSON.stringify({
        success: true,
        user_integration_id: userIntegrationId,
        connection_type: 'api_key',
        message: `Successfully connected ${integration.display_name}`,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[connect-api-key] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
