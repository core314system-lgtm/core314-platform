import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Loader2, RefreshCw, AlertTriangle, Radio, TrendingUp, Shield } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

interface Signal {
  id: string;
  user_id: string;
  signal_type: string;
  severity: string;
  confidence: number;
  description: string;
  source_integration: string;
  is_active: boolean;
  detected_at: string;
  created_at: string;
  profiles?: { full_name: string; email: string } | null;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
};

const SOURCE_COLORS: Record<string, string> = {
  slack: '#4A154B',
  hubspot: '#ff7a59',
  quickbooks: '#2CA01C',
};

export function SignalIntelligence() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSignals = async () => {
    try {
      const { data, error } = await supabase
        .from('operational_signals')
        .select(`*, profiles:user_id (full_name, email)`)
        .order('detected_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      setSignals(data || []);
    } catch (error) {
      console.error('Error fetching signals:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchSignals(); }, []);

  const handleRefresh = () => { setRefreshing(true); fetchSignals(); };

  const activeSignals = signals.filter(s => s.is_active);
  const totalSignals = signals.length;
  const criticalCount = signals.filter(s => s.severity === 'critical').length;
  const highCount = signals.filter(s => s.severity === 'high').length;

  const severityData = ['critical', 'high', 'medium', 'low'].map(sev => ({
    name: sev.charAt(0).toUpperCase() + sev.slice(1),
    value: signals.filter(s => s.severity === sev).length,
  })).filter(d => d.value > 0);

  const sourceData = ['slack', 'hubspot', 'quickbooks'].map(src => ({
    name: src.charAt(0).toUpperCase() + src.slice(1),
    value: signals.filter(s => s.source_integration === src).length,
  })).filter(d => d.value > 0);

  // Signals per user
  const userSignalMap = new Map<string, { name: string; email: string; count: number }>();
  signals.forEach(s => {
    const key = s.user_id;
    const existing = userSignalMap.get(key);
    if (existing) {
      existing.count++;
    } else {
      userSignalMap.set(key, {
        name: s.profiles?.full_name || 'Unknown',
        email: s.profiles?.email || '',
        count: 1,
      });
    }
  });
  const userSignalData = Array.from(userSignalMap.entries())
    .map(([userId, data]) => ({ userId, ...data }))
    .sort((a, b) => b.count - a.count);

  const getSeverityBadge = (severity: string) => {
    const colors: Record<string, string> = {
      critical: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
      high: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100',
      medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100',
      low: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
    };
    return <Badge className={colors[severity] || colors.low}>{severity.toUpperCase()}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Signal Intelligence</h1>
          <p className="text-gray-600 dark:text-gray-400">Cross-user operational signal monitoring</p>
        </div>
        <Button onClick={handleRefresh} disabled={refreshing} variant="outline">
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Signals</CardTitle>
            <Radio className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSignals}</div>
            <p className="text-xs text-muted-foreground">{activeSignals.length} currently active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Critical Signals</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{criticalCount}</div>
            <p className="text-xs text-muted-foreground">Require immediate attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">High Severity</CardTitle>
            <TrendingUp className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{highCount}</div>
            <p className="text-xs text-muted-foreground">Monitor closely</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Users with Signals</CardTitle>
            <Shield className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userSignalMap.size}</div>
            <p className="text-xs text-muted-foreground">Unique users generating signals</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Signals by Severity</CardTitle>
            <CardDescription>Distribution across severity levels</CardDescription>
          </CardHeader>
          <CardContent>
            {severityData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={severityData} cx="50%" cy="50%" outerRadius={80} dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {severityData.map((entry, i) => (
                      <Cell key={i} fill={SEVERITY_COLORS[entry.name.toLowerCase()] || '#9CA3AF'} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">No signals detected yet</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Signals by Source</CardTitle>
            <CardDescription>Which integrations generate signals</CardDescription>
          </CardHeader>
          <CardContent>
            {sourceData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={sourceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" name="Signals">
                    {sourceData.map((entry, i) => (
                      <Cell key={i} fill={SOURCE_COLORS[entry.name.toLowerCase()] || '#6366f1'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">No source data yet</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Per-User Breakdown */}
      {userSignalData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Signals per User</CardTitle>
            <CardDescription>Which users are generating the most signals</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Signal Count</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userSignalData.map(u => (
                  <TableRow key={u.userId}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell className="text-right font-bold">{u.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Recent Signals Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Signals</CardTitle>
          <CardDescription>{signals.length} signals across all users</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Detected</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {signals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    No operational signals detected yet. Signals will appear as users connect integrations and data flows in.
                  </TableCell>
                </TableRow>
              ) : (
                signals.slice(0, 50).map(signal => (
                  <TableRow key={signal.id}>
                    <TableCell className="font-medium">{signal.profiles?.full_name || 'Unknown'}</TableCell>
                    <TableCell>{signal.signal_type}</TableCell>
                    <TableCell>{getSeverityBadge(signal.severity)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{signal.source_integration}</Badge>
                    </TableCell>
                    <TableCell>{signal.confidence}%</TableCell>
                    <TableCell className="max-w-xs truncate">{signal.description}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {new Date(signal.detected_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Badge className={signal.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                        {signal.is_active ? 'Active' : 'Resolved'}
                      </Badge>
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
