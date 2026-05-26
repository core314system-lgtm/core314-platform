import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Loader2, RefreshCw, Users, Layers, DollarSign, Radio, FileText, HeartPulse, Activity, Wifi } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface PlatformStats {
  totalUsers: number;
  activeUsers7d: number;
  activeUsers30d: number;
  totalIntegrations: number;
  activeIntegrations: number;
  totalSignals: number;
  signalsThisWeek: number;
  signalsThisMonth: number;
  totalBriefs: number;
  briefsThisWeek: number;
  briefsThisMonth: number;
  avgHealthScore: number;
  activeSubscriptions: number;
  trialingSubscriptions: number;
  mrr: number;
}

export function RealMetricsDashboard() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activityTrend, setActivityTrend] = useState<{ date: string; briefs: number; signals: number }[]>([]);

  const fetchStats = async () => {
    try {
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const [
        profilesRes,
        integrationsRes,
        activeIntRes,
        signalsRes,
        signalsWeekRes,
        signalsMonthRes,
        briefsRes,
        briefsWeekRes,
        briefsMonthRes,
        healthRes,
        subsRes,
        activityRes,
        briefTrendRes,
        signalTrendRes,
      ] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('user_integrations').select('id', { count: 'exact', head: true }),
        supabase.from('user_integrations').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('operational_signals').select('id', { count: 'exact', head: true }),
        supabase.from('operational_signals').select('id', { count: 'exact', head: true }).gte('detected_at', sevenDaysAgo),
        supabase.from('operational_signals').select('id', { count: 'exact', head: true }).gte('detected_at', monthStart),
        supabase.from('operational_briefs').select('id', { count: 'exact', head: true }),
        supabase.from('operational_briefs').select('id', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo),
        supabase.from('operational_briefs').select('id', { count: 'exact', head: true }).gte('created_at', monthStart),
        supabase.from('operational_health_scores').select('score').order('calculated_at', { ascending: false }).limit(50),
        supabase.from('user_subscriptions').select('status, plan_name'),
        supabase.from('user_activity').select('id', { count: 'exact', head: true }).gte('created_at', thirtyDaysAgo),
        supabase.from('operational_briefs').select('created_at').gte('created_at', thirtyDaysAgo).order('created_at', { ascending: true }),
        supabase.from('operational_signals').select('detected_at').gte('detected_at', thirtyDaysAgo).order('detected_at', { ascending: true }),
      ]);

      // Calculate active users from user_activity or profiles with recent activity
      const activeUsersRes = await supabase
        .from('user_activity')
        .select('user_id')
        .gte('created_at', sevenDaysAgo);
      const activeUsers7d = new Set((activeUsersRes.data || []).map(a => a.user_id)).size;

      const activeUsers30dRes = await supabase
        .from('user_activity')
        .select('user_id')
        .gte('created_at', thirtyDaysAgo);
      const activeUsers30d = new Set((activeUsers30dRes.data || []).map(a => a.user_id)).size;

      // Calculate MRR from subscriptions
      const PLAN_PRICES: Record<string, number> = {
        'Intelligence': 299,
        'Command Center': 799,
        'Enterprise': 0, // Custom pricing
      };
      const activeSubs = (subsRes.data || []).filter(s => s.status === 'active' || s.status === 'trialing');
      const mrr = activeSubs.reduce((total, s) => total + (PLAN_PRICES[s.plan_name] || 0), 0);
      const trialingSubs = activeSubs.filter(s => s.status === 'trialing').length;

      // Avg health score
      const healthScores = (healthRes.data || []).map(h => h.score);
      const avgHealth = healthScores.length > 0
        ? Math.round(healthScores.reduce((a, b) => a + b, 0) / healthScores.length)
        : 0;

      setStats({
        totalUsers: profilesRes.count || 0,
        activeUsers7d,
        activeUsers30d,
        totalIntegrations: integrationsRes.count || 0,
        activeIntegrations: activeIntRes.count || 0,
        totalSignals: signalsRes.count || 0,
        signalsThisWeek: signalsWeekRes.count || 0,
        signalsThisMonth: signalsMonthRes.count || 0,
        totalBriefs: briefsRes.count || 0,
        briefsThisWeek: briefsWeekRes.count || 0,
        briefsThisMonth: briefsMonthRes.count || 0,
        avgHealthScore: avgHealth,
        activeSubscriptions: activeSubs.length,
        trialingSubscriptions: trialingSubs,
        mrr,
      });

      // Build activity trend
      const dayMap = new Map<string, { briefs: number; signals: number }>();
      (briefTrendRes.data || []).forEach(b => {
        const day = new Date(b.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const existing = dayMap.get(day) || { briefs: 0, signals: 0 };
        existing.briefs++;
        dayMap.set(day, existing);
      });
      (signalTrendRes.data || []).forEach(s => {
        const day = new Date(s.detected_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const existing = dayMap.get(day) || { briefs: 0, signals: 0 };
        existing.signals++;
        dayMap.set(day, existing);
      });
      setActivityTrend(Array.from(dayMap.entries()).map(([date, data]) => ({ date, ...data })));

    } catch (error) {
      console.error('Error fetching platform stats:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchStats(); }, []);
  const handleRefresh = () => { setRefreshing(true); fetchStats(); };

  if (loading || !stats) {
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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Platform Metrics</h1>
          <p className="text-gray-600 dark:text-gray-400">Real-time KPIs from live production data</p>
        </div>
        <Button onClick={handleRefresh} disabled={refreshing} variant="outline">
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Users & Revenue Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">
              {stats.activeUsers7d} active (7d) / {stats.activeUsers30d} active (30d)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">MRR</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.mrr.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              ARR: ${(stats.mrr * 12).toLocaleString()} / {stats.activeSubscriptions} active subs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Integrations</CardTitle>
            <Wifi className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeIntegrations}</div>
            <p className="text-xs text-muted-foreground">
              {stats.totalIntegrations} total ({stats.totalIntegrations - stats.activeIntegrations} inactive)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Health Score</CardTitle>
            <HeartPulse className="h-4 w-4 text-sky-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgHealthScore}/100</div>
            <p className="text-xs text-muted-foreground">Platform average</p>
          </CardContent>
        </Card>
      </div>

      {/* Intelligence Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Signals</CardTitle>
            <Radio className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalSignals}</div>
            <p className="text-xs text-muted-foreground">
              {stats.signalsThisWeek} this week / {stats.signalsThisMonth} this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Briefs</CardTitle>
            <FileText className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalBriefs}</div>
            <p className="text-xs text-muted-foreground">
              {stats.briefsThisWeek} this week / {stats.briefsThisMonth} this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Subscriptions</CardTitle>
            <Layers className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeSubscriptions}</div>
            <p className="text-xs text-muted-foreground">
              {stats.trialingSubscriptions} trialing
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Platform Activity</CardTitle>
            <Activity className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.signalsThisWeek + stats.briefsThisWeek}
            </div>
            <p className="text-xs text-muted-foreground">Intelligence events this week</p>
          </CardContent>
        </Card>
      </div>

      {/* Activity Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Intelligence Activity (Last 30 Days)</CardTitle>
          <CardDescription>Operational briefs and signals generated over time</CardDescription>
        </CardHeader>
        <CardContent>
          {activityTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={activityTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="briefs" stroke="#6366f1" strokeWidth={2} name="Briefs" />
                <Line type="monotone" dataKey="signals" stroke="#f97316" strokeWidth={2} name="Signals" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              No activity data yet. Metrics will populate as users generate briefs and signals.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
