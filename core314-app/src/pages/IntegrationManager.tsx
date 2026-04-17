import { useState, useEffect, useRef, useCallback } from 'react';
import { format } from 'date-fns';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import {
  Layers,
  CheckCircle,
  ExternalLink,
  RefreshCw,
  MessageSquare,
  Briefcase,
  DollarSign,
  Plug,
  Clock,
  Unplug,
  AlertTriangle,
  Calendar,
  Mail,
  ClipboardList,
  LayoutGrid,
  Users,
  FileSpreadsheet,
  ListTodo,
  Lock,
  ArrowUpRight,
  Key,
  BarChart3,
  ShieldAlert,
  Hash,
  TrendingDown,
  Plus,
  Inbox,
  Heart,
  Star,
  Loader2,
  Rocket,
  Gift,
  CheckCircle2,
  XCircle,
  Video,
  GitBranch,
  Headphones,
  TrendingUp,
} from 'lucide-react';
import { getSupabaseFunctionUrl, getSupabaseUrl, getSupabaseAnonKey } from '../lib/supabase';
import { authenticatedFetch, SessionExpiredError } from '../utils/authenticatedFetch';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { AnalysisProcessingScreen } from '../components/onboarding/AnalysisProcessingScreen';
import { RequestIntegrationModal } from '../components/integrations/RequestIntegrationModal';

interface IntegrationInfo {
  id: string;
  service_name: string;
  display_name: string;
  description: string;
  logo_url: string | null;
  is_enabled: boolean;
  auth_type: string;
  min_plan?: string;
}

interface UserIntegration {
  id: string;
  user_id: string;
  integration_id: string;
  provider_id: string | null;
  status: string;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  last_verified_at: string | null;
  last_error_at: string | null;
  error_message: string | null;
  consecutive_failures: number;
}

interface IngestionState {
  service_name: string;
  last_polled_at: string | null;
  next_poll_after: string | null;
}

const SERVICE_ICONS: Record<string, typeof MessageSquare> = {
  slack: MessageSquare,
  hubspot: Briefcase,
  quickbooks: DollarSign,
  google_calendar: Calendar,
  gmail: Mail,
  jira: ClipboardList,
  trello: LayoutGrid,
  microsoft_teams: Users,
  google_sheets: FileSpreadsheet,
  asana: ListTodo,
  salesforce: TrendingUp,
  zoom: Video,
  github: GitBranch,
  zendesk: Headphones,
  notion: FileSpreadsheet,
  monday: LayoutGrid,
};

const SERVICE_DESCRIPTIONS: Record<string, string> = {
  slack: 'Monitor team communication patterns, response times, and channel activity to detect operational bottlenecks and collaboration trends.',
  hubspot: 'Track deal velocity, stalled deals, pipeline changes, and follow-up delays to identify revenue risks and sales performance patterns.',
  quickbooks: 'Analyze invoice aging, overdue payments, revenue trends, and expense anomalies for comprehensive financial health monitoring.',
  google_calendar: 'Track meeting patterns, scheduling conflicts, and calendar utilization to surface time-based operational signals and meeting overload.',
  gmail: 'Analyze email volume, response patterns, and communication trends to detect bottlenecks without reading message content.',
  jira: 'Monitor sprint progress, ticket velocity, and blocker patterns to detect delivery risks and team capacity issues early.',
  trello: 'Track board activity, card movement, and workflow bottlenecks to surface stalled tasks and productivity patterns.',
  microsoft_teams: 'Monitor team channel activity, meeting patterns, and collaboration metrics across departments for organizational health.',
  google_sheets: 'Connect key operational spreadsheets for real-time KPI monitoring and automated data change tracking.',
  asana: 'Track project milestones, task completion rates, and team workload to detect delivery risks and resource constraints.',
  salesforce: 'Monitor opportunity pipeline, win rates, lead conversion, and support cases for comprehensive CRM intelligence and revenue health.',
  zoom: 'Track meeting frequency, duration patterns, and scheduling load to detect meeting overload and optimize time allocation.',
  github: 'Monitor pull request velocity, issue backlogs, commit activity, and code review bottlenecks for engineering health insights.',
  zendesk: 'Track ticket volumes, resolution rates, customer satisfaction scores, and urgent escalations for support operations intelligence.',
  notion: 'Monitor workspace activity, page freshness, and database usage to detect knowledge base staleness and team documentation patterns.',
  monday: 'Track board activity, item completion, stuck/blocked work, and overdue deadlines for project delivery and workload intelligence.',
};

// Integration connection limits per plan
const PLAN_INTEGRATION_LIMITS: Record<string, number> = {
  intelligence: 3,
  command_center: 10,
  enterprise: Infinity,
};

const ALL_INTEGRATIONS = ['slack', 'hubspot', 'quickbooks', 'google_calendar', 'gmail', 'jira', 'trello', 'microsoft_teams', 'google_sheets', 'asana', 'salesforce', 'zoom', 'github', 'zendesk', 'notion', 'monday'];

// Google services that use direct OAuth (no Supabase intermediary)
const GOOGLE_SERVICES = ['gmail', 'google_calendar', 'google_sheets'];

// Per-service Google OAuth scopes (service-specific + base identity scopes)
const GOOGLE_SERVICE_SCOPES: Record<string, string[]> = {
  google_calendar: [
    'openid',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/calendar.readonly',
  ],
  gmail: [
    'openid',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/gmail.readonly',
  ],
  google_sheets: [
    'openid',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/spreadsheets.readonly',
  ],
};

// Jira API key fields kept separate — used only in the "Advanced" fallback UI on the Jira card
const JIRA_API_KEY_FIELDS = [
  { label: 'Jira Domain', field: 'domain', type: 'text', placeholder: 'your-company.atlassian.net' },
  { label: 'Email', field: 'email', type: 'email', placeholder: 'you@company.com' },
  { label: 'API Token', field: 'api_token', type: 'password', placeholder: 'Your Jira API token' },
];

const API_KEY_FIELDS: Record<string, { label: string; field: string; type: string; placeholder: string }[]> = {
  trello: [
    { label: 'API Key', field: 'api_key', type: 'text', placeholder: 'Your Trello API key' },
    { label: 'API Token', field: 'api_token', type: 'password', placeholder: 'Your Trello API token' },
  ],
};

