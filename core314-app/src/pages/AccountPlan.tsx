import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useSubscription } from '../hooks/useSubscription';
import { useOrganization } from '../contexts/OrganizationContext';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Check, Sparkles, TrendingUp, Zap, ArrowRight, Lock, Loader2, CheckCircle } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';

// Self-serve add-on IDs that can be purchased via Stripe checkout
// Enterprise-only add-ons and additional_integration_starter remain Contact Sales
const SELF_SERVE_ADDON_IDS = [
  'additional_integration_pro',
  'premium_analytics',
  'advanced_fusion_ai',
  'data_export',
];

// Plan configuration - prices and limits match Pricing.tsx exactly
const PLAN_CONFIG: Record<string, {
  label: string;
  price: string;
  priceValue: number;
  description: string;
  integrations: string;
  users: string;
  aiLevel: string;
  features: string[];
}> = {
  none: {
    label: 'No Plan',
    price: '$0/mo',
    priceValue: 0,
    description: 'No active subscription',
    integrations: '0 integrations',
    users: '0 users',
    aiLevel: 'None',
    features: [],
  },
  starter: {
    label: 'Starter',
    price: '$99/mo',
    priceValue: 99,
    description: 'Perfect for small teams getting started',
    integrations: '3 integrations included',
    users: 'Up to 5 users',
    aiLevel: 'Basic AI recommendations',
    features: [
      'Unified dashboards',
      'Basic AI recommendations',
      'Email support',
      '14-day free trial',
    ],
  },
  professional: {
    label: 'Pro',
    price: '$999/mo',
    priceValue: 999,
    description: 'Advanced operations for growing businesses',
    integrations: '10 integrations included',
    users: 'Up to 25 users',
    aiLevel: 'Advanced AI with Proactive Optimization',
    features: [
      'Proactive Optimization Engine',
      'Real-time KPI alerts',
      'Advanced analytics',
      'Priority support',
      'API access',
    ],
  },
  enterprise: {
    label: 'Enterprise',
    price: 'Custom',
    priceValue: 0, // Not used - Enterprise is Contact Sales only
    description: 'Full-featured for large operations',
    integrations: 'Unlimited integrations',
    users: 'Unlimited users',
    aiLevel: 'Full AI orchestration',
    features: [
      'Admin Analytics dashboard',
      'Full API access',
      'On-premise deployment option',
      'Dedicated account manager',
      'Custom SLA',
      '24/7 support',
    ],
  },
};

// Tier ranking for upgrade/addon eligibility logic
type Tier = 'none' | 'starter' | 'professional' | 'enterprise';
const tierRank: Record<Tier, number> = {
  none: 0,
  starter: 1,
  professional: 2,
  enterprise: 3,
};

