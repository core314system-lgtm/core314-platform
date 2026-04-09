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
import { RefreshCw, Inbox, Save, X, TrendingUp, ChevronDown, ChevronRight, Link2, Merge, Plus, Trash2, Loader2, BarChart3, Settings2, Lightbulb, Zap, Target, ArrowDown, Rocket, Play, Users, Star, Edit, Send, Gift, CheckCircle, XCircle } from 'lucide-react';
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
  priority_score: number;
  unique_users_count: number;
  last_requested_at: string | null;
  created_at: string;
  updated_at: string;
}

interface CategoryWeight {
  id: string;
  category: string;
  weight: number;
  created_at: string;
}

interface AliasEntry {
  id: string;
  integration_catalog_id: string;
  alias_name: string;
  normalized_key: string;
  created_at: string;
}

interface ExecutionRecord {
  id: string;
  integration_catalog_id: string;
  status: string;
  estimated_completion_date: string | null;
  notes: string | null;
  monetization_potential: string;
  created_at: string;
  updated_at: string;
}

interface CommitmentCount {
  integration_catalog_id: string;
  interested: number;
  high_priority: number;
  total: number;
}

interface PrivateOffer {
  id: string;
  integration_catalog_id: string;
  user_id: string;
  offer_title: string;
  offer_description: string;
  status: string;
  created_at: string;
  responded_at: string | null;
}

interface ProfileEntry {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
}

interface Recommendation {
  id: string;
  integration_catalog_id: string | null;
  recommendation_type: string;
  title: string;
  description: string;
  priority_score_snapshot: number | null;
  created_at: string;
}

const RECOMMENDATION_TYPE_ORDER: Record<string, number> = {
  'build_now': 0,
  'high_demand': 1,
  'trending_up': 2,
  'category_gap': 3,
  'low_priority': 4,
};

const getRecommendationBadgeColor = (type: string) => {
  switch (type) {
    case 'build_now': return 'bg-red-100 text-red-800 border-red-300';
    case 'high_demand': return 'bg-orange-100 text-orange-800 border-orange-300';
    case 'trending_up': return 'bg-green-100 text-green-800 border-green-300';
    case 'category_gap': return 'bg-purple-100 text-purple-800 border-purple-300';
    case 'low_priority': return 'bg-gray-100 text-gray-500 border-gray-300';
    default: return 'bg-blue-100 text-blue-800 border-blue-300';
  }
};

const getRecommendationIcon = (type: string) => {
  switch (type) {
    case 'build_now': return Zap;
    case 'high_demand': return TrendingUp;
    case 'trending_up': return TrendingUp;
    case 'category_gap': return Target;
    case 'low_priority': return ArrowDown;
    default: return Lightbulb;
  }
};

