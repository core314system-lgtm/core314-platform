import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { withSentry, breadcrumb, handleSentryTest, jsonError } from "../_shared/sentry.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ConnectRequest {
  provider: string;
  credentials: Record<string, any>;
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
  required_fields: Array<{
    name: string;
    type: string;
    label: string;
    required: boolean;
  }>;
  success_indicators: {
    status_codes: number[];
  };
}

async function encryptData(plaintext: string, key: CryptoKey): Promise<{ iv: string; data: string }> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );
  
  return {
    iv: btoa(String.fromCharCode(...iv)),
    data: btoa(String.fromCharCode(...new Uint8Array(encrypted)))
  };
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

async function validateCredentials(
  provider: ProviderConfig,
  credentials: Record<string, any>
): Promise<{ valid: boolean; error?: string; details?: any }> {
  try {
    for (const field of provider.required_fields) {
      if (field.required && !credentials[field.name]) {
        return { valid: false, error: `Missing required field: ${field.label}` };
      }
    }

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

async function encryptCredentials(
  credentials: Record<string, any>,
  encryptionKey: CryptoKey
): Promise<Record<string, any>> {
  const encrypted: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(credentials)) {
    if (typeof value === 'string' && value.length > 0) {
      if (key.includes('key') || key.includes('token') || key.includes('secret') || key.includes('password')) {
        encrypted[key] = await encryptData(value, encryptionKey);
      } else {
        encrypted[key] = value;
      }
    }
  }
  
  return encrypted;
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

    const body: ConnectRequest = await req.json();
    const { provider, credentials } = body;

    if (!provider || !credentials) {
      throw new Error('Provider and credentials are required');
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: providerConfig, error: providerError } = await supabaseAdmin
      .from('integration_registry')
      .select('*')
      .eq('service_name', provider.toLowerCase())
      .eq('is_enabled', true)
      .single();

    if (providerError || !providerConfig) {
      throw new Error(`Provider not found or not enabled: ${provider}`);
    }

    const validation = await validateCredentials(providerConfig as ProviderConfig, credentials);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({
          success: false,
          error: validation.error || 'Credential validation failed'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const encryptionKey = await getEncryptionKey();
    const encryptedCredentials = await encryptCredentials(credentials, encryptionKey);

    const configData = {
      provider: provider.toLowerCase(),
      credentials: encryptedCredentials,
      validation_details: validation.details
    };

    const { error: upsertError } = await supabaseAdmin
      .from('user_integrations')
      .upsert({
        user_id: user.id,
        provider_id: providerConfig.id,
        config: configData,
        status: 'active',
        last_verified_at: new Date().toISOString(),
        error_message: null,
        added_by_user: true
      }, {
        onConflict: 'user_id,provider_id'
      });

    if (upsertError) {
      console.error('Database error:', upsertError);
      throw new Error('Failed to save integration');
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `${providerConfig.display_name} connected successfully`,
        provider: provider.toLowerCase(),
        status: 'active',
        last_verified_at: new Date().toISOString()
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Connect integration error:', error);
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
}), { name: "connect-integration" }));