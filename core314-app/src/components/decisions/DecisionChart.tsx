import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter } from 'recharts';

interface DecisionChartProps {
  userId: string;
}

interface ChartDataPoint {
  date: string;
  confidence: number;
  outcome: string;
  risk_level: string;
  timestamp: number;
}

export function DecisionChart({ userId }: DecisionChartProps) {
  const [data, setData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartType, setChartType] = useState<'timeline' | 'scatter'>('timeline');

  useEffect(() => {
    if (!userId) return;
    loadChartData();
  }, [userId]);

  async function loadChartData() {
    try {
      const { data: decisions, error } = await supabase
        .from('decision_events')
        .select('created_at, total_confidence_score, status, risk_level')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .limit(100);

      if (error) throw error;

      const chartData: ChartDataPoint[] = (decisions || []).map((d) => ({
        date: new Date(d.created_at).toLocaleDateString(),
        confidence: d.total_confidence_score * 100,
        outcome: d.status,
        risk_level: d.risk_level,
        timestamp: new Date(d.created_at).getTime(),
      }));

      setData(chartData);
    } catch (error) {
      console.error('Failed to load chart data:', error);
    } finally {
      setLoading(false);
    }
  }

  function getOutcomeScore(outcome: string): number {
    switch (outcome) {
      case 'executed': return 100;
      case 'approved': return 75;
      case 'pending': return 50;
      case 'rejected': return 25;
      case 'failed': return 0;
      default: return 50;
    }
  }

  function getRiskScore(riskLevel: string): number {
    switch (riskLevel) {
      case 'low': return 25;
      case 'medium': return 50;
      case 'high': return 75;
      case 'critical': return 100;
      default: return 50;
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <p className="text-muted-foreground">No data available</p>
        <p className="text-sm text-muted-foreground">
          Decision analytics will appear here as decisions are made
        </p>
      </div>
    );
  }

  const aggregatedData = data.reduce((acc, curr) => {
    const existing = acc.find(d => d.date === curr.date);
    if (existing) {
      existing.avgConfidence = (existing.avgConfidence + curr.confidence) / 2;
      existing.count++;
    } else {
      acc.push({
        date: curr.date,
        avgConfidence: curr.confidence,
        count: 1,
      });
    }
    return acc;
  }, [] as Array<{ date: string; avgConfidence: number; count: number }>);

  const scatterData = data.map(d => ({
    confidence: d.confidence,
    outcome: getOutcomeScore(d.outcome),
    risk: getRiskScore(d.risk_level),
    date: d.date,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setChartType('timeline')}
          className={`px-3 py-1 rounded text-sm ${
            chartType === 'timeline'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-200 text-gray-700'
          }`}
        >
          Timeline
        </button>
        <button
          onClick={() => setChartType('scatter')}
          className={`px-3 py-1 rounded text-sm ${
            chartType === 'scatter'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-200 text-gray-700'
          }`}
        >
          Confidence vs Outcome
        </button>
      </div>

      {chartType === 'timeline' ? (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={aggregatedData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis 
              label={{ value: 'Avg Confidence (%)', angle: -90, position: 'insideLeft' }}
              domain={[0, 100]}
            />
            <Tooltip 
              formatter={(value: number) => `${value.toFixed(1)}%`}
              labelFormatter={(label) => `Date: ${label}`}
            />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="avgConfidence" 
              stroke="#3b82f6" 
              strokeWidth={2}
              name="Avg Confidence"
              dot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              type="number" 
              dataKey="confidence" 
              name="Confidence"
              label={{ value: 'Confidence Score (%)', position: 'insideBottom', offset: -5 }}
              domain={[0, 100]}
            />
            <YAxis 
              type="number" 
              dataKey="outcome" 
              name="Outcome"
              label={{ value: 'Outcome Score', angle: -90, position: 'insideLeft' }}
              domain={[0, 100]}
            />
            <Tooltip 
              cursor={{ strokeDasharray: '3 3' }}
              formatter={(value: number, name: string) => {
                if (name === 'Confidence') return `${value.toFixed(1)}%`;
                if (name === 'Outcome') {
                  if (value >= 90) return 'Executed';
                  if (value >= 70) return 'Approved';
                  if (value >= 40) return 'Pending';
                  if (value >= 20) return 'Rejected';
                  return 'Failed';
                }
                return value;
              }}
            />
            <Legend />
            <Scatter 
              name="Decisions" 
              data={scatterData} 
              fill="#3b82f6"
            />
          </ScatterChart>
        </ResponsiveContainer>
      )}

      <div className="grid grid-cols-3 gap-4 text-sm">
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-500">{data.length}</div>
          <div className="text-muted-foreground">Total Decisions</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-500">
            {(data.reduce((sum, d) => sum + d.confidence, 0) / data.length).toFixed(1)}%
          </div>
          <div className="text-muted-foreground">Avg Confidence</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-purple-500">
            {data.filter(d => d.outcome === 'executed').length}
          </div>
          <div className="text-muted-foreground">Executed</div>
        </div>
      </div>
    </div>
  );
}
