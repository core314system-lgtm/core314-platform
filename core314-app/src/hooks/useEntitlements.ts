import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '../lib/supabase';

/**
 * ============================================================================
 * PHASE 12: MONETIZATION, ENTITLEMENTS & UPGRADE READINESS
 * ============================================================================
 * 
 * Central Entitlement Resolver - getTenantEntitlements
 * 
 * NON-NEGOTIABLE RULES:
 * 1. All integrations MUST remain visible and fully functional on all plans
 * 2. Plans may ONLY gate scale, depth, and intelligence richness — never availability
 * 3. Default = FULL ACCESS (for beta / internal tenants)
 * 4. Intelligence must NEVER error, show partial data, or mislead users
 * 5. Degradation must be graceful and silent
 * 
 * ENTITLEMENT FIELDS:
 * - max_connected_integrations: Maximum integrations that can be connected
 * - max_fusion_contributors: Maximum integrations contributing to Fusion Score
 * - intelligence_refresh_frequency: How often intelligence refreshes (minutes)
 * - historical_depth_days: How far back historical data is available
 * - cross_integration_depth: Depth of cross-integration analysis
 * - admin_visibility_scope: What admin features are visible
 * 
 * This contract was established in Phase 12 (Monetization & Entitlements)
 * and represents the monetization foundation of Core314's platform.
 * ============================================================================
 */

export interface TenantEntitlements {
  /** Maximum integrations that can be connected (-1 = unlimited) */
  max_connected_integrations: number;
  
  /** Maximum integrations contributing to Fusion Score (-1 = unlimited) */
  max_fusion_contributors: number;
  
  /** How often intelligence refreshes in minutes (lower = more frequent) */
  intelligence_refresh_frequency: number;
  
  /** How far back historical data is available in days (-1 = unlimited) */
  historical_depth_days: number;
  
  /** Depth of cross-integration analysis: 'basic' | 'standard' | 'deep' | 'full' */
  cross_integration_depth: 'basic' | 'standard' | 'deep' | 'full';
  
  /** What admin features are visible: 'limited' | 'standard' | 'full' */
  admin_visibility_scope: 'limited' | 'standard' | 'full';
  
  /** Plan tier for display purposes */
  plan_tier: 'starter' | 'professional' | 'enterprise' | 'internal';
  
  /** Whether this is a beta/internal tenant with full access */
  is_beta_tenant: boolean;
}

/**
 * Default entitlements for each plan tier
 * 
 * IMPORTANT: Default is FULL ACCESS for beta/internal tenants
 */
const PLAN_ENTITLEMENTS: Record<string, TenantEntitlements> = {
  // Internal/Beta tenants get FULL ACCESS
  internal: {
    max_connected_integrations: -1,
    max_fusion_contributors: -1,
    intelligence_refresh_frequency: 5,
    historical_depth_days: -1,
    cross_integration_depth: 'full',
    admin_visibility_scope: 'full',
    plan_tier: 'internal',
    is_beta_tenant: true,
  },
  
  // Enterprise tier - full access
  enterprise: {
    max_connected_integrations: -1,
    max_fusion_contributors: -1,
    intelligence_refresh_frequency: 5,
    historical_depth_days: -1,
    cross_integration_depth: 'full',
    admin_visibility_scope: 'full',
    plan_tier: 'enterprise',
    is_beta_tenant: false,
  },
  
  // Professional tier - expanded access
  professional: {
    max_connected_integrations: 10,
    max_fusion_contributors: 7,
    intelligence_refresh_frequency: 15,
    historical_depth_days: 90,
    cross_integration_depth: 'deep',
    admin_visibility_scope: 'standard',
    plan_tier: 'professional',
    is_beta_tenant: false,
  },
  
  // Starter tier - basic access
  starter: {
    max_connected_integrations: 5,
    max_fusion_contributors: 3,
    intelligence_refresh_frequency: 60,
    historical_depth_days: 30,
    cross_integration_depth: 'basic',
    admin_visibility_scope: 'limited',
    plan_tier: 'starter',
    is_beta_tenant: false,
  },
  
  // No plan / free tier - minimal access but ALL integrations visible
  none: {
    max_connected_integrations: 3,
    max_fusion_contributors: 2,
    intelligence_refresh_frequency: 120,
    historical_depth_days: 7,
    cross_integration_depth: 'basic',
    admin_visibility_scope: 'limited',
    plan_tier: 'starter',
    is_beta_tenant: false,
  },
};

