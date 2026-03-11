import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

/**
 * Disconnect Integration
 * 
 * Disconnects a user's integration by:
 * 1. Setting user_integrations.status to 'disconnected'
 * 2. Deleting the associated oauth_tokens record
 * 
 * Uses service role key to bypass RLS policies.
 * Requires a valid user JWT in the Authorization header.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify the user's JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create a client with the user's token to verify identity
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse request body
    const { integration_registry_id } = await req.json();
    if (!integration_registry_id) {
      return new Response(JSON.stringify({ error: 'Missing integration_registry_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use service role client to bypass RLS
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Find the user_integration record
    const { data: userIntegration, error: findError } = await supabase
      .from('user_integrations')
      .select('id')
      .eq('user_id', user.id)
      .eq('provider_id', integration_registry_id)
      .eq('status', 'active')
      .single();

    if (findError || !userIntegration) {
      return new Response(JSON.stringify({ error: 'Integration not found or already disconnected' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Set status to 'disconnected' (soft delete — preserves history)
    const { error: updateError } = await supabase
      .from('user_integrations')
      .update({
        status: 'disconnected',
        error_message: null,
        consecutive_failures: 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userIntegration.id);

    if (updateError) {
      console.error('[disconnect] Failed to update user_integration:', updateError);
      return new Response(JSON.stringify({ error: 'Failed to disconnect integration' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Delete the OAuth token record
    const { error: deleteError } = await supabase
      .from('oauth_tokens')
      .delete()
      .eq('user_id', user.id)
      .eq('integration_registry_id', integration_registry_id);

    if (deleteError) {
      console.error('[disconnect] Failed to delete oauth_token (non-fatal):', deleteError);
      // Non-fatal — the integration is already marked disconnected
    }

    console.log(`[disconnect] User ${user.id} disconnected integration ${integration_registry_id}`);

    return new Response(JSON.stringify({
      success: true,
      message: 'Integration disconnected successfully',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[disconnect] Error:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
