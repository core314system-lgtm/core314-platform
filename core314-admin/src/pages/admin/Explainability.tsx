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
import { RefreshCw, Download, Brain, TrendingUp, AlertCircle } from 'lucide-react';
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface ExplainabilityLog {
  id: string;
  event_id: string | null;
  subsystem: string;
  explanation_text: string;
  reasoning_vector: Record<string, unknown>;
  confidence: number;
  generated_by: string;
  created_at: string;
  confidence_category: string;
  risk_level: string;
}

interface ExplainabilitySummary {
  total_explanations: number;
  average_confidence: number;
  high_risk_count: number;
}

export function Explainability() {
  const [explanations, setExplanations] = useState<ExplainabilityLog[]>([]);
  const [summary, setSummary] = useState<ExplainabilitySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterSubsystem, setFilterSubsystem] = useState<string>('all');
  const [filterRiskLevel, setFilterRiskLevel] = useState<string>('all');
  const [filterConfidence, setFilterConfidence] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: explanationsData, error: explanationsError } = await supabase
        .from('explainability_dashboard')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (explanationsError) throw explanationsError;
      setExplanations(explanationsData || []);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/explainability-engine`,
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
      console.error('Error fetching explainability data:', error);
    } finally {
      setLoading(false);
    }
  };


  const exportToCSV = () => {
    const headers = ['ID', 'Subsystem', 'Explanation', 'Confidence', 'Risk Level', 'Created At'];
    const rows = filteredExplanations.map(exp => [
      exp.id,
      exp.subsystem,
      exp.explanation_text,
      (exp.confidence * 100).toFixed(1) + '%',
      exp.risk_level,
      new Date(exp.created_at).toLocaleString(),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `explainability-log-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredExplanations = explanations.filter(exp => {
    if (filterSubsystem !== 'all' && exp.subsystem !== filterSubsystem) return false;
    if (filterRiskLevel !== 'all' && exp.risk_level !== filterRiskLevel) return false;
    if (filterConfidence !== 'all' && exp.confidence_category !== filterConfidence) return false;
    if (searchTerm && !exp.explanation_text.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const confidenceTrendData = explanations
    .slice(0, 50)
    .reverse()
    .map((exp, index) => ({
      index: index + 1,
      confidence: parseFloat((exp.confidence * 100).toFixed(1)),
    }));

  const confidenceDistributionData = [
    { name: 'High (>90%)', value: explanations.filter(e => e.confidence >= 0.9).length, color: '#10b981' },
    { name: 'Medium (70-90%)', value: explanations.filter(e => e.confidence >= 0.7 && e.confidence < 0.9).length, color: '#f59e0b' },
    { name: 'Low (<70%)', value: explanations.filter(e => e.confidence < 0.7).length, color: '#ef4444' },
  ];

  const riskLevelData = [
    { name: 'Critical', value: explanations.filter(e => e.risk_level === 'Critical').length, color: '#ef4444' },
    { name: 'High', value: explanations.filter(e => e.risk_level === 'High').length, color: '#f59e0b' },
    { name: 'Medium', value: explanations.filter(e => e.risk_level === 'Medium').length, color: '#fbbf24' },
    { name: 'Low', value: explanations.filter(e => e.risk_level === 'Low').length, color: '#10b981' },
  ].filter(item => item.value > 0);

  const subsystemData = [
    { name: 'Trust', value: explanations.filter(e => e.subsystem === 'Trust').length, color: '#3b82f6' },
    { name: 'Policy', value: explanations.filter(e => e.subsystem === 'Policy').length, color: '#8b5cf6' },
    { name: 'Optimization', value: explanations.filter(e => e.subsystem === 'Optimization').length, color: '#06b6d4' },
    { name: 'Behavioral', value: explanations.filter(e => e.subsystem === 'Behavioral').length, color: '#10b981' },
    { name: 'Governance', value: explanations.filter(e => e.subsystem === 'Governance').length, color: '#f59e0b' },
    { name: 'Other', value: explanations.filter(e => !['Trust', 'Policy', 'Optimization', 'Behavioral', 'Governance'].includes(e.subsystem)).length, color: '#6b7280' },
  ].filter(item => item.value > 0);

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.9) return <Badge variant="default">High</Badge>;
    if (confidence >= 0.7) return <Badge variant="secondary">Medium</Badge>;
    return <Badge variant="destructive">Low</Badge>;
  };

  const getRiskBadge = (risk: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      'Critical': 'destructive',
      'High': 'destructive',
      'Medium': 'secondary',
      'Low': 'default',
    };
    return <Badge variant={variants[risk] || 'outline'}>{risk}</Badge>;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Explainable Decision Layer</h1>
          <p className="text-gray-600 mt-1">Human-readable justifications for all AI-driven decisions</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchData} variant="outline" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={exportToCSV} variant="outline" disabled={filteredExplanations.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Explanations</CardTitle>
            <Brain className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.total_explanations || 0}</div>
            <p className="text-xs text-gray-600 mt-1">Last 48 hours</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Confidence</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary ? `${(summary.average_confidence * 100).toFixed(1)}%` : '0%'}
            </div>
            <p className="text-xs text-gray-600 mt-1">Decision confidence</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High-Risk Decisions</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.high_risk_count || 0}</div>
            <p className="text-xs text-gray-600 mt-1">Critical/High risk</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Confidence Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={confidenceTrendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="index" label={{ value: 'Recent Explanations', position: 'insideBottom', offset: -5 }} />
                <YAxis label={{ value: 'Confidence %', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="confidence" stroke="#3b82f6" strokeWidth={2} name="Confidence %" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Confidence Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={confidenceDistributionData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {confidenceDistributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Subsystem Breakdown</CardTitle>
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

        <Card>
          <CardHeader>
            <CardTitle>Risk Level Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={riskLevelData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {riskLevelData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Explanation Log</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <Input
              placeholder="Search explanations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
            <Select value={filterSubsystem} onValueChange={setFilterSubsystem}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Subsystem" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Subsystems</SelectItem>
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
            <Select value={filterRiskLevel} onValueChange={setFilterRiskLevel}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Risk Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Risk Levels</SelectItem>
                <SelectItem value="Critical">Critical</SelectItem>
                <SelectItem value="High">High</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="Low">Low</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterConfidence} onValueChange={setFilterConfidence}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Confidence" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Confidence</SelectItem>
                <SelectItem value="High">High (>90%)</SelectItem>
                <SelectItem value="Medium">Medium (70-90%)</SelectItem>
                <SelectItem value="Low">Low (<70%)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subsystem</TableHead>
                  <TableHead>Explanation</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Risk Level</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredExplanations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                      No explanations found. Run the governance engine to generate explanations.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredExplanations.map((exp) => (
                    <TableRow key={exp.id}>
                      <TableCell>
                        <Badge variant="outline">{exp.subsystem}</Badge>
                      </TableCell>
                      <TableCell className="max-w-md">{exp.explanation_text}</TableCell>
                      <TableCell>{getConfidenceBadge(exp.confidence)}</TableCell>
                      <TableCell>{getRiskBadge(exp.risk_level)}</TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {new Date(exp.created_at).toLocaleString()}
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