/**
 * What users gain by upgrading - used for upgrade UX
 */
export const UPGRADE_BENEFITS: Record<string, { from: string; to: string; benefit: string }[]> = {
  starter: [
    { from: 'starter', to: 'professional', benefit: 'Connect up to 10 integrations (vs 5)' },
    { from: 'starter', to: 'professional', benefit: '7 integrations contribute to Fusion Score (vs 3)' },
    { from: 'starter', to: 'professional', benefit: 'Intelligence refreshes every 15 min (vs 60 min)' },
    { from: 'starter', to: 'professional', benefit: '90 days of historical data (vs 30 days)' },
    { from: 'starter', to: 'professional', benefit: 'Deep cross-integration analysis' },
  ],
  professional: [
    { from: 'professional', to: 'enterprise', benefit: 'Unlimited integrations' },
    { from: 'professional', to: 'enterprise', benefit: 'All integrations contribute to Fusion Score' },
    { from: 'professional', to: 'enterprise', benefit: 'Real-time intelligence (5 min refresh)' },
    { from: 'professional', to: 'enterprise', benefit: 'Unlimited historical data' },
    { from: 'professional', to: 'enterprise', benefit: 'Full cross-integration analysis' },
    { from: 'professional', to: 'enterprise', benefit: 'Full admin visibility' },
  ],
};

export interface UseEntitlementsResult {
  entitlements: TenantEntitlements;
  loading: boolean;
  error: string | null;
  
  /** Check if user can connect more integrations */
  canConnectIntegration: (currentCount: number) => boolean;
  
  /** Check if an integration can contribute to Fusion Score */
  canContributeToFusion: (currentContributorCount: number) => boolean;
  
  /** Get the number of integrations that can still be connected */
  remainingIntegrationSlots: (currentCount: number) => number;
  
  /** Get the number of Fusion contributors that can still be added */
  remainingFusionSlots: (currentContributorCount: number) => number;
  
  /** Get upgrade benefits for current plan */
  getUpgradeBenefits: () => { from: string; to: string; benefit: string }[];
  
  /** Check if user is at or near a limit */
  isNearLimit: (limitType: 'integrations' | 'fusion', currentCount: number) => boolean;
  
  /** Refetch entitlements */
  refetch: () => Promise<void>;
}

/**
 * Central Entitlement Resolver Hook
 * 
 * Provides access to tenant entitlements and helper functions for checking limits.
 * Default = FULL ACCESS for beta/internal tenants.
 */
