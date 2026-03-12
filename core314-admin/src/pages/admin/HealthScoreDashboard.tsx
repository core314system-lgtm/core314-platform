import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Loader2, RefreshCw, HeartPulse, TrendingUp, AlertTriangle, Shield } from 'lucide-react';
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';

interface HealthScore {
  id: string;
  user_id: string;
  score: number;
  label: string;
  score_breakdown: {
    base_score?: number;
    signal_penalties?: number;
    integration_coverage?: number;
    data_freshness_bonus?: number;
    connected_integrations?: number;
    active_signals?: number;
  } | null;
  signal_count: number;
  calculated_at: string;
  profiles?: { full_name: string; email: string } | null;
}

const LABEL_COLORS: Record<string, string> = {
  Healthy: '#22c55e',
  Moderate: '#eab308',
  'At Risk': '#f97316',
  Critical: '#ef4444',
};

export function HealthScoreDashboard() {
  const [scores, setScores] = useState<HealthScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchScores = async () => {
    try {
      const { data, error } = await supabase
        .from('operational_health_scores')
        .select(`*, profiles:user_id (full_name, email)`)
        .order('calculated_at', { ascending: false })
        .limit(500);

      if (error) throw error;
      setScores(data || []);
    } catch (error) {
      console.error('Error fetching health scores:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchScores(); }, []);
  const handleRefresh = () => { setRefreshing(true); fetchScores(); };

  // Get latest score per user
  const latestByUser = new Map<string, HealthScore>();
  scores.forEach(s => {
    if (!latestByUser.has(s.user_id)) {
      latestByUser.set(s.user_id, s);
    }
  });
  const latestScores = Array.from(latestByUser.values());

  const avgScore = latestScores.length > 0
    ? Math.round(latestScores.reduce((sum, s) => sum + s.score, 0) / latestScores.length)
    : 0;

  const healthyCount = latestScores.filter(s => s.score >= 80).length;
  const moderateCount = latestScores.filter(s => s.score >= 60 && s.score < 80).length;
  const atRiskCount = latestScores.filter(s => s.score >= 40 && s.score < 60).length;
  const criticalCount = latestScores.filter(s => s.score < 40).length;

  const distributionData = [
    { name: 'Healthy (80-100)', value: healthyCount },
    { name: 'Moderate (60-79)', value: moderateCount },
    { name: 'At Risk (40-59)', value: atRiskCount },
    { name: 'Critical (0-39)', value: criticalCount },
  ].filter(d => d.value > 0);

  const DIST_COLORS = ['#22c55e', '#eab308', '#f97316', '#ef4444'];

  // Score trend over time (all scores)
  const trendMap = new Map<string, { total: number; count: number }>();
  scores.forEach(s => {
    const day = new Date(s.calculated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const existing = trendMap.get(day);
    if (existing) {
      existing.total += s.score;
      existing.count++;
    } else {
      trendMap.set(day, { total: s.score, count: 1 });
    }
  });
  const trendData = Array.from(trendMap.entries())
    .map(([date, { total, count }]) => ({ date, avgScore: Math.round(total / count) }))
    .reverse();

  const getScoreBadge = (score: number) => {
    if (score >= 80) return <Badge className="bg-green-100 text-green-800">Healthy</Badge>;
    if (score >= 60) return <Badge className="bg-yellow-100 text-yellow-800">Moderate</Badge>;
    if (score >= 40) return <Badge className="bg-orange-100 text-orange-800">At Risk</Badge>;
    return <Badge className="bg-red-100 text-red-800">Critical</Badge>;
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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Health Scores</h1>
          <p className="text-gray-600 dark:text-gray-400">Operational health across all users</p>
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
            <CardTitle className="text-sm font-medium">Avg Health Score</CardTitle>
            <HeartPulse className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgScore}/100</div>
            <p className="text-xs text-muted-foreground">{latestScores.length} users scored</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Healthy Users</CardTitle>
            <Shield className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{healthyCount}</div>
            <p className="text-xs text-muted-foreground">Score 80+</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">At Risk</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{atRiskCount}</div>
            <p className="text-xs text-muted-foreground">Score 40-59</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Critical</CardTitle>
            <TrendingUp className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{criticalCount}</div>
            <p className="text-xs text-muted-foreground">Score below 40</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Score Distribution</CardTitle>
            <CardDescription>Current health status across users</CardDescription>
          </CardHeader>
          <CardContent>
            {distributionData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={distributionData} cx="50%" cy="50%" outerRadius={80} dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {distributionData.map((_, i) => (
                      <Cell key={i} fill={DIST_COLORS[i % DIST_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">No health scores yet</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Score Trend</CardTitle>
            <CardDescription>Average health score over time</CardDescription>
          </CardHeader>
          <CardContent>
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Line type="monotone" dataKey="avgScore" stroke="#6366f1" strokeWidth={2} name="Avg Score" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">No trend data yet</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* User Health Table */}
      <Card>
        <CardHeader>
          <CardTitle>User Health Scores</CardTitle>
          <CardDescription>Latest score per user</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Integrations</TableHead>
                <TableHead>Active Signals</TableHead>
                <TableHead>Last Calculated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {latestScores.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No health scores calculated yet. Scores are generated when users create operational briefs.
                  </TableCell>
                </TableRow>
              ) : (
                latestScores.sort((a, b) => a.score - b.score).map(score => (
                  <TableRow key={score.id}>
                    <TableCell className="font-medium">{score.profiles?.full_name || 'Unknown'}</TableCell>
                    <TableCell className="text-muted-foreground">{score.profiles?.email || ''}</TableCell>
                    <TableCell className="font-bold text-lg">{score.score}</TableCell>
                    <TableCell>{getScoreBadge(score.score)}</TableCell>
                    <TableCell>{score.score_breakdown?.connected_integrations ?? 'N/A'}</TableCell>
                    <TableCell>{score.score_breakdown?.active_signals ?? score.signal_count}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {new Date(score.calculated_at).toLocaleDateString()}
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
