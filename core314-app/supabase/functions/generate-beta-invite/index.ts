import { withSentry, breadcrumb, handleSentryTest } from "../_shared/sentry.ts";

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { corsHeaders } from '../_shared/cors.ts'
import { create, getNumericDate } from 'https://deno.land/x/djwt@v2.8/mod.ts'

interface InviteRequest {
  user_email: string
  tier: 'Starter' | 'Pro' | 'Enterprise'
  metadata?: Record<string, any>
}

serve(withSentry(async (req) => {
  const testResponse = await handleSentryTest(req);
  if (testResponse) return testResponse;

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const jwtSecret = Deno.env.get('JWT_SECRET') ?? Deno.env.get('SUPABASE_JWT_SECRET') ?? ''
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration')
    }

    if (!jwtSecret) {
      throw new Error('Missing JWT_SECRET configuration')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.substring(7)
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const inviteRequest: InviteRequest = await req.json()

    if (!inviteRequest.user_email || !inviteRequest.tier) {
      return new Response(
        JSON.stringify({ error: 'user_email and tier are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(inviteRequest.user_email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: existingInvite } = await supabase
      .from('beta_invites')
      .select('id, status')
      .eq('user_email', inviteRequest.user_email)
      .single()

    if (existingInvite && existingInvite.status === 'pending') {
      return new Response(
        JSON.stringify({ error: 'Active invite already exists for this email' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(jwtSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify']
    )

    const inviteToken = await create(
      { alg: 'HS256', typ: 'JWT' },
      {
        email: inviteRequest.user_email,
        tier: inviteRequest.tier,
        type: 'beta_invite',
        exp: getNumericDate(7 * 24 * 60 * 60), // 7 days
      },
      key
    )

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    const { data: invite, error: inviteError } = await supabase
      .from('beta_invites')
      .upsert({
        user_email: inviteRequest.user_email,
        tier: inviteRequest.tier,
        status: 'pending',
        invite_token: inviteToken,
        invited_by: user.id,
        expires_at: expiresAt,
        metadata: inviteRequest.metadata || {},
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_email'
      })
      .select()
      .single()

    if (inviteError) {
      console.error('[generate-beta-invite] Error creating invite:', inviteError)
      return new Response(
        JSON.stringify({ error: inviteError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const baseUrl = Deno.env.get('APP_URL') || 'https://app.core314.com'
    const inviteUrl = `${baseUrl}/beta-invite?token=${inviteToken}`

    return new Response(
      JSON.stringify({
        success: true,
        invite_id: invite.id,
        invite_url: inviteUrl,
        invite_token: inviteToken,
        expires_at: expiresAt,
        message: 'Beta invite generated successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[generate-beta-invite] Fatal error:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
}), { name: "generate-beta-invite" }));