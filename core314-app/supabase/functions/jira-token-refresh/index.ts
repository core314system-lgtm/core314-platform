import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/**
 * jira-token-refresh — Refreshes expired Jira OAuth 2.0 (3LO) access tokens.
 *
 * Called by jira-poll when the current access_token is expired (expires_at < now).
 * Uses the refresh_token stored in Supabase Vault to get a new access_token
 * from Atlassian's token endpoint.
 *
 * Flow:
 * 1. Receive user_id + integration_registry_id (or oauth_token row id)
 * 2. Fetch refresh_token from vault
 * 3. Exchange refresh_token for new access_token at Atlassian token endpoint
 * 4. Store new access_token (and optionally new refresh_token) in vault
 * 5. Update oauth_tokens row with new secret_ids and expires_at
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Accept either a specific token row ID or user_id + integration_registry_id
    const body = await req.json().catch(() => ({}));
    const { oauth_token_id, user_id, integration_registry_id } = body;

    // Build query to find the oauth_tokens row
    let query = supabase
      .from('oauth_tokens')
      .select('id, user_id, integration_registry_id, refresh_token_secret_id, access_token_secret_id, expires_at');

    if (oauth_token_id) {
      query = query.eq('id', oauth_token_id);
    } else if (user_id && integration_registry_id) {
      query = query.eq('user_id', user_id).eq('integration_registry_id', integration_registry_id);
    } else {
      // Batch mode: refresh ALL expired Jira tokens
      const { data: expiredTokens } = await supabase
        .from('oauth_tokens')
        .select(`
          id, user_id, integration_registry_id, refresh_token_secret_id, access_token_secret_id, expires_at,
          integration_registry!inner ( service_name )
        `)
        .eq('integration_registry.service_name', 'jira')
        .not('refresh_token_secret_id', 'is', null)
        .lt('expires_at', new Date().toISOString());

      if (!expiredTokens || expiredTokens.length === 0) {
        return new Response(JSON.stringify({ message: 'No expired Jira tokens to refresh', refreshed: 0 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      let refreshedCount = 0;
      const errors: string[] = [];

      for (const token of expiredTokens) {
        try {
          const result = await refreshSingleToken(supabase, token);
          if (result.success) {
            refreshedCount++;
          } else {
            errors.push(`User ${token.user_id}: ${result.error}`);
          }
        } catch (err) {
          errors.push(`User ${token.user_id}: ${(err as Error).message}`);
        }
      }

      return new Response(JSON.stringify({
        success: true,
        refreshed: refreshedCount,
        total: expiredTokens.length,
        errors: errors.length > 0 ? errors : undefined,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: tokenRow, error: tokenError } = await query.single();

    if (tokenError || !tokenRow) {
      return new Response(JSON.stringify({ error: 'OAuth token not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = await refreshSingleToken(supabase, tokenRow);

    if (!result.success) {
      return new Response(JSON.stringify({ error: result.error }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      expires_at: result.expires_at,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[jira-token-refresh] Error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

interface TokenRow {
  id: string;
  user_id: string;
  integration_registry_id: string;
  refresh_token_secret_id: string | null;
  access_token_secret_id: string | null;
  expires_at: string | null;
}

async function refreshSingleToken(
  supabase: ReturnType<typeof createClient>,
  tokenRow: TokenRow
): Promise<{ success: boolean; error?: string; expires_at?: string }> {
  if (!tokenRow.refresh_token_secret_id) {
    return { success: false, error: 'No refresh token available' };
  }

  // Get refresh token from vault
  const { data: refreshToken } = await supabase
    .rpc('get_decrypted_secret', { secret_id: tokenRow.refresh_token_secret_id });

  if (!refreshToken) {
    return { success: false, error: 'Failed to decrypt refresh token' };
  }

  // Get Jira OAuth credentials from environment
  const clientId = Deno.env.get('JIRA_CLIENT_ID') || Deno.env.get('CORE314_JIRA_CLIENT_ID');
  const clientSecret = Deno.env.get('JIRA_CLIENT_SECRET') || Deno.env.get('CORE314_JIRA_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    return { success: false, error: 'JIRA_CLIENT_ID or JIRA_CLIENT_SECRET not configured' };
  }

  // Exchange refresh token for new access token at Atlassian token endpoint
  console.log('[jira-token-refresh] Refreshing token for user:', tokenRow.user_id);

  const tokenResponse = await fetch('https://auth.atlassian.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  });

  const tokenData = await tokenResponse.json();

  if (!tokenResponse.ok || !tokenData.access_token) {
    console.error('[jira-token-refresh] Token refresh failed:', {
      status: tokenResponse.status,
      error: tokenData.error,
      error_description: tokenData.error_description,
    });
    return {
      success: false,
      error: `Token refresh failed: ${tokenData.error_description || tokenData.error || 'Unknown error'}`,
    };
  }

  console.log('[jira-token-refresh] Token refresh successful for user:', tokenRow.user_id);

  // Store new access token in vault
  const { data: newAccessTokenSecretId } = await supabase.rpc('vault_create_secret', {
    secret: tokenData.access_token,
  });

  // Store new refresh token if provided (Atlassian may rotate refresh tokens)
  let newRefreshTokenSecretId = tokenRow.refresh_token_secret_id;
  if (tokenData.refresh_token) {
    const { data: refreshSecretId } = await supabase.rpc('vault_create_secret', {
      secret: tokenData.refresh_token,
    });
    newRefreshTokenSecretId = refreshSecretId;
  }

  const expiresAt = tokenData.expires_in
    ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
    : null;

  // Update oauth_tokens row with new token references
  await supabase
    .from('oauth_tokens')
    .update({
      access_token_secret_id: newAccessTokenSecretId,
      refresh_token_secret_id: newRefreshTokenSecretId,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', tokenRow.id);

  return { success: true, expires_at: expiresAt ?? undefined };
}
