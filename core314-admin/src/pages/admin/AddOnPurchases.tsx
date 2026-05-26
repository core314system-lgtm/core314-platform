import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { RefreshCw, DollarSign, TrendingUp, Package } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface AddOnPurchase {
  id: string;
  user_id: string;
  addon_name: string;
  addon_category: string;
  status: string;
  activated_at: string;
  expires_at: string | null;
  metadata: {
    amount_total?: number;
    currency?: string;
  };
  profiles?: {
    full_name: string;
    email: string;
  };
}

interface RevenueData {
  date: string;
  revenue: number;
}

export function AddOnPurchases() {
  const [purchases, setPurchases] = useState<AddOnPurchase[]>([]);
  const [filteredPurchases, setFilteredPurchases] = useState<AddOnPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [revenueData, setRevenueData] = useState<RevenueData[]>([]);
  const [stats, setStats] = useState({
    total_active: 0,
    total_revenue: 0,
    monthly_revenue: 0,
  });

  useEffect(() => {
    fetchAddOnPurchases();
  }, []);

  useEffect(() => {
    filterPurchases();
  }, [purchases, statusFilter]);

  const fetchAddOnPurchases = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_addons')
        .select(`
          *,
          profiles:user_id (
            full_name,
            email
          )
        `)
        .order('activated_at', { ascending: false });

      if (error) throw error;

      setPurchases(data || []);
      calculateStats(data || []);
      calculateRevenueData(data || []);
    } catch (error) {
      console.error('Error fetching add-on purchases:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterPurchases = () => {
    if (statusFilter === 'all') {
      setFilteredPurchases(purchases);
    } else {
      setFilteredPurchases(purchases.filter(p => p.status === statusFilter));
    }
  };

  const calculateStats = (data: AddOnPurchase[]) => {
    const activeAddons = data.filter(p => p.status === 'active');
    const totalRevenue = data.reduce((sum, p) => {
      const amount = p.metadata?.amount_total || 0;
      return sum + (amount / 100); // Convert cents to dollars
    }, 0);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const monthlyRevenue = data
      .filter(p => new Date(p.activated_at) >= thirtyDaysAgo)
      .reduce((sum, p) => {
        const amount = p.metadata?.amount_total || 0;
        return sum + (amount / 100);
      }, 0);

    setStats({
      total_active: activeAddons.length,
      total_revenue: totalRevenue,
      monthly_revenue: monthlyRevenue,
    });
  };

  const calculateRevenueData = (data: AddOnPurchase[]) => {
    const last30Days: RevenueData[] = [];
    const today = new Date();

    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const dayRevenue = data
        .filter(p => p.activated_at.startsWith(dateStr))
        .reduce((sum, p) => {
          const amount = p.metadata?.amount_total || 0;
          return sum + (amount / 100);
        }, 0);

      last30Days.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        revenue: dayRevenue,
      });
    }

    setRevenueData(last30Days);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      active: 'default',
      canceled: 'destructive',
      expired: 'secondary',
      pending: 'outline',
    };
    return (
      <Badge variant={variants[status] || 'secondary'}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getCategoryBadge = (category: string) => {
    const colors: Record<string, string> = {
      integration: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      analytics: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      ai_module: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      custom: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    };
    return (
      <Badge className={colors[category] || 'bg-gray-100 text-gray-800'}>
        {category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
      </Badge>
    );
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Add-On Purchases
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Monitor and manage user add-on subscriptions
          </p>
        </div>
        <Button onClick={fetchAddOnPurchases} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Add-Ons</CardTitle>
            <Package className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_active}</div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Currently subscribed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.total_revenue)}</div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              All-time add-on revenue
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.monthly_revenue)}</div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Last 30 days
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Add-On Revenue (Last 30 Days)</CardTitle>
          <CardDescription>Daily revenue from add-on purchases</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={(value) => formatCurrency(value as number)} />
              <Legend />
              <Bar dataKey="revenue" fill="#3b82f6" name="Revenue" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Add-On Purchases</CardTitle>
            <div className="flex gap-2">
              <Button
                variant={statusFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('all')}
              >
                All
              </Button>
              <Button
                variant={statusFilter === 'active' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('active')}
              >
                Active
              </Button>
              <Button
                variant={statusFilter === 'canceled' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('canceled')}
              >
                Canceled
              </Button>
              <Button
                variant={statusFilter === 'expired' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('expired')}
              >
                Expired
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredPurchases.length === 0 ? (
            <div className="text-center py-8 text-gray-600 dark:text-gray-400">
              No add-on purchases found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Add-On Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Activated On</TableHead>
                    <TableHead>Expires On</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPurchases.map((purchase) => (
                    <TableRow key={purchase.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {purchase.profiles?.full_name || 'Unknown'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {purchase.profiles?.email || 'No email'}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {purchase.addon_name}
                      </TableCell>
                      <TableCell>
                        {getCategoryBadge(purchase.addon_category)}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(purchase.status)}
                      </TableCell>
                      <TableCell>
                        {formatDate(purchase.activated_at)}
                      </TableCell>
                      <TableCell>
                        {purchase.expires_at ? formatDate(purchase.expires_at) : 'Never'}
                      </TableCell>
                      <TableCell className="text-right">
                        {purchase.metadata?.amount_total
                          ? formatCurrency(purchase.metadata.amount_total / 100)
                          : 'N/A'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
