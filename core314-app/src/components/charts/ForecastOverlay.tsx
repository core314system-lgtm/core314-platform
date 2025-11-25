import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { LineChart, Line, Area, AreaChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface ForecastOverlayProps {
  metricName: string;
  userId: string;
  historicalData: Array<{ timestamp: string; value: number }>;
  height?: number;
}

interface PredictionData {
  timestamp: string;
  predicted_value: number;
  lower_bound: number;
  upper_bound: number;
  confidence_score: number;
}

export function ForecastOverlay({ metricName, userId, historicalData, height = 300 }: ForecastOverlayProps) {
  const [predictions, setPredictions] = useState<PredictionData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPredictions();
    setupRealtimeSubscription();
  }, [metricName, userId]);

  const fetchPredictions = async () => {
    try {
      const { data, error } = await supabase
        .from('prediction_results')
        .select('*')
        .eq('user_id', userId)
        .eq('metric_name', metricName)
        .gte('forecast_target_time', new Date().toISOString())
        .order('forecast_target_time', { ascending: true })
        .limit(10);

      if (error) throw error;

      const predictionData: PredictionData[] = (data || []).map(p => ({
        timestamp: p.forecast_target_time,
        predicted_value: p.predicted_value,
        lower_bound: p.lower_bound,
        upper_bound: p.upper_bound,
        confidence_score: p.confidence_score,
      }));

      setPredictions(predictionData);
    } catch (error) {
      console.error('Error fetching predictions:', error);
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel(`predictions_${metricName}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'prediction_results',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.new.metric_name === metricName) {
            fetchPredictions();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const chartData = [
    ...historicalData.map(d => ({
      timestamp: d.timestamp,
      actual: d.value,
      predicted: null,
      lower: null,
      upper: null,
    })),
    ...predictions.map(p => ({
      timestamp: p.timestamp,
      actual: null,
      predicted: p.predicted_value,
      lower: p.lower_bound,
      upper: p.upper_bound,
    })),
  ];

  const getThresholdColor = (value: number) => {
    if (value > 80) return '#ef4444'; // red for critical
    if (value > 60) return '#f59e0b'; // yellow for warning
    return '#10b981'; // green for normal
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData}>
        <defs>
          <linearGradient id="confidenceBand" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="timestamp"
          tickFormatter={(value) => {
            const date = new Date(value);
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          }}
          stroke="#6b7280"
        />
        <YAxis stroke="#6b7280" />
        <Tooltip
          contentStyle={{
            backgroundColor: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '12px',
          }}
          labelFormatter={(value) => {
            const date = new Date(value);
            return date.toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: 'numeric',
            });
          }}
          formatter={(value: any, name: string) => {
            if (value === null) return [null, name];
            return [value.toFixed(2), name];
          }}
        />
        <Legend />
        
        {/* Confidence band (shaded area) */}
        <Area
          type="monotone"
          dataKey="upper"
          stroke="none"
          fill="url(#confidenceBand)"
          fillOpacity={0.3}
          name="Confidence Band"
        />
        <Area
          type="monotone"
          dataKey="lower"
          stroke="none"
          fill="#fff"
          fillOpacity={1}
        />
        
        {/* Actual values (solid line) */}
        <Line
          type="monotone"
          dataKey="actual"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={{ fill: '#3b82f6', r: 3 }}
          name="Actual"
          connectNulls={false}
        />
        
        {/* Predicted values (dotted line) */}
        <Line
          type="monotone"
          dataKey="predicted"
          stroke="#8b5cf6"
          strokeWidth={2}
          strokeDasharray="5 5"
          dot={{ fill: '#8b5cf6', r: 3 }}
          name="Forecast"
          connectNulls={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
