interface IntelligenceRequest {
  data_type: 'goal_progress' | 'metric_analysis' | 'anomaly_detection';
  normalized_data: object;
  context?: object;
}

interface IntelligenceResponse {
  core_score?: number;
  efficiency_index?: number;
  risk_factor?: number;
  recommendations: string[];
  reasoning?: string;
  confidence?: number;
}

const EXTERNAL_API_URL = import.meta.env.VITE_EXTERNAL_INTELLIGENCE_API_URL || '';

export async function sendNormalizedData(
  request: IntelligenceRequest
): Promise<IntelligenceResponse> {
  if (!EXTERNAL_API_URL) {
    return generateStubResponse(request);
  }

  try {
    const response = await fetch(`${EXTERNAL_API_URL}/api/fusion/score`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_EXTERNAL_INTELLIGENCE_API_KEY || ''}`,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      console.error('External intelligence API error:', response.statusText);
      return generateStubResponse(request);
    }

    return await response.json();
  } catch (error) {
    console.error('External intelligence API error:', error);
    return generateStubResponse(request);
  }
}

function generateStubResponse(request: IntelligenceRequest): IntelligenceResponse {
  const baseResponse: IntelligenceResponse = {
    recommendations: [
      'External intelligence API not configured - using placeholder recommendations',
      'Configure VITE_EXTERNAL_INTELLIGENCE_API_URL to enable proprietary AI logic',
    ],
    reasoning: 'This is a stub response. The actual intelligence layer will be integrated via external API.',
    confidence: 0.0,
  };

  if (request.data_type === 'goal_progress') {
    const data = request.normalized_data as { progress_percentage?: number };
    const progress = data.progress_percentage || 0;
    
    return {
      ...baseResponse,
      core_score: progress,
      efficiency_index: Math.min(100, progress * 1.1),
      risk_factor: progress < 50 ? 0.3 : 0.1,
      recommendations: [
        progress < 75 
          ? 'Goal is at risk. Consider reviewing your strategy.'
          : 'Goal is on track. Maintain current approach.',
        'External intelligence API will provide advanced recommendations here.',
      ],
    };
  }

  if (request.data_type === 'metric_analysis') {
    return {
      ...baseResponse,
      core_score: 75.0,
      efficiency_index: 80.0,
      risk_factor: 0.15,
      recommendations: [
        'Metrics are within normal range.',
        'External intelligence API will provide deeper insights here.',
      ],
    };
  }

  return baseResponse;
}

export async function analyzeGoalProgress(goalData: {
  goal_name: string;
  current_value: number;
  target_value: number;
  progress_percentage: number;
  historical_data?: Array<{ date: string; value: number }>;
}): Promise<IntelligenceResponse> {
  return sendNormalizedData({
    data_type: 'goal_progress',
    normalized_data: goalData,
    context: {
      timestamp: new Date().toISOString(),
      source: 'goal_tracking_system',
    },
  });
}

export async function analyzeMetricTrend(metricData: {
  metric_name: string;
  metric_type: string;
  data_points: Array<{ timestamp: string; value: number }>;
  baseline?: number;
}): Promise<IntelligenceResponse> {
  return sendNormalizedData({
    data_type: 'metric_analysis',
    normalized_data: metricData,
    context: {
      timestamp: new Date().toISOString(),
      source: 'metric_analysis_system',
    },
  });
}

export async function detectAnomalies(data: {
  metric_name: string;
  values: number[];
  expected_range?: { min: number; max: number };
}): Promise<IntelligenceResponse> {
  return sendNormalizedData({
    data_type: 'anomaly_detection',
    normalized_data: data,
    context: {
      timestamp: new Date().toISOString(),
      source: 'anomaly_detection_system',
    },
  });
}
