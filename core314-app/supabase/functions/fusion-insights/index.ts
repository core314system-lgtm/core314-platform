import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { withSentry, breadcrumb, handleSentryTest, jsonError } from "../_shared/sentry.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

serve(withSentry(async (req) => {
  const testResponse = await handleSentryTest(req);
  if (testResponse) return testResponse;

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: recentFeedback } = await supabase
      .from('fusion_feedback')
      .select('feedback_type, score_before, score_after, created_at')
      .eq('user_id', user.id)
      .gte('created_at', sevenDaysAgo);

    const { data: olderFeedback } = await supabase
      .from('fusion_feedback')
      .select('feedback_type, score_before, score_after, created_at')
      .eq('user_id', user.id)
      .gte('created_at', thirtyDaysAgo)
      .lt('created_at', sevenDaysAgo);

    const calculateMetrics = (feedbacks: any[]) => {
      if (!feedbacks || feedbacks.length === 0) {
        return { avgConfidence: 0, successRate: 0, count: 0 };
      }

      const successCount = feedbacks.filter(f => f.feedback_type === 'success').length;
      const successRate = successCount / feedbacks.length;
      
      const avgScoreDelta = feedbacks.reduce((sum, f) => {
        return sum + ((f.score_after || 0) - (f.score_before || 0));
      }, 0) / feedbacks.length;
      
      const avgConfidence = Math.min(Math.max((successRate + (avgScoreDelta / 100)), 0), 1);
      
      return { avgConfidence, successRate, count: feedbacks.length };
    };

    const recent = calculateMetrics(recentFeedback || []);
    const older = calculateMetrics(olderFeedback || []);

    let trend7Days = '+0.0%';
    if (older.successRate > 0) {
      const change = ((recent.successRate - older.successRate) / older.successRate) * 100;
      trend7Days = change >= 0 ? `+${change.toFixed(1)}%` : `${change.toFixed(1)}%`;
    } else if (recent.successRate > 0) {
      trend7Days = `+${(recent.successRate * 100).toFixed(1)}%`;
    }

    return new Response(JSON.stringify({
      average_confidence: parseFloat(recent.avgConfidence.toFixed(2)),
      success_rate: parseFloat(recent.successRate.toFixed(2)),
      trend_7_days: trend7Days,
      feedback_count_7d: recent.count,
      feedback_count_30d: (recent.count || 0) + (older.count || 0)
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Fusion insights error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}), { name: "fusion-insights" }));