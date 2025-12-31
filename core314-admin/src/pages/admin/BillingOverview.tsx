import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { DollarSign, Users, TrendingUp, AlertCircle } from 'lucide-react';
import { PRICING } from '../../../../shared/pricing';

interface BillingMetrics {
  mrr: number;
  activeSubscriptions: {
    starter: number;
    professional: number;
    enterprise: number;
  };
  failedPayments: number;
  trialConversions: number;
}

export function BillingOverview() {
  const [metrics, setMetrics] = useState<BillingMetrics>({
    mrr: 0,
    activeSubscriptions: { starter: 0, professional: 0, enterprise: 0 },
    failedPayments: 0,
    trialConversions: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBillingMetrics();
  }, []);

    const fetchBillingMetrics = async () => {
      try {
        // Query user_subscriptions table for accurate billing data
        // Only count subscriptions with real Stripe IDs (not test data)
        const { data: subscriptions, error: subscriptionsError } = await supabase
          .from('user_subscriptions')
          .select('plan_name, status, stripe_subscription_id')
          .in('status', ['active', 'trialing'])
          .not('stripe_subscription_id', 'is', null)
          .not('stripe_subscription_id', 'like', 'test_%');

        if (subscriptionsError) throw subscriptionsError;

        const activeSubscriptions = {
          starter: subscriptions?.filter(s => s.plan_name === 'Starter').length || 0,
          professional: subscriptions?.filter(s => s.plan_name === 'Pro').length || 0,
          enterprise: subscriptions?.filter(s => s.plan_name === 'Enterprise').length || 0,
        };

        // Use shared pricing config - single source of truth
        const mrr = (
          (activeSubscriptions.starter * PRICING.starter.monthly) +
          (activeSubscriptions.professional * PRICING.pro.monthly) +
          (activeSubscriptions.enterprise * 0) // Enterprise is custom pricing
        );

      const { data: trialHistory, error: trialError } = await supabase
        .from('subscription_history')
        .select('*')
        .eq('event_type', 'subscription_created')
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      if (trialError) throw trialError;

      const trialToActiveCount = trialHistory?.filter(
        h => h.previous_status === 'trialing' && h.new_status === 'active'
      ).length || 0;
      
      const totalTrials = trialHistory?.filter(
        h => h.previous_status === 'inactive' && h.new_status === 'trialing'
      ).length || 0;

      const trialConversions = totalTrials > 0 
        ? Math.round((trialToActiveCount / totalTrials) * 100) 
        : 0;

      const { data: failedPaymentHistory, error: failedError } = await supabase
        .from('subscription_history')
        .select('*')
        .in('new_status', ['past_due', 'unpaid'])
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      if (failedError) throw failedError;

      const failedPayments = failedPaymentHistory?.length || 0;

      setMetrics({
        mrr,
        activeSubscriptions,
        failedPayments,
        trialConversions,
      });
    } catch (error) {
      console.error('Error fetching billing metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const totalSubscriptions =
    metrics.activeSubscriptions.starter +
    metrics.activeSubscriptions.professional +
    metrics.activeSubscriptions.enterprise;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Billing Overview</h1>
        <p className="text-gray-600 dark:text-gray-400">Revenue and subscription metrics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Monthly Recurring Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${metrics.mrr.toLocaleString()}</div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Total MRR
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
            <Users className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSubscriptions}</div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              All tiers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Trial Conversions</CardTitle>
            <TrendingUp className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.trialConversions}%</div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Conversion rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Failed Payments</CardTitle>
            <AlertCircle className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.failedPayments}</div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              This month
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Starter Plan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metrics.activeSubscriptions.starter}</div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Active subscribers</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                          ${(metrics.activeSubscriptions.starter * PRICING.starter.monthly).toLocaleString()} MRR
                        </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Professional Plan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metrics.activeSubscriptions.professional}</div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Active subscribers</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                          ${(metrics.activeSubscriptions.professional * PRICING.pro.monthly).toLocaleString()} MRR
                        </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Enterprise Plan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metrics.activeSubscriptions.enterprise}</div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Active subscribers</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                          $0 MRR (custom pricing)
                        </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
