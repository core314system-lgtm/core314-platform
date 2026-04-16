import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { sendIntegrationConnectedEmail } from '../_shared/integration-notifications.ts';
import { checkIntegrationLimit, integrationLimitErrorResponse } from '../_shared/integration-limits.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Validation endpoints for each API-key-based integration
const VALIDATION_CONFIG: Record<string, {
  buildUrl: (credentials: Record<string, string>) => string;
  buildHeaders: (credentials: Record<string, string>) => Record<string, string>;
  buildMethod?: () => string;
  buildBody?: (credentials: Record<string, string>) => string;
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
  github: {
    buildUrl: () => 'https://api.github.com/user',
    buildHeaders: (c) => ({
      'Authorization': `Bearer ${c.api_token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    }),
    validateResponse: (data: unknown) => !!(data as Record<string, unknown>)?.login,
  },
  zendesk: {
    buildUrl: (c) => `https://${c.domain}.zendesk.com/api/v2/users/me.json`,
    buildHeaders: (c) => ({
      'Authorization': `Basic ${btoa(`${c.email}/token:${c.api_token}`)}`,
      'Accept': 'application/json',
    }),
    validateResponse: (data: unknown) => !!(data as Record<string, unknown>)?.user,
  },
  notion: {
    buildUrl: () => 'https://api.notion.com/v1/users/me',
    buildHeaders: (c) => ({
      'Authorization': `Bearer ${c.api_token}`,
      'Notion-Version': '2022-06-28',
    }),
    validateResponse: (data: unknown) => !!(data as Record<string, unknown>)?.id,
  },
  monday: {
    buildUrl: () => 'https://api.monday.com/v2',
    buildHeaders: (c) => ({
      'Authorization': c.api_token,
      'Content-Type': 'application/json',
      'API-Version': '2024-10',
    }),
    buildMethod: () => 'POST',
    buildBody: () => JSON.stringify({ query: '{ me { id name email } }' }),
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

    // === Integration Plan Limit Check ===
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    const limitResult = await checkIntegrationLimit(supabaseAdmin, user.id);
    if (!limitResult.allowed) {
      console.log('[connect-api-key] Integration limit reached:', limitResult);
      return integrationLimitErrorResponse(limitResult, corsHeaders);
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

    const fetchOptions: RequestInit = {
      method: config.buildMethod ? config.buildMethod() : 'GET',
      headers: config.buildHeaders(credentials),
    };
    if (config.buildBody) {
      fetchOptions.body = config.buildBody(credentials);
    }
    const validationResponse = await fetch(validationUrl, fetchOptions);

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
    } else if (service_name === 'github') {
      const userData = validationData as Record<string, unknown>;
      integrationConfig.login = userData.login;
      integrationConfig.github_id = userData.id;
      integrationConfig.name = userData.name;
      integrationConfig.avatar_url = userData.avatar_url;
    } else if (service_name === 'zendesk') {
      const responseData = validationData as { user: Record<string, unknown> };
      integrationConfig.domain = credentials.domain;
      integrationConfig.email = credentials.email;
      integrationConfig.zendesk_user_id = responseData.user.id;
      integrationConfig.name = responseData.user.name;
    } else if (service_name === 'notion') {
      const userData = validationData as Record<string, unknown>;
      integrationConfig.notion_user_id = userData.id;
      integrationConfig.name = userData.name;
      integrationConfig.type = userData.type;
    } else if (service_name === 'monday') {
      const responseData = validationData as { data: { me: Record<string, unknown> } };
      const me = responseData.data?.me;
      if (me) {
        integrationConfig.monday_user_id = me.id;
        integrationConfig.name = me.name;
        integrationConfig.email = me.email;
      }
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

    // Send connection confirmation email (non-blocking)
    sendIntegrationConnectedEmail(service_name, {
      recipientEmail: user.email ?? '',
      recipientName: user.user_metadata?.full_name as string,
    }).catch(err => console.error('[connect-api-key] Email notification failed:', err));

    // Requirement 5: Immediate poll on integration connect
    // Trigger the service-specific poller immediately after successful API key connection
    console.log(`[connect-api-key] Triggering immediate poll for ${service_name} (poll-on-connect)`);
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
      const pollResponse = await fetch(`${supabaseUrl}/functions/v1/manual-poll-trigger`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          service_name: service_name,
          triggered_by: 'connect-api-key:poll-on-connect',
        }),
      });
      const pollData = await pollResponse.json();
      console.log(`[connect-api-key] Immediate poll result for ${service_name}:`, {
        ok: pollResponse.ok,
        status: pollResponse.status,
        processed: pollData.records_processed ?? 0,
        duration_ms: pollData.duration_ms ?? 0,
      });
    } catch (pollError) {
      // Non-blocking: don't fail the connection flow if the immediate poll fails
      console.error(`[connect-api-key] Immediate poll failed for ${service_name} (non-fatal):`, pollError);
    }

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
