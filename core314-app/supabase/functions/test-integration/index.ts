import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TestRequest {
  provider: string;
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

async function testSendGrid(apiKey: string): Promise<{ valid: boolean; error?: string }> {
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
      return { valid: false, error: `SendGrid API error: ${response.status}` };
    }
  } catch (error) {
    return { valid: false, error: `Network error: ${error.message}` };
  }
}

const providerTesters: Record<string, (apiKey: string) => Promise<{ valid: boolean; error?: string }>> = {
  sendgrid: testSendGrid
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

    const body: TestRequest = await req.json();
    const { provider } = body;

    if (!provider) {
      throw new Error('Provider is required');
    }

    const tester = providerTesters[provider.toLowerCase()];
    if (!tester) {
      throw new Error(`Unsupported provider: ${provider}`);
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

    const { data: userIntegration, error: fetchError } = await supabaseAdmin
      .from('user_integrations')
      .select('config')
      .eq('user_id', user.id)
      .eq('integration_id', integration.id)
      .single();

    if (fetchError || !userIntegration) {
      throw new Error('Integration not found. Please connect first.');
    }

    const encryptionKey = await getEncryptionKey();
    const config = userIntegration.config as any;
    
    if (!config.credentials?.api_key) {
      throw new Error('No API key found in integration config');
    }

    const apiKey = await decryptData(config.credentials.api_key, encryptionKey);

    const testResult = await tester(apiKey);

    const { error: updateError } = await supabaseAdmin
      .from('user_integrations')
      .update({
        status: testResult.valid ? 'active' : 'error',
        last_verified_at: new Date().toISOString(),
        error_message: testResult.valid ? null : testResult.error
      })
      .eq('user_id', user.id)
      .eq('integration_id', integration.id);

    if (updateError) {
      console.error('Failed to update integration status:', updateError);
    }

    return new Response(
      JSON.stringify({
        success: testResult.valid,
        status: testResult.valid ? 'active' : 'error',
        error: testResult.error,
        last_verified_at: new Date().toISOString()
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
});
