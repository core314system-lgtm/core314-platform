import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { Input } from '../../components/ui/input';
import { RefreshCw, Download, Brain, TrendingUp, Play } from 'lucide-react';
import { LineChart, Line, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface NeuralPolicyWeight {
  id: string;
  policy_name: string;
  last_trained: string;
  input_vector: Record<string, unknown>;
  output_weights: Record<string, unknown>;
  learning_rate: number;
  confidence_avg: number;
  accuracy: number;
  total_iterations: number;
  updated_at: string;
  confidence_category: string;
  accuracy_category: string;
}

interface NeuralPolicySummary {
  total_policies: number;
  avg_confidence: number;
  avg_accuracy: number;
  total_iterations: number;
}

export function PolicyNetwork() {
  const [weights, setWeights] = useState<NeuralPolicyWeight[]>([]);
  const [summary, setSummary] = useState<NeuralPolicySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [training, setTraining] = useState(false);
  const [filterSubsystem, setFilterSubsystem] = useState<string>('all');
  const [filterConfidence, setFilterConfidence] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: weightsData, error: weightsError } = await supabase
        .from('neural_policy_dashboard')
        .select('*')
        .order('updated_at', { ascending: false });

      if (weightsError) throw weightsError;
      setWeights(weightsData || []);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/neural-policy-engine`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      if (result.success && result.summary) {
        setSummary(result.summary);
      }
    } catch (error) {
      console.error('Error fetching neural policy data:', error);
    } finally {
      setLoading(false);
    }
  };

  const runTraining = async () => {
    setTraining(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/neural-policy-engine`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      await fetchData();
    } catch (error) {
      console.error('Error running neural training:', error);
    } finally {
      setTraining(false);
    }
  };


  const exportToCSV = () => {
    const headers = ['Policy Name', 'Learning Rate', 'Confidence Avg', 'Accuracy', 'Total Iterations', 'Last Trained'];
    const rows = filteredWeights.map(w => [
      w.policy_name,
      w.learning_rate.toFixed(3),
      (w.confidence_avg * 100).toFixed(1) + '%',
      (w.accuracy * 100).toFixed(1) + '%',
      w.total_iterations,
      new Date(w.last_trained).toLocaleString(),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `neural-policy-weights-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredWeights = weights.filter(w => {
    if (filterSubsystem !== 'all' && w.policy_name !== filterSubsystem) return false;
    if (filterConfidence !== 'all' && w.confidence_category !== filterConfidence) return false;
    if (searchTerm && !w.policy_name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const learningCurveData = weights
    .slice(0, 30)
    .reverse()
    .map((w, index) => ({
      index: index + 1,
      confidence: parseFloat((w.confidence_avg * 100).toFixed(1)),
      accuracy: parseFloat((w.accuracy * 100).toFixed(1)),
    }));

  const confidenceAccuracyData = weights.map(w => ({
    name: w.policy_name,
    confidence: parseFloat((w.confidence_avg * 100).toFixed(1)),
    accuracy: parseFloat((w.accuracy * 100).toFixed(1)),
  }));

  const subsystemData = [
    { name: 'Trust', value: weights.filter(w => w.policy_name === 'Trust').length, color: '#3b82f6' },
    { name: 'Policy', value: weights.filter(w => w.policy_name === 'Policy').length, color: '#8b5cf6' },
    { name: 'Optimization', value: weights.filter(w => w.policy_name === 'Optimization').length, color: '#06b6d4' },
    { name: 'Behavioral', value: weights.filter(w => w.policy_name === 'Behavioral').length, color: '#10b981' },
    { name: 'Governance', value: weights.filter(w => w.policy_name === 'Governance').length, color: '#f59e0b' },
    { name: 'Other', value: weights.filter(w => !['Trust', 'Policy', 'Optimization', 'Behavioral', 'Governance'].includes(w.policy_name)).length, color: '#6b7280' },
  ].filter(item => item.value > 0);

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.9) return <Badge variant="default">High</Badge>;
    if (confidence >= 0.7) return <Badge variant="secondary">Medium</Badge>;
    return <Badge variant="destructive">Low</Badge>;
  };

  const getAccuracyBadge = (accuracy: number) => {
    if (accuracy >= 0.9) return <Badge variant="default">Excellent</Badge>;
    if (accuracy >= 0.75) return <Badge variant="secondary">Good</Badge>;
    if (accuracy >= 0.6) return <Badge variant="outline">Fair</Badge>;
    return <Badge variant="destructive">Poor</Badge>;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Neural Policy Network</h1>
          <p className="text-gray-600 mt-1">Reinforcement-driven policy optimization from governance, trust, and explainability data</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchData} variant="outline" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={runTraining} disabled={training}>
            <Play className={`h-4 w-4 mr-2 ${training ? 'animate-spin' : ''}`} />
            Run Neural Training
          </Button>
          <Button onClick={exportToCSV} variant="outline" disabled={filteredWeights.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Policies Trained</CardTitle>
            <Brain className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.total_policies || 0}</div>
            <p className="text-xs text-gray-600 mt-1">Active policy weights</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Confidence</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary ? `${(summary.avg_confidence * 100).toFixed(1)}%` : '0%'}
            </div>
            <p className="text-xs text-gray-600 mt-1">Policy confidence</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Accuracy</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary ? `${(summary.avg_accuracy * 100).toFixed(1)}%` : '0%'}
            </div>
            <p className="text-xs text-gray-600 mt-1">Learning accuracy</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>30-Day Learning Curve</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={learningCurveData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="index" label={{ value: 'Training Iterations', position: 'insideBottom', offset: -5 }} />
                <YAxis label={{ value: 'Percentage', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="confidence" stroke="#3b82f6" strokeWidth={2} name="Confidence %" />
                <Line type="monotone" dataKey="accuracy" stroke="#10b981" strokeWidth={2} name="Accuracy %" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Confidence/Accuracy Heatmap</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={confidenceAccuracyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="confidence" fill="#3b82f6" name="Confidence %" />
                <Bar dataKey="accuracy" fill="#10b981" name="Accuracy %" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Weight Adjustment by Subsystem</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={subsystemData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {subsystemData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Neural Policy Weights</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <Input
              placeholder="Search policy names..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
            <Select value={filterSubsystem} onValueChange={setFilterSubsystem}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Policy Name" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Policies</SelectItem>
                <SelectItem value="Trust">Trust</SelectItem>
                <SelectItem value="Policy">Policy</SelectItem>
                <SelectItem value="Optimization">Optimization</SelectItem>
                <SelectItem value="Behavioral">Behavioral</SelectItem>
                <SelectItem value="Governance">Governance</SelectItem>
                <SelectItem value="Prediction">Prediction</SelectItem>
                <SelectItem value="Calibration">Calibration</SelectItem>
                <SelectItem value="Oversight">Oversight</SelectItem>
                <SelectItem value="Orchestration">Orchestration</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterConfidence} onValueChange={setFilterConfidence}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Confidence" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Confidence</SelectItem>
                <SelectItem value="High">High (&gt;90%)</SelectItem>
                <SelectItem value="Medium">Medium (70-90%)</SelectItem>
                <SelectItem value="Low">Low (&lt;70%)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Policy Name</TableHead>
                  <TableHead>Learning Rate</TableHead>
                  <TableHead>Confidence Avg</TableHead>
                  <TableHead>Accuracy</TableHead>
                  <TableHead>Iterations</TableHead>
                  <TableHead>Last Trained</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredWeights.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                      No policy weights found. Run neural training to generate weights.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredWeights.map((w) => (
                    <TableRow key={w.id}>
                      <TableCell>
                        <Badge variant="outline">{w.policy_name}</Badge>
                      </TableCell>
                      <TableCell>{w.learning_rate.toFixed(3)}</TableCell>
                      <TableCell>{getConfidenceBadge(w.confidence_avg)}</TableCell>
                      <TableCell>{getAccuracyBadge(w.accuracy)}</TableCell>
                      <TableCell>{w.total_iterations}</TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {new Date(w.last_trained).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