// Add-ons configuration with eligibility rules
const ADDONS = [
  {
    id: 'additional_integration_starter',
    name: 'Additional Integration (Starter)',
    description: 'Expand your connected systems beyond the 3 included in your Starter plan. Each additional integration brings more data into your unified dashboard, enabling broader Fusion scoring and cross-system insights.',
    benefit: 'Ideal for growing teams adding new tools over time. Connect Slack, Teams, Gmail, or any supported app to capture the full picture of your operations without upgrading your entire plan.',
    price: '$75/mo',
    minTier: 'starter' as Tier,
    maxTier: 'starter' as Tier,
    compatibilityLabel: 'Starter plan only',
    icon: Zap,
  },
  {
    id: 'additional_integration_pro',
    name: 'Additional Integration (Pro)',
    description: 'Go beyond the 10 integrations included in your Pro plan. Each additional connection expands your operational visibility and strengthens your Fusion scoring accuracy across more data sources.',
    benefit: 'Ideal for scaling operations with diverse tooling. Capture data from every corner of your tech stack to ensure nothing falls through the cracks as your business grows.',
    price: '$50/mo',
    minTier: 'professional' as Tier,
    maxTier: 'professional' as Tier,
    compatibilityLabel: 'Pro plan only',
    icon: Zap,
  },
  {
    id: 'premium_analytics',
    name: 'Premium Analytics',
    description: 'Unlock advanced dashboards with cross-integration analysis, trend detection, and KPI comparisons. Build custom views that surface the metrics that matter most to your leadership and operations teams.',
    benefit: 'Ideal for operations leaders and executives who need a single source of truth. Investigate anomalies, compare performance across time periods, and share polished reports with stakeholders.',
    price: '$199/mo',
    minTier: 'starter' as Tier,
    maxTier: 'enterprise' as Tier,
    compatibilityLabel: 'Available on Starter+',
    icon: TrendingUp,
  },
  {
    id: 'advanced_fusion_ai',
    name: 'Advanced Fusion AI',
    description: 'Elevate your AI capabilities with predictive signals and proactive optimization recommendations. The system learns your operational patterns and surfaces early warnings before inefficiencies impact your business.',
    benefit: 'Ideal for complex or scaling operations where early detection matters. Reduce firefighting by catching issues before they escalate, and receive actionable recommendations tailored to your workflow.',
    price: '$299/mo',
    minTier: 'professional' as Tier,
    maxTier: 'enterprise' as Tier,
    compatibilityLabel: 'Available on Pro+',
    icon: Sparkles,
  },
  {
    id: 'data_export',
    name: 'Data Export',
    description: 'Export your operational data anytime in CSV, JSON, or PDF formats. Maintain full ownership of your data for compliance audits, external reporting, or offline analysis.',
    benefit: 'Ideal for regulated industries or reporting-heavy environments. Meet audit requirements, share data with external partners, and ensure you always have access to your information.',
    price: '$99/mo',
    minTier: 'starter' as Tier,
    maxTier: 'enterprise' as Tier,
    compatibilityLabel: 'Available on Starter+',
    icon: TrendingUp,
  },
];

// Helper to check if current tier can use an addon
const canUseAddon = (currentTier: string | undefined, minTier: Tier, maxTier: Tier): boolean => {
  if (!currentTier) return false;
  const current = tierRank[currentTier as Tier] ?? 0;
  const min = tierRank[minTier];
  const max = tierRank[maxTier];
  return current >= min && current <= max;
};

// Helper to get available upgrades based on current tier
const getAvailableUpgrades = (currentTier: string | undefined): string[] => {
  const current = tierRank[(currentTier as Tier) ?? 'none'];
  const upgrades: string[] = [];
  
  if (current < tierRank.starter) upgrades.push('starter');
  if (current < tierRank.professional) upgrades.push('professional');
  if (current < tierRank.enterprise) upgrades.push('enterprise');
  
  return upgrades;
};

