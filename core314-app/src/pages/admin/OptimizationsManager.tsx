import { useState, useEffect } from 'react';
import { useOrganization } from '../../contexts/OrganizationContext';
import { supabase } from '../../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Sparkles, ChevronDown, ChevronRight, Play, Check, TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { EventOptimization } from '../../types';

export function OptimizationsManager() {
  const { currentOrganization } = useOrganization();
  const [optimizations, setOptimizations] = useState<EventOptimization[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [expandedOptimization, setExpandedOptimization] = useState<string | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);

  useEffect(() => {
    if (currentOrganization) {
      fetchOptimizations();
    }
  }, [currentOrganization?.id]);

  const fetchOptimizations = async () => {
    if (!currentOrganization) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/optimize-list?organization_id=${currentOrganization.id}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      const data = await response.json();
      if (response.ok) {
        setOptimizations(data.optimizations || []);
      }
    } catch (error) {
      console.error('Error fetching optimizations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!currentOrganization) return;

    setAnalyzing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/optimize-analyze`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            organization_id: currentOrganization.id,
            mode: 'analysis',
          }),
        }
      );

      const data = await response.json();
      if (response.ok) {
        if (data.optimization_needed) {
          await fetchOptimizations();
          alert('New optimization opportunity detected!');
        } else {
          alert(data.message || 'No optimization needed at this time.');
        }
      } else {
        alert(`Analysis failed: ${data.error}`);
      }
    } catch (error) {
      console.error('Error analyzing optimizations:', error);
      alert('Failed to analyze. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleApply = async (optimizationId: string, mode: 'apply' | 'simulate') => {
    setApplyingId(optimizationId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/optimize-apply`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            optimization_id: optimizationId,
            mode,
          }),
        }
      );

      const data = await response.json();
      if (response.ok) {
        if (mode === 'apply') {
          alert(data.message || 'Optimization applied successfully!');
          await fetchOptimizations();
        } else {
          alert('Simulation created. Check the Simulations page for results.');
        }
      } else {
        alert(`Failed to ${mode}: ${data.error}`);
      }
    } catch (error) {
      console.error(`Error ${mode}ing optimization:`, error);
      alert(`Failed to ${mode}. Please try again.`);
    } finally {
      setApplyingId(null);
    }
  };

  const getImprovementColor = (score: number) => {
    if (score >= 0.7) return 'text-green-600 dark:text-green-400';
    if (score >= 0.4) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-gray-600 dark:text-gray-400';
  };

  if (loading) {
    return <div className="p-6">Loading optimizations...</div>;
  }

  const totalOptimizations = optimizations.length;
  const appliedOptimizations = optimizations.filter(o => o.applied).length;
  const avgImprovement = optimizations.length > 0
    ? optimizations.reduce((sum, o) => sum + o.improvement_score, 0) / optimizations.length
    : 0;

  const pendingOptimizations = optimizations.filter(o => !o.applied);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Optimizations</h1>
          <p className="text-gray-600 dark:text-gray-400">
            AI-driven performance optimization opportunities
          </p>
        </div>
        <Button onClick={handleAnalyze} disabled={analyzing}>
          {analyzing ? (
            <>
              <Activity className="mr-2 h-4 w-4 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Analyze System
            </>
          )}
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Total Optimizations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOptimizations}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Applied Optimizations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {appliedOptimizations}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Avg Improvement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(avgImprovement * 100).toFixed(1)}%
            </div>
          </CardContent>
        </Card>
      </div>

      {pendingOptimizations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Manual Approval Queue</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {pendingOptimizations.length} optimization{pendingOptimizations.length !== 1 ? 's' : ''} pending review
            </p>
          </CardContent>
        </Card>
      )}

      {optimizations.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Sparkles className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              No optimizations detected yet.
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              Click "Analyze System" to detect optimization opportunities.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {optimizations.map((optimization) => {
            const scoreImprovement = optimization.optimized_data.fusion_score - optimization.baseline_data.fusion_score;
            return (
              <Card key={optimization.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2">
                        {optimization.optimization_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        <Badge variant={optimization.applied ? 'default' : 'secondary'}>
                          {optimization.applied ? (
                            <>
                              <Check className="h-3 w-3 mr-1" />
                              Applied
                            </>
                          ) : (
                            'Pending'
                          )}
                        </Badge>
                        <Badge 
                          variant="secondary" 
                          className={getImprovementColor(optimization.improvement_score)}
                        >
                          {scoreImprovement > 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                          {scoreImprovement > 0 ? '+' : ''}{scoreImprovement.toFixed(1)}
                        </Badge>
                      </CardTitle>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {new Date(optimization.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedOptimization(
                          expandedOptimization === optimization.id ? null : optimization.id
                        )}
                      >
                        {expandedOptimization === optimization.id ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-700 dark:text-gray-300">Baseline Score:</span>
                      <p className="text-gray-600 dark:text-gray-400">
                        {optimization.baseline_data.fusion_score.toFixed(1)}
                      </p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700 dark:text-gray-300">Optimized Score:</span>
                      <p className="text-gray-600 dark:text-gray-400">
                        {optimization.optimized_data.fusion_score.toFixed(1)}
                      </p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700 dark:text-gray-300">Improvement:</span>
                      <p className="text-gray-600 dark:text-gray-400">
                        {(optimization.improvement_score * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  {!optimization.applied && (
                    <div className="flex gap-2 pt-4 border-t">
                      <Button
                        size="sm"
                        onClick={() => handleApply(optimization.id, 'simulate')}
                        disabled={applyingId === optimization.id}
                        variant="outline"
                      >
                        <Play className="mr-2 h-4 w-4" />
                        Simulate
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleApply(optimization.id, 'apply')}
                        disabled={applyingId === optimization.id}
                      >
                        <Check className="mr-2 h-4 w-4" />
                        Apply
                      </Button>
                    </div>
                  )}

                  {expandedOptimization === optimization.id && (
                    <div className="space-y-4 pt-4 border-t">
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white mb-2">AI Summary</h4>
                        <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                          {optimization.summary}
                        </p>
                      </div>

                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                          Baseline vs Optimized
                        </h4>
                        <ResponsiveContainer width="100%" height={200}>
                          <LineChart 
                            data={[
                              { 
                                name: 'Baseline', 
                                score: optimization.baseline_data.fusion_score,
                                confidence: optimization.baseline_data.confidence * 100,
                                variance: optimization.baseline_data.variance * 100,
                              },
                              { 
                                name: 'Optimized', 
                                score: optimization.optimized_data.fusion_score,
                                confidence: optimization.optimized_data.confidence * 100,
                                variance: optimization.optimized_data.variance * 100,
                              },
                            ]}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis domain={[0, 100]} />
                            <Tooltip />
                            <Line type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={2} name="Fusion Score" />
                            <Line type="monotone" dataKey="confidence" stroke="#10b981" strokeWidth={2} name="Confidence %" />
                            <Line type="monotone" dataKey="variance" stroke="#f59e0b" strokeWidth={2} name="Variance %" />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>

                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white mb-2">Weight Changes</h4>
                        <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                          {Object.entries(optimization.optimized_data.weights).map(([integration, weight]) => {
                            const baseline = optimization.baseline_data.weights[integration] || 0;
                            const change = weight - baseline;
                            return (
                              <div key={integration} className="flex justify-between">
                                <span>{integration}:</span>
                                <span>
                                  {baseline.toFixed(2)} → {weight.toFixed(2)} 
                                  <span className={change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : ''}>
                                    {' '}({change > 0 ? '+' : ''}{change.toFixed(2)})
                                  </span>
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
