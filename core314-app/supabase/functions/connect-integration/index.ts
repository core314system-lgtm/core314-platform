import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ConnectRequest {
  provider: string;
  credentials: {
    api_key?: string;
    from_email?: string;
    client_id?: string;
    client_secret?: string;
    tenant_id?: string;
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

async function validateSendGrid(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const response = await fetch('https://api.sendgrid.com/v3/user/profile', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      return { valid: true };
    } else {
      const errorText = await response.text();
      return { valid: false, error: `SendGrid API error: ${response.status}` };
    }
  } catch (error) {
    return { valid: false, error: `Network error: ${error.message}` };
  }
}

const providerValidators: Record<string, (credentials: any) => Promise<{ valid: boolean; error?: string }>> = {
  sendgrid: async (creds) => {
    if (!creds.api_key) {
      return { valid: false, error: 'API key is required' };
    }
    return await validateSendGrid(creds.api_key);
  }
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

    const validator = providerValidators[provider.toLowerCase()];
    if (!validator) {
      throw new Error(`Unsupported provider: ${provider}`);
    }

    const validation = await validator(credentials);
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
    const encryptedConfig: any = {
      provider: provider.toLowerCase(),
      credentials: {}
    };

    if (credentials.api_key) {
      encryptedConfig.credentials.api_key = await encryptData(credentials.api_key, encryptionKey);
    }

    if (credentials.from_email) {
      encryptedConfig.from_email = credentials.from_email;
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: integration, error: integrationError } = await supabaseAdmin
      .from('integrations_master')
      .select('id')
      .eq('integration_type', provider.toLowerCase())
      .single();

    if (integrationError || !integration) {
      throw new Error(`Integration type not found: ${provider}`);
    }

    const { error: upsertError } = await supabaseAdmin
      .from('user_integrations')
      .upsert({
        user_id: user.id,
        integration_id: integration.id,
        config: encryptedConfig,
        status: 'active',
        last_verified_at: new Date().toISOString(),
        error_message: null,
        added_by_user: true
      }, {
        onConflict: 'user_id,integration_id'
      });

    if (upsertError) {
      console.error('Database error:', upsertError);
      throw new Error('Failed to save integration');
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `${provider} integration connected successfully`,
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
});
