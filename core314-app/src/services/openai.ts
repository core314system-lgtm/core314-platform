import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY || '',
  dangerouslyAllowBrowser: true,
});

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
1. "metrics": array of metric suggestions, each with:
   - metric_name: descriptive name
   - metric_type: count|sum|average|percentage|trend
   - data_path: array of keys to access this data (e.g., ["data", "amount"])
   - unit: optional unit (e.g., "USD", "items")
   - chart_type: line|bar|donut|gauge|table
   - confidence: 0-1 score
   - reasoning: brief explanation
2. "platform_type": detected platform (e.g., "stripe", "asana")
3. "summary": brief description of the data

Focus on metrics that would be valuable for business operations tracking. Limit to top 5-10 most important metrics.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a data analysis expert specializing in business metrics. Always return valid JSON.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    SCHEMA_CACHE.set(cacheKey, result);
    
    return result;
  } catch (error) {
    console.error('OpenAI schema analysis error:', error);
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

${data.historical_data ? `Historical data:\n${JSON.stringify(data.historical_data, null, 2)}` : ''}

Provide 3-5 specific, actionable recommendations to help them achieve this goal. Return a JSON object with a "recommendations" array of strings.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a business operations advisor. Provide specific, actionable recommendations. Always return valid JSON.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });

    const result = JSON.parse(response.choices[0].message.content || '{"recommendations":[]}');
    return result.recommendations || [];
  } catch (error) {
    console.error('OpenAI recommendation generation error:', error);
    return ['Review your current metrics and adjust strategies as needed.'];
  }
}

export async function explainRecommendation(recommendation: {
  recommendation_text: string;
  data_sources: object;
  goal_context: object;
}): Promise<{ explanation: string; key_factors: string[] }> {
  try {
    const prompt = `Explain why the following recommendation was made:

Recommendation: ${recommendation.recommendation_text}

Context: ${JSON.stringify(recommendation.goal_context, null, 2)}
Data Sources: ${JSON.stringify(recommendation.data_sources, null, 2)}

Provide:
1. "explanation": A clear, human-readable explanation (2-3 sentences)
2. "key_factors": Array of 2-4 key factors that influenced this recommendation

Return as JSON.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an AI transparency expert. Explain decisions clearly. Always return valid JSON.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.5,
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    return {
      explanation: result.explanation || 'Unable to generate explanation',
      key_factors: result.key_factors || [],
    };
  } catch (error) {
    console.error('OpenAI explanation error:', error);
    return {
      explanation: 'This recommendation is based on your current metrics and historical trends.',
      key_factors: [],
    };
  }
}

export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('OpenAI embedding error:', error);
    return [];
  }
}

export async function generateFusionNarrative(data: {
  organization_name: string;
  fusion_score?: number;
  top_integrations?: Array<{ name: string; score: number }>;
  automation_activity?: { total_rules: number; total_executions: number };
  recent_insights?: Array<{ message: string; confidence: number }>;
  time_period: string;
}): Promise<{ title: string; summary: string; recommendations: string; confidence: number }> {
  try {
    const prompt = `You are an AI operations analyst. Analyze the following data for ${data.organization_name} and generate a comprehensive executive brief.

Time Period: ${data.time_period}
Fusion Confidence Score: ${data.fusion_score !== undefined ? data.fusion_score.toFixed(1) : 'N/A'}
Top Integrations: ${data.top_integrations?.map(i => `${i.name} (${i.score.toFixed(1)})`).join(', ') || 'None'}
Automation Activity: ${data.automation_activity ? `${data.automation_activity.total_rules} rules, ${data.automation_activity.total_executions} executions` : 'No automation configured'}
Recent Insights: ${data.recent_insights?.map(i => i.message).join('; ') || 'No recent insights'}

Generate a comprehensive narrative with:
1. "title": A concise, executive-friendly title (5-10 words)
2. "summary": A 2-3 paragraph summary of the current state, trends, and key findings
3. "recommendations": 3-5 specific, actionable recommendations with bullet points
4. "confidence": A confidence score (0-100) based on data availability and quality

Return as JSON with these exact fields.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an expert AI operations analyst specializing in business intelligence and executive reporting. Always return valid JSON.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 1500,
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    return {
      title: result.title || 'Operations Summary',
      summary: result.summary || 'No summary available.',
      recommendations: result.recommendations || 'No recommendations at this time.',
      confidence: result.confidence || 50,
    };
  } catch (error) {
    console.error('OpenAI narrative generation error:', error);
    return {
      title: 'Operations Summary',
      summary: 'Unable to generate comprehensive narrative due to an error. Please try again later.',
      recommendations: 'Review system metrics manually and ensure data is being collected properly.',
      confidence: 0,
    };
  }
}
