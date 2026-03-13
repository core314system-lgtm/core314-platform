import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { withSentry, breadcrumb, handleSentryTest, jsonError } from "../_shared/sentry.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TestRequest {
  provider: string;
}

interface ProviderConfig {
  id: string;
  service_name: string;
  display_name: string;
  provider_type: string;
  validation_endpoint: string;
  validation_method: string;
  validation_headers: Record<string, string>;
  validation_body: Record<string, any>;
  success_indicators: {
    status_codes: number[];
  };
}

async function decryptData(encrypted: { iv: string; data: string }, key: CryptoKey): Promise<string> {
  const iv = Uint8Array.from(atob(encrypted.iv), c => c.charCodeAt(0));
  const data = Uint8Array.from(atob(encrypted.data), c => c.charCodeAt(0));
  
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );
  
  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

async function getEncryptionKey(): Promise<CryptoKey> {
  const keyString = Deno.env.get('INTEGRATION_SECRET_KEY');
  if (!keyString) {
    throw new Error('INTEGRATION_SECRET_KEY not configured');
  }
  
  const keyData = Uint8Array.from(atob(keyString), c => c.charCodeAt(0));
  
  return await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

function replaceTokens(template: string, credentials: Record<string, any>): string {
  let result = template;
  for (const [key, value] of Object.entries(credentials)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  return result;
}

async function decryptCredentials(
  encryptedCredentials: Record<string, any>,
  encryptionKey: CryptoKey
): Promise<Record<string, any>> {
  const decrypted: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(encryptedCredentials)) {
    if (typeof value === 'object' && value !== null && 'iv' in value && 'data' in value) {
      decrypted[key] = await decryptData(value, encryptionKey);
    } else {
      decrypted[key] = value;
    }
  }
  
  return decrypted;
}

async function testCredentials(
  provider: ProviderConfig,
  credentials: Record<string, any>
): Promise<{ valid: boolean; error?: string; details?: any }> {
  try {
    if (!provider.validation_endpoint) {
      return { valid: true };
    }

    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(provider.validation_headers)) {
      headers[key] = replaceTokens(value, credentials);
    }

    let body: any = undefined;
    if (provider.validation_method !== 'GET' && Object.keys(provider.validation_body).length > 0) {
      const bodyTemplate = JSON.stringify(provider.validation_body);
      body = JSON.parse(replaceTokens(bodyTemplate, credentials));
    }

    const response = await fetch(provider.validation_endpoint, {
      method: provider.validation_method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    const successCodes = provider.success_indicators?.status_codes || [200, 201, 204];
    if (successCodes.includes(response.status)) {
      const responseData = await response.json().catch(() => ({}));
      return { valid: true, details: responseData };
    } else {
      const errorText = await response.text();
      return { 
        valid: false, 
        error: `Validation failed: ${response.status} - ${errorText.substring(0, 200)}` 
      };
    }
  } catch (error) {
    return { valid: false, error: `Network error: ${error.message}` };
  }
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

    const body: TestRequest = await req.json();
    const { provider } = body;

    if (!provider) {
      throw new Error('Provider is required');
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: providerConfig, error: providerError } = await supabaseAdmin
      .from('integration_registry')
      .select('*')
      .eq('service_name', provider.toLowerCase())
      .eq('is_enabled', true)
      .single();

    if (providerError || !providerConfig) {
      throw new Error(`Provider not found: ${provider}`);
    }

    const { data: userIntegration, error: integrationError } = await supabaseAdmin
      .from('user_integrations')
      .select('*')
      .eq('user_id', user.id)
      .eq('provider_id', providerConfig.id)
      .single();

    if (integrationError || !userIntegration) {
      throw new Error('Integration not found. Please connect first.');
    }

    const encryptionKey = await getEncryptionKey();
    const config = userIntegration.config as any;
    const decryptedCredentials = await decryptCredentials(config.credentials, encryptionKey);

    const validation = await testCredentials(providerConfig as ProviderConfig, decryptedCredentials);

    const updateData: any = {
      last_verified_at: new Date().toISOString()
    };

    if (validation.valid) {
      updateData.status = 'active';
      updateData.error_message = null;
    } else {
      updateData.status = 'error';
      updateData.error_message = validation.error;
    }

    const { error: updateError } = await supabaseAdmin
      .from('user_integrations')
      .update(updateData)
      .eq('id', userIntegration.id);

    if (updateError) {
      console.error('Update error:', updateError);
    }

    if (!validation.valid) {
      return new Response(
        JSON.stringify({
          success: false,
          error: validation.error,
          status: 'error'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `${providerConfig.display_name} connection is valid`,
        provider: provider.toLowerCase(),
        status: 'active',
        last_verified_at: updateData.last_verified_at,
        details: validation.details
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Test integration error:', error);
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
}, { name: "test-integration" }));