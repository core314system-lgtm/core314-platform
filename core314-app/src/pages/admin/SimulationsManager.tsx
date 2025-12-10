import { useState, useEffect } from 'react';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useSupabaseClient } from '../../contexts/SupabaseClientContext';
import { getSupabaseFunctionUrl } from '../../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Slider } from '../../components/ui/slider';
import { Badge } from '../../components/ui/badge';
import { Sparkles, ChevronDown, ChevronRight, RefreshCw, Trash2, TrendingUp, TrendingDown } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import type { EventSimulation } from '../../types';

export function SimulationsManager() {
  const { currentOrganization } = useOrganization();
  const supabase = useSupabaseClient();
  const [simulations, setSimulations] = useState<EventSimulation[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [expandedSimulation, setExpandedSimulation] = useState<string | null>(null);
  
  const [simulationName, setSimulationName] = useState('');
  const [slackWeight, setSlackWeight] = useState([5]);
  const [teamsWeight, setTeamsWeight] = useState([5]);
  const [confidence, setConfidence] = useState([0.75]);
  const [baselineScore, setBaselineScore] = useState(70);

  useEffect(() => {
    if (currentOrganization) {
      fetchSimulations();
      fetchBaselineData();
    }
  }, [currentOrganization?.id]);

  const fetchSimulations = async () => {
    if (!currentOrganization) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

            const baseUrl = await getSupabaseFunctionUrl('simulate-list');
            const response = await fetch(
              `${baseUrl}?organization_id=${currentOrganization.id}`,
              {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${session.access_token}`,
                },
              }
            );

      const data = await response.json();
      if (response.ok) {
        setSimulations(data.simulations || []);
      }
    } catch (error) {
      console.error('Error fetching simulations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBaselineData = async () => {
    if (!currentOrganization) return;

    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      
      const { data: scores } = await supabase
        .from('fusion_scores')
        .select('fusion_score')
        .eq('organization_id', currentOrganization.id)
        .gte('calculated_at', thirtyDaysAgo);

      if (scores && scores.length > 0) {
        const avg = scores.reduce((sum, s) => sum + (s.fusion_score || 0), 0) / scores.length;
        setBaselineScore(avg);
      }
    } catch (error) {
      console.error('Error fetching baseline data:', error);
    }
  };

  const handleRunSimulation = async () => {
    if (!currentOrganization || !simulationName.trim()) {
      alert('Please enter a simulation name');
      return;
    }

    setRunning(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data: { user } } = await supabase.auth.getUser();
      if (!session || !user) return;

            const url = await getSupabaseFunctionUrl('simulate-run');
            const response = await fetch(
              url,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${session.access_token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  organization_id: currentOrganization.id,
                  user_id: user.id,
                  name: simulationName,
                  inputs: {
                    weights: {
                      Slack: slackWeight[0],
                      Teams: teamsWeight[0],
                    },
                    confidence: confidence[0],
                  },
                }),
              }
            );

      if (response.ok) {
        await fetchSimulations();
        setSimulationName('');
      } else {
        const error = await response.json();
        alert(`Failed to run simulation: ${error.error}`);
      }
    } catch (error) {
      console.error('Error running simulation:', error);
      alert('Failed to run simulation. Please try again.');
    } finally {
      setRunning(false);
    }
  };

  const handleDeleteSimulation = async (simulationId: string, simulationName: string) => {
    if (!confirm(`Are you sure you want to delete "${simulationName}"?`)) {
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

            const deleteUrl = await getSupabaseFunctionUrl('simulate-delete');
            const response = await fetch(
              deleteUrl,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${session.access_token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ simulation_id: simulationId }),
              }
            );

      if (response.ok) {
        await fetchSimulations();
      }
    } catch (error) {
      console.error('Error deleting simulation:', error);
    }
  };

  const getScoreChange = (simulation: EventSimulation) => {
    const baseline = simulation.input_parameters.baseline_score || baselineScore;
    const predicted = simulation.predicted_output.FusionScore;
    return predicted - baseline;
  };

  const getScoreChangeColor = (change: number) => {
    if (change > 0) return 'text-green-600 dark:text-green-400';
    if (change < 0) return 'text-red-600 dark:text-red-400';
    return 'text-gray-600 dark:text-gray-400';
  };

  if (loading) {
    return <div className="p-6">Loading simulations...</div>;
  }

  const previewData = [
    { name: 'Baseline', score: baselineScore },
    { 
      name: 'Predicted', 
      score: baselineScore + ((slackWeight[0] - 5) * 2) + ((teamsWeight[0] - 5) * 2) 
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Predictive Simulations</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Simulate "what-if" scenarios to predict performance outcomes
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Simulation Builder</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label htmlFor="simulation-name">Simulation Name</Label>
            <Input
              id="simulation-name"
              placeholder="e.g., Slack Weight Increase Test"
              value={simulationName}
              onChange={(e) => setSimulationName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <Label>Slack Weight: {slackWeight[0]}</Label>
                <Slider
                  value={slackWeight}
                  onValueChange={setSlackWeight}
                  min={0}
                  max={10}
                  step={0.5}
                  className="mt-2"
                />
              </div>

              <div>
                <Label>Teams Weight: {teamsWeight[0]}</Label>
                <Slider
                  value={teamsWeight}
                  onValueChange={setTeamsWeight}
                  min={0}
                  max={10}
                  step={0.5}
                  className="mt-2"
                />
              </div>

              <div>
                <Label>Confidence: {(confidence[0] * 100).toFixed(0)}%</Label>
                <Slider
                  value={confidence}
                  onValueChange={setConfidence}
                  min={0}
                  max={1}
                  step={0.05}
                  className="mt-2"
                />
              </div>

              <Button onClick={handleRunSimulation} disabled={running} className="w-full">
                {running ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Run Simulation
                  </>
                )}
              </Button>
            </div>

            <div>
              <Label>Preview: Predicted vs Baseline</Label>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={previewData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Bar dataKey="score" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </CardContent>
      </Card>

      {simulations.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Sparkles className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              No simulations run yet.
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              Use the simulation builder above to create your first predictive scenario.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {simulations.map((simulation) => {
            const scoreChange = getScoreChange(simulation);
            return (
              <Card key={simulation.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2">
                        {simulation.name}
                        <Badge 
                          variant="secondary" 
                          className={getScoreChangeColor(scoreChange)}
                        >
                          {scoreChange > 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                          {scoreChange > 0 ? '+' : ''}{scoreChange.toFixed(1)}
                        </Badge>
                      </CardTitle>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {new Date(simulation.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedSimulation(
                          expandedSimulation === simulation.id ? null : simulation.id
                        )}
                      >
                        {expandedSimulation === simulation.id ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteSimulation(simulation.id, simulation.name)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-700 dark:text-gray-300">Predicted Score:</span>
                      <p className="text-gray-600 dark:text-gray-400">
                        {simulation.predicted_output.FusionScore.toFixed(1)}
                      </p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700 dark:text-gray-300">Confidence:</span>
                      <p className="text-gray-600 dark:text-gray-400">
                        {(simulation.predicted_output.Confidence * 100).toFixed(0)}%
                      </p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700 dark:text-gray-300">Variance:</span>
                      <p className="text-gray-600 dark:text-gray-400">
                        {(simulation.predicted_output.Variance * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  {expandedSimulation === simulation.id && (
                    <div className="space-y-4 pt-4 border-t">
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white mb-2">AI Summary</h4>
                        <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                          {simulation.summary}
                        </p>
                      </div>

                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white mb-2">Input Parameters</h4>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {simulation.input_parameters.weights && (
                            <div>
                              Weights: {JSON.stringify(simulation.input_parameters.weights)}
                            </div>
                          )}
                          {simulation.input_parameters.confidence !== undefined && (
                            <div>
                              Confidence: {(simulation.input_parameters.confidence * 100).toFixed(0)}%
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                          Predicted vs Baseline
                        </h4>
                        <ResponsiveContainer width="100%" height={200}>
                          <LineChart 
                            data={[
                              { 
                                name: 'Baseline', 
                                score: simulation.input_parameters.baseline_score || baselineScore 
                              },
                              { 
                                name: 'Predicted', 
                                score: simulation.predicted_output.FusionScore 
                              },
                            ]}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis domain={[0, 100]} />
                            <Tooltip />
                            <Line type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={2} />
                          </LineChart>
                        </ResponsiveContainer>
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
