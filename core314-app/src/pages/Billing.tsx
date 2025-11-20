import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { PlanCard } from '../components/billing/PlanCard';
import { UsageProgressBar } from '../components/billing/UsageProgressBar';
import { AddOnManager } from '../components/billing/AddOnManager';
import { Loader2, CreditCard, AlertCircle, CheckCircle, ExternalLink } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface SubscriptionSummary {
  subscription: {
    id?: string;
    plan_name: string;
    status: string;
    current_period_end?: string;
    stripe_subscription_id?: string;
  };
  plan_limits: {
    integration_limit: number;
    features: {
      analytics: boolean;
      advanced_ai: boolean;
      proactive_optimization: boolean;
      api_access: boolean;
    };
  };
  active_addons: Array<{
    id: string;
    addon_name: string;
    addon_category: string;
    status: string;
    activated_at: string;
  }>;
}

const AVAILABLE_ADDONS = [
  {
    name: 'Advanced Analytics',
    category: 'analytics',
    description: 'Unlock detailed analytics dashboards and custom reports',
    price: 49,
    stripePriceId: 'price_analytics_monthly',
  },
  {
    name: 'AI Insights Pro',
    category: 'ai',
    description: 'Enhanced AI-powered recommendations and predictions',
    price: 99,
    stripePriceId: 'price_ai_insights_monthly',
  },
  {
    name: 'Additional Integration Pack',
    category: 'integration',
    description: 'Add 5 more integrations to your plan',
    price: 29,
    stripePriceId: 'price_integration_pack_monthly',
  },
];

const PLAN_FEATURES = {
  Free: [
    { name: 'Basic Dashboard Access', included: true },
    { name: 'Email Support', included: true },
    { name: 'Integrations', included: false },
    { name: 'Analytics', included: false },
    { name: 'Advanced AI', included: false },
    { name: 'API Access', included: false },
  ],
  Starter: [
    { name: 'Basic Dashboard Access', included: true },
    { name: 'Email Support', included: true },
    { name: '3 Integrations', included: true },
    { name: 'Proactive Optimization', included: true },
    { name: 'Analytics', included: false },
    { name: 'Advanced AI', included: false },
    { name: 'API Access', included: false },
  ],
  Pro: [
    { name: 'Priority Support', included: true },
    { name: '10 Integrations', included: true },
    { name: 'Proactive Optimization', included: true },
    { name: 'Analytics Dashboard', included: true },
    { name: 'API Access', included: true },
    { name: 'Advanced AI', included: false },
  ],
  Enterprise: [
    { name: 'Dedicated Support', included: true },
    { name: 'Unlimited Integrations', included: true },
    { name: 'Proactive Optimization', included: true },
    { name: 'Analytics Dashboard', included: true },
    { name: 'Advanced AI', included: true },
    { name: 'API Access', included: true },
    { name: 'Custom Integrations', included: true },
  ],
};

