import { useEffect, useState } from 'react';
import { fetchAdminData } from '../../lib/adminDataProxy';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Loader2, RefreshCw, BarChart3, Users, Link2, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

interface EntityStats {
  tableExists: boolean;
  stats: {
    totalEntities: number;
    personCount: number;
    companyCount: number;
    totalSourceRecords: number;
    totalMatchLogs: number;
    avgSourcesPerEntity: string;
    methodCounts: Record<string, number>;
    integrationCounts: Record<string, number>;
    confidenceBuckets: { high: number; medium: number; low: number };
    dailyCounts: Record<string, number>;
  };
}

const METHOD_LABELS: Record<string, string> = {
  exact_email: 'Exact Email',
  normalized_email: 'Normalized Email',
  domain: 'Domain',
  external_id: 'External ID',
  fuzzy_name: 'Fuzzy Name',
  phone: 'Phone',
  manual: 'Manual',
  new_entity: 'New Entity',
};

const METHOD_COLORS: Record<string, string> = {
  exact_email: '#22c55e',
  normalized_email: '#10b981',
  external_id: '#3b82f6',
  domain: '#0ea5e9',
  phone: '#14b8a6',
  fuzzy_name: '#eab308',
  manual: '#a855f7',
  new_entity: '#9ca3af',
};

const INTEGRATION_COLORS: Record<string, string> = {
  hubspot: '#ff7a59',
  slack: '#4A154B',
  jira: '#0052CC',
  salesforce: '#00A1E0',
  quickbooks: '#2CA01C',
  github: '#24292e',
  zendesk: '#03363D',
  asana: '#F06A6A',
  notion: '#000000',
  monday: '#6161FF',
};

const CONFIDENCE_COLORS = {
  high: '#22c55e',
  medium: '#eab308',
  low: '#ef4444',
};

export function EntityMatchStats() {
  const [data, setData] = useState<EntityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = async () => {
    try {
      const result = await fetchAdminData<EntityStats>('entity-stats');
      setData(result);
    } catch (error) {
      console.error('Error fetching entity stats:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchStats(); }, []);
  const handleRefresh = () => { setRefreshing(true); fetchStats(); };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data?.tableExists) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Entity Match Statistics</h1>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Entity resolution tables have not been created yet. Run the migration to enable this feature.
          </CardContent>
        </Card>
      </div>
    );
  }

  const stats = data.stats;

  const methodData = Object.entries(stats.methodCounts || {})
    .map(([method, count]) => ({
      name: METHOD_LABELS[method] || method,
      value: count,
      fill: METHOD_COLORS[method] || '#6366f1',
    }))
    .sort((a, b) => b.value - a.value);

  const integrationData = Object.entries(stats.integrationCounts || {})
    .map(([integration, count]) => ({
      name: integration.charAt(0).toUpperCase() + integration.slice(1),
      value: count,
      fill: INTEGRATION_COLORS[integration] || '#6366f1',
    }))
    .sort((a, b) => b.value - a.value);

  const confidenceData = [
    { name: 'High (95-100%)', value: stats.confidenceBuckets?.high || 0, fill: CONFIDENCE_COLORS.high },
    { name: 'Medium (85-94%)', value: stats.confidenceBuckets?.medium || 0, fill: CONFIDENCE_COLORS.medium },
    { name: 'Low (<85%)', value: stats.confidenceBuckets?.low || 0, fill: CONFIDENCE_COLORS.low },
  ].filter(d => d.value > 0);

  const dailyData = Object.entries(stats.dailyCounts || {})
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const entityTypeData = [
    { name: 'People', value: stats.personCount, fill: '#3b82f6' },
    { name: 'Companies', value: stats.companyCount, fill: '#a855f7' },
  ].filter(d => d.value > 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Match Statistics</h1>
          <p className="text-gray-600 dark:text-gray-400">Entity resolution performance and match analytics</p>
        </div>
        <Button onClick={handleRefresh} disabled={refreshing} variant="outline">
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Entities</CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalEntities}</div>
            <p className="text-xs text-muted-foreground">
              {stats.personCount} people, {stats.companyCount} companies
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Source Records</CardTitle>
            <Link2 className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalSourceRecords}</div>
            <p className="text-xs text-muted-foreground">Linked to entities</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Match Decisions</CardTitle>
            <BarChart3 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalMatchLogs}</div>
            <p className="text-xs text-muted-foreground">Total match log entries</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Sources/Entity</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgSourcesPerEntity}</div>
            <p className="text-xs text-muted-foreground">Cross-system linkage ratio</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Match Quality</CardTitle>
            <Badge className={
              (stats.confidenceBuckets?.high || 0) > (stats.confidenceBuckets?.low || 0)
                ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
            }>
              {stats.totalSourceRecords > 0
                ? `${Math.round(((stats.confidenceBuckets?.high || 0) / stats.totalSourceRecords) * 100)}% high`
                : 'N/A'}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="flex gap-1">
              <span className="text-green-600 font-bold text-sm">{stats.confidenceBuckets?.high || 0}H</span>
              <span className="text-yellow-600 font-bold text-sm">{stats.confidenceBuckets?.medium || 0}M</span>
              <span className="text-red-600 font-bold text-sm">{stats.confidenceBuckets?.low || 0}L</span>
            </div>
            <p className="text-xs text-muted-foreground">High / Medium / Low confidence</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Match Methods</CardTitle>
            <CardDescription>How entities are being matched across systems</CardDescription>
          </CardHeader>
          <CardContent>
            {methodData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={methodData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="value" name="Matches">
                    {methodData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                No match data yet
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Confidence Distribution</CardTitle>
            <CardDescription>Match confidence level breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            {confidenceData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={confidenceData}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {confidenceData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                No confidence data yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Integration Sources</CardTitle>
            <CardDescription>Which integrations contribute source records</CardDescription>
          </CardHeader>
          <CardContent>
            {integrationData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={integrationData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" name="Records">
                    {integrationData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                No integration data yet
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Entity Types</CardTitle>
            <CardDescription>People vs. companies distribution</CardDescription>
          </CardHeader>
          <CardContent>
            {entityTypeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={entityTypeData}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {entityTypeData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                No entity data yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Entities Over Time */}
      {dailyData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Entities Resolved Over Time</CardTitle>
            <CardDescription>New entities created per day (last 30 days)</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" name="New Entities" fill="#6366f1" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
