import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { PlanCard } from '../components/billing/PlanCard';
import { UsageProgressBar } from '../components/billing/UsageProgressBar';
import { Loader2, CreditCard, AlertCircle, CheckCircle, ExternalLink, Receipt, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { PRICING } from '../../../shared/pricing';

interface SubscriptionSummary {
  subscription: {
    id?: string;
    plan_name: string;
    status: string;
    current_period_start?: string;
    current_period_end?: string;
    stripe_subscription_id?: string;
    stripe_customer_id?: string;
    metadata?: {
      billing_interval?: 'monthly' | 'annual';
    };
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
    status: 'active' | 'canceled' | 'pending';
    activated_at: string;
  }>;
}


const PLAN_FEATURES = {
  Monitor: [
    { name: 'Slack Integration', included: true },
    { name: 'HubSpot Integration', included: true },
    { name: 'QuickBooks Integration', included: true },
    { name: 'Operational Health Score', included: true },
    { name: 'Signals Dashboard', included: true },
    { name: 'AI Operational Briefs (10/mo)', included: true },
    { name: 'Up to 5 Users', included: true },
  ],
  Intelligence: [
    { name: 'Everything in Monitor', included: true },
    { name: 'Unlimited AI Briefs', included: true },
    { name: 'Command Center Dashboard', included: true },
    { name: 'Signal Trend Analysis', included: true },
    { name: 'Executive Brief Delivery', included: true },
    { name: 'Up to 10 Users', included: true },
  ],
  'Command Center': [
    { name: 'Everything in Intelligence', included: true },
    { name: 'Unlimited Users', included: true },
    { name: 'Advanced Signal Analytics', included: true },
    { name: 'Operational Pattern Detection', included: true },
    { name: 'Weekly Executive Reports', included: true },
    { name: 'Early Access to New Integrations', included: true },
  ],
  Enterprise: [
    { name: 'Everything in Command Center', included: true },
    { name: 'Dedicated Onboarding', included: true },
    { name: 'Custom Integrations', included: true },
    { name: 'Priority Signal Processing', included: true },
    { name: 'Dedicated Success Manager', included: true },
    { name: 'SLA Uptime Guarantees', included: true },
  ],
};

export default function Billing() {
  const { user } = useAuth();
  const navigate = useNavigate();
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

  const handleManageBilling = async () => {
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
      console.error('Error managing billing:', error);
      setNotification({
        type: 'error',
        message: 'Failed to open billing portal. Please try again.',
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
  const isCanceled = subscription.status === 'canceled';
  const billingInterval = subscription.metadata?.billing_interval || 'monthly';
  const hasStripeCustomer = !!subscription.stripe_customer_id;

  const getPaymentStatusBadge = (status: string) => {
    const variants: Record<string, { className: string; label: string }> = {
      active: { className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100', label: 'Paid' },
      trialing: { className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100', label: 'Trial' },
      past_due: { className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100', label: 'Payment Failed' },
      canceled: { className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100', label: 'Canceled' },
      incomplete: { className: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100', label: 'Pending' },
      unpaid: { className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100', label: 'Unpaid' },
    };
    const variant = variants[status] || variants.canceled;
    return <Badge className={variant.className}>{variant.label}</Badge>;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-6">
      <div>
        <h1 className="text-3xl font-bold">Billing & Subscription</h1>
        <p className="text-muted-foreground">
          Manage your subscription, view invoices, and update payment methods
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-gray-500" />
              <div>
                <p className="text-sm text-muted-foreground">Billing Interval</p>
                <p className="font-medium capitalize">{billingInterval}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Receipt className="h-5 w-5 text-gray-500" />
              <div>
                <p className="text-sm text-muted-foreground">Next Invoice Date</p>
                <p className="font-medium">
                  {subscription.current_period_end && !isCanceled
                    ? new Date(subscription.current_period_end).toLocaleDateString()
                    : 'N/A'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-gray-500" />
              <div>
                <p className="text-sm text-muted-foreground">Last Payment Status</p>
                <div className="mt-1">{getPaymentStatusBadge(subscription.status)}</div>
              </div>
            </div>
          </div>

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
        <CardFooter className="flex flex-wrap gap-2">
          {hasStripeCustomer ? (
            <>
              <Button
                variant="default"
                onClick={handleManageBilling}
                disabled={processingAction}
              >
                <Receipt className="mr-2 h-4 w-4" />
                {processingAction ? 'Loading...' : 'Manage Billing & Download Invoices'}
                <ExternalLink className="ml-2 h-3 w-3" />
              </Button>
              <Button
                variant="outline"
                onClick={handleManageBilling}
                disabled={processingAction}
              >
                <CreditCard className="mr-2 h-4 w-4" />
                Update Payment Method
                <ExternalLink className="ml-2 h-3 w-3" />
              </Button>
              {isCanceled && (
                <Button onClick={() => handleUpgradePlan(subscription.plan_name)} disabled={processingAction}>
                  Reactivate Plan
                </Button>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Invoices and receipts will be available after your first successful payment.
            </p>
          )}
        </CardFooter>
      </Card>

      <div>
        <h2 className="text-2xl font-bold mb-4">Available Plans</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {['Monitor', 'Intelligence', 'Command Center', 'Enterprise'].map((planName) => (
            <PlanCard
              key={planName}
              planName={planName}
              price={
                planName === 'Monitor' ? PRICING.monitor.monthly
                : planName === 'Intelligence' ? PRICING.intelligence.monthly
                : planName === 'Command Center' ? PRICING.commandCenter.monthly
                : null
              }
              billingPeriod="monthly"
              description={
                planName === 'Monitor'
                  ? PRICING.monitor.tagline
                  : planName === 'Intelligence'
                  ? PRICING.intelligence.tagline
                  : planName === 'Command Center'
                  ? PRICING.commandCenter.tagline
                  : PRICING.enterprise.tagline
              }
              features={PLAN_FEATURES[planName as keyof typeof PLAN_FEATURES]}
              integrationLimit={-1}
              currentPlan={subscription.plan_name === planName}
              onSelectPlan={planName !== 'Enterprise' ? () => handleUpgradePlan(planName) : undefined}
              onContactSales={planName === 'Enterprise' ? () => navigate('/contact-sales') : undefined}
              loading={processingAction}
            />
          ))}
        </div>
      </div>

    </div>
  );
}
