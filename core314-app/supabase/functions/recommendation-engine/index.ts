
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { withSentry, breadcrumb, handleSentryTest, jsonError } from "../_shared/sentry.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PredictionEvent {
  id: string;
  source_behavior_id: string | null;
  prediction_type: string;
  recommendation: string;
  confidence_score: number;
  predicted_impact: number;
  model_version: string;
  created_at: string;
}

interface RecommendationFilters {
  prediction_type?: string;
  min_confidence?: number;
  max_confidence?: number;
  start_date?: string;
  end_date?: string;
  limit?: number;
}

interface RecommendationResponse {
  status: 'success' | 'error';
  message: string;
  summary: {
    total_recommendations: number;
    avg_confidence: number;
    avg_predicted_impact: number;
    active_model_version: string;
    prediction_types: string[];
  };
  recommendations: PredictionEvent[];
  error?: string;
}

serve(withSentry(async (req) => {
  const testResponse = await handleSentryTest(req);
  if (testResponse) return testResponse;

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let filters: RecommendationFilters = {};
    if (req.method === 'POST') {
      try {
        filters = await req.json();
      } catch {
        filters = {};
      }
    }

    let query = supabase
      .from('fusion_prediction_events')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters.prediction_type && filters.prediction_type !== 'all') {
      query = query.eq('prediction_type', filters.prediction_type);
    }

    if (filters.min_confidence !== undefined) {
      query = query.gte('confidence_score', filters.min_confidence);
    }
    if (filters.max_confidence !== undefined) {
      query = query.lte('confidence_score', filters.max_confidence);
    }

    if (filters.start_date) {
      query = query.gte('created_at', filters.start_date);
    }
    if (filters.end_date) {
      query = query.lte('created_at', filters.end_date);
    }

    const limit = filters.limit || 50;
    query = query.limit(limit);

    const { data: predictions, error: fetchError } = await query;

    if (fetchError) {
      throw new Error(`Failed to fetch predictions: ${fetchError.message}`);
    }

    if (!predictions || predictions.length === 0) {
      return new Response(
        JSON.stringify({
          status: 'success',
          message: 'No recommendations found matching the criteria',
          summary: {
            total_recommendations: 0,
            avg_confidence: 0,
            avg_predicted_impact: 0,
            active_model_version: 'N/A',
            prediction_types: [],
          },
          recommendations: [],
        } as RecommendationResponse),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    const totalRecommendations = predictions.length;
    const avgConfidence = predictions.reduce((sum, p) => sum + Number(p.confidence_score), 0) / totalRecommendations;
    const avgPredictedImpact = predictions.reduce((sum, p) => sum + Number(p.predicted_impact), 0) / totalRecommendations;
    const activeModelVersion = predictions[0]?.model_version || 'N/A';
    const predictionTypes = [...new Set(predictions.map(p => p.prediction_type))];

    const formattedRecommendations: PredictionEvent[] = predictions.map(p => ({
      id: p.id,
      source_behavior_id: p.source_behavior_id,
      prediction_type: p.prediction_type,
      recommendation: p.recommendation,
      confidence_score: Number(p.confidence_score),
      predicted_impact: Number(p.predicted_impact),
      model_version: p.model_version,
      created_at: p.created_at,
    }));

    const response: RecommendationResponse = {
      status: 'success',
      message: `Retrieved ${totalRecommendations} recommendation(s)`,
      summary: {
        total_recommendations: totalRecommendations,
        avg_confidence: parseFloat(avgConfidence.toFixed(2)),
        avg_predicted_impact: parseFloat(avgPredictedImpact.toFixed(2)),
        active_model_version: activeModelVersion,
        prediction_types: predictionTypes,
      },
      recommendations: formattedRecommendations,
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Recommendation Engine Error:', error);

    const errorResponse: RecommendationResponse = {
      status: 'error',
      message: 'Failed to retrieve recommendations',
      summary: {
        total_recommendations: 0,
        avg_confidence: 0,
        avg_predicted_impact: 0,
        active_model_version: 'N/A',
        prediction_types: [],
      },
      recommendations: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };

    return new Response(JSON.stringify(errorResponse), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
}), { name: "recommendation-engine" }));