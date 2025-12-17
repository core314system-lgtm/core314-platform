import { useAuth } from '../hooks/useAuth';
import { useSubscription } from '../hooks/useSubscription';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Check, Sparkles, TrendingUp, Zap, ArrowRight, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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
    priceValue: 2999,
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
    description: 'Add more business apps to your Starter plan.',
    benefit: 'Connect additional tools like Slack, Teams, or Gmail to get a complete view of your operations.',
    price: '$75/mo',
    minTier: 'starter' as Tier,
    maxTier: 'starter' as Tier,
    compatibilityLabel: 'Starter plan only',
    icon: Zap,
  },
  {
    id: 'additional_integration_pro',
    name: 'Additional Integration (Pro)',
    description: 'Add more business apps to your Pro plan.',
    benefit: 'Expand your integration ecosystem beyond the included 10 to capture more operational data.',
    price: '$50/mo',
    minTier: 'professional' as Tier,
    maxTier: 'professional' as Tier,
    compatibilityLabel: 'Pro plan only',
    icon: Zap,
  },
  {
    id: 'premium_analytics',
    name: 'Premium Analytics',
    description: 'Advanced reporting and insights with custom dashboards.',
    benefit: 'Gives operations leaders a single place to monitor KPIs, investigate anomalies, and share reports with stakeholders.',
    price: '$199/mo',
    minTier: 'starter' as Tier,
    maxTier: 'enterprise' as Tier,
    compatibilityLabel: 'Available on Starter+',
    icon: TrendingUp,
  },
  {
    id: 'advanced_fusion_ai',
    name: 'Advanced Fusion AI',
    description: 'Enhanced AI capabilities with predictive optimization.',
    benefit: 'Unlock proactive recommendations that anticipate issues before they impact your operations.',
    price: '$299/mo',
    minTier: 'professional' as Tier,
    maxTier: 'enterprise' as Tier,
    compatibilityLabel: 'Available on Pro+',
    icon: Sparkles,
  },
  {
    id: 'data_export',
    name: 'Data Export',
    description: 'Export all your data anytime in multiple formats.',
    benefit: 'Maintain full ownership of your operational data with CSV, JSON, and PDF exports for compliance and analysis.',
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
  const { profile } = useAuth();
  const { subscription, loading } = useSubscription(profile?.id);
  const navigate = useNavigate();

  const currentTier = subscription.tier || 'none';
  const planConfig = PLAN_CONFIG[currentTier] || PLAN_CONFIG.none;
  const availableUpgrades = getAvailableUpgrades(currentTier);

  const scrollToUpgrades = () => {
    document.getElementById('upgrade-options')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleContactSales = () => {
    navigate('/contact-sales');
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
            const notApplicable = !isEligible && !needsUpgrade;
            const IconComponent = addon.icon;

            return (
              <Card key={addon.id} className={!isEligible ? 'opacity-75' : ''}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <IconComponent className="h-5 w-5 text-blue-600" />
                      <CardTitle className="text-lg">{addon.name}</CardTitle>
                    </div>
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

                  {isEligible ? (
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={handleContactSales}
                    >
                      Add to Plan
                    </Button>
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
