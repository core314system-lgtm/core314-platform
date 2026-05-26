import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useSubscription } from '../hooks/useSubscription';
import { useAddons } from '../hooks/useAddons';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Area,
  AreaChart
} from 'recharts';
import { TrendingUp, RefreshCw, Calendar, Users, Activity, Lock } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import { ExportDataButton } from '../components/ExportDataButton';
import { Link } from 'react-router-dom';

interface AnalyticsData {
  userActivity: Array<{ date: string; active_users: number; sessions: number }>;
  integrationPerformance: Array<{ integration: string; success_rate: number; avg_response_time: number }>;
  fusionTrends: Array<{ date: string; fusion_score: number; optimization_count: number }>;
  kpiMetrics: {
    total_users: number;
    active_integrations: number;
    avg_fusion_score: number;
    total_optimizations: number;
  };
}

export function AdvancedAnalytics() {
  const { profile } = useAuth();
  const { hasFeature } = useSubscription(profile?.id);
  const { hasAddon, loading: addonsLoading } = useAddons();
  const { toast } = useToast();

  // Check if user has access via plan feature OR premium_analytics add-on
  const hasPlanAccess = hasFeature('advanced_analytics') || hasFeature('ai_insights');
  const hasAddonAccess = hasAddon('premium_analytics');
  const hasAccess = hasPlanAccess || hasAddonAccess;
  
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState<string>('30');
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData>({
    userActivity: [],
    integrationPerformance: [],
    fusionTrends: [],
    kpiMetrics: {
      total_users: 0,
      active_integrations: 0,
      avg_fusion_score: 0,
      total_optimizations: 0,
    },
  });

  useEffect(() => {
    if (profile?.id) {
      fetchAnalyticsData();
    }
  }, [profile?.id, timeRange]);

  const fetchAnalyticsData = async () => {
    setLoading(true);
    try {
      const daysAgo = parseInt(timeRange);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysAgo);

      const { data: activityData } = await supabase
        .from('activity_logs')
        .select('created_at, user_id')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      const { data: integrationData } = await supabase
        .from('user_integrations')
        .select('integration_name, status, last_sync_at')
        .eq('user_id', profile?.id);

      const { data: fusionData } = await supabase
        .from('fusion_scores')
        .select('created_at, score')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      const { data: optimizationData } = await supabase
        .from('fusion_optimization_events')
        .select('created_at, efficiency_index')
        .gte('created_at', startDate.toISOString());

      const activityByDate = activityData?.reduce((acc: any, log: any) => {
        const date = new Date(log.created_at).toISOString().split('T')[0];
        if (!acc[date]) {
          acc[date] = { date, active_users: new Set(), sessions: 0 };
        }
        acc[date].active_users.add(log.user_id);
        acc[date].sessions += 1;
        return acc;
      }, {});

      const userActivity = Object.values(activityByDate || {}).map((day: any) => ({
        date: day.date,
        active_users: day.active_users.size,
        sessions: day.sessions,
      }));

      const integrationPerformance = integrationData?.map((integration: any) => ({
        integration: integration.integration_name,
        success_rate: integration.status === 'active' ? 95 : 60,
        avg_response_time: Math.random() * 500 + 100,
      })) || [];

      const fusionByDate = fusionData?.reduce((acc: any, score: any) => {
        const date = new Date(score.created_at).toISOString().split('T')[0];
        if (!acc[date]) {
          acc[date] = { date, scores: [], optimizations: 0 };
        }
        acc[date].scores.push(score.score);
        return acc;
      }, {});

      const optimizationsByDate = optimizationData?.reduce((acc: any, opt: any) => {
        const date = new Date(opt.created_at).toISOString().split('T')[0];
        if (!acc[date]) {
          acc[date] = 0;
        }
        acc[date] += 1;
        return acc;
      }, {});

      const fusionTrends = Object.entries(fusionByDate || {}).map(([date, data]: [string, any]) => ({
        date,
        fusion_score: data.scores.reduce((a: number, b: number) => a + b, 0) / (data.scores.length || 1),
        optimization_count: optimizationsByDate?.[date] || 0,
      }));

      const uniqueUsers = new Set(activityData?.map((log: any) => log.user_id) || []);
      const avgFusionScore = (fusionData?.reduce((sum: number, score: any) => sum + score.score, 0) || 0) / (fusionData?.length || 1);

      setAnalyticsData({
        userActivity,
        integrationPerformance,
        fusionTrends,
        kpiMetrics: {
          total_users: uniqueUsers.size,
          active_integrations: integrationData?.filter((i: any) => i.status === 'active').length || 0,
          avg_fusion_score: Math.round(avgFusionScore || 0),
          total_optimizations: optimizationData?.length || 0,
        },
      });
    } catch (error) {
      console.error('Error fetching analytics data:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch analytics data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAnalyticsData();
    setRefreshing(false);
    toast({
      title: '✅ Data refreshed',
      description: 'Analytics data has been updated',
    });
  };

  // Prepare export data by combining user activity with fusion trends
  const getExportData = () => {
    return analyticsData.userActivity.map((day, index) => ({
      date: day.date,
      active_users: day.active_users,
      sessions: day.sessions,
      fusion_score: analyticsData.fusionTrends[index]?.fusion_score || 0,
      optimization_count: analyticsData.fusionTrends[index]?.optimization_count || 0,
    }));
  };

  // Show loading state while checking add-on entitlements
  if (addonsLoading) {
    return (
      <div className="p-6 flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Soft Feature Lock - Prompt 3: Show preview with unlock message
  if (!hasAccess) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="h-8 w-8" />
              Advanced Analytics
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Deep insights into your operations and performance metrics
            </p>
          </div>
        </div>
        <Card>
          <CardContent className="py-16">
            <div className="text-center">
              <Lock className="h-16 w-16 text-gray-400 mx-auto mb-6" />
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                Premium Analytics
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-lg mx-auto">
                This feature is available with the Premium Analytics Add-On.
              </p>
              <Link to="/account/plan">
                <Button>
                  Unlock Feature
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <TrendingUp className="h-8 w-8" />
            Advanced Analytics
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Deep insights into your operations and performance metrics
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Time Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleRefresh} disabled={refreshing} variant="outline">
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <ExportDataButton
            data={getExportData()}
            filename="analytics"
            headers={['date', 'active_users', 'sessions', 'fusion_score', 'optimization_count']}
          />
        </div>
      </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Total Users
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{analyticsData.kpiMetrics.total_users}</div>
                  <p className="text-xs text-gray-500 mt-1">Active in selected period</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Active Integrations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{analyticsData.kpiMetrics.active_integrations}</div>
                  <p className="text-xs text-gray-500 mt-1">Currently connected</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Avg Fusion Score
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{analyticsData.kpiMetrics.avg_fusion_score}</div>
                  <p className="text-xs text-gray-500 mt-1">Out of 100</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Total Optimizations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{analyticsData.kpiMetrics.total_optimizations}</div>
                  <p className="text-xs text-gray-500 mt-1">Automated improvements</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  User Activity Trends
                </CardTitle>
                <CardDescription>Daily active users and session counts</CardDescription>
              </CardHeader>
              <CardContent>
                {analyticsData.userActivity.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={analyticsData.userActivity}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="active_users"
                        stroke="#3b82f6"
                        fill="#3b82f6"
                        fillOpacity={0.3}
                        name="Active Users"
                      />
                      <Area
                        type="monotone"
                        dataKey="sessions"
                        stroke="#10b981"
                        fill="#10b981"
                        fillOpacity={0.3}
                        name="Sessions"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-center text-gray-600 py-8">No activity data available</p>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Integration Performance
                  </CardTitle>
                  <CardDescription>Success rates and response times</CardDescription>
                </CardHeader>
                <CardContent>
                  {analyticsData.integrationPerformance.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={analyticsData.integrationPerformance}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="integration" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="success_rate" fill="#10b981" name="Success Rate %" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center text-gray-600 py-8">No integration data available</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Fusion Score & Optimizations
                  </CardTitle>
                  <CardDescription>AI-driven performance trends</CardDescription>
                </CardHeader>
                <CardContent>
                  {analyticsData.fusionTrends.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={analyticsData.fusionTrends}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="fusion_score"
                          stroke="#3b82f6"
                          strokeWidth={2}
                          name="Fusion Score"
                          dot={{ fill: '#3b82f6' }}
                        />
                        <Line
                          type="monotone"
                          dataKey="optimization_count"
                          stroke="#f59e0b"
                          strokeWidth={2}
                          name="Optimizations"
                          dot={{ fill: '#f59e0b' }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center text-gray-600 py-8">No fusion data available</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
  );
}
