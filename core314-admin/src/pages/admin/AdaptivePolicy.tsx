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
import { RefreshCw, Play, Pause, Download, Plus, Shield, AlertTriangle, TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';

interface AdaptivePolicy {
  id: string;
  policy_name: string;
  target_role: string;
  target_function: string;
  condition_type: string;
  condition_threshold: number;
  action_type: string;
  action_value: string;
  status: string;
  created_at: string;
  expires_at: string | null;
  created_by_email: string | null;
  notes: string;
  expiration_status: string;
  hours_until_expiry: number | null;
}

interface PolicyEngineResult {
  success: boolean;
  timestamp: string;
  result: {
    analyzed_users: number;
    policies_applied: number;
    avg_risk_score: number;
  } | null;
  active_policies_count: number;
  restricted_users_count: number;
  error?: string;
}

interface RiskScore {
  user_id: string;
  risk_score: number;
  auth_failures_count: number;
  anomaly_count: number;
  calculated_at: string;
}

export function AdaptivePolicy() {
  const [policies, setPolicies] = useState<AdaptivePolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [engineRunning, setEngineRunning] = useState(false);
  const [lastEngineRun, setLastEngineRun] = useState<PolicyEngineResult | null>(null);
  const [riskScores, setRiskScores] = useState<RiskScore[]>([]);
  
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [functionFilter, setFunctionFilter] = useState<string>('all');

  const [activePolicies, setActivePolicies] = useState(0);
  const [restrictedUsers, setRestrictedUsers] = useState(0);
  const [avgRiskScore, setAvgRiskScore] = useState(0);

  useEffect(() => {
    fetchPolicies();
    fetchRiskScores();
    fetchKPIs();
  }, []);

  const fetchPolicies = async () => {
    try {
      const { data, error } = await supabase
        .from('adaptive_policy_dashboard')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPolicies(data || []);
    } catch (error) {
      console.error('Error fetching policies:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRiskScores = async () => {
    try {
      const { data, error } = await supabase
        .from('user_risk_scores')
        .select('*')
        .gte('calculated_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('calculated_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setRiskScores(data || []);
    } catch (error) {
      console.error('Error fetching risk scores:', error);
    }
  };

  const fetchKPIs = async () => {
    try {
      const { count: activeCount } = await supabase
        .from('fusion_adaptive_policies')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Active')
        .or('expires_at.is.null,expires_at.gt.now()');

      setActivePolicies(activeCount || 0);

      const { data: restrictedPolicies } = await supabase
        .from('fusion_adaptive_policies')
        .select('action_value')
        .eq('status', 'Active')
        .in('action_type', ['restrict', 'throttle'])
        .or('expires_at.is.null,expires_at.gt.now()');

      const uniqueUsers = restrictedPolicies 
        ? new Set(restrictedPolicies.map(p => p.action_value).filter(Boolean)).size 
        : 0;
      setRestrictedUsers(uniqueUsers);

      const { data: recentScores } = await supabase
        .from('user_risk_scores')
        .select('risk_score')
        .gte('calculated_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      if (recentScores && recentScores.length > 0) {
        const avg = recentScores.reduce((sum, s) => sum + s.risk_score, 0) / recentScores.length;
        setAvgRiskScore(Math.round(avg * 10) / 10);
      }
    } catch (error) {
      console.error('Error fetching KPIs:', error);
    }
  };

  const runPolicyEngine = async () => {
    setEngineRunning(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/adaptive-policy-engine`,
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

      const result: PolicyEngineResult = await response.json();
      setLastEngineRun(result);

      await Promise.all([fetchPolicies(), fetchRiskScores(), fetchKPIs()]);
    } catch (error) {
      console.error('Error running policy engine:', error);
      alert('Failed to run policy engine. Check console for details.');
    } finally {
      setEngineRunning(false);
    }
  };

  const suspendPolicy = async (policyId: string) => {
    try {
      const { error } = await supabase
        .from('fusion_adaptive_policies')
        .update({ status: 'Suspended' })
        .eq('id', policyId);

      if (error) throw error;
      
      await fetchPolicies();
      await fetchKPIs();
    } catch (error) {
      console.error('Error suspending policy:', error);
      alert('Failed to suspend policy');
    }
  };

  const exportToCSV = () => {
    const headers = [
      'Policy Name',
      'Target Role',
      'Target Function',
      'Condition Type',
      'Action Type',
      'Status',
      'Created At',
      'Expires At',
      'Notes',
    ];

    const rows = filteredPolicies.map(p => [
      p.policy_name,
      p.target_role,
      p.target_function,
      p.condition_type,
      p.action_type,
      p.status,
      new Date(p.created_at).toLocaleString(),
      p.expires_at ? new Date(p.expires_at).toLocaleString() : 'Never',
      p.notes || '',
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `adaptive-policies-${new Date().toISOString()}.csv`;
    a.click();
  };

  const filteredPolicies = policies.filter(p => {
    if (roleFilter !== 'all' && p.target_role !== roleFilter) return false;
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (functionFilter !== 'all' && p.target_function !== functionFilter) return false;
    return true;
  });

  const policyActivationData = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    const dateStr = date.toISOString().split('T')[0];
    
    const dayPolicies = policies.filter(p => 
      p.created_at.startsWith(dateStr) && p.condition_type !== 'manual_override'
    );

    return {
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      policies: dayPolicies.length,
      restrict: dayPolicies.filter(p => p.action_type === 'restrict').length,
      throttle: dayPolicies.filter(p => p.action_type === 'throttle').length,
    };
  });

  const violationsByRole = [
    { role: 'end_user', violations: policies.filter(p => p.target_role === 'end_user').length },
    { role: 'operator', violations: policies.filter(p => p.target_role === 'operator').length },
    { role: 'platform_admin', violations: policies.filter(p => p.target_role === 'platform_admin').length },
  ];

  const getActionBadgeColor = (action: string) => {
    switch (action) {
      case 'restrict':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'throttle':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'elevate':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'notify':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'Active':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'Suspended':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
      case 'Expired':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

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
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Policy Intelligence</h1>
          <p className="text-gray-600 dark:text-gray-400">Adaptive security policies and risk monitoring</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="default" 
            onClick={runPolicyEngine}
            disabled={engineRunning}
          >
            <Play className={`mr-2 h-4 w-4 ${engineRunning ? 'animate-spin' : ''}`} />
            {engineRunning ? 'Running...' : 'Run Policy Engine'}
          </Button>
          <Button variant="outline" onClick={fetchPolicies} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Last Engine Run Result */}
      {lastEngineRun && (
        <Card className={lastEngineRun.success ? 'border-green-200' : 'border-red-200'}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Last Engine Run</p>
                <p className="text-lg font-semibold">
                  {lastEngineRun.success ? (
                    <>
                      Analyzed {lastEngineRun.result?.analyzed_users || 0} users, 
                      Applied {lastEngineRun.result?.policies_applied || 0} policies
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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Policies</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activePolicies}</div>
            <p className="text-xs text-muted-foreground">
              Currently enforced policies
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Restricted Users</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{restrictedUsers}</div>
            <p className="text-xs text-muted-foreground">
              Users with active restrictions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Risk Score (7-day)</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgRiskScore}</div>
            <p className="text-xs text-muted-foreground">
              Out of 100 (lower is better)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Policy Activations (7-day trend)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={policyActivationData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="policies" stroke="#8884d8" name="Total" />
                <Line type="monotone" dataKey="restrict" stroke="#ef4444" name="Restrict" />
                <Line type="monotone" dataKey="throttle" stroke="#f97316" name="Throttle" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Access Violations by Role</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={violationsByRole}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="role" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="violations" fill="#8884d8" name="Violations" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Adaptive Policies ({filteredPolicies.length})</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={exportToCSV}>
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex gap-4 mb-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Role</label>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="end_user">End User</SelectItem>
                  <SelectItem value="operator">Operator</SelectItem>
                  <SelectItem value="platform_admin">Platform Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Suspended">Suspended</SelectItem>
                  <SelectItem value="Expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Function</label>
              <Select value={functionFilter} onValueChange={setFunctionFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Functions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Functions</SelectItem>
                  <SelectItem value="*">All Functions (*)</SelectItem>
                  <SelectItem value="fusion-optimization-engine">Optimization Engine</SelectItem>
                  <SelectItem value="fusion-calibration-engine">Calibration Engine</SelectItem>
                  <SelectItem value="fusion-oversight-engine">Oversight Engine</SelectItem>
                  <SelectItem value="fusion-orchestrator-engine">Orchestrator Engine</SelectItem>
                  <SelectItem value="recommendation-engine">Recommendation Engine</SelectItem>
                  <SelectItem value="behavioral-correlation-engine">Behavioral Correlation</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Table */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Policy Name</TableHead>
                <TableHead>Target Role</TableHead>
                <TableHead>Function</TableHead>
                <TableHead>Condition</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPolicies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-gray-500">
                    No policies found
                  </TableCell>
                </TableRow>
              ) : (
                filteredPolicies.map((policy) => (
                  <TableRow key={policy.id}>
                    <TableCell className="font-medium">{policy.policy_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{policy.target_role}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{policy.target_function}</TableCell>
                    <TableCell className="text-sm">{policy.condition_type}</TableCell>
                    <TableCell>
                      <Badge className={getActionBadgeColor(policy.action_type)}>
                        {policy.action_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusBadgeColor(policy.status)}>
                        {policy.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(policy.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-sm">
                      {policy.expires_at ? (
                        <div>
                          <div>{new Date(policy.expires_at).toLocaleDateString()}</div>
                          {policy.hours_until_expiry !== null && policy.hours_until_expiry > 0 && (
                            <div className="text-xs text-gray-500">
                              ({Math.round(policy.hours_until_expiry)}h left)
                            </div>
                          )}
                        </div>
                      ) : (
                        'Never'
                      )}
                    </TableCell>
                    <TableCell>
                      {policy.status === 'Active' && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => suspendPolicy(policy.id)}
                        >
                          <Pause className="mr-2 h-4 w-4" />
                          Suspend
                        </Button>
                      )}
                    </TableCell>
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
