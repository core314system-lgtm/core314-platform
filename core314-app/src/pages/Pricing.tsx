import { Check } from 'lucide-react';
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
    description: 'Entry-level for small teams',
    features: [
      '1 integration',
      'Up to 5 users',
      'Core dashboard',
      'Basic metrics',
      '14-day free trial',
      'Email support',
    ],
  },
  {
    name: 'Professional',
    price: '$299',
    priceId: import.meta.env.VITE_STRIPE_PRICE_PRO,
    description: 'Advanced operations control',
    popular: true,
    features: [
      'Up to 5 integrations',
      'Up to 25 users',
      'AI Insights Dashboard',
      'Real-time alerts',
      'Custom branding',
      '14-day free trial',
      'Priority support',
    ],
  },
  {
    name: 'Enterprise',
    price: '$999',
    priceId: import.meta.env.VITE_STRIPE_PRICE_ENTERPRISE,
    description: 'Full-featured for large operations',
    features: [
      'Unlimited integrations',
      'Unlimited users',
      'AI Orchestration',
      'Audit trails',
      'API access',
      'Dedicated account manager',
      '14-day free trial',
      '24/7 support',
    ],
  },
];

const addons = [
  {
    name: 'Additional Integration',
    price: '$25',
    priceId: import.meta.env.VITE_STRIPE_PRICE_INTEGRATION_ADDON,
    description: 'Add one more integration beyond your plan limit',
  },
  {
    name: 'AI Automation Add-On',
    price: '$49',
    priceId: import.meta.env.VITE_STRIPE_PRICE_AI_ADDON,
    description: 'Unlock advanced AI orchestration features',
  },
];

export function Pricing() {
  const { user } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);

  const handleSubscribe = async (priceId: string, tierName: string) => {
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
                <Button
                  className="w-full"
                  variant={tier.popular ? 'default' : 'outline'}
                  onClick={() => handleSubscribe(tier.priceId, tier.name)}
                  disabled={loading === tier.priceId}
                >
                  {loading === tier.priceId ? 'Processing...' : 'Subscribe'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-16">
          <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-8">
            Add-Ons
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {addons.map((addon) => (
              <Card key={addon.name}>
                <CardHeader>
                  <CardTitle>{addon.name}</CardTitle>
                  <CardDescription>{addon.description}</CardDescription>
                  <div className="mt-4">
                    <span className="text-3xl font-bold text-gray-900 dark:text-white">
                      {addon.price}
                    </span>
                    <span className="text-gray-600 dark:text-gray-400">/month</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => handleSubscribe(addon.priceId, addon.name)}
                    disabled={loading === addon.priceId}
                  >
                    {loading === addon.priceId ? 'Processing...' : 'Add to Plan'}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