export function AccountPlan() {
  const { profile, user } = useAuth();
  const { subscription, loading } = useSubscription(profile?.id);
  const { currentOrganization } = useOrganization();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // State for add-on management
  const [activeAddons, setActiveAddons] = useState<string[]>([]);
  const [processingAddon, setProcessingAddon] = useState<string | null>(null);
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);
  const [successAddonName, setSuccessAddonName] = useState<string | null>(null);

  const currentTier = subscription.tier || 'none';
  const planConfig = PLAN_CONFIG[currentTier] || PLAN_CONFIG.none;
  const availableUpgrades = getAvailableUpgrades(currentTier);

  // Fetch user's active add-ons
  useEffect(() => {
    const fetchActiveAddons = async () => {
      if (!user?.id) return;

      try {
        // Get all users in the same org for org-level addon checking
        let userIds = [user.id];
        
        if (currentOrganization?.id) {
          const { data: orgMembers } = await supabase
            .from('organization_members')
            .select('user_id')
            .eq('organization_id', currentOrganization.id);
          
          if (orgMembers) {
            userIds = orgMembers.map(m => m.user_id);
          }
        }

        const { data: addons, error } = await supabase
          .from('user_addons')
          .select('addon_name')
          .in('user_id', userIds)
          .eq('status', 'active');

        if (error) {
          console.error('Error fetching active addons:', error);
          return;
        }

        setActiveAddons(addons?.map(a => a.addon_name) || []);
      } catch (error) {
        console.error('Error fetching active addons:', error);
      }
    };

    fetchActiveAddons();
  }, [user?.id, currentOrganization?.id]);

  // Handle success redirect from Stripe checkout
  useEffect(() => {
    const billingSuccess = searchParams.get('billing_success');
    const addonParam = searchParams.get('addon');

    if (billingSuccess === '1' && addonParam) {
      setShowSuccessBanner(true);
      setSuccessAddonName(addonParam);
      
      // Clear the URL params
      searchParams.delete('billing_success');
      searchParams.delete('addon');
      setSearchParams(searchParams, { replace: true });

      // Refresh active addons
      const refreshAddons = async () => {
        if (!user?.id) return;
        
        let userIds = [user.id];
        if (currentOrganization?.id) {
          const { data: orgMembers } = await supabase
            .from('organization_members')
            .select('user_id')
            .eq('organization_id', currentOrganization.id);
          
          if (orgMembers) {
            userIds = orgMembers.map(m => m.user_id);
          }
        }

        const { data: addons } = await supabase
          .from('user_addons')
          .select('addon_name')
          .in('user_id', userIds)
          .eq('status', 'active');

        setActiveAddons(addons?.map(a => a.addon_name) || []);
      };

      refreshAddons();

      // Auto-hide banner after 10 seconds
      setTimeout(() => setShowSuccessBanner(false), 10000);
    }
  }, [searchParams, user?.id, currentOrganization?.id]);

  const scrollToUpgrades = () => {
    document.getElementById('upgrade-options')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleContactSales = () => {
    navigate('/contact-sales');
  };

  // Handle self-serve add-on purchase via Stripe checkout
  const handleAddOnPurchase = async (addonId: string) => {
    if (!user) {
      navigate('/login');
      return;
    }

    setProcessingAddon(addonId);

    try {
      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate('/login');
        return;
      }

      const response = await fetch('/.netlify/functions/create-addon-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          addonId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.alreadyActive) {
          // Addon already active, refresh the list
          setActiveAddons(prev => [...prev, addonId]);
        } else {
          console.error('Checkout error:', data.error);
        }
        return;
      }

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Error initiating checkout:', error);
    } finally {
      setProcessingAddon(null);
    }
  };

  // Check if an addon is self-serve (can be purchased via Stripe)
  const isSelfServeAddon = (addonId: string): boolean => {
    return SELF_SERVE_ADDON_IDS.includes(addonId);
  };

  // Check if user already has this addon active
  const isAddonActive = (addonId: string): boolean => {
    return activeAddons.includes(addonId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 max-w-6xl mx-auto">
      {/* Success Banner for Add-On Purchase */}
      {showSuccessBanner && (
        <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <div>
              <p className="font-medium text-green-800 dark:text-green-200">
                Add-on activated successfully
              </p>
              <p className="text-sm text-green-700 dark:text-green-300">
                {successAddonName ? `${successAddonName.replace(/_/g, ' ')} is now active for your organization.` : 'Your add-on is now active.'}
              </p>
            </div>
          </div>
        </div>
      )}

      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Plan & Add-Ons</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Manage your subscription and enhance your Core314 experience
        </p>
      </div>

      {/* Current Plan Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">Current Plan: {planConfig.label}</CardTitle>
              <CardDescription className="mt-1">{planConfig.description}</CardDescription>
            </div>
            <Badge variant="outline" className="text-lg px-4 py-1">
              {planConfig.price}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-1">
              <p className="text-sm text-gray-500 dark:text-gray-400">Integrations</p>
              <p className="font-semibold text-gray-900 dark:text-white">{planConfig.integrations}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-gray-500 dark:text-gray-400">Team Size</p>
              <p className="font-semibold text-gray-900 dark:text-white">{planConfig.users}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-gray-500 dark:text-gray-400">AI Capabilities</p>
              <p className="font-semibold text-gray-900 dark:text-white">{planConfig.aiLevel}</p>
            </div>
          </div>
          
          {planConfig.features.length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Included Features</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {planConfig.features.map((feature) => (
                  <div key={feature} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upgrade Options Section */}
      {availableUpgrades.length > 0 && (
        <div id="upgrade-options">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Upgrade Options</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {availableUpgrades.map((tierKey) => {
              const tier = PLAN_CONFIG[tierKey];
              const isEnterprise = tierKey === 'enterprise';
              
              return (
                <Card key={tierKey} className={tierKey === 'professional' ? 'border-2 border-blue-500 relative' : ''}>
                  {tierKey === 'professional' && (
                    <div className="absolute top-0 right-0 bg-blue-500 text-white px-3 py-1 text-sm font-semibold rounded-bl-lg rounded-tr-lg">
                      Recommended
                    </div>
                  )}
                  <CardHeader>
                    <CardTitle className="text-xl">{tier.label}</CardTitle>
                    <CardDescription>{tier.description}</CardDescription>
                    <div className="mt-3">
                      <span className="text-3xl font-bold text-gray-900 dark:text-white">
                        {tier.price}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 mb-6">
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500" />
                        <span className="text-sm">{tier.integrations}</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500" />
                        <span className="text-sm">{tier.users}</span>
                      </li>
                      {tier.features.slice(0, 3).map((feature) => (
                        <li key={feature} className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-500" />
                          <span className="text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      className="w-full"
                      variant={tierKey === 'professional' ? 'default' : 'outline'}
                      onClick={handleContactSales}
                    >
                      {isEnterprise ? 'Contact Sales' : 'Upgrade'}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Top Plan Message */}
      {availableUpgrades.length === 0 && currentTier === 'enterprise' && (
        <Card className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border-purple-200 dark:border-purple-800">
          <CardContent className="py-6">
            <div className="flex items-center gap-4">
              <Sparkles className="h-8 w-8 text-purple-600" />
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">
                  You're on our Enterprise plan
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  You have access to all Core314 features. Contact your account manager for custom requirements.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Available Add-Ons Section */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Available Add-Ons</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Enhance your Core314 experience with premium features tailored to your operational needs.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {ADDONS.map((addon) => {
            const isEligible = canUseAddon(currentTier, addon.minTier, addon.maxTier);
            const needsUpgrade = !isEligible && tierRank[(currentTier as Tier) ?? 'none'] < tierRank[addon.minTier];
            const isActive = isAddonActive(addon.id);
            const isSelfServe = isSelfServeAddon(addon.id);
            const isProcessing = processingAddon === addon.id;
            const IconComponent = addon.icon;

            return (
              <Card key={addon.id} className={`${!isEligible && !isActive ? 'opacity-75' : ''} ${isActive ? 'ring-2 ring-green-500' : ''}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <IconComponent className="h-5 w-5 text-blue-600" />
                      <CardTitle className="text-lg">{addon.name}</CardTitle>
                    </div>
                    {isActive && (
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                        Active
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="mt-2">
                    {addon.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {addon.benefit}
                  </p>
                  
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="text-xs">
                      {addon.compatibilityLabel}
                    </Badge>
                    <span className="text-xl font-bold text-gray-900 dark:text-white">
                      {addon.price}
                    </span>
                  </div>

                  {isActive ? (
                    <Button
                      className="w-full"
                      variant="outline"
                      disabled
                    >
                      <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                      Active
                    </Button>
                  ) : isEligible ? (
                    isSelfServe ? (
                      <Button
                        className="w-full"
                        variant="default"
                        onClick={() => handleAddOnPurchase(addon.id)}
                        disabled={isProcessing}
                      >
                        {isProcessing ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          'Add to Plan'
                        )}
                      </Button>
                    ) : (
                      <Button
                        className="w-full"
                        variant="outline"
                        onClick={handleContactSales}
                      >
                        Contact Sales
                      </Button>
                    )
                  ) : needsUpgrade ? (
                    <Button
                      className="w-full"
                      variant="secondary"
                      onClick={scrollToUpgrades}
                    >
                      <Lock className="mr-2 h-4 w-4" />
                      Upgrade Required
                    </Button>
                  ) : (
                    <Button
                      className="w-full"
                      variant="ghost"
                      disabled
                    >
                      Not Available for Your Plan
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Help Section */}
      <Card className="bg-gray-50 dark:bg-gray-800/50">
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">
                Need help choosing the right plan or add-ons?
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Our team is here to help you find the perfect configuration for your operations.
              </p>
            </div>
            <Button variant="outline" onClick={handleContactSales}>
              Contact Sales
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
