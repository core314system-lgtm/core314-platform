import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { initSentry, captureMessage, captureException } from '../_shared/sentry.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const eventType = url.searchParams.get('event') || 'message'
    
    const dsnConfigured = !!Deno.env.get('SENTRY_DSN')
    const environment = Deno.env.get('SENTRY_ENV') || Deno.env.get('ENVIRONMENT') || 'production'
    const release = Deno.env.get('SENTRY_RELEASE') || 'phase55-sentry-integration'
    
    initSentry()
    
    let eventId: string | undefined
    let eventDescription: string
    
    if (eventType === 'error') {
      try {
        throw new Error('Core314 Sentry Test Event - edge:prod - Controlled Error')
      } catch (error) {
        captureException(error as Error, {
          function: 'sentry-diagnostics',
          eventType: 'controlled_error',
          timestamp: new Date().toISOString(),
        })
        eventDescription = 'Controlled error thrown and captured'
      }
    } else {
      captureMessage('Core314 Sentry Test Event - edge:prod - Diagnostic Message', 'info')
      eventDescription = 'Diagnostic message sent'
    }
    
    const response = {
      status: 'success',
      sentry: {
        dsnConfigured,
        environment,
        release,
        eventType,
        eventDescription,
        timestamp: new Date().toISOString(),
      },
      message: dsnConfigured 
        ? `Sentry event sent successfully. Check Sentry dashboard for event in environment: ${environment}, release: ${release}`
        : 'SENTRY_DSN not configured - event not sent',
    }
    
    return new Response(JSON.stringify(response, null, 2), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Diagnostics error:', error)
    return new Response(
      JSON.stringify({
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