export default function Billing() {
  const { user } = useAuth();
  const [subscriptionSummary, setSubscriptionSummary] = useState<SubscriptionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [processingAction, setProcessingAction] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [integrationsUsed, setIntegrationsUsed] = useState(0);

  const fetchSubscriptionData = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase.rpc('get_user_subscription_summary', {
        p_user_id: user.id,
      });

      if (error) throw error;
      setSubscriptionSummary(data);

      setIntegrationsUsed(0);
    } catch (error) {
      console.error('Error fetching subscription data:', error);
      setNotification({
        type: 'error',
        message: 'Failed to load subscription data. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscriptionData();

    const channel = supabase
      .channel('user-subscription-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_subscriptions',
          filter: `user_id=eq.${user?.id}`,
        },
        () => {
          fetchSubscriptionData();
          setNotification({
            type: 'success',
            message: 'Your subscription has been updated!',
          });
        }
      )
      .subscribe();

    const interval = setInterval(fetchSubscriptionData, 60000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [user]);

  const handleUpgradePlan = async (planName: string) => {
    setProcessingAction(true);
    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planName,
          userId: user?.id,
        }),
      });

      const { url } = await response.json();
      window.location.href = url;
    } catch (error) {
      console.error('Error upgrading plan:', error);
      setNotification({
        type: 'error',
        message: 'Failed to start upgrade process. Please try again.',
      });
    } finally {
      setProcessingAction(false);
    }
  };

  const handleCancelPlan = async () => {
    if (!confirm('Are you sure you want to cancel your subscription?')) return;

    setProcessingAction(true);
    try {
      const response = await fetch('/api/create-portal-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
        }),
      });

      const { url } = await response.json();
      window.location.href = url;
    } catch (error) {
      console.error('Error canceling plan:', error);
      setNotification({
        type: 'error',
        message: 'Failed to open billing portal. Please try again.',
      });
    } finally {
      setProcessingAction(false);
    }
  };

  const handlePurchaseAddOn = async (addOn: typeof AVAILABLE_ADDONS[0]) => {
    setProcessingAction(true);
    try {
      const response = await fetch('/api/create-addon-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          addonName: addOn.name,
          addonCategory: addOn.category,
          priceId: addOn.stripePriceId,
          userId: user?.id,
        }),
      });

      const { url } = await response.json();
      window.location.href = url;
    } catch (error) {
      console.error('Error purchasing add-on:', error);
      setNotification({
        type: 'error',
        message: 'Failed to purchase add-on. Please try again.',
      });
    } finally {
      setProcessingAction(false);
    }
  };

  const handleCancelAddOn = async (addOnId: string) => {
    if (!confirm('Are you sure you want to cancel this add-on?')) return;

    setProcessingAction(true);
    try {
      const { error } = await supabase
        .from('user_addons')
        .update({
          status: 'canceled',
          expires_at: new Date().toISOString(),
        })
        .eq('id', addOnId);

      if (error) throw error;

      setNotification({
        type: 'success',
        message: 'Add-on canceled successfully.',
      });
      fetchSubscriptionData();
    } catch (error) {
      console.error('Error canceling add-on:', error);
      setNotification({
        type: 'error',
        message: 'Failed to cancel add-on. Please try again.',
      });
    } finally {
      setProcessingAction(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { className: string; label: string }> = {
      active: { className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100', label: 'Active' },
      trialing: { className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100', label: 'Trial' },
      past_due: { className: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100', label: 'Past Due' },
      canceled: { className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100', label: 'Canceled' },
    };

    const variant = variants[status] || variants.canceled;
    return <Badge className={variant.className}>{variant.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!subscriptionSummary) {
    return (
      <div className="flex items-center justify-center h-96">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Failed to load subscription data. Please refresh the page.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const { subscription, plan_limits, active_addons } = subscriptionSummary;
  const isFreePlan = subscription.plan_name === 'Free';
  const isCanceled = subscription.status === 'canceled';

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-6">
      <div>
        <h1 className="text-3xl font-bold">Billing & Subscription</h1>
        <p className="text-muted-foreground">
          Manage your subscription, view usage, and purchase add-ons
        </p>
      </div>

      {notification && (
        <Alert variant={notification.type === 'error' ? 'destructive' : 'default'}>
          {notification.type === 'success' ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <AlertTitle>{notification.type === 'success' ? 'Success' : 'Error'}</AlertTitle>
          <AlertDescription>{notification.message}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">Current Plan: {subscription.plan_name}</CardTitle>
              <CardDescription>
                {subscription.current_period_end && !isCanceled
                  ? `Renews on ${new Date(subscription.current_period_end).toLocaleDateString()}`
                  : isCanceled
                  ? 'Subscription canceled'
                  : 'No active subscription'}
              </CardDescription>
            </div>
            {getStatusBadge(subscription.status)}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <UsageProgressBar
            used={integrationsUsed}
            limit={plan_limits.integration_limit}
            label="Integrations"
            tooltipContent="Number of active integrations connected to your account"
          />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              <div className={`h-3 w-3 rounded-full ${plan_limits.features.analytics ? 'bg-green-500' : 'bg-gray-300'}`} />
              <span className="text-sm">Analytics</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`h-3 w-3 rounded-full ${plan_limits.features.advanced_ai ? 'bg-green-500' : 'bg-gray-300'}`} />
              <span className="text-sm">Advanced AI</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`h-3 w-3 rounded-full ${plan_limits.features.proactive_optimization ? 'bg-green-500' : 'bg-gray-300'}`} />
              <span className="text-sm">Proactive Optimization</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`h-3 w-3 rounded-full ${plan_limits.features.api_access ? 'bg-green-500' : 'bg-gray-300'}`} />
              <span className="text-sm">API Access</span>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex gap-2">
          {!isFreePlan && !isCanceled && (
            <Button
              variant="default"
              onClick={handleManageBilling}
              disabled={processingAction}
            >
              <CreditCard className="mr-2 h-4 w-4" />
              {processingAction ? 'Loading...' : 'Manage Billing'}
            </Button>
          )}
          {isCanceled && (
            <Button onClick={() => handleUpgradePlan(subscription.plan_name)} disabled={processingAction}>
              Reactivate Plan
            </Button>
          )}
        </CardFooter>
      </Card>

      <div>
        <h2 className="text-2xl font-bold mb-4">Available Plans</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {['Free', 'Starter', 'Pro', 'Enterprise'].map((planName) => (
            <PlanCard
              key={planName}
              planName={planName}
              price={planName === 'Free' ? 0 : planName === 'Starter' ? 99 : planName === 'Pro' ? 999 : 2999}
              billingPeriod="monthly"
              description={
                planName === 'Free'
                  ? 'Get started with basic features'
                  : planName === 'Starter'
                  ? 'Perfect for small teams'
                  : planName === 'Pro'
                  ? 'Advanced features for growing businesses'
                  : 'Enterprise-grade solutions'
              }
              features={PLAN_FEATURES[planName as keyof typeof PLAN_FEATURES]}
              integrationLimit={
                planName === 'Free' ? 0 : planName === 'Starter' ? 3 : planName === 'Pro' ? 10 : -1
              }
              currentPlan={subscription.plan_name === planName}
              onSelectPlan={() => handleUpgradePlan(planName)}
              loading={processingAction}
            />
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold mb-4">Add-Ons</h2>
        <AddOnManager
          activeAddOns={active_addons}
          availableAddOns={AVAILABLE_ADDONS}
          onPurchaseAddOn={handlePurchaseAddOn}
          onCancelAddOn={handleCancelAddOn}
          loading={processingAction}
        />
      </div>
    </div>
  );
}
