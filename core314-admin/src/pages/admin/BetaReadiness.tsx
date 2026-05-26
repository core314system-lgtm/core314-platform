import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useSupabaseClient } from '@/contexts/SupabaseClientContext';
import { getSupabaseFunctionUrl } from '@/lib/supabaseRuntimeConfig';
import { PieChart, Pie, Cell, ScatterChart, Scatter, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { PlayCircle, RefreshCw, Download } from 'lucide-react';

interface BetaAuditRecord {
  id: string;
  component_name: string;
  status: 'operational' | 'degraded' | 'failed';
  confidence: number;
  latency_ms: number;
  last_verified: string;
  remarks: string;
}

interface ReadinessSummary {
  id: string;
  total_subsystems: number;
  operational_count: number;
  degraded_count: number;
  failed_count: number;
  avg_confidence: number;
  avg_latency: number;
  readiness_score: number;
  created_at: string;
}

interface ReadinessMetrics {
  total_subsystems: number;
  operational_count: number;
  degraded_count: number;
  failed_count: number;
  avg_confidence: number;
  avg_latency: number;
  readiness_score: number;
}

export function BetaReadiness() {
  const supabase = useSupabaseClient();
  const [auditRecords, setAuditRecords] = useState<BetaAuditRecord[]>([]);
  const [summaries, setSummaries] = useState<ReadinessSummary[]>([]);
  const [currentMetrics, setCurrentMetrics] = useState<ReadinessMetrics>({
    total_subsystems: 0,
    operational_count: 0,
    degraded_count: 0,
    failed_count: 0,
    avg_confidence: 0,
    avg_latency: 0,
    readiness_score: 0
  });
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterComponent, setFilterComponent] = useState<string>('all');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('Not authenticated');
        return;
      }

      const url = await getSupabaseFunctionUrl('beta-readiness-engine');
      const response = await fetch(
        url,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch data');
      }

      setAuditRecords(result.current_audit || []);
      setSummaries(result.summaries || []);

      if (result.summaries && result.summaries.length > 0) {
        const latest = result.summaries[0];
        setCurrentMetrics({
          total_subsystems: latest.total_subsystems,
          operational_count: latest.operational_count,
          degraded_count: latest.degraded_count,
          failed_count: latest.failed_count,
          avg_confidence: latest.avg_confidence,
          avg_latency: latest.avg_latency,
          readiness_score: latest.readiness_score
        });
      }
    } catch (error) {
      console.error('Error fetching beta readiness data:', error);
      alert('Failed to fetch beta readiness data');
    } finally {
      setLoading(false);
    }
  };

  const runReadinessAudit = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('Not authenticated');
        return;
      }

      const url = await getSupabaseFunctionUrl('beta-readiness-engine');
      const response = await fetch(
        url,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({})
        }
      );

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Audit failed');
      }

      const metrics = result.result;
      alert(`Beta Readiness Audit Complete!\n\nTotal Subsystems: ${metrics.total_subsystems}\nOperational: ${metrics.operational_count}\nDegraded: ${metrics.degraded_count}\nFailed: ${metrics.failed_count}\nAvg Confidence: ${metrics.avg_confidence.toFixed(4)}\nAvg Latency: ${metrics.avg_latency.toFixed(2)}ms\nReadiness Score: ${metrics.readiness_score.toFixed(2)}%\n\n${metrics.readiness_score >= 90 ? '✅ BETA READY' : '⚠️ NOT READY - Score must be ≥90%'}`);

      await fetchData();
    } catch (error) {
      console.error('Error running audit:', error);
      alert(`Failed to run readiness audit: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const filteredRecords = auditRecords.filter(r => {
      if (filterStatus !== 'all' && r.status !== filterStatus) return false;
      if (filterComponent !== 'all' && r.component_name !== filterComponent) return false;
      return true;
    });

    const headers = ['Component Name', 'Status', 'Confidence', 'Latency (ms)', 'Last Verified', 'Remarks'];
    const rows = filteredRecords.map(r => [
      r.component_name,
      r.status,
      r.confidence?.toFixed(4) || 'N/A',
      r.latency_ms?.toFixed(2) || 'N/A',
      new Date(r.last_verified).toLocaleString(),
      r.remarks || ''
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `beta-readiness-${new Date().toISOString()}.csv`;
    a.click();
  };

  const statusDistributionData = [
    { name: 'Operational', value: currentMetrics.operational_count, color: '#10b981' },
    { name: 'Degraded', value: currentMetrics.degraded_count, color: '#f59e0b' },
    { name: 'Failed', value: currentMetrics.failed_count, color: '#ef4444' }
  ].filter(d => d.value > 0);

  const confidenceLatencyData = auditRecords.map(r => ({
    confidence: r.confidence || 0,
    latency: r.latency_ms || 0,
    component: r.component_name,
    status: r.status
  }));

  const readinessTrendData = summaries
    .slice(0, 10)
    .reverse()
    .map((s, index) => ({
      run: index + 1,
      score: s.readiness_score || 0,
      confidence: (s.avg_confidence || 0) * 100,
      created: new Date(s.created_at).toLocaleDateString()
    }));

  const filteredRecords = auditRecords.filter(r => {
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    if (filterComponent !== 'all' && r.component_name !== filterComponent) return false;
    return true;
  });

  const uniqueComponents = Array.from(new Set(auditRecords.map(r => r.component_name)));

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'operational': return 'text-green-600 bg-green-50';
      case 'degraded': return 'text-yellow-600 bg-yellow-50';
      case 'failed': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getReadinessColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 75) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Beta Readiness Assessment</h1>
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

      {/* Run Audit Control */}
      <Card>
        <CardHeader>
          <CardTitle>Run Readiness Audit</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-center">
            <Button 
              onClick={runReadinessAudit} 
              disabled={loading} 
              className="flex items-center gap-2"
            >
              <PlayCircle className="h-4 w-4" />
              Run Beta Readiness Audit
            </Button>
            <p className="text-sm text-gray-600">
              Evaluates all subsystems from E2E benchmarks and calculates readiness score. 
              Score ≥90% required for beta release.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Subsystems</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentMetrics.total_subsystems}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Operational</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{currentMetrics.operational_count}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Avg Confidence</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentMetrics.avg_confidence.toFixed(4)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Avg Latency</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentMetrics.avg_latency.toFixed(2)}ms</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Readiness Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getReadinessColor(currentMetrics.readiness_score)}`}>
              {currentMetrics.readiness_score.toFixed(2)}%
            </div>
            {currentMetrics.readiness_score >= 90 && (
              <div className="text-xs text-green-600 mt-1">✅ Beta Ready</div>
            )}
            {currentMetrics.readiness_score < 90 && (
              <div className="text-xs text-red-600 mt-1">⚠️ Not Ready</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Subsystem Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusDistributionData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusDistributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Confidence vs Latency Scatter</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="latency" name="Latency (ms)" />
                <YAxis dataKey="confidence" name="Confidence" domain={[0, 1]} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                <Legend />
                <Scatter name="Subsystems" data={confidenceLatencyData} fill="#8884d8" />
              </ScatterChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Readiness Trend Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={readinessTrendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="run" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="score" stroke="#8884d8" name="Readiness Score (%)" />
                <Line type="monotone" dataKey="confidence" stroke="#82ca9d" name="Avg Confidence (%)" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Audit Records Table */}
      <Card>
        <CardHeader>
          <CardTitle>Component Audit Results</CardTitle>
          <div className="flex gap-4 mt-4">
            <div className="flex-1">
              <Label>Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="operational">Operational</SelectItem>
                  <SelectItem value="degraded">Degraded</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label>Component</Label>
              <Select value={filterComponent} onValueChange={setFilterComponent}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Components</SelectItem>
                  {uniqueComponents.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
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
                <TableHead>Component Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Latency (ms)</TableHead>
                <TableHead>Last Verified</TableHead>
                <TableHead>Remarks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRecords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-gray-500">
                    No audit records found. Run a readiness audit to populate data.
                  </TableCell>
                </TableRow>
              ) : (
                filteredRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">{record.component_name}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(record.status)}`}>
                        {record.status.toUpperCase()}
                      </span>
                    </TableCell>
                    <TableCell>{record.confidence?.toFixed(4) || 'N/A'}</TableCell>
                    <TableCell>{record.latency_ms?.toFixed(2) || 'N/A'}</TableCell>
                    <TableCell>{new Date(record.last_verified).toLocaleString()}</TableCell>
                    <TableCell className="text-sm text-gray-600">{record.remarks}</TableCell>
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