export function useEntitlements(): UseEntitlementsResult {
  const { profile } = useAuth();
  const [entitlements, setEntitlements] = useState<TenantEntitlements>(PLAN_ENTITLEMENTS.internal);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEntitlements = useCallback(async () => {
    if (!profile?.id) {
      // Default to full access for unauthenticated users (will be gated elsewhere)
      setEntitlements(PLAN_ENTITLEMENTS.internal);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // First check if there's a custom entitlement override in the database
      const { data: customEntitlements, error: customError } = await supabase
        .from('tenant_entitlements')
        .select('*')
        .eq('user_id', profile.id)
        .single();

      if (customEntitlements && !customError) {
        // Use custom entitlements if they exist
        setEntitlements({
          max_connected_integrations: customEntitlements.max_connected_integrations ?? -1,
          max_fusion_contributors: customEntitlements.max_fusion_contributors ?? -1,
          intelligence_refresh_frequency: customEntitlements.intelligence_refresh_frequency ?? 5,
          historical_depth_days: customEntitlements.historical_depth_days ?? -1,
          cross_integration_depth: customEntitlements.cross_integration_depth ?? 'full',
          admin_visibility_scope: customEntitlements.admin_visibility_scope ?? 'full',
          plan_tier: customEntitlements.plan_tier ?? 'internal',
          is_beta_tenant: customEntitlements.is_beta_tenant ?? true,
        });
      } else {
        // Fall back to plan-based entitlements from profile
        const tier = profile.subscription_tier || 'none';
        
        // Check if user is a beta tester (full access)
        const isBeta = profile.role === 'admin' || tier === 'enterprise';
        
        if (isBeta) {
          setEntitlements(PLAN_ENTITLEMENTS.internal);
        } else {
          setEntitlements(PLAN_ENTITLEMENTS[tier] || PLAN_ENTITLEMENTS.none);
        }
      }
    } catch (err) {
      console.error('[useEntitlements] Error fetching entitlements:', err);
      setError('Failed to load entitlements');
      // Default to full access on error (fail open for beta)
      setEntitlements(PLAN_ENTITLEMENTS.internal);
    } finally {
      setLoading(false);
    }
  }, [profile?.id, profile?.subscription_tier, profile?.role]);

  useEffect(() => {
    fetchEntitlements();
  }, [fetchEntitlements]);

  // Helper functions
  const canConnectIntegration = useCallback((currentCount: number): boolean => {
    if (entitlements.max_connected_integrations === -1) return true;
    return currentCount < entitlements.max_connected_integrations;
  }, [entitlements.max_connected_integrations]);

  const canContributeToFusion = useCallback((currentContributorCount: number): boolean => {
    if (entitlements.max_fusion_contributors === -1) return true;
    return currentContributorCount < entitlements.max_fusion_contributors;
  }, [entitlements.max_fusion_contributors]);

  const remainingIntegrationSlots = useCallback((currentCount: number): number => {
    if (entitlements.max_connected_integrations === -1) return Infinity;
    return Math.max(0, entitlements.max_connected_integrations - currentCount);
  }, [entitlements.max_connected_integrations]);

  const remainingFusionSlots = useCallback((currentContributorCount: number): number => {
    if (entitlements.max_fusion_contributors === -1) return Infinity;
    return Math.max(0, entitlements.max_fusion_contributors - currentContributorCount);
  }, [entitlements.max_fusion_contributors]);

  const getUpgradeBenefits = useCallback((): { from: string; to: string; benefit: string }[] => {
    return UPGRADE_BENEFITS[entitlements.plan_tier] || [];
  }, [entitlements.plan_tier]);

  const isNearLimit = useCallback((limitType: 'integrations' | 'fusion', currentCount: number): boolean => {
    const limit = limitType === 'integrations' 
      ? entitlements.max_connected_integrations 
      : entitlements.max_fusion_contributors;
    
    if (limit === -1) return false;
    
    // Consider "near limit" as 80% or more of limit
    return currentCount >= limit * 0.8;
  }, [entitlements.max_connected_integrations, entitlements.max_fusion_contributors]);

  return {
    entitlements,
    loading,
    error,
    canConnectIntegration,
    canContributeToFusion,
    remainingIntegrationSlots,
    remainingFusionSlots,
    getUpgradeBenefits,
    isNearLimit,
    refetch: fetchEntitlements,
  };
}

/**
 * Get entitlements for a specific user (server-side / Edge Function use)
 * 
 * This is the authoritative entitlement resolver that should be used
 * in backend logic (Edge Functions, API routes, etc.)
 */
export async function getTenantEntitlements(userId: string): Promise<TenantEntitlements> {
  try {
    // First check for custom entitlements
    const { data: customEntitlements, error: customError } = await supabase
      .from('tenant_entitlements')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (customEntitlements && !customError) {
      return {
        max_connected_integrations: customEntitlements.max_connected_integrations ?? -1,
        max_fusion_contributors: customEntitlements.max_fusion_contributors ?? -1,
        intelligence_refresh_frequency: customEntitlements.intelligence_refresh_frequency ?? 5,
        historical_depth_days: customEntitlements.historical_depth_days ?? -1,
        cross_integration_depth: customEntitlements.cross_integration_depth ?? 'full',
        admin_visibility_scope: customEntitlements.admin_visibility_scope ?? 'full',
        plan_tier: customEntitlements.plan_tier ?? 'internal',
        is_beta_tenant: customEntitlements.is_beta_tenant ?? true,
      };
    }

    // Fall back to profile-based entitlements
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('subscription_tier, role')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      // Default to full access on error (fail open for beta)
      return PLAN_ENTITLEMENTS.internal;
    }

    const tier = profile.subscription_tier || 'none';
    const isBeta = profile.role === 'admin' || tier === 'enterprise';

    if (isBeta) {
      return PLAN_ENTITLEMENTS.internal;
    }

    return PLAN_ENTITLEMENTS[tier] || PLAN_ENTITLEMENTS.none;
  } catch (err) {
    console.error('[getTenantEntitlements] Error:', err);
    // Default to full access on error (fail open for beta)
    return PLAN_ENTITLEMENTS.internal;
  }
}

