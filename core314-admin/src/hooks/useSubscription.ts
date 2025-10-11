import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { SubscriptionFeatures } from '../types';

const tierFeatures: Record<string, SubscriptionFeatures> = {
  none: {
    tier: 'none',
    status: 'inactive',
    maxUsers: 0,
    maxIntegrations: 0,
    features: [],
  },
  starter: {
    tier: 'starter',
    status: 'active',
    maxUsers: 5,
    maxIntegrations: 1,
    features: ['core_dashboard', 'basic_metrics'],
  },
  professional: {
    tier: 'professional',
    status: 'active',
    maxUsers: 25,
    maxIntegrations: 5,
    features: ['core_dashboard', 'ai_insights', 'alerts', 'custom_branding', 'basic_metrics'],
  },
  enterprise: {
    tier: 'enterprise',
    status: 'active',
    maxUsers: -1,
    maxIntegrations: -1,
    features: ['full_access', 'ai_orchestration', 'audit_trails', 'api_access', 'account_manager', 'core_dashboard', 'ai_insights', 'alerts', 'custom_branding', 'basic_metrics'],
  },
};

export function useSubscription(userId: string | undefined) {
  const [subscription, setSubscription] = useState<SubscriptionFeatures>(tierFeatures.none);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const fetchSubscription = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('subscription_tier, subscription_status')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Failed to fetch subscription:', error);
        setSubscription(tierFeatures.none);
      } else {
        const tier = data.subscription_tier || 'none';
        setSubscription({
          ...tierFeatures[tier],
          status: data.subscription_status,
        });
      }
      setLoading(false);
    };

    fetchSubscription();

    const channel = supabase
      .channel('subscription_changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          const newData = payload.new as { subscription_tier: string; subscription_status: string };
          const tier = newData.subscription_tier || 'none';
          setSubscription({
            ...tierFeatures[tier],
            status: newData.subscription_status,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const hasFeature = (feature: string) => {
    return subscription.features.includes(feature);
  };

  const canAddIntegration = (currentCount: number) => {
    if (subscription.maxIntegrations === -1) return true;
    return currentCount < subscription.maxIntegrations;
  };

  const canAddUser = (currentCount: number) => {
    if (subscription.maxUsers === -1) return true;
    return currentCount < subscription.maxUsers;
  };

  return {
    subscription,
    loading,
    hasFeature,
    canAddIntegration,
    canAddUser,
  };
}
