import { Check, ChevronDown, ChevronUp, Info, Sparkles } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';
import { createCheckoutSession } from '../services/stripe';
import { useAuth } from '../hooks/useAuth';
import { useState } from 'react';
import { PRICING, ADDONS, formatPrice } from '../config/pricing';

// ============================================================================
// PHASE 13.4: BILLING UX (TRUST-FIRST)
// NON-NEGOTIABLE: Plans affect scale & depth only, never feature availability
// All integrations remain visible and functional on all plans
// ============================================================================

// ============================================================================
// PHASE 14.1: PRICING PAGE SOURCE-OF-TRUTH FIX
// All pricing values are imported from shared/pricing.ts
// NO inline price literals ($99, $199, etc.) are allowed in this file
// ============================================================================

const tiers = [
  {
    name: PRICING.starter.name,
    price: formatPrice(PRICING.starter.monthly),
    annualPrice: formatPrice(PRICING.starter.annual),
    priceId: import.meta.env.VITE_STRIPE_PRICE_STARTER,
    annualPriceId: import.meta.env.VITE_STRIPE_PRICE_STARTER_ANNUAL,
    description: PRICING.starter.description,
    scaleDetails: {
      integrations: PRICING.starter.integrations,
      fusionContributors: PRICING.starter.fusionContributors,
      historyDays: PRICING.starter.historyDays,
      refreshMinutes: PRICING.starter.refreshMinutes,
    },
    features: [
      `${PRICING.starter.integrations} integrations included`,
      'Unified dashboards',
      'Basic AI recommendations',
      'Email support',
      '14-day free trial',
    ],
  },
  {
    name: PRICING.pro.name,
    price: formatPrice(PRICING.pro.monthly),
    annualPrice: formatPrice(PRICING.pro.annual),
    priceId: import.meta.env.VITE_STRIPE_PRICE_PRO,
    annualPriceId: import.meta.env.VITE_STRIPE_PRICE_PRO_ANNUAL,
    description: PRICING.pro.description,
    popular: true,
    scaleDetails: {
      integrations: PRICING.pro.integrations,
      fusionContributors: PRICING.pro.fusionContributors,
      historyDays: PRICING.pro.historyDays,
      refreshMinutes: PRICING.pro.refreshMinutes,
    },
    features: [
      `${PRICING.pro.integrations} integrations included`,
      'Proactive Optimization Engine™',
      'Real-time KPI alerts',
      'Advanced analytics',
      'Priority support',
      '14-day free trial',
    ],
  },
  {
    name: PRICING.enterprise.name,
    price: 'Custom',
    annualPrice: 'Custom',
    priceId: import.meta.env.VITE_STRIPE_PRICE_ENTERPRISE,
    annualPriceId: import.meta.env.VITE_STRIPE_PRICE_ENTERPRISE_ANNUAL,
    description: PRICING.enterprise.description,
    isCustom: true,
    scaleDetails: {
      integrations: PRICING.enterprise.integrations,
      fusionContributors: PRICING.enterprise.fusionContributors,
      historyDays: PRICING.enterprise.historyDays,
      refreshMinutes: PRICING.enterprise.refreshMinutes,
    },
    features: [
      'Unlimited integrations',
      'Admin Analytics dashboard',
      'Full API access',
      'On-premise deployment option',
      'Dedicated account manager',
      'Custom SLA',
      '24/7 support',
    ],
  },
];

