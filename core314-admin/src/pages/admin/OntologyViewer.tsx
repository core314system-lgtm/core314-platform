import { useEffect, useState } from 'react';
import { fetchOntologyData } from '../../lib/ontologyDataProxy';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Loader2, RefreshCw, Box, ArrowRight, Activity, Layers } from 'lucide-react';

interface EntityTypeDef {
  id: string;
  name: string;
  is_active: boolean;
}

interface OntologyStats {
  entityTypes: EntityTypeDef[];
  totalMappings: number;
  activeMappings: number;
  totalOverrides: number;
  integrationNames: string[];
  entityTypeNames: string[];
  mappingsByIntegration: Record<string, number>;
  mappingsByEntityType: Record<string, number>;
  mappingMatrix: Record<string, Record<string, number>>;
  recentLogs: Array<{
    id: string;
    integration_service_name: string;
    mappings_applied: number;
    entities_extracted: number;
    created_at: string;
  }>;
}

const INTEGRATION_COLORS: Record<string, string> = {
  hubspot: 'bg-orange-100 text-orange-800',
  slack: 'bg-purple-100 text-purple-800',
  jira: 'bg-blue-100 text-blue-800',
  salesforce: 'bg-sky-100 text-sky-800',
  quickbooks: 'bg-green-100 text-green-800',
  github: 'bg-gray-100 text-gray-800',
  zendesk: 'bg-teal-100 text-teal-800',
  asana: 'bg-rose-100 text-rose-800',
  notion: 'bg-amber-100 text-amber-800',
  monday: 'bg-indigo-100 text-indigo-800',
  gmail: 'bg-red-100 text-red-800',
  'google-calendar': 'bg-blue-100 text-blue-800',
  'google-sheets': 'bg-emerald-100 text-emerald-800',
  zoom: 'bg-blue-100 text-blue-800',
  teams: 'bg-violet-100 text-violet-800',
  trello: 'bg-cyan-100 text-cyan-800',
};

const ENTITY_TYPE_COLORS: Record<string, string> = {
  person: '#3B82F6',
  company: '#8B5CF6',
  deal: '#10B981',
  project: '#F59E0B',
  ticket: '#EF4444',
};

export function OntologyViewer() {
  const [stats, setStats] = useState<OntologyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const result = await fetchOntologyData<OntologyStats>('ontology-stats');
      setStats(result);
    } catch (err) {
      console.error('Error fetching ontology stats:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, []);
  const handleRefresh = () => { setRefreshing(true); fetchData(); };

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const maxMappingsPerIntegration = Math.max(1, ...Object.values(stats.mappingsByIntegration));
  const maxMappingsPerType = Math.max(1, ...Object.values(stats.mappingsByEntityType));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Ontology Viewer</h1>
          <p className="text-gray-600 dark:text-gray-400">Visualize entity types, mappings, and processing activity</p>
        </div>
        <Button onClick={handleRefresh} disabled={refreshing} variant="outline">
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Entity Types</CardTitle>
            <Box className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.entityTypes.length}</div>
            <p className="text-xs text-muted-foreground">
              {stats.entityTypes.filter(t => t.is_active).length} active
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Mapping Rules</CardTitle>
            <ArrowRight className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalMappings}</div>
            <p className="text-xs text-muted-foreground">{stats.activeMappings} active</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Integrations</CardTitle>
            <Layers className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.integrationNames.length}</div>
            <p className="text-xs text-muted-foreground">With mapping rules</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Overrides</CardTitle>
            <Activity className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalOverrides}</div>
            <p className="text-xs text-muted-foreground">Active customizations</p>
          </CardContent>
        </Card>
      </div>

      {/* Ontology Graph Visualization */}
      <Card>
        <CardHeader>
          <CardTitle>Ontology Graph</CardTitle>
          <CardDescription>How integrations map to entity types</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-8">
            {/* Left: Integrations */}
            <div className="flex-1 space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">Integrations</h3>
              {stats.integrationNames.sort().map(name => (
                <div key={name} className="flex items-center gap-3">
                  <Badge className={INTEGRATION_COLORS[name] || 'bg-gray-100 text-gray-800'}>
                    {name}
                  </Badge>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-400 rounded-full transition-all"
                      style={{ width: `${((stats.mappingsByIntegration[name] || 0) / maxMappingsPerIntegration) * 100}%` }} />
                  </div>
                  <span className="text-xs text-muted-foreground w-16 text-right">
                    {stats.mappingsByIntegration[name] || 0} rules
                  </span>
                </div>
              ))}
            </div>

            {/* Center: Arrow */}
            <div className="flex flex-col items-center justify-center">
              <ArrowRight className="h-8 w-8 text-muted-foreground" />
              <span className="text-xs text-muted-foreground mt-1">maps to</span>
            </div>

            {/* Right: Entity Types */}
            <div className="flex-1 space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">Entity Types</h3>
              {stats.entityTypeNames.sort().map(name => {
                const color = ENTITY_TYPE_COLORS[name] || '#6B7280';
                return (
                  <div key={name} className="flex items-center gap-3">
                    <div className="flex items-center gap-2 min-w-[100px]">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                      <span className="text-sm font-medium">{name}</span>
                    </div>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all"
                        style={{
                          width: `${((stats.mappingsByEntityType[name] || 0) / maxMappingsPerType) * 100}%`,
                          backgroundColor: color,
                        }} />
                    </div>
                    <span className="text-xs text-muted-foreground w-16 text-right">
                      {stats.mappingsByEntityType[name] || 0} rules
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mapping Distribution Matrix */}
      <Card>
        <CardHeader>
          <CardTitle>Integration × Entity Type Matrix</CardTitle>
          <CardDescription>Number of mapping rules per integration and entity type</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Integration</th>
                  {stats.entityTypeNames.sort().map(type => (
                    <th key={type} className="text-center py-2 px-3 font-medium text-muted-foreground">{type}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.integrationNames.sort().map(integration => (
                  <tr key={integration} className="border-t">
                    <td className="py-2 pr-4">
                      <Badge className={INTEGRATION_COLORS[integration] || 'bg-gray-100 text-gray-800'}>
                        {integration}
                      </Badge>
                    </td>
                    {stats.entityTypeNames.sort().map(type => {
                      const count = stats.mappingMatrix?.[integration]?.[type] || 0;
                      const hasMapping = count > 0;
                      return (
                        <td key={type} className="text-center py-2 px-3">
                          {hasMapping ? (
                            <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-800 text-xs font-medium">
                              {count}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Recent Processing Log */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Processing Activity</CardTitle>
          <CardDescription>Ontology mapping engine processing log</CardDescription>
        </CardHeader>
        <CardContent>
          {stats.recentLogs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No processing activity yet. Ontology mappings will be applied when integration events flow through the entity resolver.
            </p>
          ) : (
            <div className="space-y-2">
              {stats.recentLogs.map(log => (
                <div key={log.id} className="flex items-center gap-4 py-2 border-b last:border-b-0">
                  <Badge className={INTEGRATION_COLORS[log.integration_service_name] || 'bg-gray-100 text-gray-800'}>
                    {log.integration_service_name}
                  </Badge>
                  <span className="text-sm">
                    <span className="font-medium">{log.mappings_applied}</span> mappings applied,{' '}
                    <span className="font-medium">{log.entities_extracted}</span> entities extracted
                  </span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {new Date(log.created_at).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
