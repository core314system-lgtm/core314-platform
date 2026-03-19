import { Check, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';
import { createCheckoutSession } from '../services/stripe';
import { useAuth } from '../hooks/useAuth';
import { useState } from 'react';
import { PRICING, formatPrice } from '../config/pricing';

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
    name: PRICING.intelligence.name,
    price: formatPrice(PRICING.intelligence.monthly),
    plan: 'intelligence' as const,
    description: PRICING.intelligence.description,
    features: PRICING.intelligence.features as unknown as string[],
  },
  {
    name: PRICING.commandCenter.name,
    price: formatPrice(PRICING.commandCenter.monthly),
    plan: 'command_center' as const,
    description: PRICING.commandCenter.description,
    popular: true,
    features: PRICING.commandCenter.features as unknown as string[],
  },
  {
    name: PRICING.enterprise.name,
    price: 'Custom',
    plan: null,
    description: PRICING.enterprise.description,
    isCustom: true,
    features: PRICING.enterprise.features as unknown as string[],
  },
];


export function Pricing() {
  const { user } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [showAddons, setShowAddons] = useState(false);

  const handleSubscribe = async (plan: 'intelligence' | 'command_center' | null) => {
    if (!plan) {
      window.location.href = '/contact-sales';
      return;
    }
    
    setLoading(plan);
    try {
      await createCheckoutSession({ plan });
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

        <Alert className="mb-8 border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800">
          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertDescription className="text-blue-800 dark:text-blue-200">
            <span className="font-medium">Trial begins after your first integration is connected.</span>{' '}
            Each tier builds on the previous one, giving you deeper operational intelligence as your needs grow.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
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
                  {!tier.isCustom && (
                    <span className="text-gray-600 dark:text-gray-400">/month</span>
                  )}
                </div>
              </CardHeader>
              <CardContent>
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
                    onClick={() => handleSubscribe(tier.plan)}
                    disabled={loading === tier.plan || tier.isCustom}
                  >
                    {tier.isCustom ? 'Contact Sales' : loading === tier.plan ? 'Processing...' : 'Start Free Trial'}
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
            <div className="text-center py-8">
              <p className="text-gray-600 dark:text-gray-400">
                Enterprise customers can request custom add-ons. Contact sales for details.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
