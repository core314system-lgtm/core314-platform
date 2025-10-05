import { Check } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../ui/card';
import { Button } from '../ui/button';

const tiers = [
  {
    name: 'Starter',
    price: '$99',
    description: 'Perfect for small teams getting started',
    features: [
      '1 integration',
      'Up to 5 users',
      'Core dashboard',
      'Basic metrics',
      'Email support',
      '14-day free trial',
    ],
    cta: 'Start Free Trial',
    highlighted: false,
  },
  {
    name: 'Professional',
    price: '$299',
    description: 'For growing teams that need more',
    features: [
      'Up to 5 integrations',
      'Up to 25 users',
      'AI Insights Dashboard',
      'Advanced analytics',
      'Smart alerts',
      'Custom branding',
      'Priority support',
      '14-day free trial',
    ],
    cta: 'Start Free Trial',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: '$999+',
    description: 'For organizations at scale',
    features: [
      'Unlimited integrations',
      'Unlimited users',
      'AI Orchestration',
      'Full audit trails',
      'API access',
      'Custom integrations',
      'Dedicated account manager',
      'SLA guarantee',
    ],
    cta: 'Contact Sales',
    highlighted: false,
  },
];

export function PricingSection() {
  const scrollToSignup = () => {
    document.getElementById('signup')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="py-24 bg-white dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Start free for 14 days. No credit card required.
          </p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8">
          {tiers.map((tier, index) => (
            <Card
              key={index}
              className={`relative ${
                tier.highlighted
                  ? 'border-2 border-core314-electric-blue shadow-xl scale-105'
                  : 'border-2'
              }`}
            >
              {tier.highlighted && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-core314-electric-blue text-white text-sm font-semibold rounded-full">
                  Most Popular
                </div>
              )}
              <CardHeader>
                <CardTitle className="text-2xl">{tier.name}</CardTitle>
                <div className="mt-4">
                  <span className="text-4xl font-bold text-gray-900 dark:text-white">
                    {tier.price}
                  </span>
                  {tier.price !== '$999+' && <span className="text-gray-600 dark:text-gray-400">/month</span>}
                </div>
                <CardDescription className="mt-2">{tier.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {tier.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start">
                      <Check className="h-5 w-5 text-core314-electric-blue mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-600 dark:text-gray-400">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button
                  className={`w-full ${
                    tier.highlighted
                      ? 'bg-core314-electric-blue hover:bg-core314-electric-blue/90'
                      : ''
                  }`}
                  variant={tier.highlighted ? 'default' : 'outline'}
                  onClick={scrollToSignup}
                >
                  {tier.cta}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
        
        <div className="mt-12 text-center">
          <p className="text-gray-600 dark:text-gray-400">
            All plans include: SSL encryption • SOC 2 compliance • 99.9% uptime SLA • Regular backups
          </p>
        </div>
      </div>
    </section>
  );
}
