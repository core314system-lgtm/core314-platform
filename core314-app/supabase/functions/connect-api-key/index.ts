import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Validation endpoints for each API-key-based integration
const VALIDATION_CONFIG: Record<string, {
  buildUrl: (credentials: Record<string, string>) => string;
  buildHeaders: (credentials: Record<string, string>) => Record<string, string>;
  validateResponse: (data: unknown) => boolean;
}> = {
  jira: {
    buildUrl: (c) => `https://${c.domain}/rest/api/3/myself`,
    buildHeaders: (c) => ({
      'Authorization': `Basic ${btoa(`${c.email}:${c.api_token}`)}`,
      'Accept': 'application/json',
    }),
    validateResponse: (data: unknown) => !!(data as Record<string, unknown>)?.accountId,
  },
  trello: {
    buildUrl: (c) => `https://api.trello.com/1/members/me?key=${c.api_key}&token=${c.api_token}`,
    buildHeaders: () => ({ 'Accept': 'application/json' }),
    validateResponse: (data: unknown) => !!(data as Record<string, unknown>)?.id,
  },
  asana: {
    buildUrl: () => 'https://app.asana.com/api/1.0/users/me',
    buildHeaders: (c) => ({
      'Authorization': `Bearer ${c.api_token}`,
      'Accept': 'application/json',
    }),
    validateResponse: (data: unknown) => !!(data as Record<string, unknown>)?.data,
  },
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { service_name, credentials } = await req.json();

    if (!service_name || !credentials) {
      return new Response(JSON.stringify({ error: 'service_name and credentials are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const config = VALIDATION_CONFIG[service_name];
    if (!config) {
      return new Response(JSON.stringify({ error: `Unsupported service: ${service_name}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate credentials by making a test API call
    console.log(`[connect-api-key] Validating ${service_name} credentials for user:`, user.id);
    
    let validationUrl: string;
    try {
      validationUrl = config.buildUrl(credentials);
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid credentials format', details: (e as Error).message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const validationResponse = await fetch(validationUrl, {
      method: 'GET',
      headers: config.buildHeaders(credentials),
    });

    if (!validationResponse.ok) {
      const errorText = await validationResponse.text();
      console.error(`[connect-api-key] ${service_name} validation failed:`, validationResponse.status, errorText);
      return new Response(JSON.stringify({ 
        error: 'Invalid credentials',
        message: `Could not authenticate with ${service_name}. Please check your credentials.`,
        status: validationResponse.status,
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const validationData = await validationResponse.json();
    if (!config.validateResponse(validationData)) {
      return new Response(JSON.stringify({ error: 'Validation failed', message: 'Credentials authenticated but returned unexpected data.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[connect-api-key] ${service_name} credentials validated successfully`);

    // Use service role client for database operations
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Store credentials securely in vault
    const credentialString = JSON.stringify(credentials);
    const { data: secretId } = await supabase.rpc('vault_create_secret', {
      secret: credentialString,
    });

    // Look up integration registry entry
    const { data: integration } = await supabase
      .from('integration_registry')
      .select('id')
      .eq('service_name', service_name)
      .eq('is_enabled', true)
      .single();

    if (!integration) {
      return new Response(JSON.stringify({ error: 'Integration not found or disabled' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Look up integrations_master entry
    const { data: integrationMaster } = await supabase
      .from('integrations_master')
      .select('id')
      .eq('integration_type', service_name)
      .single();

    // Build config with validation metadata
    const integrationConfig: Record<string, unknown> = {
      api_key_connected: true,
      credentials_secret_id: secretId,
      verified_at: new Date().toISOString(),
      verification_status: 'verified',
    };

    // Store provider-specific metadata
    if (service_name === 'jira') {
      integrationConfig.domain = credentials.domain;
      integrationConfig.email = credentials.email;
      const userData = validationData as Record<string, unknown>;
      integrationConfig.account_id = userData.accountId;
      integrationConfig.display_name = userData.displayName;
    } else if (service_name === 'trello') {
      const userData = validationData as Record<string, unknown>;
      integrationConfig.member_id = userData.id;
      integrationConfig.username = userData.username;
      integrationConfig.full_name = userData.fullName;
    } else if (service_name === 'asana') {
      const responseData = validationData as { data: Record<string, unknown> };
      integrationConfig.gid = responseData.data.gid;
      integrationConfig.name = responseData.data.name;
      integrationConfig.email = responseData.data.email;
    }

    // Upsert user_integration
    const { data: userIntegration } = await supabase
      .from('user_integrations')
      .upsert({
        user_id: user.id,
        integration_id: integrationMaster?.id,
        provider_id: integration.id,
        added_by_user: true,
        status: 'active',
        config: integrationConfig,
      }, {
        onConflict: 'user_id,integration_id',
      })
      .select()
      .single();

    // Store in oauth_tokens table for consistency with OAuth integrations
    // (polling functions use this table to find credentials)
    await supabase.from('oauth_tokens').upsert({
      user_id: user.id,
      integration_registry_id: integration.id,
      user_integration_id: userIntegration?.id,
      access_token_secret_id: secretId,
      refresh_token_secret_id: null,
      token_type: 'api_key',
      scope: null,
      expires_at: null, // API keys don't expire
      metadata: { service: service_name, connected_at: new Date().toISOString() },
    }, {
      onConflict: 'user_id,integration_registry_id',
    });

    console.log(`[connect-api-key] ${service_name} connected successfully for user:`, user.id);

    return new Response(JSON.stringify({ 
      success: true,
      service: service_name,
      message: `${service_name} connected successfully`,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[connect-api-key] Error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
