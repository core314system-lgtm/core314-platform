import { useEffect, useState } from 'react';
import { fetchAdminData } from '../../lib/adminDataProxy';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Loader2, RefreshCw, GitMerge, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';

interface MatchLogEntry {
  id: string;
  user_id: string;
  resolved_entity_id: string;
  source_record_id: string | null;
  match_method: string;
  match_confidence: number;
  match_details: Record<string, unknown>;
  created_at: string;
  entity?: { id: string; canonical_name: string; entity_type: string } | null;
  profiles?: { full_name: string; email: string } | null;
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

const METHOD_COLORS: Record<string, string> = {
  exact_email: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
  normalized_email: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100',
  external_id: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
  domain: 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-100',
  phone: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-100',
  fuzzy_name: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100',
  manual: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100',
  new_entity: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100',
};

export function EntityMergeQueue() {
  const [matchLog, setMatchLog] = useState<MatchLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewFilter, setViewFilter] = useState<'review' | 'all' | 'deterministic'>('review');

  const fetchMatchLog = async () => {
    try {
      const result = await fetchAdminData<{ data: MatchLogEntry[]; tableExists: boolean }>('entity-match-log');
      if (!result.tableExists) {
        console.warn('entity_match_log table does not exist yet.');
      }
      setMatchLog(result.data || []);
    } catch (error) {
      console.error('Error fetching match log:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchMatchLog(); }, []);
  const handleRefresh = () => { setRefreshing(true); fetchMatchLog(); };

  const fuzzyMatches = matchLog.filter(m => m.match_method === 'fuzzy_name');
  const lowConfidence = matchLog.filter(m => Number(m.match_confidence) < 90);
  const deterministicMatches = matchLog.filter(m =>
    ['exact_email', 'normalized_email', 'external_id', 'phone'].includes(m.match_method)
  );
  const newEntities = matchLog.filter(m => m.match_method === 'new_entity');

  const filtered = matchLog.filter(m => {
    if (viewFilter === 'review') {
      return m.match_method === 'fuzzy_name' || Number(m.match_confidence) < 95;
    }
    if (viewFilter === 'deterministic') {
      return ['exact_email', 'normalized_email', 'external_id', 'phone', 'domain'].includes(m.match_method);
    }
    return true;
  });

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 95) return 'text-green-600 dark:text-green-400';
    if (confidence >= 85) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Merge Queue</h1>
          <p className="text-gray-600 dark:text-gray-400">Review entity match decisions and fuzzy matches</p>
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
            <CardTitle className="text-sm font-medium">Total Matches</CardTitle>
            <GitMerge className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{matchLog.length}</div>
            <p className="text-xs text-muted-foreground">All match decisions logged</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Fuzzy Matches</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{fuzzyMatches.length}</div>
            <p className="text-xs text-muted-foreground">{lowConfidence.length} below 90% confidence</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Deterministic</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{deterministicMatches.length}</div>
            <p className="text-xs text-muted-foreground">Email, ID, phone matches</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">New Entities</CardTitle>
            <Clock className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{newEntities.length}</div>
            <p className="text-xs text-muted-foreground">No existing match found</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {([
          { key: 'review' as const, label: 'Needs Review', count: filtered.length },
          { key: 'deterministic' as const, label: 'Deterministic', count: deterministicMatches.length },
          { key: 'all' as const, label: 'All Matches', count: matchLog.length },
        ]).map(tab => (
          <Button
            key={tab.key}
            variant={viewFilter === tab.key ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewFilter(tab.key)}
          >
            {tab.label} ({tab.count})
          </Button>
        ))}
      </div>

      {/* Match Log Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            {viewFilter === 'review' ? 'Matches Requiring Review' :
             viewFilter === 'deterministic' ? 'Deterministic Matches' : 'All Match Decisions'}
          </CardTitle>
          <CardDescription>
            {viewFilter === 'review'
              ? 'Fuzzy name matches and low-confidence decisions that may need manual verification'
              : `${filtered.length} match log entries`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entity</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Match Method</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Matched At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    {matchLog.length === 0
                      ? 'No match decisions logged yet. Matches will appear as the entity resolver processes integration events.'
                      : viewFilter === 'review'
                        ? 'No matches require review. All matches are high-confidence deterministic matches.'
                        : 'No matches in this category.'}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(entry => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">
                      {entry.entity?.canonical_name || entry.resolved_entity_id.slice(0, 8)}
                    </TableCell>
                    <TableCell>
                      {entry.entity ? (
                        <Badge className={entry.entity.entity_type === 'person'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100'
                          : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100'
                        }>
                          {entry.entity.entity_type}
                        </Badge>
                      ) : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge className={METHOD_COLORS[entry.match_method] || METHOD_COLORS.new_entity}>
                        {MATCH_METHOD_LABELS[entry.match_method] || entry.match_method}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className={`font-bold ${getConfidenceColor(Number(entry.match_confidence))}`}>
                        {Number(entry.match_confidence).toFixed(0)}%
                      </span>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      {entry.match_details && Object.keys(entry.match_details).length > 0 ? (
                        <pre className="text-xs bg-gray-50 dark:bg-gray-800 rounded p-1 max-h-16 overflow-auto">
                          {JSON.stringify(entry.match_details, null, 1)}
                        </pre>
                      ) : '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {entry.profiles?.full_name || entry.profiles?.email || '—'}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {new Date(entry.created_at).toLocaleString()}
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
