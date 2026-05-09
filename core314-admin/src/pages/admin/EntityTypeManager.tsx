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
import { Loader2, RefreshCw, Plus, Pencil, Trash2, Box, Users, Building2, Briefcase, FolderKanban, Ticket } from 'lucide-react';

interface EntityField {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

interface EntityType {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  icon: string;
  color: string;
  fields: EntityField[];
  is_builtin: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const ICON_MAP: Record<string, typeof Box> = {
  Users, Building2, Briefcase, FolderKanban, Ticket, Box,
};

const EMPTY_FORM = {
  name: '',
  display_name: '',
  description: '',
  icon: 'Box',
  color: '#6B7280',
  fields: '[]',
  is_active: true,
};

export function EntityTypeManager() {
  const [types, setTypes] = useState<EntityType[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const result = await fetchOntologyData<{ data: EntityType[] }>('entity-types');
      setTypes(result.data || []);
    } catch (err) {
      console.error('Error fetching entity types:', err);
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

  const openEdit = (t: EntityType) => {
    setEditingId(t.id);
    setForm({
      name: t.name,
      display_name: t.display_name,
      description: t.description || '',
      icon: t.icon,
      color: t.color,
      fields: JSON.stringify(t.fields, null, 2),
      is_active: t.is_active,
    });
    setError(null);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      let fields: EntityField[];
      try {
        fields = JSON.parse(form.fields);
      } catch {
        setError('Invalid JSON in fields definition');
        setSaving(false);
        return;
      }

      const payload = {
        ...(editingId ? { id: editingId } : {}),
        name: form.name.toLowerCase().replace(/\s+/g, '_'),
        display_name: form.display_name,
        description: form.description || null,
        icon: form.icon,
        color: form.color,
        fields,
        is_active: form.is_active,
      };

      if (editingId) {
        await updateOntologyRecord('entity-types', payload);
      } else {
        await createOntologyRecord('entity-types', payload);
      }
      setDialogOpen(false);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string, isBuiltin: boolean) => {
    if (isBuiltin) return;
    if (!confirm(`Delete entity type "${name}"? This cannot be undone.`)) return;
    try {
      await deleteOntologyRecord('entity-types', id);
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

  const activeCount = types.filter(t => t.is_active).length;
  const builtinCount = types.filter(t => t.is_builtin).length;
  const totalFields = types.reduce((sum, t) => sum + (t.fields?.length || 0), 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Entity Types</h1>
          <p className="text-gray-600 dark:text-gray-400">Define canonical entity types for the ontology layer</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleRefresh} disabled={refreshing} variant="outline">
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            New Entity Type
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Types</CardTitle>
            <Box className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{types.length}</div>
            <p className="text-xs text-muted-foreground">{activeCount} active, {builtinCount} built-in</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Fields</CardTitle>
            <FolderKanban className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalFields}</div>
            <p className="text-xs text-muted-foreground">Across all entity types</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Custom Types</CardTitle>
            <Plus className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{types.length - builtinCount}</div>
            <p className="text-xs text-muted-foreground">User-defined entity types</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Entity Type Definitions</CardTitle>
          <CardDescription>{types.length} entity types defined</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Display Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Fields</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Built-in</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {types.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No entity types defined. Click "New Entity Type" to create one.
                  </TableCell>
                </TableRow>
              ) : (
                types.map(t => {
                  const IconComponent = ICON_MAP[t.icon] || Box;
                  return (
                    <TableRow key={t.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded" style={{ backgroundColor: t.color + '20' }}>
                            <IconComponent className="h-4 w-4" style={{ color: t.color }} />
                          </div>
                          <span className="font-mono text-sm">{t.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{t.display_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                        {t.description || '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{t.fields?.length || 0} fields</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={t.is_active
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100'
                        }>
                          {t.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {t.is_builtin ? (
                          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">Built-in</Badge>
                        ) : (
                          <Badge variant="outline">Custom</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(t)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {!t.is_builtin && (
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(t.id, t.name, t.is_builtin)}
                              className="text-red-500 hover:text-red-700">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Entity Type' : 'Create Entity Type'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {error && <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">{error}</div>}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Name (slug)</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. lead" disabled={!!editingId} />
              </div>
              <div>
                <Label>Display Name</Label>
                <Input value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })}
                  placeholder="e.g. Sales Lead" />
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Brief description of this entity type" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Icon</Label>
                <Input value={form.icon} onChange={e => setForm({ ...form, icon: e.target.value })}
                  placeholder="Lucide icon name" />
              </div>
              <div>
                <Label>Color</Label>
                <div className="flex gap-2">
                  <Input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })}
                    className="w-12 h-9 p-1" />
                  <Input value={form.color} onChange={e => setForm({ ...form, color: e.target.value })}
                    className="flex-1" />
                </div>
              </div>
            </div>
            <div>
              <Label>Fields (JSON array)</Label>
              <Textarea value={form.fields} onChange={e => setForm({ ...form, fields: e.target.value })}
                rows={8} className="font-mono text-sm"
                placeholder='[{"name": "email", "type": "email", "required": true, "description": "Primary email"}]' />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="is_active" checked={form.is_active}
                onChange={e => setForm({ ...form, is_active: e.target.checked })} />
              <Label htmlFor="is_active">Active</Label>
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
