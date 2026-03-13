import { useEffect, useState } from 'react';
import { fetchAdminData } from '../../lib/adminDataProxy';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Loader2, RefreshCw, FileText, TrendingUp, Target, Users } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Brief {
  id: string;
  user_id: string;
  title: string;
  confidence: number;
  health_score: number | null;
  brief_type: string;
  created_at: string;
  profiles: { full_name: string; email: string }[] | { full_name: string; email: string } | null;
}

export function BriefTracker() {
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBriefs = async () => {
    try {
      const result = await fetchAdminData<{ data: Brief[]; tableExists: boolean }>('briefs');
      if (!result.tableExists) {
        console.warn('operational_briefs table does not exist yet. Run migrations.');
      }
      setBriefs(result.data || []);
    } catch (error) {
      console.error('Error fetching briefs:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchBriefs(); }, []);
  const handleRefresh = () => { setRefreshing(true); fetchBriefs(); };

  const totalBriefs = briefs.length;
  const avgConfidence = briefs.length > 0
    ? Math.round(briefs.reduce((sum, b) => sum + (b.confidence || 0), 0) / briefs.length)
    : 0;

  // Briefs per user
  const userBriefMap = new Map<string, { name: string; email: string; count: number; avgConf: number }>();
  briefs.forEach(b => {
    const prof = Array.isArray(b.profiles) ? b.profiles[0] : b.profiles;
    const existing = userBriefMap.get(b.user_id);
    if (existing) {
      existing.count++;
      existing.avgConf = Math.round((existing.avgConf * (existing.count - 1) + (b.confidence || 0)) / existing.count);
    } else {
      userBriefMap.set(b.user_id, {
        name: prof?.full_name || 'Unknown',
        email: prof?.email || '',
        count: 1,
        avgConf: b.confidence || 0,
      });
    }
  });
  const userBriefData = Array.from(userBriefMap.entries())
    .map(([userId, data]) => ({ userId, ...data }))
    .sort((a, b) => b.count - a.count);

  // Briefs per day (last 30 days)
  const dailyMap = new Map<string, number>();
  briefs.forEach(b => {
    const day = new Date(b.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    dailyMap.set(day, (dailyMap.get(day) || 0) + 1);
  });
  const dailyData = Array.from(dailyMap.entries()).map(([date, count]) => ({ date, count })).reverse();

  // Unique users who generated briefs
  const uniqueUsers = userBriefMap.size;

  // This month's briefs
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonthBriefs = briefs.filter(b => new Date(b.created_at) >= monthStart).length;

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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Brief Tracker</h1>
          <p className="text-gray-600 dark:text-gray-400">Operational brief generation across all users</p>
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
            <CardTitle className="text-sm font-medium">Total Briefs</CardTitle>
            <FileText className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalBriefs}</div>
            <p className="text-xs text-muted-foreground">{thisMonthBriefs} this month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Confidence</CardTitle>
            <Target className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgConfidence}%</div>
            <p className="text-xs text-muted-foreground">Data quality indicator</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{uniqueUsers}</div>
            <p className="text-xs text-muted-foreground">Users generating briefs</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Generation Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-sky-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {uniqueUsers > 0 ? (totalBriefs / uniqueUsers).toFixed(1) : '0'}
            </div>
            <p className="text-xs text-muted-foreground">Avg briefs per user</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Card>
        <CardHeader>
          <CardTitle>Brief Generation Over Time</CardTitle>
          <CardDescription>Daily brief generation count</CardDescription>
        </CardHeader>
        <CardContent>
          {dailyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#6366f1" name="Briefs Generated" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-muted-foreground">No briefs generated yet</div>
          )}
        </CardContent>
      </Card>

      {/* Per-User Breakdown */}
      {userBriefData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Briefs per User</CardTitle>
            <CardDescription>Usage and confidence by user</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Briefs</TableHead>
                  <TableHead className="text-right">Avg Confidence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userBriefData.map(u => (
                  <TableRow key={u.userId}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell className="text-right font-bold">{u.count}</TableCell>
                    <TableCell className="text-right">
                      <Badge className={u.avgConf >= 70 ? 'bg-green-100 text-green-800' : u.avgConf >= 40 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}>
                        {u.avgConf}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Recent Briefs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Briefs</CardTitle>
          <CardDescription>{briefs.length} briefs across all users</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Health Score</TableHead>
                <TableHead>Generated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {briefs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No operational briefs generated yet. Briefs appear when users click "Generate Brief" in the app.
                  </TableCell>
                </TableRow>
              ) : (
                briefs.slice(0, 50).map(brief => (
                  <TableRow key={brief.id}>
                    <TableCell className="font-medium">{(Array.isArray(brief.profiles) ? brief.profiles[0] : brief.profiles)?.full_name || 'Unknown'}</TableCell>
                    <TableCell className="max-w-xs truncate">{brief.title}</TableCell>
                    <TableCell><Badge variant="outline">{brief.brief_type || 'operational'}</Badge></TableCell>
                    <TableCell>
                      <Badge className={
                        (brief.confidence || 0) >= 70 ? 'bg-green-100 text-green-800' :
                        (brief.confidence || 0) >= 40 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                      }>
                        {brief.confidence || 0}%
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {brief.health_score !== null ? (
                        <span className="font-medium">{brief.health_score}/100</span>
                      ) : (
                        <span className="text-muted-foreground">N/A</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {new Date(brief.created_at).toLocaleDateString()}
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
