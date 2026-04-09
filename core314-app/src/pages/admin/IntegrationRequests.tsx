import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import { useToast } from '../../hooks/use-toast';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../components/ui/dialog';
import { RefreshCw, Inbox, Save, X, TrendingUp, ChevronDown, ChevronRight, Link2, Merge, Plus, Trash2, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface IntegrationRequest {
  id: string;
  user_id: string;
  integration_name: string;
  category: string;
  url: string | null;
  use_case: string;
  status: string;
  priority: number;
  admin_notes: string | null;
  reviewed_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  integration_catalog_id: string | null;
}

interface CatalogEntry {
  id: string;
  canonical_name: string;
  normalized_key: string;
  category: string | null;
  total_requests: number;
  created_at: string;
  updated_at: string;
}

interface AliasEntry {
  id: string;
  integration_catalog_id: string;
  alias_name: string;
  normalized_key: string;
  created_at: string;
}

const STATUS_OPTIONS = ['pending', 'reviewing', 'planned', 'rejected', 'completed'];
const PRIORITY_OPTIONS = [0, 1, 2, 3, 4, 5];

const getStatusBadgeColor = (status: string) => {
  switch (status) {
    case 'completed': return 'bg-green-100 text-green-800 border-green-300';
    case 'planned': return 'bg-blue-100 text-blue-800 border-blue-300';
    case 'reviewing': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    case 'rejected': return 'bg-red-100 text-red-800 border-red-300';
    default: return 'bg-gray-100 text-gray-800 border-gray-300';
  }
};

const getPriorityBadgeColor = (priority: number) => {
  if (priority >= 4) return 'bg-red-100 text-red-800 border-red-300';
  if (priority >= 2) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
  return 'bg-gray-100 text-gray-800 border-gray-300';
};

const getDemandBadgeColor = (count: number) => {
  if (count >= 10) return 'bg-red-100 text-red-800 border-red-300';
  if (count >= 5) return 'bg-orange-100 text-orange-800 border-orange-300';
  if (count >= 3) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
  return 'bg-blue-100 text-blue-800 border-blue-300';
};

export function IntegrationRequests() {
  const { profile, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [requests, setRequests] = useState<IntegrationRequest[]>([]);
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    status: string;
    priority: number;
    admin_notes: string;
  }>({ status: '', priority: 0, admin_notes: '' });
  const [saving, setSaving] = useState(false);
  const [expandedCatalogId, setExpandedCatalogId] = useState<string | null>(null);

  // Phase 2B: Alias + Merge state
  const [aliases, setAliases] = useState<AliasEntry[]>([]);
  const [loadingAliases, setLoadingAliases] = useState(false);
  const [addAliasModal, setAddAliasModal] = useState<{ open: boolean; catalogId: string; catalogName: string }>({ open: false, catalogId: '', catalogName: '' });
  const [newAliasName, setNewAliasName] = useState('');
  const [addingAlias, setAddingAlias] = useState(false);
  const [mergeModal, setMergeModal] = useState<{ open: boolean; sourceId: string; sourceName: string }>({ open: false, sourceId: '', sourceName: '' });
  const [mergeTargetId, setMergeTargetId] = useState('');
  const [merging, setMerging] = useState(false);

  useEffect(() => {
    if (profile && !isAdmin()) {
      navigate('/brief');
    }
  }, [profile, navigate, isAdmin]);

  useEffect(() => {
    if (profile?.id && isAdmin()) {
      fetchRequests();
      fetchCatalog();
      fetchAliases();
    }
  }, [profile?.id]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('integration_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (error) {
      console.error('[AdminIntegrationRequests] Error fetching requests:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch integration requests',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCatalog = async () => {
    setLoadingCatalog(true);
    try {
      const { data, error } = await supabase
        .from('integration_catalog')
        .select('*')
        .order('total_requests', { ascending: false })
        .limit(20);

      if (error) throw error;
      setCatalog(data || []);
      console.log('[AdminIntegrationRequests] Catalog fetched:', data?.length, 'entries');
    } catch (error) {
      console.error('[AdminIntegrationRequests] Error fetching catalog:', error);
    } finally {
      setLoadingCatalog(false);
    }
  };

  const fetchAliases = async () => {
    setLoadingAliases(true);
    try {
      const { data, error } = await supabase
        .from('integration_aliases')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAliases(data || []);
      console.log('[AdminIntegrationRequests] Aliases fetched:', data?.length, 'entries');
    } catch (error) {
      console.error('[AdminIntegrationRequests] Error fetching aliases:', error);
    } finally {
      setLoadingAliases(false);
    }
  };

  const startEditing = (request: IntegrationRequest) => {
    setEditingId(request.id);
    setEditForm({
      status: request.status,
      priority: request.priority,
      admin_notes: request.admin_notes || '',
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditForm({ status: '', priority: 0, admin_notes: '' });
  };

  const handleSave = async (requestId: string) => {
    setSaving(true);
    console.log('[AdminIntegrationRequests] Updating request:', requestId, editForm);

    try {
      const updateData: Record<string, unknown> = {
        status: editForm.status,
        priority: editForm.priority,
        admin_notes: editForm.admin_notes || null,
        updated_at: new Date().toISOString(),
      };

      // Set reviewed_at when status changes to reviewing
      if (editForm.status === 'reviewing') {
        updateData.reviewed_at = new Date().toISOString();
      }
      // Set completed_at when status changes to completed
      if (editForm.status === 'completed') {
        updateData.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('integration_requests')
        .update(updateData)
        .eq('id', requestId);

      if (error) throw error;

      console.log('[AdminIntegrationRequests] Update success:', requestId);

      // Update local state
      setRequests(requests.map(r =>
        r.id === requestId
          ? { ...r, ...updateData } as IntegrationRequest
          : r
      ));

      setEditingId(null);
      toast({
        title: 'Updated',
        description: 'Integration request updated successfully',
      });
    } catch (error) {
      console.error('[AdminIntegrationRequests] Update error:', error);
      toast({
        title: 'Error',
        description: 'Failed to update request',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRefresh = () => {
    fetchRequests();
    fetchCatalog();
    fetchAliases();
  };

  // Phase 2B: Add alias manually
  const handleAddAlias = async () => {
    if (!newAliasName.trim()) return;
    setAddingAlias(true);
    try {
      const normalizedKey = newAliasName.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
      console.log('[AdminIntegrationRequests] Adding alias:', newAliasName, '→', normalizedKey, 'for catalog:', addAliasModal.catalogId);

      const { error } = await supabase
        .from('integration_aliases')
        .insert([{
          integration_catalog_id: addAliasModal.catalogId,
          alias_name: newAliasName.trim(),
          normalized_key: normalizedKey,
        }]);

      if (error) {
        if (error.code === '23505') {
          toast({ title: 'Duplicate', description: 'This alias already exists.', variant: 'destructive' });
        } else {
          throw error;
        }
      } else {
        toast({ title: 'Alias Added', description: `"${newAliasName.trim()}" mapped to ${addAliasModal.catalogName}` });
        setAddAliasModal({ open: false, catalogId: '', catalogName: '' });
        setNewAliasName('');
        fetchAliases();
      }
    } catch (error) {
      console.error('[AdminIntegrationRequests] Add alias error:', error);
      toast({ title: 'Error', description: 'Failed to add alias', variant: 'destructive' });
    } finally {
      setAddingAlias(false);
    }
  };

  // Phase 2B: Delete alias
  const handleDeleteAlias = async (aliasId: string, aliasName: string) => {
    try {
      console.log('[AdminIntegrationRequests] Deleting alias:', aliasId, aliasName);
      const { error } = await supabase
        .from('integration_aliases')
        .delete()
        .eq('id', aliasId);

      if (error) throw error;
      toast({ title: 'Alias Deleted', description: `"${aliasName}" removed` });
      fetchAliases();
    } catch (error) {
      console.error('[AdminIntegrationRequests] Delete alias error:', error);
      toast({ title: 'Error', description: 'Failed to delete alias', variant: 'destructive' });
    }
  };

  // Phase 2B: Reassign alias to a different catalog entry
  const handleReassignAlias = async (aliasId: string, newCatalogId: string) => {
    try {
      console.log('[AdminIntegrationRequests] Reassigning alias:', aliasId, '→ catalog:', newCatalogId);
      const { error } = await supabase
        .from('integration_aliases')
        .update({ integration_catalog_id: newCatalogId })
        .eq('id', aliasId);

      if (error) throw error;
      toast({ title: 'Alias Reassigned', description: 'Alias mapped to new integration' });
      fetchAliases();
      await recalculateAllCounts();
      fetchCatalog();
    } catch (error) {
      console.error('[AdminIntegrationRequests] Reassign alias error:', error);
      toast({ title: 'Error', description: 'Failed to reassign alias', variant: 'destructive' });
    }
  };

  // Phase 2B: Merge two catalog entries
  const handleMerge = async () => {
    if (!mergeTargetId || mergeTargetId === mergeModal.sourceId) {
      toast({ title: 'Invalid', description: 'Select a different target integration to merge into.', variant: 'destructive' });
      return;
    }
    setMerging(true);
    try {
      const sourceId = mergeModal.sourceId;
      const targetId = mergeTargetId;
      console.log('[AdminIntegrationRequests] Merging catalog:', sourceId, '→', targetId);

      // Step 1: Move all integration_requests from source to target
      const { error: reqError } = await supabase
        .from('integration_requests')
        .update({ integration_catalog_id: targetId })
        .eq('integration_catalog_id', sourceId);

      if (reqError) throw reqError;
      console.log('[AdminIntegrationRequests] Requests moved to target');

      // Step 2: Move all aliases from source to target
      const { error: aliasError } = await supabase
        .from('integration_aliases')
        .update({ integration_catalog_id: targetId })
        .eq('integration_catalog_id', sourceId);

      if (aliasError) throw aliasError;
      console.log('[AdminIntegrationRequests] Aliases moved to target');

      // Step 3: Delete the source catalog entry (cascade will clean up any remaining aliases)
      const { error: deleteError } = await supabase
        .from('integration_catalog')
        .delete()
        .eq('id', sourceId);

      if (deleteError) throw deleteError;
      console.log('[AdminIntegrationRequests] Source catalog entry deleted');

      // Step 4: Recalculate demand count on target
      const { count } = await supabase
        .from('integration_requests')
        .select('id', { count: 'exact', head: true })
        .eq('integration_catalog_id', targetId);

      await supabase
        .from('integration_catalog')
        .update({
          total_requests: count ?? 0,
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetId);

      console.log('[AdminIntegrationRequests] Merge complete. Target count:', count);

      toast({ title: 'Merge Complete', description: `Merged into target. Total requests: ${count}` });
      setMergeModal({ open: false, sourceId: '', sourceName: '' });
      setMergeTargetId('');
      fetchCatalog();
      fetchAliases();
      fetchRequests();
    } catch (error) {
      console.error('[AdminIntegrationRequests] Merge error:', error);
      toast({ title: 'Error', description: 'Failed to merge integrations', variant: 'destructive' });
    } finally {
      setMerging(false);
    }
  };

  // Phase 2B: Recalculate all catalog counts
  const recalculateAllCounts = async () => {
    try {
      for (const entry of catalog) {
        const { count } = await supabase
          .from('integration_requests')
          .select('id', { count: 'exact', head: true })
          .eq('integration_catalog_id', entry.id);

        await supabase
          .from('integration_catalog')
          .update({
            total_requests: count ?? 0,
            updated_at: new Date().toISOString(),
          })
          .eq('id', entry.id);
      }
      console.log('[AdminIntegrationRequests] All counts recalculated');
    } catch (error) {
      console.error('[AdminIntegrationRequests] Recalculate error:', error);
    }
  };

  const getAliasesForCatalog = (catalogId: string): AliasEntry[] => {
    return aliases.filter(a => a.integration_catalog_id === catalogId);
  };

  const toggleCatalogExpand = (catalogId: string) => {
    setExpandedCatalogId(expandedCatalogId === catalogId ? null : catalogId);
  };

  const getLinkedRequests = (catalogId: string): IntegrationRequest[] => {
    return requests.filter(r => r.integration_catalog_id === catalogId);
  };

  const getStatusDistribution = (linkedRequests: IntegrationRequest[]) => {
    const dist: Record<string, number> = {};
    linkedRequests.forEach(r => {
      dist[r.status] = (dist[r.status] || 0) + 1;
    });
    return dist;
  };

  const statusCounts = {
    pending: requests.filter(r => r.status === 'pending').length,
    reviewing: requests.filter(r => r.status === 'reviewing').length,
    planned: requests.filter(r => r.status === 'planned').length,
    completed: requests.filter(r => r.status === 'completed').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Inbox className="h-8 w-8 text-indigo-500" />
            Integration Requests
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage user-submitted integration requests
          </p>
        </div>
        <Button onClick={handleRefresh} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Status Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-gray-800 dark:text-gray-200">{statusCounts.pending}</p>
            <p className="text-xs text-gray-500">Pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-yellow-600">{statusCounts.reviewing}</p>
            <p className="text-xs text-gray-500">Reviewing</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{statusCounts.planned}</p>
            <p className="text-xs text-gray-500">Planned</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{statusCounts.completed}</p>
            <p className="text-xs text-gray-500">Completed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{statusCounts.rejected}</p>
            <p className="text-xs text-gray-500">Rejected</p>
          </CardContent>
        </Card>
      </div>

      {/* Top Requested Integrations — Demand Intelligence */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-indigo-500" />
            Top Requested Integrations
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingCatalog ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
            </div>
          ) : catalog.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No catalog entries yet. Requests will appear here once submitted.
            </div>
          ) : (
            <div className="space-y-2">
              {catalog.map((entry, index) => {
                const isExpanded = expandedCatalogId === entry.id;
                const linkedRequests = isExpanded ? getLinkedRequests(entry.id) : [];
                const statusDist = isExpanded ? getStatusDistribution(linkedRequests) : {};

                return (
                  <div key={entry.id} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                    {/* Catalog row — clickable */}
                    <button
                      onClick={() => toggleCatalogExpand(entry.id)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-mono text-gray-400 w-6 text-right">
                          {index + 1}.
                        </span>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {entry.canonical_name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {entry.category || 'Uncategorized'} &middot; Key: {entry.normalized_key}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {getAliasesForCatalog(entry.id).length > 1 && (
                          <span className="text-xs text-gray-400">
                            {getAliasesForCatalog(entry.id).length} aliases
                          </span>
                        )}
                        <Badge className={getDemandBadgeColor(entry.total_requests)}>
                          {entry.total_requests} request{entry.total_requests !== 1 ? 's' : ''}
                        </Badge>
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-gray-400" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-gray-400" />
                        )}
                      </div>
                    </button>

                    {/* Expanded detail view */}
                    {isExpanded && (
                      <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30 px-4 py-3 space-y-3">
                        {/* Admin actions */}
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => {
                              setAddAliasModal({ open: true, catalogId: entry.id, catalogName: entry.canonical_name });
                              setNewAliasName('');
                            }}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Add Alias
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => {
                              setMergeModal({ open: true, sourceId: entry.id, sourceName: entry.canonical_name });
                              setMergeTargetId('');
                            }}
                          >
                            <Merge className="h-3 w-3 mr-1" />
                            Merge Into...
                          </Button>
                        </div>

                        {/* Aliases list */}
                        {(() => {
                          const entryAliases = getAliasesForCatalog(entry.id);
                          return entryAliases.length > 0 ? (
                            <div className="space-y-1">
                              <span className="text-xs text-gray-500 font-medium flex items-center gap-1">
                                <Link2 className="h-3 w-3" />
                                Aliases ({entryAliases.length}):
                              </span>
                              <div className="flex flex-wrap gap-2">
                                {entryAliases.map((alias) => (
                                  <div key={alias.id} className="flex items-center gap-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded px-2 py-1">
                                    <span className="text-xs text-gray-700 dark:text-gray-300">{alias.alias_name}</span>
                                    <span className="text-xs text-gray-400">({alias.normalized_key})</span>
                                    <button
                                      onClick={() => handleDeleteAlias(alias.id, alias.alias_name)}
                                      className="ml-1 text-gray-400 hover:text-red-500 transition-colors"
                                      title="Delete alias"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null;
                        })()}

                        {/* Status distribution */}
                        {Object.keys(statusDist).length > 0 && (
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-gray-500 font-medium">Status:</span>
                            {Object.entries(statusDist).map(([status, count]) => (
                              <Badge key={status} className={`${getStatusBadgeColor(status)} text-xs`}>
                                {status.charAt(0).toUpperCase() + status.slice(1)}: {count}
                              </Badge>
                            ))}
                          </div>
                        )}

                        {/* Linked requests table */}
                        {linkedRequests.length === 0 ? (
                          <p className="text-sm text-gray-500">No linked requests found (may be unlinked legacy data).</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="text-xs">User ID</TableHead>
                                  <TableHead className="text-xs">Use Case</TableHead>
                                  <TableHead className="text-xs">Status</TableHead>
                                  <TableHead className="text-xs">Created</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {linkedRequests.map((req) => (
                                  <TableRow key={req.id}>
                                    <TableCell className="text-xs font-mono text-gray-500">
                                      {req.user_id.substring(0, 8)}...
                                    </TableCell>
                                    <TableCell className="text-xs text-gray-600 dark:text-gray-400 max-w-sm">
                                      <p className="truncate" title={req.use_case}>{req.use_case}</p>
                                    </TableCell>
                                    <TableCell>
                                      <Badge className={`${getStatusBadgeColor(req.status)} text-xs`}>
                                        {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-xs text-gray-500">
                                      {format(new Date(req.created_at), 'MMM d, yyyy')}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Requests Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Requests ({requests.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No integration requests yet
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Integration</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Use Case</TableHead>
                    <TableHead>User ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Admin Notes</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Reviewed</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell className="font-medium">
                        <div>
                          <p>{request.integration_name}</p>
                          {request.url && (
                            <a
                              href={request.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-500 hover:underline"
                            >
                              {request.url}
                            </a>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{request.category}</TableCell>
                      <TableCell className="max-w-xs">
                        <p className="text-sm text-gray-600 dark:text-gray-400 truncate" title={request.use_case}>
                          {request.use_case}
                        </p>
                      </TableCell>
                      <TableCell className="text-xs font-mono text-gray-500">
                        {request.user_id.substring(0, 8)}...
                      </TableCell>

                      {/* Status - inline editable */}
                      <TableCell>
                        {editingId === request.id ? (
                          <Select
                            value={editForm.status}
                            onValueChange={(val) => setEditForm({ ...editForm, status: val })}
                          >
                            <SelectTrigger className="w-28 h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUS_OPTIONS.map((s) => (
                                <SelectItem key={s} value={s}>
                                  {s.charAt(0).toUpperCase() + s.slice(1)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge className={getStatusBadgeColor(request.status)}>
                            {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                          </Badge>
                        )}
                      </TableCell>

                      {/* Priority - inline editable */}
                      <TableCell>
                        {editingId === request.id ? (
                          <Select
                            value={String(editForm.priority)}
                            onValueChange={(val) => setEditForm({ ...editForm, priority: parseInt(val) })}
                          >
                            <SelectTrigger className="w-16 h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {PRIORITY_OPTIONS.map((p) => (
                                <SelectItem key={p} value={String(p)}>
                                  {p}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge className={getPriorityBadgeColor(request.priority)}>
                            P{request.priority}
                          </Badge>
                        )}
                      </TableCell>

                      {/* Admin Notes - inline editable */}
                      <TableCell className="max-w-xs">
                        {editingId === request.id ? (
                          <Textarea
                            value={editForm.admin_notes}
                            onChange={(e) => setEditForm({ ...editForm, admin_notes: e.target.value })}
                            placeholder="Add notes..."
                            rows={2}
                            className="text-xs min-w-[200px]"
                          />
                        ) : (
                          <p className="text-sm text-gray-600 dark:text-gray-400 truncate" title={request.admin_notes || ''}>
                            {request.admin_notes || '—'}
                          </p>
                        )}
                      </TableCell>

                      <TableCell className="text-xs text-gray-500">
                        {format(new Date(request.created_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="text-xs text-gray-500">
                        {request.reviewed_at ? format(new Date(request.reviewed_at), 'MMM d, yyyy') : '—'}
                      </TableCell>
                      <TableCell className="text-xs text-gray-500">
                        {request.completed_at ? format(new Date(request.completed_at), 'MMM d, yyyy') : '—'}
                      </TableCell>

                      {/* Actions */}
                      <TableCell>
                        {editingId === request.id ? (
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              onClick={() => handleSave(request.id)}
                              disabled={saving}
                              className="h-7 text-xs"
                            >
                              {saving ? (
                                <RefreshCw className="h-3 w-3 animate-spin" />
                              ) : (
                                <Save className="h-3 w-3 mr-1" />
                              )}
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={cancelEditing}
                              className="h-7 text-xs"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => startEditing(request)}
                            className="h-7 text-xs"
                          >
                            Edit
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      {/* Phase 2B: Integration Aliases Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-indigo-500" />
            Integration Aliases ({aliases.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingAliases ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
            </div>
          ) : aliases.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No aliases yet. Aliases are auto-created when new integrations are submitted.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Alias Name</TableHead>
                    <TableHead className="text-xs">Normalized Key</TableHead>
                    <TableHead className="text-xs">Canonical Integration</TableHead>
                    <TableHead className="text-xs">Reassign</TableHead>
                    <TableHead className="text-xs">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aliases.map((alias) => {
                    const parentCatalog = catalog.find(c => c.id === alias.integration_catalog_id);
                    return (
                      <TableRow key={alias.id}>
                        <TableCell className="font-medium text-sm">{alias.alias_name}</TableCell>
                        <TableCell className="text-xs font-mono text-gray-500">{alias.normalized_key}</TableCell>
                        <TableCell className="text-sm">
                          {parentCatalog?.canonical_name || 'Unknown'}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={alias.integration_catalog_id}
                            onValueChange={(val) => handleReassignAlias(alias.id, val)}
                          >
                            <SelectTrigger className="w-40 h-7 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {catalog.map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                  {c.canonical_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-red-500 hover:text-red-700"
                            onClick={() => handleDeleteAlias(alias.id, alias.alias_name)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Phase 2B: Add Alias Modal */}
      <Dialog open={addAliasModal.open} onOpenChange={(open) => setAddAliasModal({ ...addAliasModal, open })}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Add Alias</DialogTitle>
            <DialogDescription>
              Add a new alias for <strong>{addAliasModal.catalogName}</strong>. Future requests matching this alias will be grouped under this integration.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="alias-name">Alias Name</Label>
              <Input
                id="alias-name"
                placeholder="e.g., MS Teams, MSFT Teams"
                value={newAliasName}
                onChange={(e) => setNewAliasName(e.target.value)}
                disabled={addingAlias}
              />
              {newAliasName && (
                <p className="text-xs text-gray-500">
                  Normalized key: <span className="font-mono">{newAliasName.toLowerCase().trim().replace(/[^a-z0-9]/g, '')}</span>
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddAliasModal({ open: false, catalogId: '', catalogName: '' })} disabled={addingAlias}>
              Cancel
            </Button>
            <Button onClick={handleAddAlias} disabled={addingAlias || !newAliasName.trim()}>
              {addingAlias ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Add Alias
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Phase 2B: Merge Modal */}
      <Dialog open={mergeModal.open} onOpenChange={(open) => setMergeModal({ ...mergeModal, open })}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Merge Integration</DialogTitle>
            <DialogDescription>
              Merge <strong>{mergeModal.sourceName}</strong> into another integration. All requests and aliases will be moved to the target. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Merge Into</Label>
              <Select value={mergeTargetId} onValueChange={setMergeTargetId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select target integration" />
                </SelectTrigger>
                <SelectContent>
                  {catalog.filter(c => c.id !== mergeModal.sourceId).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.canonical_name} ({c.total_requests} requests)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMergeModal({ open: false, sourceId: '', sourceName: '' })} disabled={merging}>
              Cancel
            </Button>
            <Button onClick={handleMerge} disabled={merging || !mergeTargetId} variant="destructive">
              {merging ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Merge className="mr-2 h-4 w-4" />}
              Merge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