const formatRecommendationType = (type: string) => {
  switch (type) {
    case 'build_now': return 'Build Now';
    case 'high_demand': return 'High Demand';
    case 'trending_up': return 'Trending Up';
    case 'category_gap': return 'Category Gap';
    case 'low_priority': return 'Low Priority';
    default: return type;
  }
};

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

  // Phase 2C: Priority Scoring state
  const [categoryWeights, setCategoryWeights] = useState<CategoryWeight[]>([]);
  const [loadingWeights, setLoadingWeights] = useState(false);
  const [editingWeightId, setEditingWeightId] = useState<string | null>(null);
  const [editWeightValue, setEditWeightValue] = useState('');
  const [savingWeight, setSavingWeight] = useState(false);

  // Phase 2D: AI Recommendations state
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [generatingRecommendations, setGeneratingRecommendations] = useState(false);
  const [recFilterType, setRecFilterType] = useState<string>('all');
  const [recFilterCategory, setRecFilterCategory] = useState<string>('all');

  // Phase 3A: Execution Pipeline + Commitments state
  const [executionRecords, setExecutionRecords] = useState<ExecutionRecord[]>([]);
  const [loadingExecution, setLoadingExecution] = useState(false);
  const [commitmentCounts, setCommitmentCounts] = useState<CommitmentCount[]>([]);
  const [editingExecutionId, setEditingExecutionId] = useState<string | null>(null);
  const [executionForm, setExecutionForm] = useState<{
    status: string;
    estimated_completion_date: string;
    notes: string;
    monetization_potential: string;
  }>({ status: 'not_started', estimated_completion_date: '', notes: '', monetization_potential: 'low' });
  const [savingExecution, setSavingExecution] = useState(false);
  const [creatingExecution, setCreatingExecution] = useState(false);

  // Phase 3B: Private Offers state
  const [privateOffers, setPrivateOffers] = useState<PrivateOffer[]>([]);
  const [loadingOffers, setLoadingOffers] = useState(false);
  const [allProfiles, setAllProfiles] = useState<ProfileEntry[]>([]);
  const [offerModal, setOfferModal] = useState<{ open: boolean; catalogId: string; catalogName: string }>({ open: false, catalogId: '', catalogName: '' });
  const [offerForm, setOfferForm] = useState<{ user_id: string; offer_title: string; offer_description: string }>({ user_id: '', offer_title: '', offer_description: '' });
  const [sendingOffer, setSendingOffer] = useState(false);

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
      fetchCategoryWeights();
      fetchRecommendations();
      fetchExecutionRecords();
      fetchCommitmentCounts();
      fetchPrivateOffers();
      fetchAllProfiles();
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
        .order('priority_score', { ascending: false })
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

  const fetchCategoryWeights = async () => {
    setLoadingWeights(true);
    try {
      const { data, error } = await supabase
        .from('integration_category_weights')
        .select('*')
        .order('category', { ascending: true });

      if (error) throw error;
      setCategoryWeights(data || []);
      console.log('[AdminIntegrationRequests] Category weights fetched:', data?.length);
    } catch (error) {
      console.error('[AdminIntegrationRequests] Error fetching category weights:', error);
    } finally {
      setLoadingWeights(false);
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
    fetchCategoryWeights();
    fetchRecommendations();
    fetchExecutionRecords();
    fetchCommitmentCounts();
    fetchPrivateOffers();
  };

  // Phase 3A: Fetch execution records
  const fetchExecutionRecords = async () => {
    setLoadingExecution(true);
    try {
      const { data, error } = await supabase
        .from('integration_execution')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setExecutionRecords(data || []);
      console.log('[AdminIntegrationRequests] Execution records fetched:', data?.length);
    } catch (error) {
      console.error('[AdminIntegrationRequests] Error fetching execution records:', error);
    } finally {
      setLoadingExecution(false);
    }
  };

  // Phase 3A: Fetch commitment counts (aggregated)
  const fetchCommitmentCounts = async () => {
    try {
      const { data, error } = await supabase
        .from('integration_commitments')
        .select('integration_catalog_id, commitment_type');

      if (error) throw error;
      const counts: Record<string, CommitmentCount> = {};
      (data || []).forEach((c: { integration_catalog_id: string; commitment_type: string }) => {
        if (!counts[c.integration_catalog_id]) {
          counts[c.integration_catalog_id] = { integration_catalog_id: c.integration_catalog_id, interested: 0, high_priority: 0, total: 0 };
        }
        if (c.commitment_type === 'high_priority') {
          counts[c.integration_catalog_id].high_priority++;
        } else {
          counts[c.integration_catalog_id].interested++;
        }
        counts[c.integration_catalog_id].total++;
      });
      setCommitmentCounts(Object.values(counts));
      console.log('[AdminIntegrationRequests] Commitment counts fetched:', Object.keys(counts).length);
    } catch (error) {
      console.error('[AdminIntegrationRequests] Error fetching commitment counts:', error);
    }
  };

  // Phase 3A: Create execution record
  const handleCreateExecution = async (catalogId: string) => {
    setCreatingExecution(true);
    console.log('[AdminIntegrationRequests] Creating execution record for:', catalogId);
    try {
      const { error } = await supabase
        .from('integration_execution')
        .insert({
          integration_catalog_id: catalogId,
          status: 'planned',
          monetization_potential: 'low',
        });
      if (error) throw error;
      toast({ title: 'Execution Created', description: 'Integration added to execution pipeline' });
      await fetchExecutionRecords();
      // Trigger notification structure
      notifyUsersOnStatusChange(catalogId, 'not_started', 'planned');
    } catch (error) {
      console.error('[AdminIntegrationRequests] Create execution error:', error);
      toast({ title: 'Error', description: 'Failed to create execution record', variant: 'destructive' });
    } finally {
      setCreatingExecution(false);
    }
  };

  // Phase 3A: Start editing execution record
  const startEditingExecution = (exec: ExecutionRecord) => {
    setEditingExecutionId(exec.id);
    setExecutionForm({
      status: exec.status,
      estimated_completion_date: exec.estimated_completion_date ? exec.estimated_completion_date.split('T')[0] : '',
      notes: exec.notes || '',
      monetization_potential: exec.monetization_potential,
    });
  };

  // Phase 3A: Save execution record updates
  const handleSaveExecution = async (execId: string, catalogId: string) => {
    setSavingExecution(true);
    console.log('[AdminIntegrationRequests] Updating execution:', execId, executionForm);
    try {
      const oldExec = executionRecords.find(e => e.id === execId);
      const { error } = await supabase
        .from('integration_execution')
        .update({
          status: executionForm.status,
          estimated_completion_date: executionForm.estimated_completion_date || null,
          notes: executionForm.notes || null,
          monetization_potential: executionForm.monetization_potential,
          updated_at: new Date().toISOString(),
        })
        .eq('id', execId);

      if (error) throw error;
      toast({ title: 'Updated', description: 'Execution record updated' });
      await logAdminAudit('execution_status_change', { exec_id: execId, catalog_id: catalogId, old_status: oldExec?.status, new_status: executionForm.status });
      setEditingExecutionId(null);
      await fetchExecutionRecords();

      // Phase 3A: Notify on status change
      if (oldExec && oldExec.status !== executionForm.status) {
        notifyUsersOnStatusChange(catalogId, oldExec.status, executionForm.status);
      }
    } catch (error) {
      console.error('[AdminIntegrationRequests] Save execution error:', error);
      toast({ title: 'Error', description: 'Failed to update execution record', variant: 'destructive' });
    } finally {
      setSavingExecution(false);
    }
  };

  // Phase 3A: Notification hook structure (no external service yet)
  const notifyUsersOnStatusChange = (catalogId: string, oldStatus: string, newStatus: string) => {
    console.log(`[AdminIntegrationRequests] Status change notification: ${catalogId} changed from ${oldStatus} to ${newStatus}`);
    console.log('[AdminIntegrationRequests] TODO: Wire to email/push notification service when ready');
  };

  // Phase 3B: Fetch private offers
  const fetchPrivateOffers = async () => {
    setLoadingOffers(true);
    try {
      const { data, error } = await supabase
        .from('integration_private_offers')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setPrivateOffers(data || []);
      console.log('[AdminIntegrationRequests] Private offers fetched:', data?.length);
    } catch (error) {
      console.error('[AdminIntegrationRequests] Error fetching private offers:', error);
    } finally {
      setLoadingOffers(false);
    }
  };

  // Phase 3B: Fetch all profiles for user selection
  const fetchAllProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, role')
        .order('email', { ascending: true });
      if (error) throw error;
      setAllProfiles(data || []);
      console.log('[AdminIntegrationRequests] Profiles fetched:', data?.length);
    } catch (error) {
      console.error('[AdminIntegrationRequests] Error fetching profiles:', error);
    }
  };

  // Phase 3B: Create private offer
  const handleCreateOffer = async () => {
    if (!offerForm.user_id || !offerForm.offer_title || !offerForm.offer_description) return;
    setSendingOffer(true);
    console.log('[AdminIntegrationRequests] Creating private offer:', offerModal.catalogId, offerForm);
    try {
      const { error } = await supabase
        .from('integration_private_offers')
        .insert({
          integration_catalog_id: offerModal.catalogId,
          user_id: offerForm.user_id,
          offer_title: offerForm.offer_title,
          offer_description: offerForm.offer_description,
        });
      if (error) throw error;
      toast({ title: 'Offer Sent', description: 'Private offer created and delivered to user' });
      await logAdminAudit('private_offer_created', { catalog_id: offerModal.catalogId, catalog_name: offerModal.catalogName, user_id: offerForm.user_id, offer_title: offerForm.offer_title });
      setOfferModal({ open: false, catalogId: '', catalogName: '' });
      setOfferForm({ user_id: '', offer_title: '', offer_description: '' });
      await fetchPrivateOffers();
      notifyUserOfOffer(offerForm.user_id, offerModal.catalogId);
    } catch (error) {
      console.error('[AdminIntegrationRequests] Create offer error:', error);
      toast({ title: 'Error', description: 'Failed to create private offer', variant: 'destructive' });
    } finally {
      setSendingOffer(false);
    }
  };

  // Phase 3B: Notification hook for new offer
  const notifyUserOfOffer = (userId: string, catalogId: string) => {
    console.log(`[AdminIntegrationRequests] Offer notification: user ${userId} for integration ${catalogId}`);
    console.log('[AdminIntegrationRequests] TODO: Wire to email/push notification service when ready');
  };

  // Phase 3B: Get offers for a catalog entry
  const getOffersForCatalog = (catalogId: string) => {
    return privateOffers.filter(o => o.integration_catalog_id === catalogId);
  };

  // Phase 3B: Get offer status badge color
  const getOfferStatusColor = (status: string) => {
    switch (status) {
      case 'accepted': return 'bg-green-100 text-green-800 border-green-300';
      case 'declined': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    }
  };

  // Phase 3B: Get user display name
  const getUserDisplay = (userId: string) => {
    const p = allProfiles.find(pr => pr.id === userId);
    return p ? (p.full_name || p.email) : userId.slice(0, 8) + '...';
  };

  // Phase 3A: Get execution record for a catalog entry
  const getExecutionForCatalog = (catalogId: string) => {
    return executionRecords.find(e => e.integration_catalog_id === catalogId);
  };

  // Phase 3A: Get commitment counts for a catalog entry
  const getCommitmentCountsForCatalog = (catalogId: string) => {
    return commitmentCounts.find(c => c.integration_catalog_id === catalogId) || { interested: 0, high_priority: 0, total: 0 };
  };

  const EXECUTION_STATUS_OPTIONS = ['not_started', 'planned', 'in_progress', 'beta', 'completed'];
  const MONETIZATION_OPTIONS = ['low', 'medium', 'high'];

  const getExecutionStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 border-green-300';
      case 'beta': return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'in_progress': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'planned': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getMonetizationColor = (level: string) => {
    switch (level) {
      case 'high': return 'bg-green-100 text-green-800 border-green-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const formatExecutionStatus = (status: string) => {
    switch (status) {
      case 'not_started': return 'Not Started';
      case 'planned': return 'Planned';
      case 'in_progress': return 'In Progress';
      case 'beta': return 'Beta';
      case 'completed': return 'Completed';
      default: return status;
    }
  };

  // Phase 2D: Fetch recommendations
  const fetchRecommendations = async () => {
    setLoadingRecommendations(true);
    try {
      const { data, error } = await supabase
        .from('integration_recommendations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      // Sort by recommendation type importance
      const sorted = (data || []).sort((a, b) => {
        const aOrder = RECOMMENDATION_TYPE_ORDER[a.recommendation_type] ?? 99;
        const bOrder = RECOMMENDATION_TYPE_ORDER[b.recommendation_type] ?? 99;
        return aOrder - bOrder;
      });
      setRecommendations(sorted);
      console.log('[AdminIntegrationRequests] Recommendations fetched:', sorted.length);
    } catch (error) {
      console.error('[AdminIntegrationRequests] Error fetching recommendations:', error);
    } finally {
      setLoadingRecommendations(false);
    }
  };

  // Phase 2D: Generate recommendations engine
  const generateIntegrationRecommendations = async () => {
    setGeneratingRecommendations(true);
    console.log('[AdminIntegrationRequests] Recommendation generation started');
    try {
      // Fetch fresh catalog data for computation
      const { data: catalogData, error: catError } = await supabase
        .from('integration_catalog')
        .select('*')
        .order('priority_score', { ascending: false });

      if (catError) throw catError;
      const allEntries: CatalogEntry[] = catalogData || [];
      if (allEntries.length === 0) {
        console.log('[AdminIntegrationRequests] No catalog entries, skipping recommendation generation');
        setGeneratingRecommendations(false);
        return;
      }

      // Step 1: Clear existing recommendations
      const { error: deleteError } = await supabase
        .from('integration_recommendations')
        .delete()
        .gte('created_at', '1970-01-01T00:00:00Z');

      if (deleteError) throw deleteError;
      console.log('[AdminIntegrationRequests] Cleared existing recommendations');

      const newRecs: Array<{
        integration_catalog_id: string | null;
        recommendation_type: string;
        title: string;
        description: string;
        priority_score_snapshot: number | null;
      }> = [];

      // Compute thresholds
      const scores = allEntries.map(e => e.priority_score ?? 0);
      const sortedScores = [...scores].sort((a, b) => b - a);
      const top10Idx = Math.max(0, Math.floor(sortedScores.length * 0.1) - 1);
      const bottom30Idx = Math.floor(sortedScores.length * 0.7);
      const top10Threshold = sortedScores[top10Idx] ?? 0;
      const bottom30Threshold = sortedScores[bottom30Idx] ?? 0;

      // Count integrations per category
      const categoryCounts: Record<string, number> = {};
      allEntries.forEach(e => {
        const cat = e.category || 'Other';
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      });
      const avgPerCategory = allEntries.length / Math.max(Object.keys(categoryCounts).length, 1);

      // Fetch recent requests for trending detection
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      for (const entry of allEntries) {
        const score = entry.priority_score ?? 0;

        // BUILD NOW: top 10% priority score
        if (score >= top10Threshold && top10Threshold > 0) {
          newRecs.push({
            integration_catalog_id: entry.id,
            recommendation_type: 'build_now',
            title: `Build ${entry.canonical_name} Next`,
            description: 'This integration has one of the highest priority scores based on demand, recency, and user distribution.',
            priority_score_snapshot: score,
          });
        }

        // HIGH DEMAND: total_requests >= 5 or top 30%
        if (entry.total_requests >= 5) {
          newRecs.push({
            integration_catalog_id: entry.id,
            recommendation_type: 'high_demand',
            title: 'High Demand Integration',
            description: `This integration has been requested ${entry.total_requests} times by multiple users.`,
            priority_score_snapshot: score,
          });
        }

        // TRENDING UP: requests in last 7 days vs 30-day avg
        const { count: recentCount } = await supabase
          .from('integration_requests')
          .select('id', { count: 'exact', head: true })
          .eq('integration_catalog_id', entry.id)
          .gte('created_at', sevenDaysAgo);

        const { count: monthCount } = await supabase
          .from('integration_requests')
          .select('id', { count: 'exact', head: true })
          .eq('integration_catalog_id', entry.id)
          .gte('created_at', thirtyDaysAgo);

        const recent = recentCount ?? 0;
        const monthly = monthCount ?? 0;
        const weeklyAvg = monthly > 0 ? (monthly / 4.3) : 0;

        if (recent > 0 && (weeklyAvg === 0 || recent > weeklyAvg * 1.5)) {
          newRecs.push({
            integration_catalog_id: entry.id,
            recommendation_type: 'trending_up',
            title: 'Trending Integration',
            description: `Recent demand for ${entry.canonical_name} has increased significantly (${recent} requests in the last 7 days).`,
            priority_score_snapshot: score,
          });
        }

        // LOW PRIORITY: bottom 30%
        if (score <= bottom30Threshold && score < top10Threshold) {
          newRecs.push({
            integration_catalog_id: entry.id,
            recommendation_type: 'low_priority',
            title: 'Low Priority Integration',
            description: 'This integration currently has low demand and priority.',
            priority_score_snapshot: score,
          });
        }
      }

      // CATEGORY GAP: underrepresented categories
      const allWeightCategories = categoryWeights.map(w => w.category);
      for (const cat of allWeightCategories) {
        const count = categoryCounts[cat] || 0;
        if (count < avgPerCategory * 0.5 && count > 0) {
          newRecs.push({
            integration_catalog_id: null,
            recommendation_type: 'category_gap',
            title: 'Category Opportunity Detected',
            description: `The ${cat} category has relatively low coverage (${count} integration${count !== 1 ? 's' : ''}) but emerging demand.`,
            priority_score_snapshot: null,
          });
        }
      }

      // Also detect categories with demand but zero integrations in catalog
      for (const cat of allWeightCategories) {
        if (!categoryCounts[cat]) {
          // Check if there are any requests in this category
          const { count: reqCount } = await supabase
            .from('integration_requests')
            .select('id', { count: 'exact', head: true })
            .eq('category', cat);

          if ((reqCount ?? 0) > 0) {
            newRecs.push({
              integration_catalog_id: null,
              recommendation_type: 'category_gap',
              title: 'Category Opportunity Detected',
              description: `The ${cat} category has ${reqCount} request${(reqCount ?? 0) !== 1 ? 's' : ''} but no catalog entries yet.`,
              priority_score_snapshot: null,
            });
          }
        }
      }

      // Insert all recommendations (skip duplicates via unique index)
      if (newRecs.length > 0) {
        const { error: insertError } = await supabase
          .from('integration_recommendations')
          .insert(newRecs);

        if (insertError) {
          console.error('[AdminIntegrationRequests] Recommendation insert error:', insertError);
        }
      }

      console.log('[AdminIntegrationRequests] Recommendation generation complete:', newRecs.length, 'recommendations created');
      toast({ title: 'Recommendations Updated', description: `${newRecs.length} recommendations generated` });
      fetchRecommendations();
    } catch (error) {
      console.error('[AdminIntegrationRequests] Recommendation generation error:', error);
      toast({ title: 'Error', description: 'Failed to generate recommendations', variant: 'destructive' });
    } finally {
      setGeneratingRecommendations(false);
    }
  };

  // P1 Hardening: Audit log admin actions to system_health_logs
  const logAdminAudit = async (action: string, details: Record<string, unknown>) => {
    try {
      await supabase.from('system_health_logs').insert({
        service: 'admin_audit',
        status: 'success',
        message: action,
        metadata: { ...details, admin_id: profile?.id, timestamp: new Date().toISOString() },
      });
    } catch (e) {
      console.error('[AdminAudit] Failed to log:', e);
    }
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
      await logAdminAudit('alias_reassign', { alias_id: aliasId, new_catalog_id: newCatalogId });
      fetchAliases();
      await recalculateAllCounts();
      fetchCatalog();

      // Phase 2D: Regenerate recommendations after alias reassign
      generateIntegrationRecommendations();
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

      // Step 4: Recalculate demand count + priority score on target
      const targetEntry = catalog.find(c => c.id === targetId);
      await recalculateCatalogEntry(targetId, targetEntry?.category ?? null);

      console.log('[AdminIntegrationRequests] Merge complete with priority recalculation');

      await logAdminAudit('catalog_merge', { source_id: sourceId, target_id: targetId, source_name: mergeModal.sourceName });
      toast({ title: 'Merge Complete', description: 'Merged into target. Priority score recalculated.' });
      setMergeModal({ open: false, sourceId: '', sourceName: '' });
      setMergeTargetId('');
      fetchCatalog();
      fetchAliases();
      fetchRequests();

      // Phase 2D: Regenerate recommendations after merge
      generateIntegrationRecommendations();
    } catch (error) {
      console.error('[AdminIntegrationRequests] Merge error:', error);
      toast({ title: 'Error', description: 'Failed to merge integrations', variant: 'destructive' });
    } finally {
      setMerging(false);
    }
  };

  // Recalculate all catalog counts + priority scores
  const recalculateAllCounts = async () => {
    try {
      for (const entry of catalog) {
        await recalculateCatalogEntry(entry.id, entry.category);
      }
      console.log('[AdminIntegrationRequests] All counts and scores recalculated');
    } catch (error) {
      console.error('[AdminIntegrationRequests] Recalculate error:', error);
    }
  };

  // Phase 2C: Recalculate a single catalog entry's priority score
  const recalculateCatalogEntry = async (catalogId: string, category: string | null) => {
    const { count: totalReqs } = await supabase
      .from('integration_requests')
      .select('id', { count: 'exact', head: true })
      .eq('integration_catalog_id', catalogId);

    const { count: uniqueUsers } = await supabase
      .from('integration_requests')
      .select('user_id', { count: 'exact', head: true })
      .eq('integration_catalog_id', catalogId);

    const { data: lastReqData } = await supabase
      .from('integration_requests')
      .select('created_at')
      .eq('integration_catalog_id', catalogId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const lastRequestedAt = lastReqData?.created_at ?? null;

    // Recency score
    let recencyScore = 0.1;
    if (lastRequestedAt) {
      const daysSince = (Date.now() - new Date(lastRequestedAt).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince <= 7) recencyScore = 1.0;
      else if (daysSince <= 30) recencyScore = 0.7;
      else if (daysSince <= 90) recencyScore = 0.4;
    }

    // Category weight
    const weight = categoryWeights.find(w => w.category === category);
    const categoryWeight = weight?.weight ?? 1.0;

    const total = totalReqs ?? 0;
    const unique = uniqueUsers ?? 0;
    const priorityScore = (total * 0.4) + (unique * 0.3) + (recencyScore * 0.2) + (categoryWeight * 0.1);

    await supabase
      .from('integration_catalog')
      .update({
        total_requests: total,
        unique_users_count: unique,
        last_requested_at: lastRequestedAt,
        priority_score: priorityScore,
        updated_at: new Date().toISOString(),
      })
      .eq('id', catalogId);

    console.log('[AdminIntegrationRequests] Recalculated:', catalogId, '→ score:', priorityScore.toFixed(2));
  };

  // Phase 2C: Save category weight
  const handleSaveWeight = async (weightId: string) => {
    setSavingWeight(true);
    try {
      const newWeight = parseFloat(editWeightValue);
      if (isNaN(newWeight) || newWeight < 0 || newWeight > 5) {
        toast({ title: 'Invalid', description: 'Weight must be a number between 0 and 5', variant: 'destructive' });
        return;
      }

      const { error } = await supabase
        .from('integration_category_weights')
        .update({ weight: newWeight })
        .eq('id', weightId);

      if (error) throw error;

      console.log('[AdminIntegrationRequests] Category weight updated:', weightId, '→', newWeight);
      toast({ title: 'Weight Updated', description: `Category weight set to ${newWeight}` });
      setEditingWeightId(null);
      setEditWeightValue('');
      fetchCategoryWeights();

      // Recalculate all priority scores with new weight
      await recalculateAllCounts();
      fetchCatalog();

      // Phase 2D: Regenerate recommendations after weight change
      generateIntegrationRecommendations();
    } catch (error) {
      console.error('[AdminIntegrationRequests] Save weight error:', error);
      toast({ title: 'Error', description: 'Failed to update weight', variant: 'destructive' });
    } finally {
      setSavingWeight(false);
    }
  };

  // Phase 2C: Priority tier for visual indicators
  const getPriorityTier = (score: number, allScores: number[]): 'high' | 'medium' | 'low' => {
    if (allScores.length === 0) return 'medium';
    const sorted = [...allScores].sort((a, b) => b - a);
    const topThreshold = sorted[Math.floor(sorted.length * 0.2)] ?? 0;
    const bottomThreshold = sorted[Math.floor(sorted.length * 0.6)] ?? 0;
    if (score >= topThreshold && topThreshold > 0) return 'high';
    if (score <= bottomThreshold) return 'low';
    return 'medium';
  };

  const getPriorityTierStyle = (tier: 'high' | 'medium' | 'low') => {
    switch (tier) {
      case 'high': return 'bg-red-50 border-l-4 border-l-red-500';
      case 'low': return 'opacity-60';
      default: return '';
    }
  };

  const getPriorityScoreBadge = (tier: 'high' | 'medium' | 'low') => {
    switch (tier) {
      case 'high': return 'bg-red-100 text-red-800 border-red-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low': return 'bg-gray-100 text-gray-500 border-gray-300';
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

      {/* Phase 2D: AI Recommendations */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-amber-500" />
              AI Recommendations ({recommendations.length})
            </CardTitle>
            <Button
              size="sm"
              onClick={generateIntegrationRecommendations}
              disabled={generatingRecommendations}
            >
              {generatingRecommendations ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              {generatingRecommendations ? 'Generating...' : 'Regenerate'}
            </Button>
          </div>
          {/* Filters */}
          <div className="flex gap-3 mt-3">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-gray-500">Type:</Label>
              <Select value={recFilterType} onValueChange={setRecFilterType}>
                <SelectTrigger className="w-36 h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="build_now">Build Now</SelectItem>
                  <SelectItem value="high_demand">High Demand</SelectItem>
                  <SelectItem value="trending_up">Trending Up</SelectItem>
                  <SelectItem value="category_gap">Category Gap</SelectItem>
                  <SelectItem value="low_priority">Low Priority</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-gray-500">Category:</Label>
              <Select value={recFilterCategory} onValueChange={setRecFilterCategory}>
                <SelectTrigger className="w-40 h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categoryWeights.map((w) => (
                    <SelectItem key={w.category} value={w.category}>{w.category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingRecommendations ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
            </div>
          ) : recommendations.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No recommendations yet. Click &quot;Regenerate&quot; to generate AI recommendations based on current data.
            </div>
          ) : (() => {
            const filtered = recommendations.filter(rec => {
              if (recFilterType !== 'all' && rec.recommendation_type !== recFilterType) return false;
              if (recFilterCategory !== 'all') {
                const catEntry = catalog.find(c => c.id === rec.integration_catalog_id);
                if (catEntry && catEntry.category !== recFilterCategory) return false;
                if (!catEntry && rec.recommendation_type !== 'category_gap') return false;
              }
              return true;
            });

            if (filtered.length === 0) {
              return (
                <div className="text-center py-8 text-gray-500">
                  No recommendations match the current filters.
                </div>
              );
            }

            return (
              <div className="space-y-3">
                {filtered.map((rec) => {
                  const Icon = getRecommendationIcon(rec.recommendation_type);
                  const catEntry = catalog.find(c => c.id === rec.integration_catalog_id);
                  return (
                    <div
                      key={rec.id}
                      className={`flex items-start gap-3 p-3 rounded-lg border ${
                        rec.recommendation_type === 'build_now'
                          ? 'border-red-200 bg-red-50 dark:bg-red-900/10'
                          : rec.recommendation_type === 'low_priority'
                          ? 'border-gray-200 bg-gray-50 dark:bg-gray-800/30 opacity-70'
                          : 'border-gray-200 bg-white dark:bg-gray-800/50'
                      }`}
                    >
                      <div className="mt-0.5">
                        <Icon className={`h-5 w-5 ${
                          rec.recommendation_type === 'build_now' ? 'text-red-500' :
                          rec.recommendation_type === 'trending_up' ? 'text-green-500' :
                          rec.recommendation_type === 'high_demand' ? 'text-orange-500' :
                          rec.recommendation_type === 'category_gap' ? 'text-purple-500' :
                          'text-gray-400'
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={getRecommendationBadgeColor(rec.recommendation_type)}>
                            {formatRecommendationType(rec.recommendation_type)}
                          </Badge>
                          {catEntry && (
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              {catEntry.canonical_name}
                            </span>
                          )}
                          {rec.priority_score_snapshot !== null && (
                            <span className="text-xs text-gray-400">
                              Score: {rec.priority_score_snapshot.toFixed(2)}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{rec.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{rec.description}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {format(new Date(rec.created_at), 'MMM d, yyyy h:mm a')}
                        </p>
                      </div>
                      {/* Phase 3A: Start Build action for build_now recommendations */}
                      {rec.recommendation_type === 'build_now' && rec.integration_catalog_id && !getExecutionForCatalog(rec.integration_catalog_id) && (
                        <div className="flex-shrink-0 self-center">
                          <Button
                            size="sm"
                            className="h-7 text-xs bg-red-600 hover:bg-red-700 text-white"
                            onClick={() => handleCreateExecution(rec.integration_catalog_id!)}
                            disabled={creatingExecution}
                          >
                            {creatingExecution ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Play className="h-3 w-3 mr-1" />}
                            Start Build
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Phase 2C: Integration Priority Rankings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-indigo-500" />
            Integration Priority Rankings
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingCatalog ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
            </div>
          ) : catalog.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No integrations ranked yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs w-8">#</TableHead>
                    <TableHead className="text-xs">Integration</TableHead>
                    <TableHead className="text-xs">Category</TableHead>
                    <TableHead className="text-xs text-center">Total Requests</TableHead>
                    <TableHead className="text-xs text-center">Unique Users</TableHead>
                    <TableHead className="text-xs">Last Requested</TableHead>
                    <TableHead className="text-xs text-center">Priority Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(() => {
                    const allScores = catalog.map(c => c.priority_score ?? 0);
                    return catalog.map((entry, index) => {
                      const tier = getPriorityTier(entry.priority_score ?? 0, allScores);
                      return (
                        <TableRow key={entry.id} className={getPriorityTierStyle(tier)}>
                          <TableCell className="text-xs font-mono text-gray-400">{index + 1}</TableCell>
                          <TableCell className="font-medium text-sm">
                            {entry.canonical_name}
                            <p className="text-xs text-gray-400 font-mono">{entry.normalized_key}</p>
                          </TableCell>
                          <TableCell className="text-xs">{entry.category || 'N/A'}</TableCell>
                          <TableCell className="text-center">
                            <Badge className={getDemandBadgeColor(entry.total_requests)}>
                              {entry.total_requests}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center text-sm">{entry.unique_users_count ?? 0}</TableCell>
                          <TableCell className="text-xs text-gray-500">
                            {entry.last_requested_at
                              ? format(new Date(entry.last_requested_at), 'MMM d, yyyy')
                              : 'Never'}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className={getPriorityScoreBadge(tier)}>
                              {(entry.priority_score ?? 0).toFixed(2)}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    });
                  })()}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Requested Integrations — Demand Intelligence (expanded detail view) */}
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

      {/* Phase 2C: Category Weights Editor */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-indigo-500" />
            Category Weights
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingWeights ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
            </div>
          ) : categoryWeights.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No category weights configured.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Category</TableHead>
                    <TableHead className="text-xs text-center">Weight</TableHead>
                    <TableHead className="text-xs">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categoryWeights.map((w) => (
                    <TableRow key={w.id}>
                      <TableCell className="font-medium text-sm">{w.category}</TableCell>
                      <TableCell className="text-center">
                        {editingWeightId === w.id ? (
                          <Input
                            type="number"
                            step="0.1"
                            min="0"
                            max="5"
                            value={editWeightValue}
                            onChange={(e) => setEditWeightValue(e.target.value)}
                            className="w-20 h-7 text-xs text-center mx-auto"
                          />
                        ) : (
                          <Badge className="bg-indigo-100 text-indigo-800 border-indigo-300">
                            {w.weight.toFixed(1)}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {editingWeightId === w.id ? (
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              onClick={() => handleSaveWeight(w.id)}
                              disabled={savingWeight}
                              className="h-7 text-xs"
                            >
                              {savingWeight ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => { setEditingWeightId(null); setEditWeightValue(''); }}
                              className="h-7 text-xs"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => { setEditingWeightId(w.id); setEditWeightValue(w.weight.toString()); }}
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
              <p className="text-xs text-gray-400 mt-2">
                Higher weights increase priority score for integrations in that category. Changes trigger automatic score recalculation.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Phase 3A: Integration Execution Pipeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-indigo-500" />
            Integration Execution Pipeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingExecution ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
            </div>
          ) : (
            <>
              {/* Execution table for integrations that have execution records */}
              {executionRecords.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Integration</TableHead>
                        <TableHead className="text-xs">Priority Score</TableHead>
                        <TableHead className="text-xs">Requests</TableHead>
                        <TableHead className="text-xs">Commitments</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-xs">ETA</TableHead>
                        <TableHead className="text-xs">Monetization</TableHead>
                        <TableHead className="text-xs">Notes</TableHead>
                        <TableHead className="text-xs">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {executionRecords.map((exec) => {
                        const catEntry = catalog.find(c => c.id === exec.integration_catalog_id);
                        const counts = getCommitmentCountsForCatalog(exec.integration_catalog_id);
                        const isEditing = editingExecutionId === exec.id;

                        return (
                          <TableRow key={exec.id}>
                            <TableCell className="font-medium text-sm">{catEntry?.canonical_name || 'Unknown'}</TableCell>
                            <TableCell>
                              {catEntry ? (
                                <Badge className={getPriorityScoreBadge(getPriorityTier(catEntry.priority_score, catalog.map(c => c.priority_score)))}>
                                  {catEntry.priority_score.toFixed(2)}
                                </Badge>
                              ) : '—'}
                            </TableCell>
                            <TableCell className="text-sm">{catEntry?.total_requests || 0}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 text-xs">
                                <Users className="h-3 w-3 text-gray-400" />
                                <span>{counts.total}</span>
                                {counts.high_priority > 0 && (
                                  <span className="text-amber-600 ml-1">
                                    <Star className="h-3 w-3 inline" /> {counts.high_priority}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {isEditing ? (
                                <Select value={executionForm.status} onValueChange={(v) => setExecutionForm({ ...executionForm, status: v })}>
                                  <SelectTrigger className="w-32 h-7 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {EXECUTION_STATUS_OPTIONS.map(s => (
                                      <SelectItem key={s} value={s}>{formatExecutionStatus(s)}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Badge className={getExecutionStatusColor(exec.status)}>
                                  {formatExecutionStatus(exec.status)}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {isEditing ? (
                                <Input
                                  type="date"
                                  value={executionForm.estimated_completion_date}
                                  onChange={(e) => setExecutionForm({ ...executionForm, estimated_completion_date: e.target.value })}
                                  className="w-36 h-7 text-xs"
                                />
                              ) : (
                                <span className="text-xs text-gray-600">
                                  {exec.estimated_completion_date ? format(new Date(exec.estimated_completion_date), 'MMM d, yyyy') : '—'}
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              {isEditing ? (
                                <Select value={executionForm.monetization_potential} onValueChange={(v) => setExecutionForm({ ...executionForm, monetization_potential: v })}>
                                  <SelectTrigger className="w-24 h-7 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {MONETIZATION_OPTIONS.map(m => (
                                      <SelectItem key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Badge className={getMonetizationColor(exec.monetization_potential)}>
                                  {exec.monetization_potential.charAt(0).toUpperCase() + exec.monetization_potential.slice(1)}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {isEditing ? (
                                <Input
                                  value={executionForm.notes}
                                  onChange={(e) => setExecutionForm({ ...executionForm, notes: e.target.value })}
                                  className="w-40 h-7 text-xs"
                                  placeholder="Add notes..."
                                />
                              ) : (
                                <span className="text-xs text-gray-500 max-w-[150px] truncate block">
                                  {exec.notes || '—'}
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              {isEditing ? (
                                <div className="flex items-center gap-1">
                                  <Button
                                    size="sm"
                                    onClick={() => handleSaveExecution(exec.id, exec.integration_catalog_id)}
                                    disabled={savingExecution}
                                    className="h-7 text-xs"
                                  >
                                    {savingExecution ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
                                    Save
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setEditingExecutionId(null)}
                                    className="h-7 text-xs"
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => startEditingExecution(exec)}
                                  className="h-7 text-xs"
                                >
                                  <Edit className="h-3 w-3 mr-1" />
                                  Edit
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No integrations in execution pipeline. Use &quot;Start Build&quot; on Build Now recommendations or create execution records manually.
                </div>
              )}

              {/* Quick-add: catalog entries without execution records */}
              {(() => {
                const execCatalogIds = new Set(executionRecords.map(e => e.integration_catalog_id));
                const untracked = catalog.filter(c => !execCatalogIds.has(c.id));
                if (untracked.length === 0) return null;
                return (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-500 mb-2">Not yet in pipeline:</p>
                    <div className="flex flex-wrap gap-2">
                      {untracked.map(c => (
                        <Button
                          key={c.id}
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => handleCreateExecution(c.id)}
                          disabled={creatingExecution}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          {c.canonical_name}
                        </Button>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </>
          )}
        </CardContent>
      </Card>

      {/* Phase 3B: Private Offers Dashboard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-purple-500" />
            Private Offers ({privateOffers.length})
          </CardTitle>
          <p className="text-xs text-gray-500 mt-1">
            Send private offers to specific users for integrations in the execution pipeline.
          </p>
        </CardHeader>
        <CardContent>
          {loadingOffers ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
            </div>
          ) : privateOffers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No private offers sent yet. Use the &quot;Send Offer&quot; button in the execution pipeline to create user-specific offers.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Integration</TableHead>
                    <TableHead className="text-xs">User</TableHead>
                    <TableHead className="text-xs">Offer Title</TableHead>
                    <TableHead className="text-xs">Description</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Sent</TableHead>
                    <TableHead className="text-xs">Responded</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {privateOffers.map((offer) => {
                    const catEntry = catalog.find(c => c.id === offer.integration_catalog_id);
                    return (
                      <TableRow key={offer.id}>
                        <TableCell className="font-medium text-sm">{catEntry?.canonical_name || 'Unknown'}</TableCell>
                        <TableCell className="text-sm">{getUserDisplay(offer.user_id)}</TableCell>
                        <TableCell className="text-sm font-medium">{offer.offer_title}</TableCell>
                        <TableCell className="text-xs text-gray-500 max-w-[200px] truncate">{offer.offer_description}</TableCell>
                        <TableCell>
                          <Badge className={getOfferStatusColor(offer.status)}>
                            {offer.status === 'accepted' && <CheckCircle className="h-3 w-3 mr-1" />}
                            {offer.status === 'declined' && <XCircle className="h-3 w-3 mr-1" />}
                            {offer.status.charAt(0).toUpperCase() + offer.status.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-gray-500">{format(new Date(offer.created_at), 'MMM d, yyyy')}</TableCell>
                        <TableCell className="text-xs text-gray-500">
                          {offer.responded_at ? format(new Date(offer.responded_at), 'MMM d, yyyy') : '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Quick-send: catalog entries in execution pipeline */}
          {executionRecords.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 mb-2">Send offer for:</p>
              <div className="flex flex-wrap gap-2">
                {executionRecords.map(exec => {
                  const catEntry = catalog.find(c => c.id === exec.integration_catalog_id);
                  return (
                    <Button
                      key={exec.id}
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => {
                        setOfferModal({ open: true, catalogId: exec.integration_catalog_id, catalogName: catEntry?.canonical_name || 'Unknown' });
                        setOfferForm({ user_id: '', offer_title: '', offer_description: '' });
                      }}
                    >
                      <Send className="h-3 w-3 mr-1" />
                      {catEntry?.canonical_name || 'Unknown'}
                    </Button>
                  );
                })}
              </div>
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

      {/* Phase 3B: Send Offer Modal */}
      <Dialog open={offerModal.open} onOpenChange={(open) => { setOfferModal({ ...offerModal, open }); if (!open) setOfferForm({ user_id: '', offer_title: '', offer_description: '' }); }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-purple-500" />
              Send Private Offer
            </DialogTitle>
            <DialogDescription>
              Create a private offer for <strong>{offerModal.catalogName}</strong>. Only the selected user will see this offer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="offer-user">Select User</Label>
              <Select value={offerForm.user_id} onValueChange={(v) => setOfferForm({ ...offerForm, user_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a user" />
                </SelectTrigger>
                <SelectContent>
                  {allProfiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name ? `${p.full_name} (${p.email})` : p.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="offer-title">Offer Title</Label>
              <Input
                id="offer-title"
                placeholder="e.g., Early Access to Notion Integration"
                value={offerForm.offer_title}
                onChange={(e) => setOfferForm({ ...offerForm, offer_title: e.target.value })}
                disabled={sendingOffer}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="offer-desc">Offer Description</Label>
              <Textarea
                id="offer-desc"
                placeholder="Describe the offer details, what the user gets, timeline, etc."
                value={offerForm.offer_description}
                onChange={(e) => setOfferForm({ ...offerForm, offer_description: e.target.value })}
                disabled={sendingOffer}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOfferModal({ open: false, catalogId: '', catalogName: '' }); setOfferForm({ user_id: '', offer_title: '', offer_description: '' }); }} disabled={sendingOffer}>
              Cancel
            </Button>
            <Button onClick={handleCreateOffer} disabled={sendingOffer || !offerForm.user_id || !offerForm.offer_title.trim() || !offerForm.offer_description.trim()}>
              {sendingOffer ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Send Offer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
