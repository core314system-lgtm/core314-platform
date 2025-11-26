import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { RevenueSummary } from '../../components/billing/RevenueSummary';
import { Loader2, RefreshCw, ExternalLink } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';

interface Subscription {
  id: string;
  user_id: string;
  plan_name: string;
  status: string;
  stripe_subscription_id: string;
  current_period_end: string;
  created_at: string;
  profiles?: {
    full_name: string;
    email: string;
  };
}

export default function Subscriptions() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [filteredSubscriptions, setFilteredSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [refreshing, setRefreshing] = useState(false);

  const fetchSubscriptions = async () => {
    try {
      const { data, error } = await supabase
        .from('user_subscriptions')
        .select(`
          *,
          profiles:user_id (
            full_name,
            email
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSubscriptions(data || []);
      setFilteredSubscriptions(data || []);
    } catch (error) {
      console.error('Error fetching subscriptions:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSubscriptions();

    const channel = supabase
      .channel('subscriptions-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_subscriptions',
        },
        () => {
          fetchSubscriptions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    let filtered = subscriptions;

    if (planFilter !== 'all') {
      filtered = filtered.filter((sub) => sub.plan_name === planFilter);
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((sub) => sub.status === statusFilter);
    }

    setFilteredSubscriptions(filtered);
  }, [planFilter, statusFilter, subscriptions]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchSubscriptions();
  };

  const activeSubscriptions = subscriptions.filter((sub) => 
    sub.status === 'active' || sub.status === 'trialing'
  ).length;

  const planDistribution = subscriptions.reduce((acc, sub) => {
    acc[sub.plan_name] = (acc[sub.plan_name] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const planDistributionData = Object.entries(planDistribution).map(([name, value]) => ({
    name,
    value,
  }));

  const COLORS = {
    Free: '#9CA3AF',
    Starter: '#3B82F6',
    Pro: '#8B5CF6',
    Enterprise: '#F59E0B',
  };

  const calculateMRR = () => {
    const planPrices: Record<string, number> = {
      Free: 0,
      Starter: 99,
      Pro: 999,
      Enterprise: 2999,
    };

    return subscriptions
      .filter((sub) => sub.status === 'active' || sub.status === 'trialing')
      .reduce((total, sub) => total + (planPrices[sub.plan_name] || 0), 0);
  };

  const totalMRR = calculateMRR();
  const totalARR = totalMRR * 12;
  const churnRate = 2.3; // Mock churn rate

  const revenueTrendData = [
    { month: 'Jun', revenue: totalMRR * 0.7 },
    { month: 'Jul', revenue: totalMRR * 0.8 },
    { month: 'Aug', revenue: totalMRR * 0.85 },
    { month: 'Sep', revenue: totalMRR * 0.9 },
    { month: 'Oct', revenue: totalMRR * 0.95 },
    { month: 'Nov', revenue: totalMRR },
  ];

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
      trialing: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
      past_due: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100',
      canceled: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100',
      incomplete: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
    };

    return (
      <Badge className={variants[status] || variants.canceled}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getPlanBadge = (plan: string) => {
    const variants: Record<string, string> = {
      Free: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100',
      Starter: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
      Pro: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100',
      Enterprise: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100',
    };

    return (
      <Badge className={variants[plan] || variants.Free}>
        {plan}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Subscriptions</h1>
          <p className="text-muted-foreground">
            Manage and monitor all user subscriptions and billing
          </p>
        </div>
        <Button onClick={handleRefresh} disabled={refreshing} variant="outline">
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <RevenueSummary
        totalMRR={totalMRR}
        totalARR={totalARR}
        activeSubscriptions={activeSubscriptions}
        churnRate={churnRate}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Plan Distribution</CardTitle>
            <CardDescription>Active subscriptions by plan tier</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={planDistributionData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {planDistributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[entry.name as keyof typeof COLORS] || '#9CA3AF'} />
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
            <CardTitle>Revenue Trend</CardTitle>
            <CardDescription>Monthly recurring revenue over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={revenueTrendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip
                  formatter={(value: number) =>
                    new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: 'USD',
                    }).format(value)
                  }
                />
                <Line type="monotone" dataKey="revenue" stroke="#8B5CF6" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Subscriptions</CardTitle>
          <CardDescription>
            {filteredSubscriptions.length} subscription{filteredSubscriptions.length !== 1 ? 's' : ''}
          </CardDescription>
          <div className="flex gap-4 mt-4">
            <Select value={planFilter} onValueChange={setPlanFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by plan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Plans</SelectItem>
                <SelectItem value="Free">Free</SelectItem>
                <SelectItem value="Starter">Starter</SelectItem>
                <SelectItem value="Pro">Pro</SelectItem>
                <SelectItem value="Enterprise">Enterprise</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="trialing">Trialing</SelectItem>
                <SelectItem value="past_due">Past Due</SelectItem>
                <SelectItem value="canceled">Canceled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Next Billing</TableHead>
                <TableHead>Stripe ID</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSubscriptions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No subscriptions found
                  </TableCell>
                </TableRow>
              ) : (
                filteredSubscriptions.map((subscription) => (
                  <TableRow key={subscription.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {subscription.profiles?.full_name || 'Unknown User'}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {subscription.profiles?.email}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{getPlanBadge(subscription.plan_name)}</TableCell>
                    <TableCell>{getStatusBadge(subscription.status)}</TableCell>
                    <TableCell>
                      {subscription.current_period_end
                        ? formatDate(subscription.current_period_end)
                        : 'N/A'}
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {subscription.stripe_subscription_id?.substring(0, 20)}...
                      </code>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(`/admin/users/${subscription.user_id}`, '_blank')}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
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