const addons = [
  {
    category: 'Integrations',
    items: [
      {
        name: ADDONS.integrations.starter.description,
        price: formatPrice(ADDONS.integrations.starter.monthly),
        priceId: import.meta.env.VITE_STRIPE_PRICE_INTEGRATION_STARTER_ADDON,
        description: 'Add more business apps to your Starter plan',
        perMonth: true,
      },
      {
        name: ADDONS.integrations.pro.description,
        price: formatPrice(ADDONS.integrations.pro.monthly),
        priceId: import.meta.env.VITE_STRIPE_PRICE_INTEGRATION_PRO_ADDON,
        description: 'Add more business apps to your Pro plan',
        perMonth: true,
      },
      {
        name: ADDONS.integrations.custom.description,
        price: formatPrice(ADDONS.integrations.custom.setup),
        priceId: import.meta.env.VITE_STRIPE_PRICE_CUSTOM_INTEGRATION,
        description: 'Build a custom connector for your unique system',
        perMonth: false,
        setupFee: true,
      },
    ],
  },
  {
    category: 'Analytics',
    items: [
      {
        name: ADDONS.analytics.premium.description,
        price: formatPrice(ADDONS.analytics.premium.monthly),
        priceId: import.meta.env.VITE_STRIPE_PRICE_PREMIUM_ANALYTICS,
        description: 'Advanced reporting and insights with custom dashboards',
        perMonth: true,
      },
      {
        name: ADDONS.analytics.dataExport.description,
        price: formatPrice(ADDONS.analytics.dataExport.monthly),
        priceId: import.meta.env.VITE_STRIPE_PRICE_DATA_EXPORT,
        description: 'Export all your data anytime in multiple formats',
        perMonth: true,
      },
    ],
  },
  {
    category: 'AI Modules',
    items: [
      {
        name: ADDONS.ai.advancedFusion.description,
        price: formatPrice(ADDONS.ai.advancedFusion.monthly),
        priceId: import.meta.env.VITE_STRIPE_PRICE_ADVANCED_FUSION_AI,
        description: 'Enhanced AI capabilities with predictive optimization',
        perMonth: true,
      },
      {
        name: ADDONS.ai.predictive.description,
        price: formatPrice(ADDONS.ai.predictive.monthly),
        priceId: import.meta.env.VITE_STRIPE_PRICE_PREDICTIVE_ANALYTICS,
        description: 'Forecast future trends with machine learning models',
        perMonth: true,
      },
    ],
  },
];

