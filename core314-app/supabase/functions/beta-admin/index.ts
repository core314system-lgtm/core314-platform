import { withSentry, breadcrumb, handleSentryTest } from "../_shared/sentry.ts";

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface BetaAdminRequest {
  action: 'approve' | 'revoke' | 'reset'
  userId: string
}

serve(withSentry(async (req) => {
  const testResponse = await handleSentryTest(req);
  if (testResponse) return testResponse;

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    
    if (authError || !user) {
      console.error('[BETA-ADMIN] Authentication failed:', authError)
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || profile?.role !== 'admin') {
      console.error('[BETA-ADMIN] User is not admin:', user.id)
      return new Response(JSON.stringify({ error: 'Forbidden: Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { action, userId }: BetaAdminRequest = await req.json()

    if (!action || !userId) {
      return new Response(JSON.stringify({ error: 'Missing required fields: action, userId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: targetProfile } = await serviceClient
      .from('profiles')
      .select('email, full_name, beta_status')
      .eq('id', userId)
      .single()

    if (!targetProfile) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const oldStatus = targetProfile.beta_status

    let updateData: any = {}
    let newStatus: string = oldStatus

    switch (action) {
      case 'approve':
        updateData = {
          beta_status: 'approved',
          beta_approved_at: new Date().toISOString()
        }
        newStatus = 'approved'
        break
      
      case 'revoke':
        updateData = {
          beta_status: 'revoked'
        }
        newStatus = 'revoked'
        break
      
      case 'reset':
        updateData = {
          beta_status: 'pending',
          beta_approved_at: null
        }
        newStatus = 'pending'
        break
      
      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }

    const { error: updateError } = await serviceClient
      .from('profiles')
      .update(updateData)
      .eq('id', userId)

    if (updateError) {
      console.error('[BETA-ADMIN] Update failed:', updateError)
      return new Response(JSON.stringify({ error: 'Failed to update beta status' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`[BETA-ADMIN] ${action} completed for user ${userId} by admin ${user.id}`)
    console.log(`[BETA-ADMIN] Status changed: ${oldStatus} → ${newStatus}`)

    if ((newStatus === 'approved' || newStatus === 'revoked') && oldStatus !== newStatus) {
      try {
        const notifyResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/beta-notify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
          },
          body: JSON.stringify({
            userId,
            email: targetProfile.email,
            fullName: targetProfile.full_name,
            newStatus,
            oldStatus
          })
        })

        if (!notifyResponse.ok) {
          console.error('[BETA-ADMIN] Notification failed:', await notifyResponse.text())
        } else {
          console.log('[BETA-ADMIN] Notification sent successfully')
        }
      } catch (notifyError) {
        console.error('[BETA-ADMIN] Notification error:', notifyError)
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      userId,
      action,
      oldStatus,
      newStatus
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('[BETA-ADMIN] Unexpected error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
}), { name: "beta-admin" }));