/**
 * Select top N integrations for Fusion Score contribution
 * 
 * When max_fusion_contributors is limited, this function deterministically
 * selects the highest-signal integrations to include in the Fusion Score.
 * 
 * Selection criteria (in order):
 * 1. Highest activity_volume
 * 2. Most recent last_successful_run_at
 * 3. Alphabetical by service_name (for determinism)
 */
export function selectFusionContributors<T extends { 
  service_name: string; 
  activity_volume?: number;
  last_successful_run_at?: string | null;
}>(
  integrations: T[],
  maxContributors: number
): T[] {
  if (maxContributors === -1 || integrations.length <= maxContributors) {
    return integrations;
  }

  // Sort by highest signal first
  const sorted = [...integrations].sort((a, b) => {
    // Primary: activity_volume (higher is better)
    const volumeA = a.activity_volume ?? 0;
    const volumeB = b.activity_volume ?? 0;
    if (volumeB !== volumeA) return volumeB - volumeA;

    // Secondary: last_successful_run_at (more recent is better)
    const dateA = a.last_successful_run_at ? new Date(a.last_successful_run_at).getTime() : 0;
    const dateB = b.last_successful_run_at ? new Date(b.last_successful_run_at).getTime() : 0;
    if (dateB !== dateA) return dateB - dateA;

    // Tertiary: alphabetical by service_name (for determinism)
    return a.service_name.localeCompare(b.service_name);
  });

  return sorted.slice(0, maxContributors);
}

/**
 * Check if historical data should be included based on entitlements
 */
export function isWithinHistoricalDepth(
  date: Date | string,
  historicalDepthDays: number
): boolean {
  if (historicalDepthDays === -1) return true;

  const dataDate = typeof date === 'string' ? new Date(date) : date;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - historicalDepthDays);

  return dataDate >= cutoffDate;
}

/**
 * Filter an array of items with a date field based on historical depth entitlement
 * 
 * This is used to silently filter out data that is older than the user's
 * historical_depth_days entitlement allows. The filtering is silent and
 * graceful - no errors, no partial data indicators.
 */
export function filterByHistoricalDepth<T extends { computed_at?: string; created_at?: string }>(
  items: T[],
  historicalDepthDays: number
): T[] {
  if (historicalDepthDays === -1) return items;

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - historicalDepthDays);

  return items.filter(item => {
    const dateStr = item.computed_at || item.created_at;
    if (!dateStr) return true; // Include items without dates
    
    const itemDate = new Date(dateStr);
    return itemDate >= cutoffDate;
  });
}

/**
 * Check if intelligence refresh should be allowed based on entitlements
 * 
 * Returns true if enough time has passed since the last refresh based on
 * the intelligence_refresh_frequency entitlement.
 */
export function canRefreshIntelligence(
  lastRefreshAt: Date | string | null,
  refreshFrequencyMinutes: number
): boolean {
  if (!lastRefreshAt) return true; // No previous refresh, allow it
  
  const lastRefresh = typeof lastRefreshAt === 'string' ? new Date(lastRefreshAt) : lastRefreshAt;
  const now = new Date();
  const diffMinutes = (now.getTime() - lastRefresh.getTime()) / (1000 * 60);
  
  return diffMinutes >= refreshFrequencyMinutes;
}

/**
 * Get the cutoff date for historical data based on entitlements
 */
export function getHistoricalCutoffDate(historicalDepthDays: number): Date | null {
  if (historicalDepthDays === -1) return null; // No cutoff
  
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - historicalDepthDays);
  return cutoffDate;
}

/**
 * Export plan entitlements for use in other modules
 */
export { PLAN_ENTITLEMENTS };
