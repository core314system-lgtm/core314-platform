import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { PlanCard } from '../components/billing/PlanCard';
import { UsageProgressBar } from '../components/billing/UsageProgressBar';
import { Loader2, CreditCard, AlertCircle, CheckCircle, ExternalLink, Receipt, Calendar, Gift, Clock, Star } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  Intelligence: [
    { name: 'Slack Integration', included: true },
    { name: 'HubSpot Integration', included: true },
    { name: 'QuickBooks Integration', included: true },
    { name: 'Operational Health Score', included: true },
    { name: 'Signals Dashboard', included: true },
    { name: 'AI Operational Briefs', included: true },
    { name: 'Up to 5 Users', included: true },
  ],
  'Command Center': [
    { name: 'Everything in Intelligence', included: true },
    { name: 'Up to 25 Users', included: true },
    { name: 'Advanced Signal Analytics', included: true },
    { name: 'Operational Pattern Detection', included: true },
    { name: 'Weekly Executive Reports', included: true },
    { name: 'Early Access to New Integrations', included: true },
  ],
  Enterprise: [
    { name: 'Everything in Command Center', included: true },
    { name: 'Unlimited Users', included: true },
    { name: 'Custom Integrations', included: true },
    { name: 'Priority Signal Processing', included: true },
    { name: 'Dedicated Success Manager', included: true },
    { name: 'SLA Uptime Guarantees', included: true },
  ],
};

interface BetaLifecycleInfo {
  found: boolean;
  lifecycle_status?: string;
  days_elapsed?: number;
  days_remaining?: number;
  total_days?: number;
  stripe_subscription_id?: string | null;
  checkout_url?: string | null;
  day_45_completed_at?: string | null;
  first_login_at?: string | null;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://ygvkegcstaowikessigx.supabase.co';

export default function Billing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [subscriptionSummary, setSubscriptionSummary] = useState<SubscriptionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [processingAction, setProcessingAction] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [integrationsUsed, setIntegrationsUsed] = useState(0);
  const [betaLifecycle, setBetaLifecycle] = useState<BetaLifecycleInfo | null>(null);
  const [claimingDiscount, setClaimingDiscount] = useState(false);

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

  // Handle query params from Stripe checkout redirect
  useEffect(() => {
    const betaConverted = searchParams.get('beta_converted');
    const betaCanceled = searchParams.get('beta_conversion');
    const alreadySubscribed = searchParams.get('already_subscribed');

    if (betaConverted === 'true') {
      setNotification({
        type: 'success',
        message: 'Welcome aboard! Your beta discount has been applied. You now have full Command Center access at 50% off for 6 months.',
      });
      // Clean up URL params
      searchParams.delete('beta_converted');
      setSearchParams(searchParams, { replace: true });
    } else if (betaCanceled === 'canceled') {
      setNotification({
        type: 'error',
        message: 'Checkout was canceled. Your beta discount is still available — claim it anytime before your beta period ends.',
      });
      searchParams.delete('beta_conversion');
      setSearchParams(searchParams, { replace: true });
    } else if (alreadySubscribed === 'true') {
      setNotification({
        type: 'success',
        message: 'You already have an active subscription with your beta discount applied.',
      });
      searchParams.delete('already_subscribed');
      setSearchParams(searchParams, { replace: true });
    }
  }, []);

  // Fetch beta lifecycle status
  const fetchBetaLifecycle = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase.rpc('get_beta_lifecycle_status', {
        p_user_id: user.id,
      });
      if (!error && data) {
        setBetaLifecycle(data as BetaLifecycleInfo);
      }
    } catch {
      // Not a beta tester — that's fine
    }
  };

  const handleClaimBetaDiscount = () => {
    if (!user) return;
    setClaimingDiscount(true);
    // Redirect to the beta-create-checkout edge function which handles
    // Stripe coupon creation, customer setup, and checkout session
    window.location.href = `${SUPABASE_URL}/functions/v1/beta-create-checkout?user_id=${user.id}`;
  };

  useEffect(() => {
    fetchSubscriptionData();
    fetchBetaLifecycle();

    const channel = supabase
      .channel('user-subscription-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'subscriptions',
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

      {/* Beta Tester Discount Banner */}
      {betaLifecycle?.found && !betaLifecycle.stripe_subscription_id && (
        <Card className="border-2 border-cyan-500 bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-950/30 dark:to-blue-950/30">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-full bg-cyan-100 dark:bg-cyan-900">
                  <Gift className="h-6 w-6 text-cyan-600 dark:text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Star className="h-5 w-5 text-amber-500" />
                    Beta Tester Exclusive: 50% Off Command Center
                  </h3>
                  <p className="text-muted-foreground mt-1">
                    As a valued beta participant, you've earned <strong className="text-cyan-700 dark:text-cyan-400">$399.50/mo</strong> instead of $799/mo for your first 6 months.
                    {betaLifecycle.days_remaining != null && betaLifecycle.days_remaining > 0 && (
                      <span className="ml-1">
                        You have <strong>{betaLifecycle.days_remaining} days</strong> remaining in your beta period.
                      </span>
                    )}
                    {betaLifecycle.lifecycle_status === 'completed' && (
                      <span className="ml-1 text-amber-600 dark:text-amber-400 font-medium">
                        Your beta period has ended — claim your discount before it expires.
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground mt-2 flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    No charge until your beta period ends. Cancel anytime.
                  </p>
                </div>
              </div>
              <Button
                size="lg"
                onClick={handleClaimBetaDiscount}
                disabled={claimingDiscount}
                className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white shadow-lg whitespace-nowrap"
              >
                {claimingDiscount ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Gift className="mr-2 h-4 w-4" />
                )}
                Claim Your 50% Discount
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Already converted banner */}
      {betaLifecycle?.found && betaLifecycle.stripe_subscription_id && (
        <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-800 dark:text-green-200">Beta Discount Active</AlertTitle>
          <AlertDescription className="text-green-700 dark:text-green-300">
            Your 50% beta tester discount is applied to your subscription. You're paying $399.50/mo for the first 6 months.
          </AlertDescription>
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
          {['Intelligence', 'Command Center', 'Enterprise'].map((planName) => (
            <PlanCard
              key={planName}
              planName={planName}
              price={
                planName === 'Intelligence' ? PRICING.intelligence.monthly
                : planName === 'Command Center' ? PRICING.commandCenter.monthly
                : null
              }
              billingPeriod="monthly"
              description={
                planName === 'Intelligence'
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
