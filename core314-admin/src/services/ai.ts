import { supabase } from '@/lib/supabase';

interface MetricSuggestion {
  metric_name: string;
  metric_type: 'count' | 'sum' | 'average' | 'percentage' | 'trend';
  data_path: string[];
  unit?: string;
  chart_type: 'line' | 'bar' | 'donut' | 'gauge' | 'table';
  confidence: number;
  reasoning: string;
}

interface SchemaAnalysisResponse {
  metrics: MetricSuggestion[];
  platform_type?: string;
  summary: string;
}

const SCHEMA_CACHE = new Map<string, SchemaAnalysisResponse>();

export async function analyzeAPISchema(
  schema: object,
  platformName?: string
): Promise<SchemaAnalysisResponse> {
  const cacheKey = JSON.stringify({ schema, platformName });
  
  if (SCHEMA_CACHE.has(cacheKey)) {
    return SCHEMA_CACHE.get(cacheKey)!;
  }

  try {
    const prompt = `You are an expert data analyst. Analyze the following API schema and suggest relevant metrics for a business operations dashboard.

Platform: ${platformName || 'Unknown'}

API Schema:
${JSON.stringify(schema, null, 2)}

Return a JSON response with:
1. "metrics": array of metric suggestions
2. "platform_type": detected platform
3. "summary": brief description

Focus on top 5-10 most important metrics.`;

    const { data, error } = await supabase.functions.invoke('ai-generate', {
      body: {
        prompt,
        model: 'gpt-4o-mini',
        temperature: 0.3,
        response_format: { type: 'json_object' },
      },
    });

    if (error) throw error;

    const result = JSON.parse(data.text || '{}');
    SCHEMA_CACHE.set(cacheKey, result);
    
    return result;
  } catch (error) {
    console.error('AI schema analysis error:', error);
    return {
      metrics: [],
      summary: 'Failed to analyze schema',
    };
  }
}

export async function generateMetricRecommendations(data: {
  goal_name: string;
  current_value: number;
  target_value: number;
  progress_percentage: number;
  historical_data?: Array<{ date: string; value: number }>;
}): Promise<string[]> {
  try {
    const prompt = `You are a business operations advisor. A user has the following goal:

Goal: ${data.goal_name}
Current: ${data.current_value}
Target: ${data.target_value}
Progress: ${data.progress_percentage}%

Provide 3-5 specific recommendations. Return JSON with "recommendations" array.`;

    const { data: responseData, error } = await supabase.functions.invoke('ai-generate', {
      body: {
        prompt,
        model: 'gpt-4o-mini',
        temperature: 0.7,
        response_format: { type: 'json_object' },
      },
    });

    if (error) throw error;

    const result = JSON.parse(responseData.text || '{"recommendations":[]}');
    return result.recommendations || [];
  } catch (error) {
    console.error('AI recommendation error:', error);
    return ['Review your current metrics and adjust strategies as needed.'];
  }
}

export async function explainRecommendation(recommendation: {
  recommendation_text: string;
  data_sources: object;
  goal_context: object;
}): Promise<{ explanation: string; key_factors: string[] }> {
  try {
    const prompt = `Explain why this recommendation was made:

Recommendation: ${recommendation.recommendation_text}

Provide:
1. "explanation": Clear explanation (2-3 sentences)
2. "key_factors": Array of 2-4 key factors

Return as JSON.`;

    const { data, error } = await supabase.functions.invoke('ai-generate', {
      body: {
        prompt,
        model: 'gpt-4o-mini',
        temperature: 0.5,
        response_format: { type: 'json_object' },
      },
    });

    if (error) throw error;

    const result = JSON.parse(data.text || '{}');
    return {
      explanation: result.explanation || 'Unable to generate explanation',
      key_factors: result.key_factors || [],
    };
  } catch (error) {
    console.error('AI explanation error:', error);
    return {
      explanation: 'This recommendation is based on your current metrics.',
      key_factors: [],
    };
  }
}

export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const { data, error } = await supabase.functions.invoke('ai-generate', {
      body: {
        prompt: text,
        operation: 'embedding',
      },
    });

    if (error) throw error;

    return data.embedding || [];
  } catch (error) {
    console.error('AI embedding error:', error);
    return [];
  }
}
