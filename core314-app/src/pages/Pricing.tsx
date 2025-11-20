import { Check, ChevronDown, ChevronUp, Play } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { createCheckoutSession } from '../services/stripe';
import { useAuth } from '../hooks/useAuth';
import { useState } from 'react';

const tiers = [
  {
    name: 'Starter',
    price: '$99',
    priceId: import.meta.env.VITE_STRIPE_PRICE_STARTER,
    description: 'Perfect for small teams getting started',
    features: [
      '3 integrations included',
      'Unified dashboards',
      'Basic AI recommendations',
      'Email support',
      '14-day free trial',
    ],
  },
  {
    name: 'Pro',
    price: '$999',
    priceId: import.meta.env.VITE_STRIPE_PRICE_PRO,
    description: 'Advanced operations for growing businesses',
    popular: true,
    features: [
      '10 integrations included',
      'Proactive Optimization Engine™',
      'Real-time KPI alerts',
      'Advanced analytics',
      'Priority support',
      '14-day free trial',
    ],
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    priceId: import.meta.env.VITE_STRIPE_PRICE_ENTERPRISE,
    description: 'Full-featured for large operations',
    isCustom: true,
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
        name: 'Additional Integration (Starter)',
        price: '$75',
        priceId: import.meta.env.VITE_STRIPE_PRICE_INTEGRATION_STARTER_ADDON,
        description: 'Add more business apps to your Starter plan',
        perMonth: true,
      },
      {
        name: 'Additional Integration (Pro)',
        price: '$50',
        priceId: import.meta.env.VITE_STRIPE_PRICE_INTEGRATION_PRO_ADDON,
        description: 'Add more business apps to your Pro plan',
        perMonth: true,
      },
      {
        name: 'Custom Integration',
        price: '$500',
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
        name: 'Premium Analytics',
        price: '$199',
        priceId: import.meta.env.VITE_STRIPE_PRICE_PREMIUM_ANALYTICS,
        description: 'Advanced reporting and insights with custom dashboards',
        perMonth: true,
      },
      {
        name: 'Data Export',
        price: '$99',
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
        name: 'Advanced Fusion AI',
        price: '$299',
        priceId: import.meta.env.VITE_STRIPE_PRICE_ADVANCED_FUSION_AI,
        description: 'Enhanced AI capabilities with predictive optimization',
        perMonth: true,
      },
      {
        name: 'Predictive Analytics',
        price: '$399',
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
        metadata: { tier: tierName.toLowerCase() },
      });
    } catch (error) {
      console.error('Checkout error:', error);
      setLoading(null);
    }
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
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Choose Your Plan
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400">
            Select the perfect plan for your organization
          </p>
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
                    {tier.price}
                  </span>
                  <span className="text-gray-600 dark:text-gray-400">/month</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 mb-6">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-center">
                      <Check className="h-5 w-5 text-green-500 mr-2" />
                      <span className="text-gray-700 dark:text-gray-300">{feature}</span>
                    </li>
                  ))}
                </ul>
                <div className="space-y-2">
                  <Button
                    className="w-full"
                    variant={tier.popular ? 'default' : 'outline'}
                    onClick={() => handleSubscribe(tier.priceId, tier.name)}
                    disabled={loading === tier.priceId || tier.isCustom}
                  >
                    {tier.isCustom ? 'Contact Sales' : loading === tier.priceId ? 'Processing...' : 'Start Free Trial'}
                  </Button>
                  <Button
                    className="w-full"
                    variant="ghost"
                    size="sm"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Watch Demo
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
