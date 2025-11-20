import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useSubscription } from '../hooks/useSubscription';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { createCheckoutSession } from '../services/stripe';
import { Sparkles, TrendingUp, Zap, X } from 'lucide-react';

interface AddOnCTAProps {
  type: 'integration_limit' | 'premium_analytics' | 'advanced_fusion_ai' | 'dashboard_footer';
  onDismiss?: () => void;
}

export function AddOnCTA({ type, onDismiss }: AddOnCTAProps) {
  const { user, profile } = useAuth();
  const { subscription } = useSubscription(profile?.id);
  const [loading, setLoading] = useState(false);

  const handlePurchase = async (priceId: string, addonName: string, category: string) => {
    setLoading(true);
    try {
      await createCheckoutSession({
        priceId,
        email: user?.email,
        metadata: {
          type: 'addon',
          addon_name: addonName,
          addon_category: category,
          user_id: profile?.id || '',
        },
      });
    } catch (error) {
      console.error('Checkout error:', error);
      setLoading(false);
    }
  };

  if (type === 'dashboard_footer') {
    return (
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-blue-200 dark:border-blue-800">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles className="w-6 h-6 text-blue-600" />
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">
                  Unlock more power with Add-Ons
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Enhance your Core314 experience with premium features
                </p>
              </div>
            </div>
            <Button onClick={() => window.location.href = '/pricing'}>
              View Add-Ons
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (type === 'integration_limit') {
    const isStarter = subscription.tier === 'starter';
    const priceId = isStarter 
      ? import.meta.env.VITE_STRIPE_PRICE_INTEGRATION_STARTER_ADDON
      : import.meta.env.VITE_STRIPE_PRICE_INTEGRATION_PRO_ADDON;
    const price = isStarter ? '$75' : '$50';

    return (
      <Card className="border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-600" />
              <CardTitle className="text-lg">Integration Limit Reached</CardTitle>
            </div>
            {onDismiss && (
              <Button variant="ghost" size="sm" onClick={onDismiss}>
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
          <CardDescription>
            You've reached your plan's integration limit. Add more integrations to continue connecting your business apps.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{price}/mo</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">per additional integration</p>
            </div>
            <Button
              onClick={() => handlePurchase(
                priceId,
                `Additional Integration (${subscription.tier})`,
                'integration'
              )}
              disabled={loading}
            >
              {loading ? 'Processing...' : 'Add More Integrations'}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (type === 'premium_analytics') {
    return (
      <Card className="border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-purple-600" />
              <CardTitle className="text-lg">Upgrade to Premium Analytics</CardTitle>
            </div>
            {onDismiss && (
              <Button variant="ghost" size="sm" onClick={onDismiss}>
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
          <CardDescription>
            Get advanced reporting, custom dashboards, and deeper insights into your operations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">$199/mo</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Advanced reporting & insights</p>
            </div>
            <Button
              onClick={() => handlePurchase(
                import.meta.env.VITE_STRIPE_PRICE_PREMIUM_ANALYTICS,
                'Premium Analytics',
                'analytics'
              )}
              disabled={loading}
            >
              {loading ? 'Processing...' : 'Upgrade Analytics'}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (type === 'advanced_fusion_ai') {
    return (
      <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-600" />
              <CardTitle className="text-lg">Enable Advanced Fusion AI</CardTitle>
            </div>
            {onDismiss && (
              <Button variant="ghost" size="sm" onClick={onDismiss}>
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
          <CardDescription>
            Unlock enhanced AI capabilities with predictive optimization and advanced recommendations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">$299/mo</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Enhanced AI capabilities</p>
            </div>
            <Button
              onClick={() => handlePurchase(
                import.meta.env.VITE_STRIPE_PRICE_ADVANCED_FUSION_AI,
                'Advanced Fusion AI',
                'ai_module'
              )}
              disabled={loading}
            >
              {loading ? 'Processing...' : 'Enable Advanced AI'}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}
