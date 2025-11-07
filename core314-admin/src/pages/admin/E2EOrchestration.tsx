import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/lib/supabase';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { PlayCircle, RefreshCw, Download, Trash2 } from 'lucide-react';

interface E2ESession {
  id: string;
  session_name: string;
  phase_sequence: string[];
  total_steps: number;
  steps_completed: number;
  success_rate: number;
  avg_confidence: number;
  avg_latency_ms: number;
  anomalies_detected: number;
  started_at: string;
  completed_at: string | null;
}

interface E2EResult {
  id: string;
  session_id: string;
  phase_name: string;
  status: 'success' | 'warning' | 'failure';
  confidence: number;
  latency_ms: number;
  error_details: string | null;
  created_at: string;
}

interface E2ESummary {
  total_sessions: number;
  avg_success_rate: number;
  avg_confidence: number;
  avg_latency_ms: number;
}

export function E2EOrchestration() {
  const [sessions, setSessions] = useState<E2ESession[]>([]);
  const [results, setResults] = useState<E2EResult[]>([]);
  const [summary, setSummary] = useState<E2ESummary>({
    total_sessions: 0,
    avg_success_rate: 0,
    avg_confidence: 0,
    avg_latency_ms: 0
  });
  const [loading, setLoading] = useState(false);
  const [filterPhase, setFilterPhase] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
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
        .order('started_at', { ascending: false })
        .limit(20);

      if (sessionsError) throw sessionsError;

      setSessions(sessionsData || []);

      const { data: resultsData, error: resultsError } = await supabase
        .from('fusion_e2e_results')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (resultsError) throw resultsError;

      setResults(resultsData || []);

      if (sessionsData && sessionsData.length > 0) {
        const totalSessions = sessionsData.length;
        const avgSuccessRate = sessionsData.reduce((sum, s) => sum + (s.success_rate || 0), 0) / totalSessions;
        const avgConfidence = sessionsData.reduce((sum, s) => sum + (s.avg_confidence || 0), 0) / totalSessions;
        const avgLatency = sessionsData.reduce((sum, s) => sum + (s.avg_latency_ms || 0), 0) / totalSessions;

        setSummary({
          total_sessions: totalSessions,
          avg_success_rate: avgSuccessRate,
          avg_confidence: avgConfidence,
          avg_latency_ms: avgLatency
        });
      }
    } catch (error) {
      console.error('Error fetching E2E data:', error);
      alert('Failed to fetch E2E orchestration data');
    } finally {
      setLoading(false);
    }
  };

  const runOrchestration = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('Not authenticated');
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/e2e-orchestration-engine`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            session_name: `Core314 E2E Test - ${new Date().toLocaleString()}`
          })
        }
      );

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Orchestration failed');
      }

      alert(`E2E Orchestration completed!\n\nSession ID: ${result.result.session_id}\nTotal Phases: ${result.result.total_phases}\nSuccess Rate: ${result.result.success_rate.toFixed(2)}%\nAvg Confidence: ${result.result.avg_confidence.toFixed(4)}\nAvg Latency: ${result.result.avg_latency_ms.toFixed(2)}ms`);

      await fetchData();
    } catch (error) {
      console.error('Error running orchestration:', error);
      alert(`Failed to run E2E orchestration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const clearSessionData = async () => {
    if (!confirm('Are you sure you want to clear all E2E session data? This action cannot be undone.')) {
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('fusion_e2e_sessions')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

      if (error) throw error;

      alert('All E2E session data cleared successfully');
      await fetchData();
    } catch (error) {
      console.error('Error clearing session data:', error);
      alert('Failed to clear session data');
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const filteredResults = results.filter(r => {
      if (filterPhase !== 'all' && r.phase_name !== filterPhase) return false;
      if (filterStatus !== 'all' && r.status !== filterStatus) return false;
      if (filterSession !== 'all' && r.session_id !== filterSession) return false;
      return true;
    });

    const headers = ['Phase Name', 'Status', 'Confidence', 'Latency (ms)', 'Error Details', 'Created At'];
    const rows = filteredResults.map(r => [
      r.phase_name,
      r.status,
      r.confidence?.toFixed(4) || 'N/A',
      r.latency_ms?.toFixed(2) || 'N/A',
      r.error_details || '',
      new Date(r.created_at).toLocaleString()
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `e2e-orchestration-${new Date().toISOString()}.csv`;
    a.click();
  };

  const phaseSequenceData = sessions.length > 0 && sessions[0].id && results.length > 0
    ? results
        .filter(r => r.session_id === sessions[0].id)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .map((r, index) => ({
          phase: r.phase_name,
          order: index + 1,
          latency: r.latency_ms || 0,
          confidence: r.confidence || 0
        }))
    : [];

  const confidenceOverTimeData = results
    .slice(0, 20)
    .reverse()
    .map((r, index) => ({
      index: index + 1,
      confidence: r.confidence || 0,
      phase: r.phase_name
    }));

  const latencyByPhaseData = ['simulation', 'governance', 'policy', 'neural', 'trust', 'explainability'].map(phase => {
    const phaseResults = results.filter(r => r.phase_name === phase);
    const avgLatency = phaseResults.length > 0
      ? phaseResults.reduce((sum, r) => sum + (r.latency_ms || 0), 0) / phaseResults.length
      : 0;
    return {
      phase,
      latency: avgLatency
    };
  });

  const filteredResults = results.filter(r => {
    if (filterPhase !== 'all' && r.phase_name !== filterPhase) return false;
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    if (filterSession !== 'all' && r.session_id !== filterSession) return false;
    return true;
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">E2E Orchestration & Validation</h1>
        <div className="flex gap-2">
          <Button onClick={runOrchestration} disabled={loading} className="flex items-center gap-2">
            <PlayCircle className="h-4 w-4" />
            Run E2E Validation
          </Button>
          <Button onClick={fetchData} disabled={loading} variant="outline" className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={exportToCSV} variant="outline" className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          <Button onClick={clearSessionData} disabled={loading} variant="destructive" className="flex items-center gap-2">
            <Trash2 className="h-4 w-4" />
            Clear Data
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.total_sessions}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Avg Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.avg_success_rate.toFixed(2)}%</div>
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
            <div className="text-2xl font-bold">{summary.avg_latency_ms.toFixed(2)}ms</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Phase Sequence Timeline (Latest Session)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={phaseSequenceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="phase" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="latency" stroke="#8884d8" name="Latency (ms)" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Confidence Over Time (Last 20 Results)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={confidenceOverTimeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="index" />
                <YAxis domain={[0, 1]} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="confidence" stroke="#82ca9d" name="Confidence" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Latency by Phase (Average)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={latencyByPhaseData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="phase" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="latency" fill="#8884d8" name="Avg Latency (ms)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Results Table */}
      <Card>
        <CardHeader>
          <CardTitle>E2E Orchestration Results</CardTitle>
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
              <Label>Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="failure">Failure</SelectItem>
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
                <TableHead>Phase Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Latency (ms)</TableHead>
                <TableHead>Error Details</TableHead>
                <TableHead>Created At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredResults.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-gray-500">
                    No results found
                  </TableCell>
                </TableRow>
              ) : (
                filteredResults.map((result) => (
                  <TableRow key={result.id}>
                    <TableCell className="font-medium">{result.phase_name}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs ${
                        result.status === 'success' ? 'bg-green-100 text-green-800' :
                        result.status === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {result.status}
                      </span>
                    </TableCell>
                    <TableCell>{result.confidence?.toFixed(4) || 'N/A'}</TableCell>
                    <TableCell>{result.latency_ms?.toFixed(2) || 'N/A'}ms</TableCell>
                    <TableCell className="max-w-xs truncate">{result.error_details || '-'}</TableCell>
                    <TableCell>{new Date(result.created_at).toLocaleString()}</TableCell>
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
