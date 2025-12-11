import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useSupabaseClient } from '@/contexts/SupabaseClientContext';
import { getSupabaseFunctionUrl } from '@/lib/supabaseRuntimeConfig';
import { LineChart, Line, ScatterChart, Scatter, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { PlayCircle, RefreshCw, Download } from 'lucide-react';

interface E2ESession {
  id: string;
  session_name: string;
  test_mode: 'functional' | 'performance' | 'resilience';
  simulation_cycles: number;
  phase_sequence: string[];
  total_steps: number;
  steps_completed: number;
  success_rate: number;
  avg_confidence: number;
  avg_latency_ms: number;
  avg_stability: number;
  errors_detected: number;
  anomalies_detected: number;
  started_at: string;
  completed_at: string | null;
}

interface E2EBenchmark {
  id: string;
  session_id: string;
  phase_name: string;
  iteration: number;
  confidence: number;
  latency_ms: number;
  stability: number;
  error_flag: boolean;
  created_at: string;
}

interface E2ESummary {
  total_runs: number;
  avg_confidence: number;
  avg_latency: number;
  avg_stability: number;
  total_errors: number;
}

export function E2ECampaign() {
  const supabase = useSupabaseClient();
  const [sessions, setSessions] = useState<E2ESession[]>([]);
  const [benchmarks, setBenchmarks] = useState<E2EBenchmark[]>([]);
  const [summary, setSummary] = useState<E2ESummary>({
    total_runs: 0,
    avg_confidence: 0,
    avg_latency: 0,
    avg_stability: 0,
    total_errors: 0
  });
  const [loading, setLoading] = useState(false);
  const [filterPhase, setFilterPhase] = useState<string>('all');
  const [filterTestMode, setFilterTestMode] = useState<string>('all');
  const [filterSession, setFilterSession] = useState<string>('all');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('fusion_e2e_sessions')
        .select('*')
        .not('test_mode', 'is', null)
        .order('started_at', { ascending: false })
        .limit(20);

      if (sessionsError) throw sessionsError;

      setSessions(sessionsData || []);

      const { data: benchmarksData, error: benchmarksError } = await supabase
        .from('fusion_e2e_benchmarks')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (benchmarksError) throw benchmarksError;

      setBenchmarks(benchmarksData || []);

      if (sessionsData && sessionsData.length > 0) {
        const totalRuns = sessionsData.length;
        const avgConfidence = sessionsData.reduce((sum, s) => sum + (s.avg_confidence || 0), 0) / totalRuns;
        const avgLatency = sessionsData.reduce((sum, s) => sum + (s.avg_latency_ms || 0), 0) / totalRuns;
        const avgStability = sessionsData.reduce((sum, s) => sum + (s.avg_stability || 0), 0) / totalRuns;
        const totalErrors = sessionsData.reduce((sum, s) => sum + (s.errors_detected || 0), 0);

        setSummary({
          total_runs: totalRuns,
          avg_confidence: avgConfidence,
          avg_latency: avgLatency,
          avg_stability: avgStability,
          total_errors: totalErrors
        });
      }
    } catch (error) {
      console.error('Error fetching E2E campaign data:', error);
      alert('Failed to fetch E2E campaign data');
    } finally {
      setLoading(false);
    }
  };

  const runCampaign = async (testMode: 'functional' | 'performance' | 'resilience', cycles: number) => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('Not authenticated');
        return;
      }

      const url = await getSupabaseFunctionUrl('e2e-campaign-engine');
      const response = await fetch(
        url,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            test_mode: testMode,
            cycles: cycles
          })
        }
      );

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Campaign failed');
      }

      alert(`E2E Campaign completed!\n\nSession ID: ${result.result.session_id}\nTotal Iterations: ${result.result.total_iterations}\nAvg Confidence: ${result.result.avg_confidence.toFixed(4)}\nAvg Latency: ${result.result.avg_latency.toFixed(2)}ms\nAvg Stability: ${result.result.avg_stability.toFixed(4)}\nErrors: ${result.result.errors_detected}`);

      await fetchData();
    } catch (error) {
      console.error('Error running campaign:', error);
      alert(`Failed to run E2E campaign: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const filteredBenchmarks = benchmarks.filter(b => {
      if (filterPhase !== 'all' && b.phase_name !== filterPhase) return false;
      if (filterSession !== 'all' && b.session_id !== filterSession) return false;
      return true;
    });

    const headers = ['Iteration', 'Phase Name', 'Confidence', 'Latency (ms)', 'Stability', 'Error Flag', 'Created At'];
    const rows = filteredBenchmarks.map(b => [
      b.iteration,
      b.phase_name,
      b.confidence?.toFixed(4) || 'N/A',
      b.latency_ms?.toFixed(2) || 'N/A',
      b.stability?.toFixed(4) || 'N/A',
      b.error_flag ? 'TRUE' : 'FALSE',
      new Date(b.created_at).toLocaleString()
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `e2e-campaign-${new Date().toISOString()}.csv`;
    a.click();
  };

  const confidenceTrendData = benchmarks
    .slice(0, 50)
    .reverse()
    .map((b, index) => ({
      index: index + 1,
      confidence: b.confidence || 0,
      iteration: b.iteration
    }));

  const latencyConfidenceData = benchmarks
    .slice(0, 100)
    .map(b => ({
      latency: b.latency_ms || 0,
      confidence: b.confidence || 0,
      phase: b.phase_name
    }));

  const stabilityDistributionData = [
    { range: '0.0-0.2', count: benchmarks.filter(b => b.stability >= 0 && b.stability < 0.2).length },
    { range: '0.2-0.4', count: benchmarks.filter(b => b.stability >= 0.2 && b.stability < 0.4).length },
    { range: '0.4-0.6', count: benchmarks.filter(b => b.stability >= 0.4 && b.stability < 0.6).length },
    { range: '0.6-0.8', count: benchmarks.filter(b => b.stability >= 0.6 && b.stability < 0.8).length },
    { range: '0.8-1.0', count: benchmarks.filter(b => b.stability >= 0.8 && b.stability <= 1.0).length }
  ];

  const cycleCompletionData = sessions
    .slice(0, 10)
    .reverse()
    .map((s, index) => ({
      session: index + 1,
      cycles: s.simulation_cycles || 0,
      completed: s.steps_completed || 0,
      name: s.session_name.substring(0, 20) + '...'
    }));

  const filteredBenchmarks = benchmarks.filter(b => {
    if (filterPhase !== 'all' && b.phase_name !== filterPhase) return false;
    if (filterSession !== 'all' && b.session_id !== filterSession) return false;
    if (filterTestMode !== 'all') {
      const session = sessions.find(s => s.id === b.session_id);
      if (session && session.test_mode !== filterTestMode) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">E2E Validation Campaign</h1>
        <div className="flex gap-2">
          <Button onClick={fetchData} disabled={loading} variant="outline" className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={exportToCSV} variant="outline" className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Campaign Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Run Campaign</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button 
              onClick={() => runCampaign('functional', 10)} 
              disabled={loading} 
              className="flex items-center gap-2"
            >
              <PlayCircle className="h-4 w-4" />
              Functional (10 cycles)
            </Button>
            <Button 
              onClick={() => runCampaign('performance', 50)} 
              disabled={loading} 
              className="flex items-center gap-2"
              variant="secondary"
            >
              <PlayCircle className="h-4 w-4" />
              Performance (50 cycles)
            </Button>
            <Button 
              onClick={() => runCampaign('resilience', 15)} 
              disabled={loading} 
              className="flex items-center gap-2"
              variant="destructive"
            >
              <PlayCircle className="h-4 w-4" />
              Resilience (15 cycles)
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Runs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.total_runs}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Avg Confidence</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.avg_confidence.toFixed(4)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Avg Latency</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.avg_latency.toFixed(2)}ms</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Avg Stability</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.avg_stability.toFixed(4)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Errors Detected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{summary.total_errors}</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Confidence Trend Over Iterations</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={confidenceTrendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="index" />
                <YAxis domain={[0, 1]} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="confidence" stroke="#8884d8" name="Confidence" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Latency vs Confidence Scatter</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="latency" name="Latency (ms)" />
                <YAxis dataKey="confidence" name="Confidence" domain={[0, 1]} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                <Legend />
                <Scatter name="Benchmarks" data={latencyConfidenceData} fill="#82ca9d" />
              </ScatterChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Stability Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stabilityDistributionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#ffc658" name="Count" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cycle Completion Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={cycleCompletionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="session" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="completed" fill="#8884d8" name="Steps Completed" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Benchmarks Table */}
      <Card>
        <CardHeader>
          <CardTitle>Campaign Benchmarks</CardTitle>
          <div className="flex gap-4 mt-4">
            <div className="flex-1">
              <Label>Phase</Label>
              <Select value={filterPhase} onValueChange={setFilterPhase}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Phases</SelectItem>
                  <SelectItem value="simulation">Simulation</SelectItem>
                  <SelectItem value="governance">Governance</SelectItem>
                  <SelectItem value="policy">Policy</SelectItem>
                  <SelectItem value="neural">Neural</SelectItem>
                  <SelectItem value="trust">Trust</SelectItem>
                  <SelectItem value="explainability">Explainability</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label>Test Mode</Label>
              <Select value={filterTestMode} onValueChange={setFilterTestMode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Modes</SelectItem>
                  <SelectItem value="functional">Functional</SelectItem>
                  <SelectItem value="performance">Performance</SelectItem>
                  <SelectItem value="resilience">Resilience</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label>Session</Label>
              <Select value={filterSession} onValueChange={setFilterSession}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sessions</SelectItem>
                  {sessions.slice(0, 10).map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.session_name.substring(0, 30)}...
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Iteration</TableHead>
                <TableHead>Phase Name</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Latency (ms)</TableHead>
                <TableHead>Stability</TableHead>
                <TableHead>Error Flag</TableHead>
                <TableHead>Created At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBenchmarks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-gray-500">
                    No benchmarks found
                  </TableCell>
                </TableRow>
              ) : (
                filteredBenchmarks.slice(0, 50).map((benchmark) => (
                  <TableRow key={benchmark.id}>
                    <TableCell className="font-medium">{benchmark.iteration}</TableCell>
                    <TableCell>{benchmark.phase_name}</TableCell>
                    <TableCell>{benchmark.confidence?.toFixed(4) || 'N/A'}</TableCell>
                    <TableCell>{benchmark.latency_ms?.toFixed(2) || 'N/A'}ms</TableCell>
                    <TableCell>{benchmark.stability?.toFixed(4) || 'N/A'}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs ${
                        benchmark.error_flag ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {benchmark.error_flag ? 'TRUE' : 'FALSE'}
                      </span>
                    </TableCell>
                    <TableCell>{new Date(benchmark.created_at).toLocaleString()}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
