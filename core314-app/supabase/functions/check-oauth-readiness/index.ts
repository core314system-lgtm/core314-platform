import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

/**
 * OAuth Readiness Check Function
 * 
 * Returns which OAuth integrations have their credentials properly configured.
 * This allows the frontend to hide integrations that aren't ready at runtime.
 * 
 * SECURITY: Only returns boolean flags, never exposes actual credential values.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

// OAuth integrations and their required env var prefixes
const OAUTH_INTEGRATIONS = [
  { serviceName: 'salesforce', envPrefix: 'SALESFORCE', fallbackPrefix: 'CORE314_SALESFORCE' },
  { serviceName: 'microsoft_teams', envPrefix: 'TEAMS', fallbackPrefix: 'CORE314_TEAMS' },
  { serviceName: 'slack', envPrefix: 'SLACK', fallbackPrefix: 'CORE314_SLACK' },
  { serviceName: 'zoom', envPrefix: 'ZOOM', fallbackPrefix: 'CORE314_ZOOM' },
  { serviceName: 'google_calendar', envPrefix: 'GOOGLE', fallbackPrefix: 'CORE314_GOOGLE' },
  { serviceName: 'quickbooks', envPrefix: 'QUICKBOOKS', fallbackPrefix: 'CORE314_QUICKBOOKS' },
  { serviceName: 'xero', envPrefix: 'XERO', fallbackPrefix: 'CORE314_XERO' },
];

function checkOAuthReady(envPrefix: string, fallbackPrefix: string): boolean {
  // Check primary prefix
  const clientId = Deno.env.get(`${envPrefix}_CLIENT_ID`);
  const clientSecret = Deno.env.get(`${envPrefix}_CLIENT_SECRET`);
  
  if (clientId && clientId !== '' && clientSecret && clientSecret !== '') {
    return true;
  }
  
  // Check fallback prefix
  const fallbackClientId = Deno.env.get(`${fallbackPrefix}_CLIENT_ID`);
  const fallbackClientSecret = Deno.env.get(`${fallbackPrefix}_CLIENT_SECRET`);
  
  return !!(fallbackClientId && fallbackClientId !== '' && fallbackClientSecret && fallbackClientSecret !== '');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const readinessStatus: Record<string, boolean> = {};
    const notReady: string[] = [];
    
    for (const integration of OAUTH_INTEGRATIONS) {
      const isReady = checkOAuthReady(integration.envPrefix, integration.fallbackPrefix);
      readinessStatus[integration.serviceName] = isReady;
      
      if (!isReady) {
        notReady.push(integration.serviceName);
        console.log(`[check-oauth-readiness] ${integration.serviceName}: NOT READY (missing ${integration.envPrefix}_CLIENT_ID or ${integration.envPrefix}_CLIENT_SECRET)`);
      } else {
        console.log(`[check-oauth-readiness] ${integration.serviceName}: READY`);
      }
    }

    return new Response(JSON.stringify({
      readiness: readinessStatus,
      notReady,
      allReady: notReady.length === 0,
      timestamp: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[check-oauth-readiness] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
