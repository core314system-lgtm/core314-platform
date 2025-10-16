import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function decodeBase32(encoded: string): Uint8Array {
  encoded = encoded.toUpperCase().replace(/=+$/, '');
  const output: number[] = [];
  let bits = 0;
  let value = 0;

  for (let i = 0; i < encoded.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(encoded[i]);
    if (idx === -1) throw new Error('Invalid base32 character');
    
    value = (value << 5) | idx;
    bits += 5;

    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return new Uint8Array(output);
}

async function verifyTOTP(secret: string, token: string, window: number = 2): Promise<boolean> {
  try {
    const decodedSecret = decodeBase32(secret);
    const epoch = Math.floor(Date.now() / 1000);
    const timeStep = 30;
    
    for (let i = -window; i <= window; i++) {
      const counter = Math.floor(epoch / timeStep) + i;
      const counterBuffer = new ArrayBuffer(8);
      const counterView = new DataView(counterBuffer);
      counterView.setBigUint64(0, BigInt(counter), false);
      
      const key = await crypto.subtle.importKey(
        'raw',
        decodedSecret,
        { name: 'HMAC', hash: 'SHA-1' },
        false,
        ['sign']
      );
      
      const signature = await crypto.subtle.sign('HMAC', key, counterBuffer);
      const signatureArray = new Uint8Array(signature);
      
      const offset = signatureArray[signatureArray.length - 1] & 0x0f;
      const code = (
        ((signatureArray[offset] & 0x7f) << 24) |
        ((signatureArray[offset + 1] & 0xff) << 16) |
        ((signatureArray[offset + 2] & 0xff) << 8) |
        (signatureArray[offset + 3] & 0xff)
      ) % 1000000;
      
      const paddedCode = code.toString().padStart(6, '0');
      if (paddedCode === token) {
        return true;
      }
    }
    return false;
  } catch (error) {
    console.error('TOTP verification error:', error);
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token } = await req.json();
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

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: profile } = await supabase
      .from('profiles')
      .select('two_factor_secret')
      .eq('id', user.id)
      .single();

    if (!profile?.two_factor_secret) {
      return new Response(JSON.stringify({ error: '2FA not set up' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const verified = await verifyTOTP(profile.two_factor_secret, token, 2);

    if (verified) {
      await supabase
        .from('profiles')
        .update({ two_factor_enabled: true })
        .eq('id', user.id);

      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: '2fa_enabled',
        resource_type: 'authentication',
        details: { status: 'success' },
      });

      return new Response(JSON.stringify({ success: true, verified: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      return new Response(JSON.stringify({ success: false, verified: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
