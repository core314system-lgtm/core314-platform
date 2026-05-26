import { useEffect, useState } from 'react';
import { fetchAdminData } from '../../lib/adminDataProxy';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Loader2, RefreshCw, Users, Building2, Link2, Search, ChevronDown, ChevronRight } from 'lucide-react';

interface SourceRecord {
  id: string;
  source_integration: string;
  external_id: string | null;
  source_name: string | null;
  source_email: string | null;
  source_phone: string | null;
  source_domain: string | null;
  match_method: string;
  match_confidence: number;
  last_seen_at: string;
  created_at: string;
}

interface ResolvedEntity {
  id: string;
  user_id: string;
  entity_type: 'person' | 'company';
  canonical_name: string;
  canonical_email: string | null;
  canonical_domain: string | null;
  canonical_phone: string | null;
  metadata: Record<string, unknown>;
  source_count: number;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
  profiles?: { full_name: string; email: string } | null;
  source_records: SourceRecord[];
}

const MATCH_METHOD_LABELS: Record<string, string> = {
  exact_email: 'Exact Email',
  normalized_email: 'Normalized Email',
  domain: 'Domain',
  external_id: 'External ID',
  fuzzy_name: 'Fuzzy Name',
  phone: 'Phone',
  manual: 'Manual',
  new_entity: 'New Entity',
};

const INTEGRATION_COLORS: Record<string, string> = {
  hubspot: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100',
  slack: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100',
  jira: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
  salesforce: 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-100',
  quickbooks: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
  github: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100',
  zendesk: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-100',
  asana: 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-100',
  notion: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100',
  monday: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-100',
};

export function EntityBrowser() {
  const [entities, setEntities] = useState<ResolvedEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'person' | 'company'>('all');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const fetchEntities = async () => {
    try {
      const result = await fetchAdminData<{ data: ResolvedEntity[]; tableExists: boolean }>('entities');
      if (!result.tableExists) {
        console.warn('resolved_entities table does not exist yet.');
      }
      setEntities(result.data || []);
    } catch (error) {
      console.error('Error fetching entities:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchEntities(); }, []);
  const handleRefresh = () => { setRefreshing(true); fetchEntities(); };

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filtered = entities.filter(e => {
    const matchesSearch = !searchTerm ||
      e.canonical_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (e.canonical_email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (e.canonical_domain || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || e.entity_type === typeFilter;
    return matchesSearch && matchesType;
  });

  const personCount = entities.filter(e => e.entity_type === 'person').length;
  const companyCount = entities.filter(e => e.entity_type === 'company').length;
  const totalSources = entities.reduce((sum, e) => sum + (e.source_records?.length || 0), 0);
  const multiSourceCount = entities.filter(e => (e.source_records?.length || 0) > 1).length;

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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Entity Browser</h1>
          <p className="text-gray-600 dark:text-gray-400">Browse resolved entities across all integrations</p>
        </div>
        <Button onClick={handleRefresh} disabled={refreshing} variant="outline">
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Entities</CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{entities.length}</div>
            <p className="text-xs text-muted-foreground">Resolved across all users</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">People</CardTitle>
            <Users className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{personCount}</div>
            <p className="text-xs text-muted-foreground">Individual contacts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Companies</CardTitle>
            <Building2 className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{companyCount}</div>
            <p className="text-xs text-muted-foreground">Organization entities</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Cross-System Links</CardTitle>
            <Link2 className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSources}</div>
            <p className="text-xs text-muted-foreground">{multiSourceCount} entities linked across 2+ systems</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or domain..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'person', 'company'] as const).map(type => (
            <Button
              key={type}
              variant={typeFilter === type ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTypeFilter(type)}
            >
              {type === 'all' ? 'All' : type === 'person' ? 'People' : 'Companies'}
            </Button>
          ))}
        </div>
      </div>

      {/* Entity Table */}
      <Card>
        <CardHeader>
          <CardTitle>Resolved Entities</CardTitle>
          <CardDescription>
            {filtered.length} of {entities.length} entities
            {searchTerm && ` matching "${searchTerm}"`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Domain</TableHead>
                <TableHead>Sources</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Last Seen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    {entities.length === 0
                      ? 'No resolved entities yet. Entities will appear as integration data flows through the entity resolver.'
                      : 'No entities match your filters.'}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(entity => (
                  <>
                    <TableRow
                      key={entity.id}
                      className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                      onClick={() => toggleExpand(entity.id)}
                    >
                      <TableCell>
                        {entity.source_records.length > 0 ? (
                          expandedIds.has(entity.id) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )
                        ) : null}
                      </TableCell>
                      <TableCell className="font-medium">{entity.canonical_name}</TableCell>
                      <TableCell>
                        <Badge className={entity.entity_type === 'person'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100'
                          : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100'
                        }>
                          {entity.entity_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{entity.canonical_email || '—'}</TableCell>
                      <TableCell className="text-muted-foreground">{entity.canonical_domain || '—'}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {entity.source_records.length > 0 ? (
                            [...new Set(entity.source_records.map(sr => sr.source_integration))].map(integration => (
                              <Badge key={integration} className={INTEGRATION_COLORS[integration] || 'bg-gray-100 text-gray-800'} variant="outline">
                                {integration}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-muted-foreground text-sm">{entity.source_count} source(s)</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {entity.profiles?.full_name || entity.profiles?.email || '—'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {new Date(entity.last_seen_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                    {expandedIds.has(entity.id) && entity.source_records.length > 0 && (
                      <TableRow key={`${entity.id}-details`}>
                        <TableCell colSpan={8} className="bg-gray-50 dark:bg-gray-800/50 p-0">
                          <div className="p-4">
                            <h4 className="text-sm font-semibold mb-3">Source Records ({entity.source_records.length})</h4>
                            <div className="rounded-md border">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Integration</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>External ID</TableHead>
                                    <TableHead>Match Method</TableHead>
                                    <TableHead>Confidence</TableHead>
                                    <TableHead>First Seen</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {entity.source_records.map(sr => (
                                    <TableRow key={sr.id}>
                                      <TableCell>
                                        <Badge className={INTEGRATION_COLORS[sr.source_integration] || 'bg-gray-100 text-gray-800'}>
                                          {sr.source_integration}
                                        </Badge>
                                      </TableCell>
                                      <TableCell>{sr.source_name || '—'}</TableCell>
                                      <TableCell className="text-muted-foreground">{sr.source_email || '—'}</TableCell>
                                      <TableCell className="font-mono text-xs">{sr.external_id || '—'}</TableCell>
                                      <TableCell>
                                        <Badge variant="outline">
                                          {MATCH_METHOD_LABELS[sr.match_method] || sr.match_method}
                                        </Badge>
                                      </TableCell>
                                      <TableCell>
                                        <span className={`font-medium ${
                                          sr.match_confidence >= 95 ? 'text-green-600' :
                                          sr.match_confidence >= 85 ? 'text-yellow-600' : 'text-red-600'
                                        }`}>
                                          {sr.match_confidence}%
                                        </span>
                                      </TableCell>
                                      <TableCell className="whitespace-nowrap text-sm">
                                        {new Date(sr.created_at).toLocaleDateString()}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