export function IntegrationManager() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [integrations, setIntegrations] = useState<IntegrationInfo[]>([]);
  const [userIntegrations, setUserIntegrations] = useState<UserIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [connectionSuccess, setConnectionSuccess] = useState<string | null>(null);
  const [disconnectConfirm, setDisconnectConfirm] = useState<string | null>(null);
  const [ingestionStates, setIngestionStates] = useState<IngestionState[]>([]);
  const [userPlan, setUserPlan] = useState<string>('intelligence');
  const [apiKeyForm, setApiKeyForm] = useState<{ service: string; credentials: Record<string, string> } | null>(null);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  const [jiraAdvancedOpen, setJiraAdvancedOpen] = useState(false);
  const [autoGenerating, setAutoGenerating] = useState(false);
  const [limitError, setLimitError] = useState<string | null>(null);
  // CTA state: shown when a new integration connects but user already has briefs
  const [showNewDataCTA, setShowNewDataCTA] = useState(false);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [myRequests, setMyRequests] = useState<Array<{
    id: string;
    integration_name: string;
    category: string;
    status: string;
    admin_notes: string | null;
    created_at: string;
  }>>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  // Phase 3A: Commitments + Execution
  interface Commitment {
    id: string;
    integration_catalog_id: string;
    user_id: string;
    commitment_type: string;
    created_at: string;
  }
  interface ExecutionRecord {
    id: string;
    integration_catalog_id: string;
    status: string;
    estimated_completion_date: string | null;
    notes: string | null;
    created_at: string;
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
  interface CatalogEntryUser {
    id: string;
    canonical_name: string;
    category: string | null;
    total_requests: number;
    priority_score: number;
  }
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [executionRecords, setExecutionRecords] = useState<ExecutionRecord[]>([]);
  const [catalogEntries, setCatalogEntries] = useState<CatalogEntryUser[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [committingTo, setCommittingTo] = useState<string | null>(null);
  const [allCommitmentCounts, setAllCommitmentCounts] = useState<Record<string, { interested: number; high_priority: number }>>({});

  // Phase 3B: Private Offers
  const [myOffers, setMyOffers] = useState<PrivateOffer[]>([]);
  const [loadingOffers, setLoadingOffers] = useState(false);
  const [respondingToOffer, setRespondingToOffer] = useState<string | null>(null);

  // Track whether an OAuth callback was detected that should trigger brief generation
  const [pendingAutoTrigger, setPendingAutoTrigger] = useState(false);
  // Ref to prevent double-triggering
  const autoTriggerFiredRef = useRef(false);
  // Ref to always have latest profile available in async functions
  const profileRef = useRef(profile);
  useEffect(() => { profileRef.current = profile; }, [profile]);

  // Future: user setting for auto-trigger behavior (not exposed in UI yet)
  // When implemented, this will be fetched from user_preferences table
  // const [autoTriggerEnabled, setAutoTriggerEnabled] = useState(true);

  // Auto-trigger: after first integration connects, auto-generate brief and redirect
  // ONLY triggers if user has zero existing briefs (first "aha moment")
  // If briefs already exist, shows a CTA instead of auto-triggering
  const autoTriggerBriefGeneration = useCallback(async () => {
    const currentProfile = profileRef.current;
    if (!currentProfile?.id) {
      console.warn('[AutoTrigger] No profile.id available, cannot trigger');
      return;
    }
    if (autoTriggerFiredRef.current) {
      console.log('[AutoTrigger] Already fired, skipping duplicate');
      return;
    }
    autoTriggerFiredRef.current = true;

    // DB check: only auto-trigger if user has zero existing briefs
    try {
      const { count, error: countError } = await supabase
        .from('operational_briefs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', currentProfile.id);

      if (countError) {
        console.error('[AutoTrigger] Failed to check brief count:', countError);
        // On error, fall through to CTA as safe default
        setShowNewDataCTA(true);
        return;
      }

      const briefCount = count ?? 0;
      console.log('[AutoTrigger] Existing brief count:', briefCount);

      if (briefCount > 0) {
        // User already has briefs — show CTA instead of auto-triggering
        console.log('[AutoTrigger] User has existing briefs, showing CTA instead');
        setShowNewDataCTA(true);
        return;
      }
    } catch (err) {
      console.error('[AutoTrigger] Brief count check failed:', err);
      setShowNewDataCTA(true);
      return;
    }

    // Zero briefs — proceed with auto-trigger for first "aha moment"
    console.log('[AutoTrigger] Zero briefs found, starting auto-generation for user:', currentProfile.id);
    setAutoGenerating(true);
    try {
      const url = await getSupabaseFunctionUrl('operational-brief-generate');
      const anonKey = await getSupabaseAnonKey();
      console.log('[AutoTrigger] Calling operational-brief-generate...');

      const response = await authenticatedFetch(async (token) => {
        return await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'apikey': anonKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });
      });

      const result = await response.json();
      console.log('[AutoTrigger] Response:', response.status, result);
      if (response.ok && result.success) {
        console.log('[AutoTrigger] Brief generated successfully, redirecting to /brief');
        navigate('/brief');
      } else {
        console.error('[AutoTrigger] Brief generation failed:', result);
      }
    } catch (err) {
      if (err instanceof SessionExpiredError) {
        console.error('[AutoTrigger] Session expired, user needs to sign in again');
      } else {
        console.error('[AutoTrigger] Failed to generate brief:', err);
      }
    } finally {
      setAutoGenerating(false);
    }
  }, [navigate]);

  // Step 1: Detect OAuth callback params and mark pending auto-trigger
  useEffect(() => {
    const oauthSuccess = searchParams.get('oauth_success');
    const oauthService = searchParams.get('service');
    const hubspotStatus = searchParams.get('hubspot');

    // Handle integration limit error from OAuth redirect (oauth-callback returns this)
    const errorParam = searchParams.get('error');
    if (errorParam === 'integration_limit_reached') {
      const limitParam = searchParams.get('limit');
      const planParam = searchParams.get('plan');
      setLimitError(`You have reached the maximum of ${limitParam || '?'} integrations for your ${(planParam || 'current').replace(/_/g, ' ')} plan. Upgrade to connect more integrations.`);
      searchParams.delete('error');
      searchParams.delete('limit');
      searchParams.delete('plan');
      setSearchParams(searchParams, { replace: true });
    }

    if (oauthSuccess === 'true' && oauthService) {
      console.log('[AutoTrigger] OAuth callback detected for:', oauthService);
      setConnectionSuccess(oauthService);
      searchParams.delete('oauth_success');
      searchParams.delete('service');
      setSearchParams(searchParams, { replace: true });
      setPendingAutoTrigger(true);
      setTimeout(() => setConnectionSuccess(null), 5000);
    } else if (hubspotStatus === 'connected') {
      console.log('[AutoTrigger] HubSpot callback detected');
      setConnectionSuccess('hubspot');
      searchParams.delete('hubspot');
      setSearchParams(searchParams, { replace: true });
      setPendingAutoTrigger(true);
      setTimeout(() => setConnectionSuccess(null), 5000);
    }
  }, [searchParams, setSearchParams]);

  // Step 2: When pendingAutoTrigger is true AND profile is available, fire the trigger
  // This eliminates the stale closure — we wait for profile to be ready via deps
  useEffect(() => {
    if (!pendingAutoTrigger) return;
    if (!profile?.id) {
      console.log('[AutoTrigger] Waiting for profile to load before triggering...');
      return; // Will re-run when profile becomes available
    }
    // Profile is ready — fire the auto-trigger
    console.log('[AutoTrigger] Profile ready, firing auto-trigger');
    setPendingAutoTrigger(false);
    autoTriggerBriefGeneration();
  }, [pendingAutoTrigger, profile?.id, autoTriggerBriefGeneration]);

  useEffect(() => {
    if (profile?.id) {
      fetchIntegrations();
      fetchUserPlan();
      fetchMyRequests();
      fetchCatalogForCommitments();
      fetchMyCommitments();
      fetchExecutionRecords();
      fetchAllCommitmentCounts();
      fetchMyOffers();
    }
  }, [profile?.id]);

  const fetchCatalogForCommitments = async () => {
    setLoadingCatalog(true);
    try {
      const { data, error } = await supabase
        .from('integration_catalog')
        .select('id, canonical_name, category, total_requests, priority_score')
        .order('priority_score', { ascending: false });
      if (!error && data) {
        setCatalogEntries(data);
      }
    } catch (err) {
      console.error('[IntegrationManager] Failed to fetch catalog:', err);
    } finally {
      setLoadingCatalog(false);
    }
  };

  const fetchMyCommitments = async () => {
    if (!profile?.id) return;
    try {
      const { data, error } = await supabase
        .from('integration_commitments')
        .select('*')
        .eq('user_id', profile.id);
      if (!error && data) {
        setCommitments(data);
        console.log('[IntegrationManager] Commitments fetched:', data.length);
      }
    } catch (err) {
      console.error('[IntegrationManager] Failed to fetch commitments:', err);
    }
  };

  const fetchAllCommitmentCounts = async () => {
    try {
      const { data, error } = await supabase
        .from('integration_commitments')
        .select('integration_catalog_id, commitment_type');
      if (!error && data) {
        const counts: Record<string, { interested: number; high_priority: number }> = {};
        data.forEach((c: { integration_catalog_id: string; commitment_type: string }) => {
          if (!counts[c.integration_catalog_id]) {
            counts[c.integration_catalog_id] = { interested: 0, high_priority: 0 };
          }
          if (c.commitment_type === 'high_priority') {
            counts[c.integration_catalog_id].high_priority++;
          } else {
            counts[c.integration_catalog_id].interested++;
          }
        });
        setAllCommitmentCounts(counts);
      }
    } catch (err) {
      console.error('[IntegrationManager] Failed to fetch commitment counts:', err);
    }
  };

  const fetchExecutionRecords = async () => {
    try {
      const { data, error } = await supabase
        .from('integration_execution')
        .select('id, integration_catalog_id, status, estimated_completion_date, notes, created_at');
      if (!error && data) {
        setExecutionRecords(data);
        console.log('[IntegrationManager] Execution records fetched:', data.length);
      }
    } catch (err) {
      console.error('[IntegrationManager] Failed to fetch execution records:', err);
    }
  };

  const handleCommitment = async (catalogId: string, type: 'interested' | 'high_priority') => {
    if (!profile?.id) return;
    setCommittingTo(catalogId);
    console.log('[IntegrationManager] Commitment action:', catalogId, type);
    try {
      const existing = commitments.find(c => c.integration_catalog_id === catalogId);
      if (existing) {
        if (existing.commitment_type === type) {
          // Already same type — no-op
          console.log('[IntegrationManager] Same commitment already exists');
          setCommittingTo(null);
          return;
        }
        // Upgrade from interested → high_priority
        const { error } = await supabase
          .from('integration_commitments')
          .update({ commitment_type: type })
          .eq('id', existing.id);
        if (error) throw error;
        console.log('[IntegrationManager] Commitment upgraded to:', type);
      } else {
        const { error } = await supabase
          .from('integration_commitments')
          .insert({
            integration_catalog_id: catalogId,
            user_id: profile.id,
            commitment_type: type,
          });
        if (error) throw error;
        console.log('[IntegrationManager] New commitment created:', type);
      }
      await fetchMyCommitments();
      await fetchAllCommitmentCounts();
    } catch (err) {
      console.error('[IntegrationManager] Commitment error:', err);
    } finally {
      setCommittingTo(null);
    }
  };

  const getMyCommitment = (catalogId: string) => {
    return commitments.find(c => c.integration_catalog_id === catalogId);
  };

  const getExecution = (catalogId: string) => {
    return executionRecords.find(e => e.integration_catalog_id === catalogId);
  };

  const getExecutionStatusLabel = (status: string) => {
    switch (status) {
      case 'not_started': return 'Not Started';
      case 'planned': return 'Planned';
      case 'in_progress': return 'In Progress';
      case 'beta': return 'Beta';
      case 'completed': return 'Completed';
      default: return status;
    }
  };

  const getExecutionStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'beta': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
      case 'in_progress': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'planned': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  // Phase 3B: Fetch user's private offers
  const fetchMyOffers = async () => {
    if (!profile?.id) return;
    setLoadingOffers(true);
    try {
      const { data, error } = await supabase
        .from('integration_private_offers')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) {
        setMyOffers(data);
        console.log('[IntegrationManager] My offers fetched:', data.length);
      }
    } catch (err) {
      console.error('[IntegrationManager] Failed to fetch offers:', err);
    } finally {
      setLoadingOffers(false);
    }
  };

  // Phase 3B: Accept offer
  const handleAcceptOffer = async (offerId: string) => {
    setRespondingToOffer(offerId);
    try {
      const { error } = await supabase
        .from('integration_private_offers')
        .update({ status: 'accepted', responded_at: new Date().toISOString() })
        .eq('id', offerId);
      if (error) throw error;
      console.log('[IntegrationManager] Offer accepted:', offerId);
      await fetchMyOffers();
    } catch (err) {
      console.error('[IntegrationManager] Accept offer error:', err);
    } finally {
      setRespondingToOffer(null);
    }
  };

  // Phase 3B: Decline offer
  const handleDeclineOffer = async (offerId: string) => {
    setRespondingToOffer(offerId);
    try {
      const { error } = await supabase
        .from('integration_private_offers')
        .update({ status: 'declined', responded_at: new Date().toISOString() })
        .eq('id', offerId);
      if (error) throw error;
      console.log('[IntegrationManager] Offer declined:', offerId);
      await fetchMyOffers();
    } catch (err) {
      console.error('[IntegrationManager] Decline offer error:', err);
    } finally {
      setRespondingToOffer(null);
    }
  };

  // Phase 3B: Get catalog name for an offer
  const getOfferCatalogName = (catalogId: string) => {
    const entry = catalogEntries.find(c => c.id === catalogId);
    return entry?.canonical_name || 'Integration';
  };

  const fetchMyRequests = async () => {
    if (!profile?.id) return;
    setLoadingRequests(true);
    try {
      const { data, error } = await supabase
        .from('integration_requests')
        .select('id, integration_name, category, status, admin_notes, created_at')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });
      if (!error && data) {
        setMyRequests(data);
      }
    } catch (err) {
      console.error('[IntegrationRequests] Failed to fetch requests:', err);
    } finally {
      setLoadingRequests(false);
    }
  };

  const fetchUserPlan = async () => {
    if (!profile?.id) return;

    // Primary source of truth: user_subscriptions table (per-user, linked to Stripe)
    const { data: subscription } = await supabase
      .from('user_subscriptions')
      .select('plan_name')
      .eq('user_id', profile.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (subscription?.plan_name) {
      const planName = subscription.plan_name.toLowerCase();
      if (planName.includes('command') || planName.includes('center')) {
        setUserPlan('command_center');
      } else if (planName.includes('enterprise')) {
        setUserPlan('enterprise');
      } else {
        setUserPlan('intelligence');
      }
    }
  };

  const fetchIntegrations = async () => {
    if (!profile?.id) return;
    setLoading(true);

    // Fetch ALL enabled integrations
    const { data: registryData } = await supabase
      .from('integration_registry')
      .select('id, service_name, display_name, description, logo_url, is_enabled, auth_type')
      .in('service_name', ALL_INTEGRATIONS)
      .eq('is_enabled', true);

    if (registryData) {
      const sorted = [...registryData].sort((a, b) => {
        const aIdx = ALL_INTEGRATIONS.indexOf(a.service_name);
        const bIdx = ALL_INTEGRATIONS.indexOf(b.service_name);
        return aIdx - bIdx;
      });
      setIntegrations(sorted as IntegrationInfo[]);
    }

    // Fetch user's connected integrations
    const { data: userIntData } = await supabase
      .from('user_integrations')
      .select('id, user_id, integration_id, provider_id, status, config, created_at, updated_at, last_verified_at, last_error_at, error_message, consecutive_failures')
      .eq('user_id', profile.id)
      .eq('status', 'active');

    if (userIntData) {
      setUserIntegrations(userIntData as UserIntegration[]);
    }

    // Fetch ingestion state for all integrations
    // Only fetch services we actually display to avoid hitting PostgREST row limits
    // (duplicate rows from null user_integration_id upserts can accumulate)
    const { data: stateData } = await supabase
      .from('integration_ingestion_state')
      .select('service_name, last_polled_at, next_poll_after')
      .eq('user_id', profile.id)
      .in('service_name', ALL_INTEGRATIONS)
      .order('last_polled_at', { ascending: false });

    if (stateData) {
      // Deduplicate: keep only the most recent record per service_name
      const seen = new Set<string>();
      const deduped = stateData.filter((s: IngestionState) => {
        if (seen.has(s.service_name)) return false;
        seen.add(s.service_name);
        return true;
      });
      setIngestionStates(deduped as IngestionState[]);
    }

    setLoading(false);
  };


  /**
   * Initiate Google OAuth directly from the frontend.
   * Constructs the Google OAuth URL without any Supabase intermediary,
   * so the consent screen shows "Continue to Core314" (not a Supabase domain).
   *
   * Flow:
   * 1. Generate UUID state and insert into oauth_states table
   * 2. Construct Google OAuth URL with client_id, redirect_uri, scopes
   * 3. Redirect user to Google directly
   * 4. Google shows "Continue to Core314" consent screen
   * 5. Google redirects to /auth/callback
   * 6. AuthCallback.tsx sends code+state to google-oauth-exchange Edge Function
   */
  const handleGoogleConnect = async (serviceName: string) => {
    // Frontend guard: check integration limit before redirecting to Google
    if (isAtLimit) {
      setLimitError(`You have reached the maximum of ${integrationLimit} integrations for your ${userPlan.replace(/_/g, ' ')} plan. Upgrade to connect more integrations.`);
      return;
    }

    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!googleClientId) {
      console.error('[handleGoogleConnect] VITE_GOOGLE_CLIENT_ID not configured');
      return;
    }

    // Find integration_registry entry for this Google service
    const registryEntry = integrations.find(i => i.service_name === serviceName);
    if (!registryEntry) {
      console.error('[handleGoogleConnect] No registry entry for:', serviceName);
      return;
    }

    // Generate state for CSRF protection
    const state = crypto.randomUUID();
    const redirectUri = `${window.location.origin}/auth/callback`;

    // Insert state into oauth_states table (RLS allows authenticated users)
    const { error: stateError } = await supabase
      .from('oauth_states')
      .insert({
        state,
        user_id: profile!.id,
        integration_registry_id: registryEntry.id,
        redirect_uri: redirectUri,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      });

    if (stateError) {
      console.error('[handleGoogleConnect] Failed to store OAuth state:', stateError);
      return;
    }

    // Get scopes for this Google service
    const scopes = GOOGLE_SERVICE_SCOPES[serviceName] || GOOGLE_SERVICE_SCOPES['gmail'];

    // Construct Google OAuth URL directly — no Supabase domain involved
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', googleClientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', scopes.join(' '));
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent');

    // Redirect directly to Google (consent screen will show "Continue to Core314")
    window.location.href = authUrl.toString();
  };

  const handleConnect = async (serviceName: string) => {
    if (!profile?.id) return;

    // Frontend guard: check integration limit
    if (isAtLimit) {
      setLimitError(`You have reached the maximum of ${integrationLimit} integrations for your ${userPlan.replace(/_/g, ' ')} plan. Upgrade to connect more integrations.`);
      return;
    }
    if (API_KEY_FIELDS[serviceName]) {
      setApiKeyForm({ service: serviceName, credentials: {} });
      setApiKeyError(null);
      return;
    }
    setConnecting(serviceName);

    try {
      // Google services: construct OAuth URL directly on the frontend
      // This ensures Google consent screen shows "Continue to Core314"
      // instead of a Supabase domain
      if (GOOGLE_SERVICES.includes(serviceName)) {
        await handleGoogleConnect(serviceName);
        return;
      }

      // HubSpot uses dedicated Netlify function for OAuth
      if (serviceName === 'hubspot') {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        if (!accessToken) throw new Error('No session');
        window.location.href = `/.netlify/functions/hubspot-auth?access_token=${accessToken}`;
        return;
      }

      // Other integrations (Slack, QuickBooks, Jira, Salesforce, Zoom) use Supabase Edge Function
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('No session');

      const url = await getSupabaseFunctionUrl('oauth-initiate');
      const supabaseUrl = await getSupabaseUrl();
      // Jira uses hardcoded production redirect URI (must match Atlassian Developer Console exactly)
      // Other OAuth services use the Supabase edge function URL directly
      const callbackUri = serviceName === 'jira'
        ? 'https://app.core314.com/auth/callback'
        : `${supabaseUrl}/functions/v1/oauth-callback`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          service_name: serviceName,
          redirect_uri: callbackUri,
        }),
      });

      const data = await response.json();
      if (data.error === 'integration_limit_reached') {
        setLimitError(data.message || 'Integration limit reached. Upgrade to connect more.');
        setConnecting(null);
        return;
      }
      if (data.authorization_url) {
        console.log(`[handleConnect] OAuth redirect for ${serviceName}:`, data.authorization_url);
        window.location.href = data.authorization_url;
      } else if (data.error) {
        console.error('OAuth error:', data.error);
      }
    } catch (err) {
      console.error('Error connecting:', err);
    } finally {
      setConnecting(null);
    }
  };

  const handleApiKeySubmit = async () => {
    if (!apiKeyForm || !profile?.id) return;

    // Frontend guard: check integration limit
    if (isAtLimit) {
      setApiKeyError(`You have reached the maximum of ${integrationLimit} integrations for your ${userPlan.replace(/_/g, ' ')} plan. Upgrade to connect more.`);
      return;
    }

    setConnecting(apiKeyForm.service);
    setApiKeyError(null);
    try {
      const { data, error } = await supabase.functions.invoke('connect-api-key', {
        body: {
          service_name: apiKeyForm.service,
          credentials: apiKeyForm.credentials,
        },
      });
      if (error) {
        setApiKeyError('Failed to connect. Please check your credentials.');
        return;
      }
      // Handle integration limit error from backend (must check before generic !data.success)
      if (data?.error === 'integration_limit_reached') {
        setApiKeyError(data.message || 'Integration limit reached. Upgrade to connect more.');
        return;
      }
      if (data && !data.success) {
        setApiKeyError(data.message || data.error || 'Connection failed');
        return;
      }
      setApiKeyForm(null);
      setConnectionSuccess(apiKeyForm.service);
      setTimeout(() => setConnectionSuccess(null), 5000);
      // Auto-trigger brief generation for API key integrations
      // Uses the same pendingAutoTrigger flow to ensure profile is available
      console.log('[AutoTrigger] API key connection success, setting pending trigger');
      setPendingAutoTrigger(true);
      await fetchIntegrations();
    } catch {
      setApiKeyError('An unexpected error occurred. Please try again.');
    } finally {
      setConnecting(null);
    }
  };

  const handleDisconnect = async (serviceName: string, registryId: string) => {
    if (!profile?.id) return;

    // Require confirmation
    if (disconnectConfirm !== registryId) {
      setDisconnectConfirm(registryId);
      return;
    }

    setDisconnecting(serviceName);
    setDisconnectConfirm(null);

    try {
      // Call the disconnect Edge Function via supabase client
      // supabase.functions.invoke() automatically sends auth headers
      const { data, error } = await supabase.functions.invoke('disconnect-integration', {
        body: { integration_registry_id: registryId },
      });

      if (error) {
        console.error('Disconnect error:', error);
        return;
      }

      if (data && !data.success) {
        console.error('Disconnect failed:', data.error);
        return;
      }

      // Refresh the integrations list
      await fetchIntegrations();
    } catch (err) {
      console.error('Error disconnecting:', err);
    } finally {
      setDisconnecting(null);
    }
  };

  const isConnected = (registryId: string) => {
    return userIntegrations.some(ui => ui.provider_id === registryId);
  };

  const getConnectionDate = (registryId: string) => {
    const ui = userIntegrations.find(u => u.provider_id === registryId);
    return ui?.created_at || null;
  };

  const getUserIntegration = (registryId: string) => {
    return userIntegrations.find(u => u.provider_id === registryId) || null;
  };

  const getIngestionState = (serviceName: string) => {
    return ingestionStates.find(s => s.service_name === serviceName) || null;
  };

  const formatTimeAgo = (dateStr: string | null) => {
    if (!dateStr) return null;
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const getHealthStatus = (ui: UserIntegration | null): { label: string; color: string } => {
    if (!ui) return { label: 'Not connected', color: 'text-gray-400' };
    if (ui.consecutive_failures >= 3) return { label: 'Error', color: 'text-red-600' };
    if (ui.consecutive_failures > 0) return { label: 'Degraded', color: 'text-yellow-600' };
    if (ui.last_verified_at) return { label: 'Verified', color: 'text-green-600' };
    return { label: 'Connected', color: 'text-green-600' };
  };

  const connectedCount = integrations.filter(i => isConnected(i.id)).length;

  // Check if the user has reached their integration limit
  const integrationLimit = PLAN_INTEGRATION_LIMITS[userPlan] ?? PLAN_INTEGRATION_LIMITS['intelligence'];
  const isAtLimit = connectedCount >= integrationLimit;

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Layers className="h-6 w-6 text-indigo-500" />
          Integration Manager
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Connect your business tools to enable operational intelligence
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button onClick={() => setRequestModalOpen(true)} variant="outline">
          <Plus className="h-4 w-4 mr-2" />
          Request Integration
        </Button>
      </div>

      {/* Connection Success Banner */}
      {connectionSuccess && (
        <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <p className="text-sm font-medium text-green-800 dark:text-green-200">
                {connectionSuccess.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} connected successfully! Core314 will begin analyzing your data shortly.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* New Data CTA - shown when integration connects but user already has briefs */}
      {showNewDataCTA && (
        <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <RefreshCw className="h-5 w-5 text-blue-600" />
                <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                  New data available — Refresh your operational brief to see the latest insights
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  setShowNewDataCTA(false);
                  navigate('/brief');
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap"
              >
                Refresh Insights
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Processing Screen - shown while auto-generating first brief */}
      <AnalysisProcessingScreen
        isVisible={autoGenerating}
        onComplete={() => {
          // The actual navigation happens in autoTriggerBriefGeneration
          // This callback fires when the animation sequence completes
        }}
      />

      {/* API Key Form removed from here — now rendered inline within each card */}

      {/* Integration Limit Error Banner */}
      {limitError && (
        <Card className="bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <p className="text-sm font-medium text-red-800 dark:text-red-200">
                  {limitError}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => navigate('/account-plan')}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white whitespace-nowrap"
                >
                  <ArrowUpRight className="h-4 w-4 mr-1" /> Upgrade Plan
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setLimitError(null)} className="text-red-600 hover:text-red-700">
                  Dismiss
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Connection Status Summary */}
      <Card className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950/20 dark:to-blue-950/20 border-indigo-200 dark:border-indigo-800">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Plug className="h-8 w-8 text-indigo-500" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {connectedCount} / {integrationLimit === Infinity ? 'Unlimited' : integrationLimit} integrations used
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {isAtLimit
                  ? 'Integration limit reached. Upgrade your plan to connect more.'
                  : 'You can connect any integration. Your plan determines how many you can use.'}
              </p>
            </div>
          </div>
          <div className="mt-3 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${isAtLimit ? 'bg-red-500' : 'bg-indigo-500'}`}
              style={{ width: `${Math.min((connectedCount / Math.max(integrationLimit === Infinity ? connectedCount || 1 : integrationLimit, 1)) * 100, 100)}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* All Integrations — Unified List */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Available Integrations</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {integrations.map((integration, idx) => {
            const Icon = SERVICE_ICONS[integration.service_name] || Layers;
            const connected = isConnected(integration.id);
            const connDate = getConnectionDate(integration.id);
            const description = SERVICE_DESCRIPTIONS[integration.service_name] || integration.description;
            const ui = getUserIntegration(integration.id);
            const state = getIngestionState(integration.service_name);
            const health = getHealthStatus(ui);
            const isApiKeyService = !!API_KEY_FIELDS[integration.service_name];
            return (
              <Card key={integration.id} className={connected ? 'border-green-200 dark:border-green-800' : ''} {...(idx === 0 ? { 'data-onboarding': 'primary-integration' } : {})}>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${connected ? 'bg-green-100 dark:bg-green-900/30' : 'bg-indigo-100 dark:bg-indigo-900/30'}`}>
                      <Icon className={`h-5 w-5 ${connected ? 'text-green-600' : 'text-indigo-600'}`} />
                    </div>
                    <div>
                      <CardTitle className="text-base">{integration.display_name}</CardTitle>
                      {connected && (
                        <Badge variant="outline" className="text-xs text-green-600 border-green-300">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Connected
                        </Badge>
                      )}
                      {isApiKeyService && !connected && (
                        <Badge variant="outline" className="text-xs text-gray-500 border-gray-300">
                          <Key className="h-3 w-3 mr-1" /> API Key
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{description}</p>
                  {connected ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Clock className="h-3 w-3" />
                        Connected {connDate ? new Date(connDate).toLocaleDateString() : ''}
                      </div>
                      <div className={`flex items-center gap-2 text-xs ${health.color}`}>
                        <CheckCircle className="h-3 w-3" />
                        {health.label}
                        {ui?.last_verified_at && <span className="text-gray-400">({formatTimeAgo(ui.last_verified_at)})</span>}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <RefreshCw className={`h-3 w-3 ${state?.last_polled_at ? '' : 'text-gray-300'}`} />
                        {state?.last_polled_at ? (
                          <span>Last polled {formatTimeAgo(state.last_polled_at)}<span className="text-gray-400 ml-1">(every 15 min)</span></span>
                        ) : (<span className="text-gray-400">Awaiting first poll...</span>)}
                      </div>
                      {ui?.error_message && ui.consecutive_failures > 0 && (
                        <div className="flex items-center gap-2 text-xs text-red-500">
                          <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate" title={ui.error_message}>{ui.error_message.length > 60 ? ui.error_message.slice(0, 60) + '...' : ui.error_message}</span>
                        </div>
                      )}
                      {/* Slack Transparency Metrics - Production Hardening */}
                      {integration.service_name === 'slack' && ui?.config && (() => {
                        const cfg = ui.config;
                        const channelsTotal = (cfg.channels_total as number) ?? 0;
                        const channelsMember = (cfg.channels_member as number) ?? 0;
                        const channelsAnalyzed = (cfg.channels_analyzed as number) ?? 0;
                        const messagesAnalyzed = (cfg.messages_analyzed as number) ?? 0;
                        const channelsSyncedAt = cfg.channels_synced_at as string | null;
                        const privateAccessible = cfg.private_channels_accessible as boolean ?? false;
                        const scopeWarning = cfg.scope_warning as string | null;
                        const dataCompleteness = cfg.data_completeness as Record<string, unknown> | null;
                        const coveragePct = dataCompleteness ? (dataCompleteness.coverage_pct as number) ?? 0 : (channelsMember > 0 ? Math.round((channelsAnalyzed / channelsMember) * 100) : 0);
                        const lastErrors = cfg.last_api_errors as string[] | null;

                        if (channelsTotal > 0 || channelsSyncedAt) {
                          return (
                            <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-800/50 rounded-md space-y-1.5 border border-gray-100 dark:border-gray-700">
                              <div className="flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
                                <BarChart3 className="h-3 w-3 text-indigo-500" />
                                Slack Data Transparency
                              </div>
                              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                                <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                                  <Hash className="h-3 w-3" />
                                  Channels detected
                                </div>
                                <div className="font-medium text-gray-700 dark:text-gray-300">{channelsTotal}</div>
                                <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                                  <CheckCircle className="h-3 w-3" />
                                  Monitored
                                </div>
                                <div className="font-medium text-gray-700 dark:text-gray-300">{channelsMember}</div>
                                <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                                  <BarChart3 className="h-3 w-3" />
                                  Analyzed
                                </div>
                                <div className="font-medium text-gray-700 dark:text-gray-300">
                                  {channelsAnalyzed}
                                  {channelsMember > 0 && (
                                    <span className={`ml-1 ${coveragePct >= 80 ? 'text-green-600' : coveragePct >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                                      ({coveragePct}%)
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                                  <MessageSquare className="h-3 w-3" />
                                  Messages
                                </div>
                                <div className="font-medium text-gray-700 dark:text-gray-300">{messagesAnalyzed.toLocaleString()}</div>
                              </div>
                              {channelsSyncedAt && (
                                <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 pt-0.5">
                                  <Clock className="h-3 w-3" />
                                  Last sync: {formatTimeAgo(channelsSyncedAt)}
                                </div>
                              )}
                              {scopeWarning && !privateAccessible && (
                                <div className="flex items-start gap-1 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 p-1.5 rounded mt-1">
                                  <ShieldAlert className="h-3 w-3 flex-shrink-0 mt-0.5" />
                                  <span>Private channels not accessible (missing groups:read scope). Only public channels are monitored.</span>
                                </div>
                              )}
                              {lastErrors && lastErrors.length > 0 && (
                                <div className="flex items-start gap-1 text-xs text-red-500 dark:text-red-400 pt-0.5">
                                  <AlertTriangle className="h-3 w-3 flex-shrink-0 mt-0.5" />
                                  <span className="truncate" title={lastErrors[0]}>{lastErrors.length} API error{lastErrors.length > 1 ? 's' : ''} in last poll</span>
                                </div>
                              )}
                            </div>
                          );
                        }
                        return null;
                      })()}
                      {/* HubSpot CRM Transparency Metrics */}
                      {integration.service_name === 'hubspot' && ui?.config && (() => {
                        const cfg = ui.config;
                        const totalDeals = (cfg.total_deals as number) ?? 0;
                        const dealsAnalyzed = (cfg.deals_analyzed as number) ?? 0;
                        const openDeals = (cfg.open_deals as number) ?? 0;
                        const stalledDeals = (cfg.stalled_deals as number) ?? 0;
                        const totalContacts = (cfg.total_contacts as number) ?? 0;
                        const totalCompanies = (cfg.total_companies as number) ?? 0;
                        const pipelineCount = (cfg.pipeline_count as number) ?? 0;
                        const openPipelineValue = (cfg.open_pipeline_value as number) ?? 0;
                        const crmSyncedAt = cfg.crm_synced_at as string | null;
                        const portalName = cfg.portal_name as string | null;
                        const dataCompleteness = cfg.data_completeness as Record<string, unknown> | null;
                        const coveragePct = dataCompleteness ? (dataCompleteness.coverage_pct as number) ?? 100 : 100;
                        const lastErrors = cfg.last_api_errors as string[] | null;

                        if (totalDeals > 0 || totalContacts > 0 || crmSyncedAt) {
                          return (
                            <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-800/50 rounded-md space-y-1.5 border border-gray-100 dark:border-gray-700">
                              <div className="flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
                                <BarChart3 className="h-3 w-3 text-orange-500" />
                                HubSpot CRM Transparency
                                {portalName && <span className="text-gray-400 font-normal ml-1">({portalName})</span>}
                              </div>
                              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                                <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400"><Briefcase className="h-3 w-3" />Total deals</div>
                                <div className="font-medium text-gray-700 dark:text-gray-300">
                                  {totalDeals}
                                  {dealsAnalyzed > 0 && dealsAnalyzed < totalDeals && <span className={`ml-1 ${coveragePct >= 80 ? 'text-green-600' : 'text-yellow-600'}`}>({coveragePct}% analyzed)</span>}
                                </div>
                                <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400"><CheckCircle className="h-3 w-3" />Open deals</div>
                                <div className="font-medium text-gray-700 dark:text-gray-300">{openDeals}{openPipelineValue > 0 && <span className="text-gray-400 ml-1">(${openPipelineValue.toLocaleString()})</span>}</div>
                                {stalledDeals > 0 && (<>
                                  <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400"><TrendingDown className="h-3 w-3" />Stalled deals</div>
                                  <div className="font-medium text-amber-600 dark:text-amber-400">{stalledDeals}</div>
                                </>)}
                                <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400"><Users className="h-3 w-3" />Contacts</div>
                                <div className="font-medium text-gray-700 dark:text-gray-300">{totalContacts.toLocaleString()}</div>
                                <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400"><Layers className="h-3 w-3" />Companies</div>
                                <div className="font-medium text-gray-700 dark:text-gray-300">{totalCompanies.toLocaleString()}</div>
                                <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400"><BarChart3 className="h-3 w-3" />Pipelines</div>
                                <div className="font-medium text-gray-700 dark:text-gray-300">{pipelineCount}</div>
                              </div>
                              {crmSyncedAt && (
                                <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 pt-0.5">
                                  <Clock className="h-3 w-3" />Last sync: {formatTimeAgo(crmSyncedAt)}
                                </div>
                              )}
                              {lastErrors && lastErrors.length > 0 && (
                                <div className="flex items-start gap-1 text-xs text-red-500 dark:text-red-400 pt-0.5">
                                  <AlertTriangle className="h-3 w-3 flex-shrink-0 mt-0.5" />
                                  <span className="truncate" title={lastErrors[0]}>{lastErrors.length} API error{lastErrors.length > 1 ? 's' : ''} in last poll</span>
                                </div>
                              )}
                            </div>
                          );
                        }
                        return null;
                      })()}
                      {/* QuickBooks Financial Transparency Metrics */}
                      {integration.service_name === 'quickbooks' && ui?.config && (() => {
                        const cfg = ui.config;
                        const accountCount = (cfg.account_count as number) ?? 0;
                        const invoiceCount = (cfg.invoice_count as number) ?? 0;
                        const invoiceTotal = (cfg.invoice_total as number) ?? 0;
                        const paymentCount = (cfg.payment_count as number) ?? 0;
                        const paymentTotal = (cfg.payment_total as number) ?? 0;
                        const expenseCount = (cfg.expense_count as number) ?? 0;
                        const expenseTotal = (cfg.expense_total as number) ?? 0;
                        const overdueInvoices = (cfg.overdue_invoices as number) ?? 0;
                        const overdueTotal = (cfg.overdue_total as number) ?? 0;
                        const companyName = cfg.company_name as string | null;
                        const financialSyncedAt = cfg.financial_synced_at as string | null;
                        const hasActivity = accountCount > 0 || invoiceCount > 0 || paymentCount > 0 || expenseCount > 0;

                        if (hasActivity || financialSyncedAt) {
                          return (
                            <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-800/50 rounded-md space-y-1.5 border border-gray-100 dark:border-gray-700">
                              <div className="flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
                                <BarChart3 className="h-3 w-3 text-green-500" />
                                QuickBooks Financial Transparency
                                {companyName && <span className="text-gray-400 font-normal ml-1">({companyName})</span>}
                              </div>
                              {!hasActivity ? (
                                <div className="text-xs text-gray-400 dark:text-gray-500 italic">No financial activity</div>
                              ) : (
                                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                                  <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400"><Layers className="h-3 w-3" />Accounts</div>
                                  <div className="font-medium text-gray-700 dark:text-gray-300">{accountCount}</div>
                                  <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400"><DollarSign className="h-3 w-3" />Invoices</div>
                                  <div className="font-medium text-gray-700 dark:text-gray-300">{invoiceCount}{invoiceTotal > 0 && <span className="text-gray-400 ml-1">(${invoiceTotal.toLocaleString()})</span>}</div>
                                  <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400"><CheckCircle className="h-3 w-3" />Payments</div>
                                  <div className="font-medium text-gray-700 dark:text-gray-300">{paymentCount}{paymentTotal > 0 && <span className="text-gray-400 ml-1">(${paymentTotal.toLocaleString()})</span>}</div>
                                  <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400"><DollarSign className="h-3 w-3" />Expenses</div>
                                  <div className="font-medium text-gray-700 dark:text-gray-300">{expenseCount}{expenseTotal > 0 && <span className="text-gray-400 ml-1">(${expenseTotal.toLocaleString()})</span>}</div>
                                  {overdueInvoices > 0 && (<>
                                    <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400"><AlertTriangle className="h-3 w-3" />Overdue</div>
                                    <div className="font-medium text-amber-600 dark:text-amber-400">{overdueInvoices}{overdueTotal > 0 && <span className="ml-1">(${overdueTotal.toLocaleString()})</span>}</div>
                                  </>)}
                                </div>
                              )}
                              {financialSyncedAt && (
                                <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 pt-0.5">
                                  <Clock className="h-3 w-3" />Last sync: {formatTimeAgo(financialSyncedAt)}
                                </div>
                              )}
                            </div>
                          );
                        }
                        return null;
                      })()}
                      <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                        {disconnectConfirm === integration.id ? (
                          <div className="flex items-center gap-2">
                            <Button variant="destructive" size="sm" className="text-xs h-7" onClick={() => handleDisconnect(integration.service_name, integration.id)} disabled={disconnecting === integration.service_name}>
                              {disconnecting === integration.service_name ? <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> : <Unplug className="h-3 w-3 mr-1" />}
                              Confirm Disconnect
                            </Button>
                            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setDisconnectConfirm(null)}>Cancel</Button>
                          </div>
                        ) : (
                          <Button variant="ghost" size="sm" className="text-xs h-7 text-gray-400 hover:text-red-500" onClick={() => handleDisconnect(integration.service_name, integration.id)}>
                            <Unplug className="h-3 w-3 mr-1" /> Disconnect
                          </Button>
                        )}
                      </div>
                    </div>
                  ) : isAtLimit ? (
                    <div className="space-y-2">
                      <Button className="w-full" disabled>
                        <Lock className="h-4 w-4 mr-2" /> Limit Reached
                      </Button>
                      <p className="text-xs text-center text-amber-600 dark:text-amber-400">
                        Upgrade to connect more integrations
                      </p>
                    </div>
                  ) : integration.service_name === 'jira' ? (
                    /* Jira: OAuth primary + API key Advanced fallback */
                    <div className="space-y-3">
                      <Button
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                        onClick={() => handleConnect('jira')}
                        disabled={connecting === 'jira'}
                      >
                        {connecting === 'jira' ? (
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <ExternalLink className="h-4 w-4 mr-2" />
                        )}
                        {connecting === 'jira' ? 'Connecting...' : 'Connect Jira'}
                      </Button>
                      <button
                        type="button"
                        className="w-full text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex items-center justify-center gap-1 py-1"
                        onClick={() => setJiraAdvancedOpen(!jiraAdvancedOpen)}
                      >
                        <Key className="h-3 w-3" />
                        {jiraAdvancedOpen ? 'Hide' : 'Use API Token instead (Advanced)'}
                      </button>
                      {jiraAdvancedOpen && (
                        <div className="border border-gray-200 dark:border-gray-700 rounded-md p-3 space-y-2 bg-gray-50 dark:bg-gray-800/50">
                          <p className="text-xs text-gray-500 dark:text-gray-400">Connect using an Atlassian API token instead of OAuth.</p>
                          {JIRA_API_KEY_FIELDS.map(field => (
                            <div key={field.field}>
                              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-0.5">
                                {field.label}
                              </label>
                              <input
                                type={field.type}
                                placeholder={field.placeholder}
                                className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                value={apiKeyForm?.service === 'jira' ? (apiKeyForm.credentials[field.field] || '') : ''}
                                onChange={(e) => setApiKeyForm({
                                  service: 'jira',
                                  credentials: { ...(apiKeyForm?.service === 'jira' ? apiKeyForm.credentials : {}), [field.field]: e.target.value },
                                })}
                              />
                            </div>
                          ))}
                          {apiKeyError && apiKeyForm?.service === 'jira' && (
                            <p className="text-xs text-red-600">{apiKeyError}</p>
                          )}
                          <div className="flex gap-2 pt-1">
                            <Button
                              size="sm"
                              onClick={handleApiKeySubmit}
                              disabled={connecting === 'jira'}
                              className="flex-1 h-7 text-xs"
                            >
                              {connecting === 'jira' ? (
                                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                              ) : (
                                <CheckCircle className="h-3 w-3 mr-1" />
                              )}
                              {connecting === 'jira' ? 'Validating...' : 'Connect with API Token'}
                            </Button>
                            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setJiraAdvancedOpen(false); setApiKeyForm(null); setApiKeyError(null); }}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : apiKeyForm?.service === integration.service_name ? (
                    /* Inline API Key Form — renders right inside the card */
                    <div className="space-y-3 border border-indigo-200 dark:border-indigo-700 rounded-md p-3 bg-indigo-50/50 dark:bg-indigo-950/20">
                      {API_KEY_FIELDS[integration.service_name]?.map(field => (
                        <div key={field.field}>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-0.5">
                            {field.label}
                          </label>
                          <input
                            type={field.type}
                            placeholder={field.placeholder}
                            className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                            value={apiKeyForm.credentials[field.field] || ''}
                            onChange={(e) => setApiKeyForm({
                              ...apiKeyForm,
                              credentials: { ...apiKeyForm.credentials, [field.field]: e.target.value },
                            })}
                          />
                        </div>
                      ))}
                      {apiKeyError && (
                        <p className="text-xs text-red-600">{apiKeyError}</p>
                      )}
                      <div className="flex gap-2 pt-1">
                        <Button
                          size="sm"
                          onClick={handleApiKeySubmit}
                          disabled={connecting === integration.service_name}
                          className="flex-1 h-8 text-xs"
                        >
                          {connecting === integration.service_name ? (
                            <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                          ) : (
                            <CheckCircle className="h-3 w-3 mr-1" />
                          )}
                          {connecting === integration.service_name ? 'Validating...' : 'Connect'}
                        </Button>
                        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => { setApiKeyForm(null); setApiKeyError(null); }}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button className="w-full" onClick={() => handleConnect(integration.service_name)} disabled={connecting === integration.service_name}>
                      {connecting === integration.service_name ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : isApiKeyService ? <Key className="h-4 w-4 mr-2" /> : <ExternalLink className="h-4 w-4 mr-2" />}
                      {connecting === integration.service_name ? 'Connecting...' : `Connect ${integration.display_name}`}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Request Integration - Secondary CTA */}
      <div className="flex justify-center">
        <Button
          variant="ghost"
          className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
          onClick={() => setRequestModalOpen(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Don&apos;t see your tool? Request an integration
        </Button>
      </div>

      {/* My Requested Integrations — with commitment buttons + execution status */}
      {catalogEntries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Rocket className="h-4 w-4 text-indigo-500" />
              Requested Integrations ({catalogEntries.length})
            </CardTitle>
            <p className="text-xs text-gray-500 mt-1">
              Express your interest to help us prioritize what to build next.
            </p>
          </CardHeader>
          <CardContent>
            {loadingCatalog ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
              </div>
            ) : (
              <div className="space-y-3">
                {catalogEntries.map((entry) => {
                  const myCommitment = getMyCommitment(entry.id);
                  const execution = getExecution(entry.id);
                  const counts = allCommitmentCounts[entry.id] || { interested: 0, high_priority: 0 };
                  const totalCommitments = counts.interested + counts.high_priority;
                  return (
                    <div key={entry.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">{entry.canonical_name}</span>
                          {entry.category && (
                            <Badge variant="outline" className="text-xs">{entry.category}</Badge>
                          )}
                          {execution && (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getExecutionStatusColor(execution.status)}`}>
                              {getExecutionStatusLabel(execution.status)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span>{entry.total_requests} request{entry.total_requests !== 1 ? 's' : ''}</span>
                          {totalCommitments > 0 && (
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {totalCommitments} committed
                              {counts.high_priority > 0 && (
                                <span className="text-amber-600">({counts.high_priority} high priority)</span>
                              )}
                            </span>
                          )}
                          {execution?.estimated_completion_date && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              ETA: {format(new Date(execution.estimated_completion_date), 'MMM d, yyyy')}
                            </span>
                          )}
                          {execution?.notes && (
                            <span className="max-w-xs truncate">{execution.notes}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Button
                          size="sm"
                          variant={myCommitment?.commitment_type === 'interested' ? 'default' : 'outline'}
                          className="h-7 text-xs"
                          onClick={() => handleCommitment(entry.id, 'interested')}
                          disabled={committingTo === entry.id || myCommitment?.commitment_type === 'interested'}
                        >
                          {committingTo === entry.id ? (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          ) : (
                            <Heart className={`h-3 w-3 mr-1 ${myCommitment?.commitment_type === 'interested' ? 'fill-current' : ''}`} />
                          )}
                          Interested
                        </Button>
                        <Button
                          size="sm"
                          variant={myCommitment?.commitment_type === 'high_priority' ? 'default' : 'outline'}
                          className={`h-7 text-xs ${myCommitment?.commitment_type === 'high_priority' ? 'bg-amber-600 hover:bg-amber-700' : ''}`}
                          onClick={() => handleCommitment(entry.id, 'high_priority')}
                          disabled={committingTo === entry.id || myCommitment?.commitment_type === 'high_priority'}
                        >
                          {committingTo === entry.id ? (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          ) : (
                            <Star className={`h-3 w-3 mr-1 ${myCommitment?.commitment_type === 'high_priority' ? 'fill-current' : ''}`} />
                          )}
                          High Priority
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Phase 3B: My Offers */}
      {myOffers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Gift className="h-4 w-4 text-purple-500" />
              My Offers ({myOffers.length})
            </CardTitle>
            <p className="text-xs text-gray-500 mt-1">
              Private offers from the Core314 team for you.
            </p>
          </CardHeader>
          <CardContent>
            {loadingOffers ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
              </div>
            ) : (
              <div className="space-y-3">
                {myOffers.map((offer) => (
                  <div key={offer.id} className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">{getOfferCatalogName(offer.integration_catalog_id)}</span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            offer.status === 'accepted' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                            offer.status === 'declined' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                            'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                          }`}>
                            {offer.status.charAt(0).toUpperCase() + offer.status.slice(1)}
                          </span>
                        </div>
                        <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">{offer.offer_title}</h4>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">{offer.offer_description}</p>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span>Received: {format(new Date(offer.created_at), 'MMM d, yyyy')}</span>
                          {offer.responded_at && (
                            <span>Responded: {format(new Date(offer.responded_at), 'MMM d, yyyy')}</span>
                          )}
                        </div>
                      </div>
                      {offer.status === 'pending' && (
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Button
                            size="sm"
                            className="h-7 text-xs bg-green-600 hover:bg-green-700"
                            onClick={() => handleAcceptOffer(offer.id)}
                            disabled={respondingToOffer === offer.id}
                          >
                            {respondingToOffer === offer.id ? (
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            ) : (
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                            )}
                            Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs text-red-600 border-red-300 hover:bg-red-50"
                            onClick={() => handleDeclineOffer(offer.id)}
                            disabled={respondingToOffer === offer.id}
                          >
                            {respondingToOffer === offer.id ? (
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            ) : (
                              <XCircle className="h-3 w-3 mr-1" />
                            )}
                            Decline
                          </Button>
                        </div>
                      )}
                      {offer.status === 'accepted' && (
                        <div className="flex items-center gap-1 text-green-600 text-xs">
                          <CheckCircle2 className="h-4 w-4" />
                          Accepted
                        </div>
                      )}
                      {offer.status === 'declined' && (
                        <div className="flex items-center gap-1 text-red-500 text-xs">
                          <XCircle className="h-4 w-4" />
                          Declined
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* My Integration Requests */}
      {myRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Inbox className="h-4 w-4 text-indigo-500" />
              My Integration Requests ({myRequests.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 px-3 font-medium text-gray-600 dark:text-gray-400">Integration</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-600 dark:text-gray-400">Category</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-600 dark:text-gray-400">Status</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-600 dark:text-gray-400">Admin Notes</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-600 dark:text-gray-400">Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {myRequests.map((req) => (
                    <tr key={req.id} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="py-2 px-3 font-medium text-gray-900 dark:text-white">{req.integration_name}</td>
                      <td className="py-2 px-3 text-gray-600 dark:text-gray-400">{req.category}</td>
                      <td className="py-2 px-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          req.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                          req.status === 'planned' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' :
                          req.status === 'reviewing' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                          req.status === 'rejected' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                          'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                          {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-gray-600 dark:text-gray-400 max-w-xs truncate">{req.admin_notes || '—'}</td>
                      <td className="py-2 px-3 text-gray-500 dark:text-gray-500 text-xs">{format(new Date(req.created_at), 'MMM d, yyyy')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* How It Works */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">How Signal Detection Works</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto mb-3">
                <span className="text-blue-600 font-bold">1</span>
              </div>
              <h4 className="text-sm font-medium mb-1">Connect</h4>
              <p className="text-xs text-gray-500">
                Securely connect your tools via OAuth or API key. Core314 never stores your passwords.
              </p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto mb-3">
                <span className="text-blue-600 font-bold">2</span>
              </div>
              <h4 className="text-sm font-medium mb-1">Detect</h4>
              <p className="text-xs text-gray-500">
                Core314 polls your systems every 15 minutes and detects operational patterns.
              </p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto mb-3">
                <span className="text-blue-600 font-bold">3</span>
              </div>
              <h4 className="text-sm font-medium mb-1">Brief</h4>
              <p className="text-xs text-gray-500">
                Receive AI-generated operational briefs explaining what&apos;s happening in your business.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      {/* Request Integration Modal */}
      <RequestIntegrationModal
        open={requestModalOpen}
        onOpenChange={setRequestModalOpen}
        onSubmitted={fetchMyRequests}
      />
    </div>
  );
}
