import { useEffect, useState } from 'react';
import { fetchOntologyData, createOntologyRecord, updateOntologyRecord, deleteOntologyRecord } from '../../lib/ontologyDataProxy';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Loader2, RefreshCw, Plus, Pencil, Trash2, ArrowRight, Search, Filter } from 'lucide-react';

interface FieldMapping {
  id: string;
  integration_service_name: string;
  source_event_type: string | null;
  source_field_path: string;
  target_entity_type: string;
  target_field: string;
  transform_rule: string | null;
  hint_type: 'person' | 'company';
  priority: number;
  is_active: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
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

const TRANSFORM_RULES = [
  { value: '', label: 'None (passthrough)' },
  { value: 'split_email_domain', label: 'Extract email domain' },
  { value: 'split_email_local', label: 'Extract email local part' },
  { value: 'normalize_phone', label: 'Normalize phone number' },
  { value: 'title_case', label: 'Title Case' },
  { value: 'lowercase', label: 'Lowercase' },
];

const EMPTY_FORM = {
  integration_service_name: '',
  source_event_type: '',
  source_field_path: '',
  target_entity_type: 'person',
  target_field: '',
  transform_rule: '',
  hint_type: 'person' as 'person' | 'company',
  priority: 100,
  is_active: true,
  description: '',
};

export function IntegrationMappingManager() {
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [integrationFilter, setIntegrationFilter] = useState<string>('all');

  const fetchData = async () => {
    try {
      const result = await fetchOntologyData<{ data: FieldMapping[] }>('field-mappings');
      setMappings(result.data || []);
    } catch (err) {
      console.error('Error fetching mappings:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, []);
  const handleRefresh = () => { setRefreshing(true); fetchData(); };

  const integrations = [...new Set(mappings.map(m => m.integration_service_name))].sort();

  const filtered = mappings.filter(m => {
    const matchesSearch = !searchTerm ||
      m.source_field_path.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.target_field.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesIntegration = integrationFilter === 'all' || m.integration_service_name === integrationFilter;
    return matchesSearch && matchesIntegration;
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
    setDialogOpen(true);
  };

  const openEdit = (m: FieldMapping) => {
    setEditingId(m.id);
    setForm({
      integration_service_name: m.integration_service_name,
      source_event_type: m.source_event_type || '',
      source_field_path: m.source_field_path,
      target_entity_type: m.target_entity_type,
      target_field: m.target_field,
      transform_rule: m.transform_rule || '',
      hint_type: m.hint_type,
      priority: m.priority,
      is_active: m.is_active,
      description: m.description || '',
    });
    setError(null);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...(editingId ? { id: editingId } : {}),
        integration_service_name: form.integration_service_name,
        source_event_type: form.source_event_type || null,
        source_field_path: form.source_field_path,
        target_entity_type: form.target_entity_type,
        target_field: form.target_field,
        transform_rule: form.transform_rule || null,
        hint_type: form.hint_type,
        priority: form.priority,
        is_active: form.is_active,
        description: form.description || null,
      };

      if (editingId) {
        await updateOntologyRecord('field-mappings', payload);
      } else {
        await createOntologyRecord('field-mappings', payload);
      }
      setDialogOpen(false);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this mapping rule?')) return;
    try {
      await deleteOntologyRecord('field-mappings', id);
      fetchData();
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const handleToggleActive = async (m: FieldMapping) => {
    try {
      await updateOntologyRecord('field-mappings', { id: m.id, is_active: !m.is_active });
      fetchData();
    } catch (err) {
      console.error('Toggle error:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const activeCount = mappings.filter(m => m.is_active).length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Integration Mappings</h1>
          <p className="text-gray-600 dark:text-gray-400">Define how integration fields map to entity types</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleRefresh} disabled={refreshing} variant="outline">
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            New Mapping
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Mappings</CardTitle>
            <ArrowRight className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mappings.length}</div>
            <p className="text-xs text-muted-foreground">{activeCount} active</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Integrations</CardTitle>
            <Filter className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{integrations.length}</div>
            <p className="text-xs text-muted-foreground">With mapping rules</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Entity Types</CardTitle>
            <ArrowRight className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{[...new Set(mappings.map(m => m.target_entity_type))].length}</div>
            <p className="text-xs text-muted-foreground">Target entity types</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by field path, target, or description..."
            value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
        </div>
        <select className="border rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-800"
          value={integrationFilter} onChange={e => setIntegrationFilter(e.target.value)}>
          <option value="all">All Integrations</option>
          {integrations.map(i => <option key={i} value={i}>{i}</option>)}
        </select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Field Mapping Rules</CardTitle>
          <CardDescription>{filtered.length} of {mappings.length} mapping rules</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Integration</TableHead>
                <TableHead>Source Field</TableHead>
                <TableHead className="w-8"></TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Transform</TableHead>
                <TableHead>Hint Type</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    {mappings.length === 0 ? 'No mapping rules defined.' : 'No mappings match your filters.'}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(m => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <Badge className={INTEGRATION_COLORS[m.integration_service_name] || 'bg-gray-100 text-gray-800'}>
                        {m.integration_service_name}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{m.source_field_path}</TableCell>
                    <TableCell><ArrowRight className="h-3.5 w-3.5 text-muted-foreground" /></TableCell>
                    <TableCell>
                      <span className="font-medium">{m.target_entity_type}</span>
                      <span className="text-muted-foreground">.{m.target_field}</span>
                    </TableCell>
                    <TableCell>
                      {m.transform_rule ? (
                        <Badge variant="outline" className="font-mono text-xs">{m.transform_rule}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={m.hint_type === 'person'
                        ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}>
                        {m.hint_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{m.priority}</TableCell>
                    <TableCell>
                      <Badge className={m.is_active
                        ? 'bg-green-100 text-green-800 cursor-pointer' : 'bg-gray-100 text-gray-800 cursor-pointer'}
                        onClick={() => handleToggleActive(m)}>
                        {m.is_active ? 'Active' : 'Disabled'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(m)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(m.id)}
                          className="text-red-500 hover:text-red-700">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Mapping Rule' : 'Create Mapping Rule'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {error && <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">{error}</div>}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Integration Service</Label>
                <Input value={form.integration_service_name}
                  onChange={e => setForm({ ...form, integration_service_name: e.target.value })}
                  placeholder="e.g. hubspot" />
              </div>
              <div>
                <Label>Source Event Type (optional)</Label>
                <Input value={form.source_event_type}
                  onChange={e => setForm({ ...form, source_event_type: e.target.value })}
                  placeholder="e.g. contact_updated" />
              </div>
            </div>
            <div>
              <Label>Source Field Path</Label>
              <Input value={form.source_field_path}
                onChange={e => setForm({ ...form, source_field_path: e.target.value })}
                placeholder="e.g. contact_name or attendees[].email" />
              <p className="text-xs text-muted-foreground mt-1">
                Use dot notation for nested fields. Use [] for arrays (e.g. attendees[].email).
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Target Entity Type</Label>
                <Input value={form.target_entity_type}
                  onChange={e => setForm({ ...form, target_entity_type: e.target.value })}
                  placeholder="e.g. person" />
              </div>
              <div>
                <Label>Target Field</Label>
                <Input value={form.target_field}
                  onChange={e => setForm({ ...form, target_field: e.target.value })}
                  placeholder="e.g. name, email, domain" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Transform Rule</Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-800"
                  value={form.transform_rule}
                  onChange={e => setForm({ ...form, transform_rule: e.target.value })}>
                  {TRANSFORM_RULES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <Label>Hint Type</Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-800"
                  value={form.hint_type}
                  onChange={e => setForm({ ...form, hint_type: e.target.value as 'person' | 'company' })}>
                  <option value="person">Person</option>
                  <option value="company">Company</option>
                </select>
              </div>
              <div>
                <Label>Priority</Label>
                <Input type="number" value={form.priority}
                  onChange={e => setForm({ ...form, priority: parseInt(e.target.value) || 100 })} />
              </div>
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Input value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="What this mapping does" />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="mapping_active" checked={form.is_active}
                onChange={e => setForm({ ...form, is_active: e.target.checked })} />
              <Label htmlFor="mapping_active">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingId ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
