import React from 'react';
import { useSupabaseClient } from '@/contexts/SupabaseClientContext';
import { getSupabaseFunctionUrl, getSupabaseAnonKeySync } from '@/lib/supabaseRuntimeConfig';
import { Lightbulb, Download, RefreshCw, Play, TrendingUp, Activity } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface SystemInsight {
  id: string;
  source_phase: string;
  metric_type: string;
  metric_value: number | null;
  metric_context: Record<string, unknown> | null;
  cohesion_score: number | null;
  insight_summary: string | null;
  created_at: string;
}

interface InsightStats {
  currentCohesionScore: number;
  totalInsights: number;
  activeSubsystems: number;
  systemHealth: string;
}

interface ExplainabilityResponse {
  success: boolean;
  explanation: string;
  context: Record<string, unknown>;
  detail_level: string;
  error?: string;
}

export function InsightHub() {
  const supabase = useSupabaseClient();
  const [insights, setInsights] = React.useState<SystemInsight[]>([]);
  const [stats, setStats] = React.useState<InsightStats>({
    currentCohesionScore: 0,
    totalInsights: 0,
    activeSubsystems: 0,
    systemHealth: 'Unknown',
  });
  const [loading, setLoading] = React.useState(true);
  const [triggering, setTriggering] = React.useState(false);
  
  const [explainQuery, setExplainQuery] = React.useState('');
  const [explainType, setExplainType] = React.useState<'event_id' | 'phase'>('phase');
  const [detailLevel, setDetailLevel] = React.useState<'summary' | 'technical'>('summary');
  const [explanation, setExplanation] = React.useState<ExplainabilityResponse | null>(null);
  const [explaining, setExplaining] = React.useState(false);

  const fetchInsightsData = React.useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('fusion_system_insights')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;

      const systemInsights = data || [];
      setInsights(systemInsights);

      const latestCohesion = systemInsights.find(i => i.source_phase === 'System-Wide' && i.metric_type === 'Cohesion Score');
      const cohesionScore = latestCohesion?.cohesion_score || 0;
      
      const systemHealthInsight = latestCohesion?.metric_context as { system_health?: string } | null;
      const systemHealth = systemHealthInsight?.system_health || 'Unknown';
      
      const activeSubsystemsContext = latestCohesion?.metric_context as { active_subsystems?: number } | null;
      const activeSubsystems = activeSubsystemsContext?.active_subsystems || 0;

      setStats({
        currentCohesionScore: cohesionScore,
        totalInsights: systemInsights.length,
        activeSubsystems,
        systemHealth,
      });
    } catch (error) {
      console.error('Error fetching insights data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchInsightsData();

    const subscription = supabase
      .channel('fusion_system_insights_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fusion_system_insights' }, () => {
        fetchInsightsData();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchInsightsData]);

  const triggerCohesionEngine = async () => {
    try {
      setTriggering(true);
      const url = await getSupabaseFunctionUrl('fusion-cohesion-engine');
      const anonKey = getSupabaseAnonKeySync();
      const response = await fetch(
        url,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${anonKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Cohesion engine result:', result);

      await fetchInsightsData();
      alert(`Cohesion analysis complete!\nScore: ${result.cohesion_score || 0}\nInsights created: ${result.insights_created || 0}`);
    } catch (error) {
      console.error('Error triggering cohesion engine:', error);
      alert('Failed to trigger cohesion engine. Check console for details.');
    } finally {
      setTriggering(false);
    }
  };

  const generateExplanation = async () => {
    if (!explainQuery.trim()) {
      alert('Please enter an event ID or phase name');
      return;
    }

    try {
      setExplaining(true);
      const params = new URLSearchParams({
        detail: detailLevel,
      });

      if (explainType === 'event_id') {
        params.append('event_id', explainQuery.trim());
      } else {
        params.append('phase', explainQuery.trim());
      }

      const baseUrl = await getSupabaseFunctionUrl('fusion-explainability-engine');
      const anonKey = getSupabaseAnonKeySync();
      const response = await fetch(
        `${baseUrl}?${params.toString()}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${anonKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: ExplainabilityResponse = await response.json();
      setExplanation(result);
    } catch (error) {
      console.error('Error generating explanation:', error);
      setExplanation({
        success: false,
        explanation: '',
        context: {},
        detail_level: detailLevel,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setExplaining(false);
    }
  };

  const cohesionTrendData = React.useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      return date.toISOString().split('T')[0];
    });

    return days.map(day => {
      const dayInsights = insights.filter(i => 
        i.created_at.startsWith(day) && 
        i.source_phase === 'System-Wide' && 
        i.metric_type === 'Cohesion Score'
      );
      const avgCohesion = dayInsights.length > 0
        ? dayInsights.reduce((sum, i) => sum + (i.cohesion_score || 0), 0) / dayInsights.length
        : 0;
      return {
        date: day,
        cohesion: avgCohesion,
      };
    });
  }, [insights]);

  const multiPhaseTrendData = React.useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => {
      const date = new Date();
      date.setHours(date.getHours() - (23 - i));
      return date.toISOString().split('T')[0] + ' ' + date.getHours().toString().padStart(2, '0') + ':00';
    });

    return hours.map(hour => {
      const hourInsights = insights.filter(i => {
        const insightHour = new Date(i.created_at).toISOString().split('T')[0] + ' ' + 
                           new Date(i.created_at).getHours().toString().padStart(2, '0') + ':00';
        return insightHour === hour;
      });

      const optimizationActivity = hourInsights.filter(i => i.source_phase === 'Optimization').length;
      const calibrationActivity = hourInsights.filter(i => i.source_phase === 'Calibration').length;
      const predictionActivity = hourInsights.filter(i => i.source_phase === 'Prediction').length;

      return {
        time: hour.split(' ')[1],
        optimization: optimizationActivity,
        calibration: calibrationActivity,
        prediction: predictionActivity,
      };
    });
  }, [insights]);

  const exportToCSV = () => {
    const headers = ['ID', 'Source Phase', 'Metric Type', 'Metric Value', 'Cohesion Score', 'Insight Summary', 'Created At'];
    const rows = insights.map(i => [
      i.id,
      i.source_phase,
      i.metric_type,
      i.metric_value || 'N/A',
      i.cohesion_score || 'N/A',
      (i.insight_summary || '').replace(/,/g, ';'),
      new Date(i.created_at).toLocaleString(),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `insight_hub_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getCohesionColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-blue-600';
    if (score >= 40) return 'text-yellow-600';
    if (score >= 20) return 'text-orange-600';
    return 'text-red-600';
  };

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'Excellent': return 'text-green-600 bg-green-50';
      case 'Good': return 'text-blue-600 bg-blue-50';
      case 'Fair': return 'text-yellow-600 bg-yellow-50';
      case 'Poor': return 'text-orange-600 bg-orange-50';
      case 'Critical': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading insight hub data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Lightbulb className="w-8 h-8 text-indigo-600" />
            System Cohesion & Insight Hub
          </h1>
          <p className="text-gray-500 mt-1">
            Unified intelligence visualization and AI explainability
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchInsightsData}
            disabled={loading}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={exportToCSV}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={triggerCohesionEngine}
            disabled={triggering}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
          >
            <Play className={`w-4 h-4 ${triggering ? 'animate-spin' : ''}`} />
            {triggering ? 'Running...' : 'Run Cohesion Analysis'}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-sm text-gray-500">Current Cohesion Score</p>
          <p className={`text-3xl font-bold mt-1 ${getCohesionColor(stats.currentCohesionScore)}`}>
            {stats.currentCohesionScore.toFixed(1)}
          </p>
          <p className="text-xs text-gray-400 mt-1">out of 100</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-sm text-gray-500">Total Insights Logged</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{stats.totalInsights}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-sm text-gray-500">Active Subsystems</p>
          <p className="text-3xl font-bold text-purple-600 mt-1">{stats.activeSubsystems}/6</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-sm text-gray-500">System Health Status</p>
          <span className={`inline-block px-3 py-1 text-sm font-semibold rounded-full mt-2 ${getHealthColor(stats.systemHealth)}`}>
            {stats.systemHealth}
          </span>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-600" />
            7-Day Cohesion Score Trend
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={cohesionTrendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="cohesion" stroke="#6366f1" name="Cohesion Score" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-600" />
            24-Hour Multi-Phase Activity
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={multiPhaseTrendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="optimization" stroke="#10b981" name="Optimization" strokeWidth={2} />
              <Line type="monotone" dataKey="calibration" stroke="#f59e0b" name="Calibration" strokeWidth={2} />
              <Line type="monotone" dataKey="prediction" stroke="#8b5cf6" name="Prediction" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* AI Explainability Panel */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">AI Explainability Assistant</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Query Type
            </label>
            <select
              value={explainType}
              onChange={(e) => setExplainType(e.target.value as 'event_id' | 'phase')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="phase">Phase Name</option>
              <option value="event_id">Event ID</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Detail Level
            </label>
            <select
              value={detailLevel}
              onChange={(e) => setDetailLevel(e.target.value as 'summary' | 'technical')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="summary">Summary</option>
              <option value="technical">Technical</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">&nbsp;</label>
            <button
              onClick={generateExplanation}
              disabled={explaining}
              className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Play className={`w-4 h-4 ${explaining ? 'animate-spin' : ''}`} />
              {explaining ? 'Generating...' : 'Generate Explanation'}
            </button>
          </div>
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {explainType === 'event_id' ? 'Event ID' : 'Phase Name'} (e.g., {explainType === 'event_id' ? 'UUID' : 'Calibration, Oversight, Orchestrator'})
          </label>
          <input
            type="text"
            value={explainQuery}
            onChange={(e) => setExplainQuery(e.target.value)}
            placeholder={explainType === 'event_id' ? 'Enter event UUID...' : 'Enter phase name...'}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
        {explanation && (
          <div className={`p-4 rounded-lg ${explanation.success ? 'bg-blue-50 border border-blue-200' : 'bg-red-50 border border-red-200'}`}>
            <h3 className="font-semibold text-gray-900 mb-2">
              {explanation.success ? 'Explanation' : 'Error'}
            </h3>
            {explanation.success ? (
              <div className="text-gray-700 whitespace-pre-wrap">{explanation.explanation}</div>
            ) : (
              <div className="text-red-700">{explanation.error}</div>
            )}
          </div>
        )}
      </div>

      {/* Insights Feed */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Latest System Insights</h2>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {insights.slice(0, 20).map((insight) => (
            <div key={insight.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-800">
                      {insight.source_phase}
                    </span>
                    <span className="text-xs text-gray-500">{insight.metric_type}</span>
                    {insight.cohesion_score !== null && (
                      <span className={`text-xs font-semibold ${getCohesionColor(insight.cohesion_score)}`}>
                        Score: {insight.cohesion_score.toFixed(1)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-700">{insight.insight_summary}</p>
                </div>
                <span className="text-xs text-gray-400 ml-4 whitespace-nowrap">
                  {new Date(insight.created_at).toLocaleString()}
                </span>
              </div>
            </div>
          ))}
          {insights.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No insights available. Run cohesion analysis to generate insights.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
