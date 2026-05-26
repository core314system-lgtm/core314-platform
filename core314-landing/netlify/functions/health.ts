import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export const handler: Handler = async () => {
  try {
    const startTime = Date.now();

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: errorCount } = await supabase
      .from('audit_logs')
      .select('*', { count: 'exact', head: true })
      .in('event_type', ['error', 'critical_error', 'system_error'])
      .gte('created_at', twentyFourHoursAgo);

    const { data: fusionScores } = await supabase
      .from('fusion_scores')
      .select('fusion_score')
      .order('calculated_at', { ascending: false })
      .limit(100);

    const avgFusionScore = fusionScores && fusionScores.length > 0
      ? fusionScores.reduce((sum, s) => sum + (s.fusion_score || 0), 0) / fusionScores.length
      : 0;

    const uptimeSeconds = process.uptime();

    const responseTime = Date.now() - startTime;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
      body: JSON.stringify({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime_seconds: Math.floor(uptimeSeconds),
        errors_24h: errorCount || 0,
        fusion_score_avg: Math.round(avgFusionScore * 100) / 100,
        response_time_ms: responseTime,
        version: '1.0-GA-RC1',
      }),
    };
  } catch (error: any) {
    console.error('Health check error:', error);
    return {
      statusCode: 503,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message,
      }),
    };
  }
};