export function Pricing() {
  const { user } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [showAddons, setShowAddons] = useState(false);
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'annual'>('monthly');

  const handleSubscribe = async (priceId: string, tierName: string) => {
    if (!priceId) {
      window.location.href = '/contact-sales';
      return;
    }
    
    setLoading(priceId);
    try {
      await createCheckoutSession({
        priceId,
        email: user?.email,
        metadata: { tier: tierName.toLowerCase(), billing_interval: billingInterval },
      });
    } catch (error) {
      console.error('Checkout error:', error);
      setLoading(null);
    }
  };

  const getActivePriceId = (tier: typeof tiers[0]) => {
    return billingInterval === 'annual' && tier.annualPriceId 
      ? tier.annualPriceId 
      : tier.priceId;
  };

  const getActivePrice = (tier: typeof tiers[0]) => {
    return billingInterval === 'annual' ? tier.annualPrice : tier.price;
  };

  const handleAddonPurchase = async (priceId: string, addonName: string, category: string) => {
    if (!priceId) return;
    
    setLoading(priceId);
    try {
      await createCheckoutSession({
        priceId,
        email: user?.email,
        metadata: { 
          type: 'addon',
          addon_name: addonName,
          addon_category: category.toLowerCase().replace(/\s+/g, '_'),
        },
      });
    } catch (error) {
      console.error('Checkout error:', error);
      setLoading(null);
    }
  };

  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Choose Your Plan
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400">
            Select the perfect plan for your organization
          </p>
        </div>

        {/* Phase 13.4: Trust-First Messaging */}
        <Alert className="mb-8 border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800">
          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertDescription className="text-blue-800 dark:text-blue-200">
            <span className="font-medium">All features are available on every plan.</span>{' '}
            Plans differ only in scale (number of integrations), depth (historical data), and AI refresh frequency. 
            You'll never lose access to any integration or intelligence feature.
          </AlertDescription>
        </Alert>

        {/* Billing Interval Toggle */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex items-center rounded-lg border border-gray-200 dark:border-gray-700 p-1 bg-gray-50 dark:bg-gray-800">
            <button
              onClick={() => setBillingInterval('monthly')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                billingInterval === 'monthly'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingInterval('annual')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                billingInterval === 'annual'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Annual
              <span className="text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full">
                Save 17%
              </span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {tiers.map((tier) => (
            <Card
              key={tier.name}
              className={tier.popular ? 'border-2 border-blue-500 relative' : ''}
            >
              {tier.popular && (
                <div className="absolute top-0 right-0 bg-blue-500 text-white px-3 py-1 text-sm font-semibold rounded-bl-lg rounded-tr-lg">
                  Most Popular
                </div>
              )}
              <CardHeader>
                <CardTitle className="text-2xl">{tier.name}</CardTitle>
                <CardDescription>{tier.description}</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold text-gray-900 dark:text-white">
                    {getActivePrice(tier)}
                  </span>
                  <span className="text-gray-600 dark:text-gray-400">
                    /{billingInterval === 'annual' ? 'year' : 'month'}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                {/* Scale Details - Phase 13.4 Trust-First */}
                {tier.scaleDetails && (
                  <div className="mb-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 text-sm">
                    <div className="flex items-center gap-1 mb-2 text-gray-700 dark:text-gray-300 font-medium">
                      <Sparkles className="h-4 w-4 text-blue-500" />
                      Scale & Depth
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-gray-600 dark:text-gray-400">
                      <div>{tier.scaleDetails.integrations === -1 ? 'Unlimited' : tier.scaleDetails.integrations} integrations</div>
                      <div>{tier.scaleDetails.historyDays === -1 ? 'Unlimited' : `${tier.scaleDetails.historyDays} days`} history</div>
                      <div>{tier.scaleDetails.fusionContributors === -1 ? 'All' : tier.scaleDetails.fusionContributors} Fusion sources</div>
                      <div>{tier.scaleDetails.refreshMinutes}min AI refresh</div>
                    </div>
                  </div>
                )}
                <ul className="space-y-3 mb-6">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-center">
                      <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
                      <span className="text-gray-700 dark:text-gray-300">{feature}</span>
                    </li>
                  ))}
                </ul>
                <div className="space-y-2">
                  <Button
                    className="w-full"
                    variant={tier.popular ? 'default' : 'outline'}
                    onClick={() => handleSubscribe(getActivePriceId(tier), tier.name)}
                    disabled={loading === getActivePriceId(tier) || tier.isCustom}
                  >
                    {tier.isCustom ? 'Contact Sales' : loading === getActivePriceId(tier) ? 'Processing...' : 'Start Free Trial'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-16">
          <div className="text-center mb-8">
            <Button
              variant="outline"
              size="lg"
              onClick={() => setShowAddons(!showAddons)}
              className="mx-auto"
            >
              {showAddons ? (
                <>
                  <ChevronUp className="w-5 h-5 mr-2" />
                  Hide Available Add-Ons
                </>
              ) : (
                <>
                  <ChevronDown className="w-5 h-5 mr-2" />
                  View Available Add-Ons
                </>
              )}
            </Button>
          </div>

          {showAddons && (
            <div className="space-y-12">
              {addons.map((addonCategory) => (
                <div key={addonCategory.category}>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                    {addonCategory.category}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {addonCategory.items.map((addon) => (
                      <Card key={addon.name} className="flex flex-col">
                        <CardHeader>
                          <CardTitle className="text-lg">{addon.name}</CardTitle>
                          <CardDescription className="text-sm">
                            {addon.description}
                          </CardDescription>
                          <div className="mt-4">
                            <span className="text-3xl font-bold text-gray-900 dark:text-white">
                              {addon.price}
                            </span>
                            {addon.perMonth && (
                              <span className="text-gray-600 dark:text-gray-400">/month</span>
                            )}
                            {addon.setupFee && (
                              <span className="text-sm text-gray-500 dark:text-gray-400 block mt-1">
                                One-time setup fee
                              </span>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent className="flex-1 flex flex-col justify-end">
                          <Button
                            className="w-full"
                            variant="outline"
                            onClick={() => handleAddonPurchase(addon.priceId, addon.name, addonCategory.category)}
                            disabled={loading === addon.priceId || !addon.priceId}
                          >
                            {loading === addon.priceId ? 'Processing...' : 'Add to Plan'}
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
