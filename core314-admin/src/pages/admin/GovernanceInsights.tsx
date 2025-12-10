import { useEffect, useState } from 'react';
import { useSupabaseClient } from '../../contexts/SupabaseClientContext';
import { getSupabaseFunctionUrl } from '../../lib/supabaseRuntimeConfig';
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
import { RefreshCw, Play, Download, Shield, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface GovernanceAudit {
  id: string;
  source_event_id: string | null;
  subsystem: string;
  governance_action: string;
  justification: string;
  confidence_level: number;
  policy_reference: string | null;
  outcome: string;
  audit_severity: string;
  reviewer_id: string | null;
  reviewer_email: string | null;
  explanation_context: Record<string, unknown>;
  created_at: string;
  recency: string;
}

interface GovernanceMetrics {
  audits_run: number;
  anomalies_detected: number;
  average_confidence: number;
  policy_violations: number;
}

export function GovernanceInsights() {
  const supabase = useSupabaseClient();
  const [audits, setAudits] = useState<GovernanceAudit[]>([]);
  const [metrics, setMetrics] = useState<GovernanceMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [filterSubsystem, setFilterSubsystem] = useState<string>('all');
  const [filterOutcome, setFilterOutcome] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: auditsData, error: auditsError } = await supabase
        .from('governance_dashboard')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (auditsError) throw auditsError;
      setAudits(auditsData || []);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const url = await getSupabaseFunctionUrl('governance-engine');
      const response = await fetch(
        url,
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
      if (result.success && result.result) {
        setMetrics(result.result);
      }
    } catch (error) {
      console.error('Error fetching governance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const runGovernanceEngine = async () => {
    setRunning(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const url = await getSupabaseFunctionUrl('governance-engine');
      const response = await fetch(
        url,
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

      const result = await response.json();
      if (result.success && result.result) {
        setMetrics(result.result);
        await fetchData();
      }
    } catch (error) {
      console.error('Error running governance engine:', error);
      alert('Failed to run governance engine. Check console for details.');
    } finally {
      setRunning(false);
    }
  };

  const exportToCSV = () => {
    const headers = ['ID', 'Subsystem', 'Action', 'Justification', 'Confidence', 'Outcome', 'Severity', 'Created At'];
    const rows = filteredAudits.map(audit => [
      audit.id,
      audit.subsystem,
      audit.governance_action,
      audit.justification,
      audit.confidence_level.toFixed(2),
      audit.outcome,
      audit.audit_severity,
      new Date(audit.created_at).toLocaleString(),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `governance-audit-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredAudits = audits.filter(audit => {
    if (filterSubsystem !== 'all' && audit.subsystem !== filterSubsystem) return false;
    if (filterOutcome !== 'all' && audit.outcome !== filterOutcome) return false;
    if (filterSeverity !== 'all' && audit.audit_severity !== filterSeverity) return false;
    if (searchTerm && !audit.governance_action.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !audit.justification.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const confidenceTrendData = audits
    .slice(0, 50)
    .reverse()
    .map((audit, index) => ({
      index: index + 1,
      confidence: parseFloat((audit.confidence_level * 100).toFixed(1)),
    }));

  const severityData = [
    { name: 'Info', value: audits.filter(a => a.audit_severity === 'Info').length, color: '#10b981' },
    { name: 'Warning', value: audits.filter(a => a.audit_severity === 'Warning').length, color: '#f59e0b' },
    { name: 'Critical', value: audits.filter(a => a.audit_severity === 'Critical').length, color: '#ef4444' },
  ];

  const subsystemData = [
    { name: 'Trust', value: audits.filter(a => a.subsystem === 'Trust').length, color: '#3b82f6' },
    { name: 'Policy', value: audits.filter(a => a.subsystem === 'Policy').length, color: '#8b5cf6' },
    { name: 'Optimization', value: audits.filter(a => a.subsystem === 'Optimization').length, color: '#06b6d4' },
    { name: 'Behavioral', value: audits.filter(a => a.subsystem === 'Behavioral').length, color: '#10b981' },
    { name: 'Other', value: audits.filter(a => !['Trust', 'Policy', 'Optimization', 'Behavioral'].includes(a.subsystem)).length, color: '#6b7280' },
  ].filter(item => item.value > 0);

  const getSeverityBadge = (severity: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      'Info': 'default',
      'Warning': 'secondary',
      'Critical': 'destructive',
    };
    return <Badge variant={variants[severity] || 'outline'}>{severity}</Badge>;
  };

  const getOutcomeBadge = (outcome: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      'Approved': 'default',
      'Denied': 'destructive',
      'Escalated': 'secondary',
      'Deferred': 'outline',
    };
    return <Badge variant={variants[outcome] || 'outline'}>{outcome}</Badge>;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Governance Insights</h1>
          <p className="text-gray-600 mt-1">Autonomous governance framework with explainable AI decisions</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchData} variant="outline" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={runGovernanceEngine} disabled={running}>
            <Play className={`h-4 w-4 mr-2 ${running ? 'animate-spin' : ''}`} />
            Run Governance Audit
          </Button>
          <Button onClick={exportToCSV} variant="outline" disabled={filteredAudits.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Audits Run</CardTitle>
            <Shield className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.audits_run || 0}</div>
            <p className="text-xs text-gray-600 mt-1">Last 48 hours</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Anomalies Detected</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.anomalies_detected || 0}</div>
            <p className="text-xs text-gray-600 mt-1">Escalated for review</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Confidence</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics ? `${(metrics.average_confidence * 100).toFixed(1)}%` : '0%'}
            </div>
            <p className="text-xs text-gray-600 mt-1">Decision confidence</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Policy Violations</CardTitle>
            <Clock className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.policy_violations || 0}</div>
            <p className="text-xs text-gray-600 mt-1">Expired policies</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Governance Confidence Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={confidenceTrendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="index" label={{ value: 'Recent Audits', position: 'insideBottom', offset: -5 }} />
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
            <CardTitle>Audit Severity Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={severityData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {severityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Subsystem Health</CardTitle>
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
          <CardTitle>Governance Audit Log</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <Input
              placeholder="Search actions or justifications..."
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
                <SelectItem value="Prediction">Prediction</SelectItem>
                <SelectItem value="Calibration">Calibration</SelectItem>
                <SelectItem value="Oversight">Oversight</SelectItem>
                <SelectItem value="Orchestration">Orchestration</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterOutcome} onValueChange={setFilterOutcome}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Outcome" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Outcomes</SelectItem>
                <SelectItem value="Approved">Approved</SelectItem>
                <SelectItem value="Denied">Denied</SelectItem>
                <SelectItem value="Escalated">Escalated</SelectItem>
                <SelectItem value="Deferred">Deferred</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterSeverity} onValueChange={setFilterSeverity}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="Info">Info</SelectItem>
                <SelectItem value="Warning">Warning</SelectItem>
                <SelectItem value="Critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subsystem</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Justification</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAudits.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-gray-500 py-8">
                      No governance audits found. Run the governance engine to generate audits.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAudits.map((audit) => (
                    <TableRow key={audit.id}>
                      <TableCell>
                        <Badge variant="outline">{audit.subsystem}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">{audit.governance_action}</TableCell>
                      <TableCell className="max-w-md truncate">{audit.justification}</TableCell>
                      <TableCell>{(audit.confidence_level * 100).toFixed(1)}%</TableCell>
                      <TableCell>{getOutcomeBadge(audit.outcome)}</TableCell>
                      <TableCell>{getSeverityBadge(audit.audit_severity)}</TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {new Date(audit.created_at).toLocaleString()}
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
