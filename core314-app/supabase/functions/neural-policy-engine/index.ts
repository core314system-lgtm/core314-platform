import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { withSentry, breadcrumb, handleSentryTest } from "../_shared/sentry.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TrainingResult {
  policies_trained: number;
  avg_confidence: number;
  avg_accuracy: number;
}

serve(withSentry(async (req) => {
  const testResponse = await handleSentryTest(req);
  if (testResponse) return testResponse;

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authorization token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_platform_admin, role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isPlatformAdmin = profile.is_platform_admin === true || profile.role === 'platform_admin';

    if (!isPlatformAdmin) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Platform admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (req.method === 'POST') {
      console.log('Running neural policy training...');

      const { data: trainingData, error: trainingError } = await supabase
        .rpc('run_neural_policy_training');

      if (trainingError) {
        console.error('Training error:', trainingError);
        return new Response(
          JSON.stringify({ 
            error: 'Failed to run neural policy training',
            details: trainingError.message 
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const result = trainingData && trainingData.length > 0 ? trainingData[0] : {
        policies_trained: 0,
        avg_confidence: 0,
        avg_accuracy: 0
      };

      return new Response(
        JSON.stringify({
          success: true,
          timestamp: new Date().toISOString(),
          policies_trained: result.policies_trained,
          avg_confidence: result.avg_confidence,
          avg_accuracy: result.avg_accuracy
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (req.method === 'GET') {
      console.log('Fetching neural policy weights summary...');

      const { data: weights, error: weightsError } = await supabase
        .from('fusion_neural_policy_weights')
        .select('*')
        .order('updated_at', { ascending: false });

      if (weightsError) {
        console.error('Weights fetch error:', weightsError);
        return new Response(
          JSON.stringify({ 
            error: 'Failed to fetch neural policy weights',
            details: weightsError.message 
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const totalPolicies = weights?.length || 0;
      const avgConfidence = totalPolicies > 0
        ? weights.reduce((sum, w) => sum + (w.confidence_avg || 0), 0) / totalPolicies
        : 0;
      const avgAccuracy = totalPolicies > 0
        ? weights.reduce((sum, w) => sum + (w.accuracy || 0), 0) / totalPolicies
        : 0;
      const totalIterations = weights?.reduce((sum, w) => sum + (w.total_iterations || 0), 0) || 0;

      return new Response(
        JSON.stringify({
          success: true,
          timestamp: new Date().toISOString(),
          summary: {
            total_policies: totalPolicies,
            avg_confidence: Math.round(avgConfidence * 10000) / 10000,
            avg_accuracy: Math.round(avgAccuracy * 10000) / 10000,
            total_iterations: totalIterations
          },
          weights: weights || []
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}), { name: "neural-policy-engine" }));