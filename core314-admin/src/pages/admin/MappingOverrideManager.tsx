import { useEffect, useState } from 'react';
import { fetchOntologyData, createOntologyRecord, updateOntologyRecord, deleteOntologyRecord } from '../../lib/ontologyDataProxy';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Loader2, RefreshCw, Plus, Pencil, Trash2, ShieldOff, Settings2 } from 'lucide-react';

interface MappingOverride {
  id: string;
  field_mapping_id: string;
  user_id: string | null;
  override_type: 'disable' | 'remap' | 'custom_transform';
  override_config: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  integration_field_mappings: {
    integration_service_name: string;
    source_field_path: string;
    target_entity_type: string;
    target_field: string;
  } | null;
  profiles: { full_name: string; email: string } | null;
}

interface FieldMapping {
  id: string;
  integration_service_name: string;
  source_field_path: string;
  target_entity_type: string;
  target_field: string;
}

const OVERRIDE_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  disable: { label: 'Disabled', color: 'bg-red-100 text-red-800' },
  remap: { label: 'Remapped', color: 'bg-yellow-100 text-yellow-800' },
  custom_transform: { label: 'Custom Transform', color: 'bg-blue-100 text-blue-800' },
};

const EMPTY_FORM = {
  field_mapping_id: '',
  user_id: '',
  override_type: 'disable' as 'disable' | 'remap' | 'custom_transform',
  override_config: '{}',
};

export function MappingOverrideManager() {
  const [overrides, setOverrides] = useState<MappingOverride[]>([]);
  const [availableMappings, setAvailableMappings] = useState<FieldMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [overrideResult, mappingResult] = await Promise.all([
        fetchOntologyData<{ data: MappingOverride[] }>('mapping-overrides'),
        fetchOntologyData<{ data: FieldMapping[] }>('field-mappings'),
      ]);
      setOverrides(overrideResult.data || []);
      setAvailableMappings(mappingResult.data || []);
    } catch (err) {
      console.error('Error fetching overrides:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, []);
  const handleRefresh = () => { setRefreshing(true); fetchData(); };

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
    setDialogOpen(true);
  };

  const openEdit = (o: MappingOverride) => {
    setEditingId(o.id);
    setForm({
      field_mapping_id: o.field_mapping_id,
      user_id: o.user_id || '',
      override_type: o.override_type,
      override_config: JSON.stringify(o.override_config, null, 2),
    });
    setError(null);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      let config: Record<string, unknown>;
      try {
        config = JSON.parse(form.override_config);
      } catch {
        setError('Invalid JSON in override config');
        setSaving(false);
        return;
      }

      const payload = {
        ...(editingId ? { id: editingId } : {}),
        field_mapping_id: form.field_mapping_id,
        user_id: form.user_id || null,
        override_type: form.override_type,
        override_config: config,
      };

      if (editingId) {
        await updateOntologyRecord('mapping-overrides', payload);
      } else {
        await createOntologyRecord('mapping-overrides', payload);
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
    if (!confirm('Delete this override?')) return;
    try {
      await deleteOntologyRecord('mapping-overrides', id);
      fetchData();
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const disableCount = overrides.filter(o => o.override_type === 'disable').length;
  const remapCount = overrides.filter(o => o.override_type === 'remap').length;
  const customCount = overrides.filter(o => o.override_type === 'custom_transform').length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Mapping Overrides</h1>
          <p className="text-gray-600 dark:text-gray-400">Customize or disable mapping rules per user or globally</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleRefresh} disabled={refreshing} variant="outline">
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            New Override
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Overrides</CardTitle>
            <Settings2 className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overrides.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Disabled</CardTitle>
            <ShieldOff className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{disableCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Remapped</CardTitle>
            <Settings2 className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{remapCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Custom Transforms</CardTitle>
            <Settings2 className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Override Rules</CardTitle>
          <CardDescription>{overrides.length} overrides configured</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mapping</TableHead>
                <TableHead>Override Type</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Config</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overrides.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No overrides configured. Click "New Override" to customize a mapping rule.
                  </TableCell>
                </TableRow>
              ) : (
                overrides.map(o => {
                  const mapping = o.integration_field_mappings;
                  const typeInfo = OVERRIDE_TYPE_LABELS[o.override_type] || { label: o.override_type, color: 'bg-gray-100 text-gray-800' };
                  return (
                    <TableRow key={o.id}>
                      <TableCell>
                        {mapping ? (
                          <div className="text-sm">
                            <span className="font-medium">{mapping.integration_service_name}</span>
                            <span className="text-muted-foreground"> {mapping.source_field_path} → {mapping.target_entity_type}.{mapping.target_field}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground font-mono text-xs">{o.field_mapping_id}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={typeInfo.color}>{typeInfo.label}</Badge>
                      </TableCell>
                      <TableCell>
                        {o.user_id ? (
                          <div className="text-sm">
                            <span className="font-medium">{o.profiles?.full_name || o.profiles?.email || 'User'}</span>
                          </div>
                        ) : (
                          <Badge variant="outline">Global</Badge>
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <pre className="text-xs text-muted-foreground truncate">
                          {JSON.stringify(o.override_config)}
                        </pre>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {new Date(o.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(o)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(o.id)}
                            className="text-red-500 hover:text-red-700">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Override' : 'Create Override'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {error && <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">{error}</div>}
            <div>
              <Label>Mapping Rule</Label>
              <select className="w-full border rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-800"
                value={form.field_mapping_id}
                onChange={e => setForm({ ...form, field_mapping_id: e.target.value })}>
                <option value="">Select a mapping...</option>
                {availableMappings.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.integration_service_name}: {m.source_field_path} → {m.target_entity_type}.{m.target_field}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>User ID (leave empty for global override)</Label>
              <Input value={form.user_id}
                onChange={e => setForm({ ...form, user_id: e.target.value })}
                placeholder="UUID of specific user, or empty for global" />
            </div>
            <div>
              <Label>Override Type</Label>
              <select className="w-full border rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-800"
                value={form.override_type}
                onChange={e => setForm({ ...form, override_type: e.target.value as 'disable' | 'remap' | 'custom_transform' })}>
                <option value="disable">Disable — skip this mapping entirely</option>
                <option value="remap">Remap — change target field</option>
                <option value="custom_transform">Custom Transform — apply custom logic</option>
              </select>
            </div>
            <div>
              <Label>Override Config (JSON)</Label>
              <Textarea value={form.override_config}
                onChange={e => setForm({ ...form, override_config: e.target.value })}
                rows={4} className="font-mono text-sm"
                placeholder='{"new_target_field": "phone"}' />
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
