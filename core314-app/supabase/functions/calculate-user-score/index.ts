
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CalculateScoreRequest {
  user_id: string;
}

interface ScoreResult {
  user_id: string;
  onboarding_score: number;
  activity_score: number;
  feature_usage_score: number;
  total_score: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseService = createClient(supabaseUrl, supabaseServiceKey);
    
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Valid authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { user_id } = body as CalculateScoreRequest;

    if (!user_id || typeof user_id !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Invalid user_id: must be a valid UUID string' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: profile } = await supabaseService
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const isAdmin = profile?.role === 'admin';
    const isSelf = user.id === user_id;

    if (!isAdmin && !isSelf) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: You can only calculate your own score unless you are an admin' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let onboardingScore = 0;
    
    const { data: betaUser } = await supabaseService
      .from('beta_users')
      .select('onboarding_completed')
      .eq('user_id', user_id)
      .single();

    if (betaUser?.onboarding_completed === true) {
      onboardingScore = 40;
    }

    let activityScore = 0;
    
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: recentEvents, count: eventCount } = await supabaseService
      .from('beta_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user_id)
      .gte('created_at', sevenDaysAgo.toISOString());

    const numEvents = eventCount || 0;
    
    if (numEvents === 0) {
      activityScore = 0;
    } else if (numEvents >= 1 && numEvents <= 3) {
      activityScore = 10;
    } else if (numEvents >= 4 && numEvents <= 10) {
      activityScore = 20;
    } else {
      activityScore = 30;
    }

    let featureUsageScore = 0;
    
    const { data: featureUsage } = await supabaseService
      .from('beta_feature_usage')
      .select('usage_count')
      .eq('user_id', user_id);

    const totalUsageCount = (featureUsage || []).reduce((sum, f) => sum + (f.usage_count || 0), 0);
    
    if (totalUsageCount === 0) {
      featureUsageScore = 0;
    } else if (totalUsageCount >= 1 && totalUsageCount <= 5) {
      featureUsageScore = 10;
    } else if (totalUsageCount >= 6 && totalUsageCount <= 15) {
      featureUsageScore = 20;
    } else {
      featureUsageScore = 30;
    }

    const totalScore = onboardingScore + activityScore + featureUsageScore;

    const { error: upsertError } = await supabaseService
      .from('user_quality_scores')
      .upsert({
        user_id: user_id,
        onboarding_score: onboardingScore,
        activity_score: activityScore,
        feature_usage_score: featureUsageScore,
        last_calculated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      });

    if (upsertError) {
      console.error('Failed to upsert user quality score:', upsertError);
      return new Response(
        JSON.stringify({ error: `Failed to save score: ${upsertError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result: ScoreResult = {
      user_id: user_id,
      onboarding_score: onboardingScore,
      activity_score: activityScore,
      feature_usage_score: featureUsageScore,
      total_score: totalScore,
    };

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error in calculate-user-score:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
