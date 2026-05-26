import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"

export default async (_req: Request, _context: Context) => {
  const startTime = Date.now()
  let dbStatus = 'ok'

  try {
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!
    )

    // Quick DB health check
    const { error } = await supabase.from('organizations').select('id', { count: 'exact', head: true })
    if (error) dbStatus = 'degraded'
  } catch {
    dbStatus = 'unavailable'
  }

  const responseTime = Date.now() - startTime

  return new Response(JSON.stringify({
    status: dbStatus === 'ok' ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    services: {
      database: dbStatus,
      api: 'ok',
    },
    response_time_ms: responseTime,
  }), {
    status: dbStatus === 'ok' ? 200 : 503,
    headers: { 'Content-Type': 'application/json' }
  })
}
