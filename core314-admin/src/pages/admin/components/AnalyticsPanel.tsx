import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Users, Activity, CheckCircle, TrendingUp, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

interface AnalyticsData {
  totalUsers: number;
  activeUsers: number;
  onboardingCompletion: number;
  avgQualityScore: number;
  dailyActiveUsers: { date: string; users: number }[];
  featureUsage: { feature: string; count: number; userPercentage: number }[];
  funnelData: { step: string; count: number; percentage: number }[];
  atRiskUsers: { user_id: string; name: string; email: string; lastEvent: string; totalScore: number }[];
}

export default function AnalyticsPanel() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalyticsData | null>(null);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);

      const { count: totalUsers } = await supabase
        .from('beta_users')
        .select('*', { count: 'exact', head: true });

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const { data: activeUsersData } = await supabase
        .from('beta_events_admin_view')
        .select('user_id')
        .gte('created_at', sevenDaysAgo.toISOString());
      
      const activeUsers = new Set(activeUsersData?.map(e => e.user_id) || []).size;

      const { count: completedCount } = await supabase
        .from('beta_users')
        .select('*', { count: 'exact', head: true })
        .eq('onboarding_completed', true);
      
      const onboardingCompletion = totalUsers ? Math.round((completedCount || 0) / totalUsers * 100) : 0;

      const { data: scoresData } = await supabase
        .from('user_quality_scores')
        .select('total_score');
      
      const avgQualityScore = scoresData && scoresData.length > 0
        ? Math.round(scoresData.reduce((sum, s) => sum + s.total_score, 0) / scoresData.length)
        : 0;

      const dailyActiveUsers = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const startOfDay = new Date(date.setHours(0, 0, 0, 0)).toISOString();
        const endOfDay = new Date(date.setHours(23, 59, 59, 999)).toISOString();

        const { data: dayEvents } = await supabase
          .from('beta_events_admin_view')
          .select('user_id')
          .gte('created_at', startOfDay)
          .lte('created_at', endOfDay);

        const uniqueUsers = new Set(dayEvents?.map(e => e.user_id) || []).size;
        dailyActiveUsers.push({
          date: new Date(startOfDay).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          users: uniqueUsers,
        });
      }

      const { data: eventsData } = await supabase
        .from('beta_events_admin_view')
        .select('event_name, user_id');

      const featureMap = new Map<string, Set<string>>();
      eventsData?.forEach(e => {
        if (!featureMap.has(e.event_name)) {
          featureMap.set(e.event_name, new Set());
        }
        featureMap.get(e.event_name)!.add(e.user_id);
      });

      const featureUsage = Array.from(featureMap.entries())
        .map(([feature, users]) => ({
          feature,
          count: users.size,
          userPercentage: totalUsers ? Math.round(users.size / totalUsers * 100) : 0,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      const { data: allBetaUsers } = await supabase
        .from('beta_users')
        .select('user_id, onboarding_completed');

      const startedOnboarding = allBetaUsers?.length || 0;
      const completedOnboarding = allBetaUsers?.filter(u => u.onboarding_completed).length || 0;

      const { data: usersWithEvents } = await supabase
        .from('beta_events_admin_view')
        .select('user_id, created_at');
      const firstFeatureUsage = new Set(usersWithEvents?.map(e => e.user_id) || []).size;

      const userEventDays = new Map<string, Set<string>>();
      usersWithEvents?.forEach(e => {
        const day = new Date(e.created_at).toDateString();
        if (!userEventDays.has(e.user_id)) {
          userEventDays.set(e.user_id, new Set());
        }
        userEventDays.get(e.user_id)!.add(day);
      });
      const secondSession = Array.from(userEventDays.values()).filter(days => days.size >= 2).length;

      const userEventCounts = new Map<string, number>();
      usersWithEvents?.forEach(e => {
        userEventCounts.set(e.user_id, (userEventCounts.get(e.user_id) || 0) + 1);
      });
      const fivePlusEvents = Array.from(userEventCounts.values()).filter(count => count >= 5).length;

      const funnelData = [
        { step: 'Started Onboarding', count: startedOnboarding, percentage: 100 },
        { step: 'Completed Onboarding', count: completedOnboarding, percentage: startedOnboarding ? Math.round(completedOnboarding / startedOnboarding * 100) : 0 },
        { step: 'First Feature Usage', count: firstFeatureUsage, percentage: completedOnboarding ? Math.round(firstFeatureUsage / completedOnboarding * 100) : 0 },
        { step: 'Second Session', count: secondSession, percentage: firstFeatureUsage ? Math.round(secondSession / firstFeatureUsage * 100) : 0 },
        { step: '5+ Total Events', count: fivePlusEvents, percentage: secondSession ? Math.round(fivePlusEvents / secondSession * 100) : 0 },
      ];

      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      const { data: recentEvents } = await supabase
        .from('beta_events_admin_view')
        .select('user_id, created_at')
        .gte('created_at', threeDaysAgo.toISOString());

      const activeUserIds = new Set(recentEvents?.map(e => e.user_id) || []);

      const { data: allUsers } = await supabase
        .from('beta_users')
        .select('user_id');

      const atRiskUserIds = allUsers?.filter(u => !activeUserIds.has(u.user_id)).map(u => u.user_id) || [];

      if (atRiskUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', atRiskUserIds);

        const { data: scores } = await supabase
          .from('user_quality_scores')
          .select('user_id, total_score')
          .in('user_id', atRiskUserIds);

        const { data: lastEvents } = await supabase
          .from('beta_events_admin_view')
          .select('user_id, created_at')
          .in('user_id', atRiskUserIds)
          .order('created_at', { ascending: false });

        const lastEventMap = new Map<string, string>();
        lastEvents?.forEach(e => {
          if (!lastEventMap.has(e.user_id)) {
            lastEventMap.set(e.user_id, e.created_at);
          }
        });

        const atRiskUsers = atRiskUserIds.map(userId => {
          const profile = profiles?.find(p => p.id === userId);
          const score = scores?.find(s => s.user_id === userId);
          return {
            user_id: userId,
            name: profile?.full_name || 'No name',
            email: profile?.email || 'Unknown',
            lastEvent: lastEventMap.get(userId) || 'Never',
            totalScore: score?.total_score || 0,
          };
        }).slice(0, 10);

        setData({
          totalUsers: totalUsers || 0,
          activeUsers,
          onboardingCompletion,
          avgQualityScore,
          dailyActiveUsers,
          featureUsage,
          funnelData,
          atRiskUsers,
        });
      } else {
        setData({
          totalUsers: totalUsers || 0,
          activeUsers,
          onboardingCompletion,
          avgQualityScore,
          dailyActiveUsers,
          featureUsage,
          funnelData,
          atRiskUsers: [],
        });
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg">
        <p className="text-gray-600">No analytics data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-500">Total Beta Users</h3>
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{data.totalUsers}</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-500">Active Users (7d)</h3>
            <Activity className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{data.activeUsers}</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-500">Onboarding Complete</h3>
            <CheckCircle className="w-5 h-5 text-purple-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{data.onboardingCompletion}%</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-500">Avg Quality Score</h3>
            <TrendingUp className="w-5 h-5 text-orange-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{data.avgQualityScore}</p>
        </div>
      </div>

      {/* 7-Day DAU Chart */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Active Users (Last 7 Days)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data.dailyActiveUsers}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="users" stroke="#2563eb" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Feature Usage Leaderboard */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Feature Usage Leaderboard</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Feature</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Users</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">% of Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data.featureUsage.map((item, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-2 text-sm text-gray-900">{item.feature}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">{item.count}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">{item.userPercentage}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Onboarding Funnel */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Onboarding Funnel</h3>
          <div className="space-y-3">
            {data.funnelData.map((step, idx) => (
              <div key={idx}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700">{step.step}</span>
                  <span className="text-sm text-gray-600">{step.count} users ({step.percentage}%)</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-6">
                  <div
                    className="bg-blue-600 h-6 rounded-full flex items-center justify-end pr-2"
                    style={{ width: `${step.percentage}%` }}
                  >
                    <span className="text-xs font-medium text-white">{step.percentage}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* At Risk Users */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          <h3 className="text-lg font-semibold text-gray-900">At Risk Users (No Activity in 3+ Days)</h3>
        </div>
        {data.atRiskUsers.length === 0 ? (
          <p className="text-sm text-gray-600">No at-risk users found. Great job!</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Last Event</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data.atRiskUsers.map((user) => (
                  <tr key={user.user_id}>
                    <td className="px-4 py-2 text-sm text-gray-900">{user.name}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">{user.email}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">
                      {user.lastEvent === 'Never' ? 'Never' : new Date(user.lastEvent).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600">{user.totalScore}</td>
                    <td className="px-4 py-2 text-sm">
                      <a
                        href={`mailto:${user.email}`}
                        className="text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Message User
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
