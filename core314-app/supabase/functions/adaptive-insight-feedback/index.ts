
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FeedbackRequest {
  insight_id?: string;
  insight_text: string;
  insight_category: string; // 'trend', 'anomaly', 'forecast', 'recommendation'
  related_metrics: string[];
  context_data: any;
  impact_score: number;
  confidence_before: number;
  user_feedback?: 'accepted' | 'rejected' | 'modified';
  similarity_threshold?: number;
}

interface SimilarInsight {
  id: string;
  insight_text: string;
  impact_score: number;
  confidence_after: number;
  reuse_count: number;
  similarity_score: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(jwt);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const requestBody: FeedbackRequest = await req.json();

    if (!requestBody.insight_text || !requestBody.insight_category || !requestBody.related_metrics) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: insight_text, insight_category, related_metrics' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (requestBody.insight_id) {
      const result = await updateInsightFeedback(supabaseClient, user.id, requestBody);
      return new Response(
        JSON.stringify(result),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      const result = await createInsightMemory(supabaseClient, user.id, requestBody);
      return new Response(
        JSON.stringify(result),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Error in adaptive-insight-feedback:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function updateInsightFeedback(
  supabaseClient: any,
  userId: string,
  request: FeedbackRequest
): Promise<any> {
  const { insight_id, user_feedback } = request;

  const { data: existingInsight, error: fetchError } = await supabaseClient
    .from('insight_memory')
    .select('*')
    .eq('id', insight_id)
    .eq('user_id', userId)
    .single();

  if (fetchError || !existingInsight) {
    throw new Error('Insight not found');
  }

  let confidenceAfter = existingInsight.confidence_before;

  if (user_feedback === 'accepted') {
    confidenceAfter = Math.min(1.0, existingInsight.confidence_before + 0.1);
  } else if (user_feedback === 'rejected') {
    confidenceAfter = Math.max(0.0, existingInsight.confidence_before - 0.15);
  } else if (user_feedback === 'modified') {
    confidenceAfter = existingInsight.confidence_before; // No change for modified
  }

  const { error: updateError } = await supabaseClient
    .from('insight_memory')
    .update({
      user_feedback,
      feedback_timestamp: new Date().toISOString(),
      confidence_after: confidenceAfter,
    })
    .eq('id', insight_id);

  if (updateError) throw updateError;

  return {
    success: true,
    message: 'Insight feedback recorded',
    insight_id,
    user_feedback,
    confidence_before: existingInsight.confidence_before,
    confidence_after: confidenceAfter,
    confidence_change: confidenceAfter - existingInsight.confidence_before,
  };
}

async function createInsightMemory(
  supabaseClient: any,
  userId: string,
  request: FeedbackRequest
): Promise<any> {
  const similarityThreshold = request.similarity_threshold || 0.8;

  const similarInsights = await findSimilarInsights(
    supabaseClient,
    userId,
    request.insight_category,
    request.related_metrics,
    similarityThreshold
  );

  let reinforcedConfidence = request.confidence_before;

  if (similarInsights.length > 0) {
    const acceptedInsights = similarInsights.filter(i => i.confidence_after && i.confidence_after > 0.7);
    
    if (acceptedInsights.length > 0) {
      const avgSimilarConfidence = acceptedInsights.reduce((sum, i) => sum + (i.confidence_after || 0), 0) / acceptedInsights.length;
      
      const blendWeight = Math.min(acceptedInsights.length / 5, 0.5); // Max 50% weight from similar insights
      reinforcedConfidence = (request.confidence_before * (1 - blendWeight)) + (avgSimilarConfidence * blendWeight);
    }

    for (const similar of similarInsights) {
      await supabaseClient
        .from('insight_memory')
        .update({
          reuse_count: (similar.reuse_count || 0) + 1,
          last_reused_at: new Date().toISOString(),
        })
        .eq('id', similar.id);
    }
  }

  const { data: newInsight, error: insertError } = await supabaseClient
    .from('insight_memory')
    .insert({
      user_id: userId,
      insight_text: request.insight_text,
      insight_category: request.insight_category,
      related_metrics: request.related_metrics,
      context_data: request.context_data || {},
      impact_score: request.impact_score,
      confidence_before: request.confidence_before,
      confidence_after: reinforcedConfidence,
      similarity_threshold: similarityThreshold,
    })
    .select()
    .single();

  if (insertError) throw insertError;

  return {
    success: true,
    message: 'Insight memory created with reinforcement',
    insight_id: newInsight.id,
    confidence_before: request.confidence_before,
    confidence_after: reinforcedConfidence,
    confidence_boost: reinforcedConfidence - request.confidence_before,
    similar_insights_found: similarInsights.length,
    memory_reinforcement_applied: similarInsights.length > 0,
  };
}

async function findSimilarInsights(
  supabaseClient: any,
  userId: string,
  category: string,
  relatedMetrics: string[],
  threshold: number
): Promise<SimilarInsight[]> {
  const { data: insights, error } = await supabaseClient
    .from('insight_memory')
    .select('*')
    .eq('user_id', userId)
    .eq('insight_category', category)
    .not('confidence_after', 'is', null)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error || !insights) {
    return [];
  }

  const similarInsights: SimilarInsight[] = [];

  for (const insight of insights) {
    const insightMetrics = insight.related_metrics || [];
    const overlap = relatedMetrics.filter(m => insightMetrics.includes(m)).length;
    const totalUnique = new Set([...relatedMetrics, ...insightMetrics]).size;
    const similarityScore = totalUnique === 0 ? 0 : overlap / totalUnique;

    if (similarityScore >= threshold) {
      similarInsights.push({
        id: insight.id,
        insight_text: insight.insight_text,
        impact_score: insight.impact_score,
        confidence_after: insight.confidence_after,
        reuse_count: insight.reuse_count || 0,
        similarity_score: similarityScore,
      });
    }
  }

  return similarInsights.sort((a, b) => b.similarity_score - a.similarity_score);
}
