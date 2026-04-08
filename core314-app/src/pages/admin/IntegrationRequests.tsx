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
import { RefreshCw, Inbox, Save, X, TrendingUp, ChevronDown, ChevronRight } from 'lucide-react';
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

  useEffect(() => {
    if (profile && !isAdmin()) {
      navigate('/brief');
    }
  }, [profile, navigate, isAdmin]);

  useEffect(() => {
    if (profile?.id && isAdmin()) {
      fetchRequests();
      fetchCatalog();
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
    </div>
  );
}
