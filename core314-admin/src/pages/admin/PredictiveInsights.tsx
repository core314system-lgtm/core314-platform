import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Activity, TrendingUp, Target, Cpu, RefreshCw, Download } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

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

interface KPIData {
  totalPredictions: number;
  avgConfidence: number;
  predictedImpact: number;
  activeModelVersion: string;
}

export function PredictiveInsights() {
  const [predictions, setPredictions] = useState<PredictionEvent[]>([]);
  const [kpis, setKPIs] = useState<KPIData>({
    totalPredictions: 0,
    avgConfidence: 0,
    predictedImpact: 0,
    activeModelVersion: 'N/A',
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [predictionTypeFilter, setPredictionTypeFilter] = useState('all');
  const [confidenceRangeFilter, setConfidenceRangeFilter] = useState('all');
  const [dateRangeFilter, setDateRangeFilter] = useState('30');

  const fetchPredictions = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('fusion_prediction_events')
        .select('*')
        .order('created_at', { ascending: false });

      if (dateRangeFilter !== 'all') {
        const daysAgo = new Date();
        daysAgo.setDate(daysAgo.getDate() - parseInt(dateRangeFilter));
        query = query.gte('created_at', daysAgo.toISOString());
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching predictions:', error);
        return;
      }

      setPredictions(data || []);

      if (data && data.length > 0) {
        const avgConf = data.reduce((sum, p) => sum + Number(p.confidence_score), 0) / data.length;
        const avgImpact = data.reduce((sum, p) => sum + Number(p.predicted_impact), 0) / data.length;
        
        setKPIs({
          totalPredictions: data.length,
          avgConfidence: parseFloat(avgConf.toFixed(2)),
          predictedImpact: parseFloat(avgImpact.toFixed(2)),
          activeModelVersion: data[0]?.model_version || 'N/A',
        });
      } else {
        setKPIs({
          totalPredictions: 0,
          avgConfidence: 0,
          predictedImpact: 0,
          activeModelVersion: 'N/A',
        });
      }
    } catch (err) {
      console.error('Error in fetchPredictions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPredictions();

    const subscription = supabase
      .channel('prediction_events_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'fusion_prediction_events',
        },
        () => {
          fetchPredictions();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [dateRangeFilter]);

  const filteredPredictions = predictions.filter((prediction) => {
    const matchesSearch =
      searchTerm === '' ||
      prediction.recommendation.toLowerCase().includes(searchTerm.toLowerCase()) ||
      prediction.prediction_type.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesPredictionType =
      predictionTypeFilter === 'all' || prediction.prediction_type === predictionTypeFilter;

    const matchesConfidenceRange = (() => {
      if (confidenceRangeFilter === 'all') return true;
      const score = prediction.confidence_score;
      if (confidenceRangeFilter === 'high') return score >= 80;
      if (confidenceRangeFilter === 'medium') return score >= 60 && score < 80;
      if (confidenceRangeFilter === 'low') return score < 60;
      return true;
    })();

    return matchesSearch && matchesPredictionType && matchesConfidenceRange;
  });

  const trendData = (() => {
    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (29 - i));
      return date.toISOString().split('T')[0];
    });

    return last30Days.map((date) => {
      const dayPredictions = predictions.filter(
        (p) => p.created_at.split('T')[0] === date
      );
      const avgImpact = dayPredictions.length > 0
        ? dayPredictions.reduce((sum, p) => sum + Number(p.predicted_impact), 0) / dayPredictions.length
        : 0;

      return {
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        impact: parseFloat(avgImpact.toFixed(2)),
      };
    });
  })();

  const predictionTypeData = (() => {
    const typeCounts = predictions.reduce((acc, p) => {
      acc[p.prediction_type] = (acc[p.prediction_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(typeCounts)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  })();

  const uniquePredictionTypes = [...new Set(predictions.map((p) => p.prediction_type))];

  const exportToCSV = () => {
    const headers = ['Prediction Type', 'Recommendation', 'Confidence Score', 'Predicted Impact', 'Model Version', 'Created At'];
    const rows = filteredPredictions.map((p) => [
      p.prediction_type,
      p.recommendation,
      p.confidence_score.toString(),
      p.predicted_impact.toString(),
      p.model_version,
      new Date(p.created_at).toLocaleString(),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `predictive-insights-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Predictive Insights Dashboard</h1>
          <p className="text-gray-600 mt-1">AI-powered recommendations for optimization opportunities</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchPredictions}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Predictions</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{kpis.totalPredictions}</p>
            </div>
            <Activity className="w-12 h-12 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Avg Confidence</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{kpis.avgConfidence}%</p>
            </div>
            <Target className="w-12 h-12 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Predicted Impact</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{kpis.predictedImpact.toFixed(1)}</p>
            </div>
            <TrendingUp className="w-12 h-12 text-purple-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Model Version</p>
              <p className="text-xl font-bold text-gray-900 mt-2">{kpis.activeModelVersion}</p>
            </div>
            <Cpu className="w-12 h-12 text-orange-500" />
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Predicted Efficiency Gains Trend */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Predicted Efficiency Gains (30 Days)</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="impact" stroke="#8b5cf6" name="Predicted Impact" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Prediction Type Distribution */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Prediction Type Distribution</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={predictionTypeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="type" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" fill="#3b82f6" name="Prediction Count" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Filters and Table */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <input
              type="text"
              placeholder="Search recommendations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <select
              value={predictionTypeFilter}
              onChange={(e) => setPredictionTypeFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Prediction Types</option>
              {uniquePredictionTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <select
              value={confidenceRangeFilter}
              onChange={(e) => setConfidenceRangeFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Confidence Levels</option>
              <option value="high">High (≥80%)</option>
              <option value="medium">Medium (60-79%)</option>
              <option value="low">Low (&lt;60%)</option>
            </select>
            <select
              value={dateRangeFilter}
              onChange={(e) => setDateRangeFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="7">Last 7 Days</option>
              <option value="30">Last 30 Days</option>
              <option value="90">Last 90 Days</option>
              <option value="all">All Time</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Prediction Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Recommendation
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Confidence
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Predicted Impact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Model Version
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created At
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                    Loading predictions...
                  </td>
                </tr>
              ) : filteredPredictions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                    No predictions found
                  </td>
                </tr>
              ) : (
                filteredPredictions.map((prediction) => (
                  <tr key={prediction.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {prediction.prediction_type}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-md">
                      {prediction.recommendation}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          prediction.confidence_score >= 80
                            ? 'bg-green-100 text-green-800'
                            : prediction.confidence_score >= 60
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {prediction.confidence_score.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {prediction.predicted_impact.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {prediction.model_version}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(prediction.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
