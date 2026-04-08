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
import { RefreshCw, Inbox, Save, X } from 'lucide-react';
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

export function IntegrationRequests() {
  const { profile, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [requests, setRequests] = useState<IntegrationRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    status: string;
    priority: number;
    admin_notes: string;
  }>({ status: '', priority: 0, admin_notes: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile && !isAdmin()) {
      navigate('/brief');
    }
  }, [profile, navigate, isAdmin]);

  useEffect(() => {
    if (profile?.id && isAdmin()) {
      fetchRequests();
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
        <Button onClick={fetchRequests} disabled={loading}>
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
