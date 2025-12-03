import { withSentry, breadcrumb, handleSentryTest, jsonError } from "../_shared/sentry.ts";

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { corsHeaders } from '../_shared/cors.ts'

interface MonitoringEvent {
  user_id?: string
  session_id?: string
  event_type: 'session_start' | 'session_end' | 'api_call' | 'error' | 'fusion_score' | 'page_view'
  endpoint?: string
  latency_ms?: number
  status_code?: number
  error_message?: string
  fusion_score?: number
  fusion_deviation?: number
  page_path?: string
  user_agent?: string
  ip_address?: string
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
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const event: MonitoringEvent = await req.json()

    if (!event.event_type) {
      return new Response(
        JSON.stringify({ error: 'event_type is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!event.user_id) {
      const authHeader = req.headers.get('Authorization')
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7)
        const { data: { user }, error: userError } = await supabase.auth.getUser(token)
        if (!userError && user) {
          event.user_id = user.id
        }
      }
    }

    if (!event.ip_address) {
      event.ip_address = req.headers.get('x-forwarded-for') || 
                         req.headers.get('x-real-ip') || 
                         'unknown'
    }

    if (!event.user_agent) {
      event.user_agent = req.headers.get('user-agent') || 'unknown'
    }

    const { data, error } = await supabase
      .from('beta_monitoring_log')
      .insert({
        user_id: event.user_id,
        session_id: event.session_id,
        event_type: event.event_type,
        endpoint: event.endpoint,
        latency_ms: event.latency_ms,
        status_code: event.status_code,
        error_message: event.error_message,
        fusion_score: event.fusion_score,
        fusion_deviation: event.fusion_deviation,
        page_path: event.page_path,
        user_agent: event.user_agent,
        ip_address: event.ip_address,
        metadata: event.metadata || {},
      })
      .select()
      .single()

    if (error) {
      console.error('[beta-monitor] Error inserting monitoring event:', error)
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (event.event_type === 'error') {
      await checkErrorThreshold(supabase, event.user_id)
    }

    if (event.event_type === 'fusion_score' && event.fusion_deviation && event.fusion_deviation > 20) {
      await alertFusionDeviation(supabase, event.user_id, event.fusion_score, event.fusion_deviation)
    }

    return new Response(
      JSON.stringify({
        success: true,
        event_id: data.id,
        message: 'Monitoring event logged successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[beta-monitor] Fatal error:', error)
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
})

async function checkErrorThreshold(supabase: any, userId?: string) {
  const { data: recentEvents } = await supabase
    .from('beta_monitoring_log')
    .select('event_type')
    .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
    .in('event_type', ['api_call', 'error'])

  if (recentEvents && recentEvents.length > 10) {
    const errorCount = recentEvents.filter((e: any) => e.event_type === 'error').length
    const errorRate = (errorCount / recentEvents.length) * 100

    if (errorRate > 5) {
      console.warn(`[beta-monitor] High error rate detected: ${errorRate.toFixed(2)}%`)
      
      await supabase
        .from('auto_scale_recommendations')
        .insert({
          trigger_condition: 'high_error_rate_5m',
          failure_rate: errorRate,
          recommendation: 'Investigate error spike and consider scaling resources',
          severity: 'critical',
          metadata: {
            error_count: errorCount,
            total_events: recentEvents.length,
            time_window: '5 minutes'
          }
        })
    }
  }
}

async function alertFusionDeviation(
  supabase: any, 
  userId: string | undefined, 
  fusionScore: number | undefined, 
  deviation: number
) {
  console.warn(`[beta-monitor] High fusion deviation detected: ${deviation}% (score: ${fusionScore})`)
  
  await supabase
    .from('auto_scale_recommendations')
    .insert({
      trigger_condition: 'high_fusion_deviation',
      recommendation: 'Review fusion scoring algorithm - high deviation detected',
      severity: 'warning',
      metadata: {
        user_id: userId,
        fusion_score: fusionScore,
        deviation: deviation
      }
    })
}
