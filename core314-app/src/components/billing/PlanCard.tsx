import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Check, X } from 'lucide-react';

interface PlanFeature {
  name: string;
  included: boolean;
}

interface PlanCardProps {
  planName: string;
  price: number;
  billingPeriod: 'monthly' | 'annual';
  description: string;
  features: PlanFeature[];
  integrationLimit: number;
  currentPlan?: boolean;
  onSelectPlan?: () => void;
  loading?: boolean;
}

export const PlanCard: React.FC<PlanCardProps> = ({
  planName,
  price,
  billingPeriod,
  description,
  features,
  integrationLimit,
  currentPlan = false,
  onSelectPlan,
  loading = false,
}) => {
  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getPlanColor = (plan: string) => {
    switch (plan.toLowerCase()) {
      case 'free':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100';
      case 'starter':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100';
      case 'pro':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100';
      case 'enterprise':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100';
    }
  };

  return (
    <Card className={`relative ${currentPlan ? 'ring-2 ring-primary' : ''}`}>
      {currentPlan && (
        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
          <Badge className="bg-primary text-primary-foreground">Current Plan</Badge>
        </div>
      )}
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-2xl">{planName}</CardTitle>
          <Badge className={getPlanColor(planName)}>{planName}</Badge>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex items-baseline">
            <span className="text-4xl font-bold">{formatPrice(price)}</span>
            <span className="text-muted-foreground ml-2">
              /{billingPeriod === 'monthly' ? 'mo' : 'yr'}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium">
            {integrationLimit === -1 ? 'Unlimited' : integrationLimit} Integration{integrationLimit !== 1 ? 's' : ''}
          </div>
          <div className="space-y-2 mt-4">
            {features.map((feature, index) => (
              <div key={index} className="flex items-start gap-2">
                {feature.included ? (
                  <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <X className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
                )}
                <span className={`text-sm ${feature.included ? '' : 'text-muted-foreground line-through'}`}>
                  {feature.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
      <CardFooter>
        {onSelectPlan && (
          <Button
            className="w-full"
            onClick={onSelectPlan}
            disabled={currentPlan || loading}
            variant={currentPlan ? 'outline' : 'default'}
          >
            {loading ? 'Processing...' : currentPlan ? 'Current Plan' : `Upgrade to ${planName}`}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};
