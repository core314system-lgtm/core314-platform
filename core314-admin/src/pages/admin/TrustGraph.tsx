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
import { RefreshCw, Play, Download, Network, TrendingUp, AlertTriangle, Users } from 'lucide-react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

interface TrustRecord {
  id: string;
  user_id: string;
  user_email: string;
  user_role: string;
  organization_id: string | null;
  organization_name: string | null;
  trust_score: number;
  risk_level: string;
  total_interactions: number;
  last_anomaly: string | null;
  last_policy_action: string | null;
  behavior_consistency: number;
  adaptive_flags: number;
  connections: any[];
  updated_at: string;
  anomaly_recency: string;
}

interface TrustEngineResult {
  success: boolean;
  timestamp: string;
  result: {
    avg_trust_score: number;
    users_updated: number;
    high_risk_users: number;
    low_risk_users: number;
  } | null;
  error?: string;
}

interface GraphNode {
  id: string;
  email: string;
  trust_score: number;
  risk_level: string;
  x: number;
  y: number;
}

export function TrustGraph() {
  const [trustRecords, setTrustRecords] = useState<TrustRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [engineRunning, setEngineRunning] = useState(false);
  const [lastEngineRun, setLastEngineRun] = useState<TrustEngineResult | null>(null);
  
  const [orgFilter, setOrgFilter] = useState<string>('all');
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [policyFilter, setPolicyFilter] = useState<string>('all');

  const [avgTrustScore, setAvgTrustScore] = useState(0);
  const [highRiskUsers, setHighRiskUsers] = useState(0);
  const [activePolicyCorrelations, setActivePolicyCorrelations] = useState(0);
  const [behaviorConsistencyIndex, setBehaviorConsistencyIndex] = useState(0);

  useEffect(() => {
    fetchTrustRecords();
    fetchKPIs();
  }, []);

  const fetchTrustRecords = async () => {
    try {
      const { data, error } = await supabase
        .from('trust_graph_dashboard')
        .select('*')
        .order('trust_score', { ascending: true });

      if (error) throw error;
      setTrustRecords(data || []);
    } catch (error) {
      console.error('Error fetching trust records:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchKPIs = async () => {
    try {
      const { data: trustData } = await supabase
        .from('fusion_trust_graph')
        .select('trust_score, behavior_consistency');

      if (trustData && trustData.length > 0) {
        const avgTrust = trustData.reduce((sum, r) => sum + r.trust_score, 0) / trustData.length;
        setAvgTrustScore(Math.round(avgTrust * 10) / 10);

        const highRisk = trustData.filter(r => r.trust_score < 60).length;
        setHighRiskUsers(highRisk);

        const avgConsistency = trustData.reduce((sum, r) => sum + (r.behavior_consistency || 0), 0) / trustData.length;
        setBehaviorConsistencyIndex(Math.round(avgConsistency * 10) / 10);
      }

      const { count: policyCount } = await supabase
        .from('fusion_adaptive_policies')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Active')
        .not('action_value', 'is', null);

      setActivePolicyCorrelations(policyCount || 0);
    } catch (error) {
      console.error('Error fetching KPIs:', error);
    }
  };

  const runTrustEngine = async () => {
    setEngineRunning(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/trust-graph-engine`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action: 'analyze' }),
        }
      );

      if (!response.ok) {
        throw new Error(`Engine failed: ${response.statusText}`);
      }

      const result: TrustEngineResult = await response.json();
      setLastEngineRun(result);

      await Promise.all([fetchTrustRecords(), fetchKPIs()]);
    } catch (error) {
      console.error('Error running trust engine:', error);
      alert('Failed to run trust engine. Check console for details.');
    } finally {
      setEngineRunning(false);
    }
  };

  const exportGraphJSON = () => {
    const graphData = {
      nodes: trustRecords.map(r => ({
        id: r.user_id,
        email: r.user_email,
        trust_score: r.trust_score,
        risk_level: r.risk_level,
        organization: r.organization_name,
        connections: r.connections,
      })),
      metadata: {
        exported_at: new Date().toISOString(),
        total_nodes: trustRecords.length,
        avg_trust_score: avgTrustScore,
      },
    };

    const blob = new Blob([JSON.stringify(graphData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trust-graph-${new Date().toISOString()}.json`;
    a.click();
  };

  const exportToCSV = () => {
    const headers = [
      'User Email',
      'Role',
      'Organization',
      'Trust Score',
      'Risk Level',
      'Total Interactions',
      'Behavior Consistency',
      'Adaptive Flags',
      'Last Policy Action',
      'Last Anomaly',
      'Updated At',
    ];

    const rows = filteredRecords.map(r => [
      r.user_email,
      r.user_role,
      r.organization_name || 'N/A',
      r.trust_score,
      r.risk_level,
      r.total_interactions,
      r.behavior_consistency,
      r.adaptive_flags,
      r.last_policy_action || 'None',
      r.last_anomaly ? new Date(r.last_anomaly).toLocaleString() : 'None',
      new Date(r.updated_at).toLocaleString(),
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trust-records-${new Date().toISOString()}.csv`;
    a.click();
  };

  const filteredRecords = trustRecords.filter(r => {
    if (orgFilter !== 'all' && r.organization_name !== orgFilter) return false;
    if (riskFilter !== 'all' && r.risk_level !== riskFilter) return false;
    if (policyFilter !== 'all') {
      if (policyFilter === 'has_policy' && !r.last_policy_action) return false;
      if (policyFilter === 'no_policy' && r.last_policy_action) return false;
    }
    return true;
  });

  const graphNodes: GraphNode[] = filteredRecords.map((r, index) => ({
    id: r.user_id,
    email: r.user_email,
    trust_score: r.trust_score,
    risk_level: r.risk_level,
    x: (index % 10) * 100,
    y: Math.floor(index / 10) * 100,
  }));

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'Low':
        return '#10b981';
      case 'Moderate':
        return '#f59e0b';
      case 'High':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  const getRiskBadgeColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'Low':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'Moderate':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'High':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const uniqueOrgs = Array.from(new Set(trustRecords.map(r => r.organization_name).filter(Boolean)));

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Trust Graph Intelligence</h1>
          <p className="text-gray-600 dark:text-gray-400">Dynamic trust scoring and behavioral analysis</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="default" 
            onClick={runTrustEngine}
            disabled={engineRunning}
          >
            <Play className={`mr-2 h-4 w-4 ${engineRunning ? 'animate-spin' : ''}`} />
            {engineRunning ? 'Recalculating...' : 'Recalculate Trust'}
          </Button>
          <Button variant="outline" onClick={fetchTrustRecords} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {lastEngineRun && (
        <Card className={lastEngineRun.success ? 'border-green-200' : 'border-red-200'}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Last Trust Engine Run</p>
                <p className="text-lg font-semibold">
                  {lastEngineRun.success ? (
                    <>
                      Updated {lastEngineRun.result?.users_updated || 0} users, 
                      Avg Trust: {lastEngineRun.result?.avg_trust_score || 0}
                    </>
                  ) : (
                    <span className="text-red-600">Failed: {lastEngineRun.error}</span>
                  )}
                </p>
              </div>
              <p className="text-sm text-gray-500">
                {new Date(lastEngineRun.timestamp).toLocaleString()}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Trust Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgTrustScore}</div>
            <p className="text-xs text-muted-foreground">
              System-wide average
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High-Risk Users</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{highRiskUsers}</div>
            <p className="text-xs text-muted-foreground">
              Trust score below 60
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Policy Correlations</CardTitle>
            <Network className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activePolicyCorrelations}</div>
            <p className="text-xs text-muted-foreground">
              Users with active policies
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Behavior Consistency Index</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{behaviorConsistencyIndex}</div>
            <p className="text-xs text-muted-foreground">
              Average consistency score
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Trust Score Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                type="number" 
                dataKey="x" 
                name="Position" 
                domain={[0, 1000]}
                hide
              />
              <YAxis 
                type="number" 
                dataKey="trust_score" 
                name="Trust Score" 
                domain={[0, 100]}
              />
              <Tooltip 
                cursor={{ strokeDasharray: '3 3' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload as GraphNode;
                    return (
                      <div className="bg-white dark:bg-gray-800 p-3 border rounded shadow-lg">
                        <p className="font-semibold">{data.email}</p>
                        <p className="text-sm">Trust Score: {data.trust_score}</p>
                        <p className="text-sm">Risk Level: {data.risk_level}</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend />
              <Scatter name="Users" data={graphNodes} fill="#8884d8">
                {graphNodes.map((node, index) => (
                  <Cell key={`cell-${index}`} fill={getRiskColor(node.risk_level)} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Trust Records ({filteredRecords.length})</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={exportGraphJSON}>
                <Download className="mr-2 h-4 w-4" />
                Export Graph JSON
              </Button>
              <Button variant="outline" size="sm" onClick={exportToCSV}>
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Organization</label>
              <Select value={orgFilter} onValueChange={setOrgFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Organizations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Organizations</SelectItem>
                  {uniqueOrgs.map(org => (
                    <SelectItem key={org} value={org!}>{org}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Risk Level</label>
              <Select value={riskFilter} onValueChange={setRiskFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Risk Levels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Risk Levels</SelectItem>
                  <SelectItem value="Low">Low</SelectItem>
                  <SelectItem value="Moderate">Moderate</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Policy Status</label>
              <Select value={policyFilter} onValueChange={setPolicyFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Policies" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Policies</SelectItem>
                  <SelectItem value="has_policy">Has Active Policy</SelectItem>
                  <SelectItem value="no_policy">No Active Policy</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Trust Score</TableHead>
                  <TableHead>Risk Level</TableHead>
                  <TableHead>Interactions</TableHead>
                  <TableHead>Consistency</TableHead>
                  <TableHead>Flags</TableHead>
                  <TableHead>Last Policy</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-gray-500">
                      No trust records found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{record.user_email}</div>
                          <div className="text-sm text-gray-500">{record.user_role}</div>
                        </div>
                      </TableCell>
                      <TableCell>{record.organization_name || 'N/A'}</TableCell>
                      <TableCell>
                        <div className="font-semibold">{record.trust_score}</div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getRiskBadgeColor(record.risk_level)}>
                          {record.risk_level}
                        </Badge>
                      </TableCell>
                      <TableCell>{record.total_interactions}</TableCell>
                      <TableCell>{record.behavior_consistency}</TableCell>
                      <TableCell>
                        {record.adaptive_flags > 0 ? (
                          <Badge variant="destructive">{record.adaptive_flags}</Badge>
                        ) : (
                          <span className="text-gray-400">0</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {record.last_policy_action ? (
                          <Badge variant="outline">{record.last_policy_action}</Badge>
                        ) : (
                          <span className="text-gray-400">None</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {new Date(record.updated_at).toLocaleDateString()}
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
