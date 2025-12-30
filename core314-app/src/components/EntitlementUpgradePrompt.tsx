import { AlertCircle, ArrowRight, Sparkles } from 'lucide-react';
import { useEntitlements } from '../hooks/useEntitlements';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { useNavigate } from 'react-router-dom';

/**
 * ============================================================================
 * PHASE 12.3: UPGRADE UX (NO LOCKS)
 * ============================================================================
 * 
 * NON-NEGOTIABLE RULES:
 * 1. All integrations remain selectable regardless of plan
 * 2. If limits exceeded: show informative, trust-safe messaging
 * 3. Never disable existing intelligence
 * 4. Provide clear "What you gain by upgrading" previews
 * 
 * This component provides informative upgrade prompts when users approach
 * or exceed their entitlement limits. It NEVER disables features or shows
 * alarming language.
 * ============================================================================
 */

interface EntitlementUpgradePromptProps {
  limitType: 'integrations' | 'fusion';
  currentCount: number;
  variant?: 'inline' | 'card' | 'banner';
  className?: string;
}

export function EntitlementUpgradePrompt({
  limitType,
  currentCount,
  variant = 'inline',
  className = '',
}: EntitlementUpgradePromptProps) {
  const { entitlements, isNearLimit, getUpgradeBenefits } = useEntitlements();
  const navigate = useNavigate();
  
  const limit = limitType === 'integrations' 
    ? entitlements.max_connected_integrations 
    : entitlements.max_fusion_contributors;
  
  const isUnlimited = limit === -1;
  const nearLimit = isNearLimit(limitType, currentCount);
  const atLimit = !isUnlimited && currentCount >= limit;
  
  if (isUnlimited || (!nearLimit && !atLimit)) {
    return null;
  }
  
  const upgradeBenefits = getUpgradeBenefits();
  const relevantBenefits = upgradeBenefits.filter(b => 
    limitType === 'integrations' 
      ? b.benefit.toLowerCase().includes('integration')
      : b.benefit.toLowerCase().includes('fusion')
  );
  
  const handleUpgrade = () => {
    navigate('/settings/billing');
  };
  
  if (variant === 'banner') {
    return (
      <div className={`bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 ${className}`}>
        <div className="flex items-start gap-3">
          <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
              {atLimit 
                ? `You're using all ${limit} ${limitType === 'integrations' ? 'integration slots' : 'Fusion contributors'}`
                : `You're using ${currentCount} of ${limit} ${limitType === 'integrations' ? 'integration slots' : 'Fusion contributors'}`
              }
            </p>
            <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
              Upgrade to unlock more capacity and deeper insights.
            </p>
            {relevantBenefits.length > 0 && (
              <ul className="mt-2 space-y-1">
                {relevantBenefits.slice(0, 2).map((benefit, idx) => (
                  <li key={idx} className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
                    <ArrowRight className="h-3 w-3" />
                    {benefit.benefit}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={handleUpgrade}
            className="flex-shrink-0"
          >
            View Plans
          </Button>
        </div>
      </div>
    );
  }
  
  if (variant === 'card') {
    return (
      <Card className={`border-blue-200 dark:border-blue-800 ${className}`}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-blue-600" />
            Unlock More with an Upgrade
          </CardTitle>
          <CardDescription>
            {atLimit 
              ? `You're at your ${limitType === 'integrations' ? 'integration' : 'Fusion contributor'} limit`
              : `You're approaching your ${limitType === 'integrations' ? 'integration' : 'Fusion contributor'} limit`
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Current usage</span>
              <span className="font-medium">{currentCount} / {limit}</span>
            </div>
            
            {relevantBenefits.length > 0 && (
              <div className="pt-2 border-t">
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  What you gain by upgrading:
                </p>
                <ul className="space-y-1">
                  {relevantBenefits.map((benefit, idx) => (
                    <li key={idx} className="text-sm flex items-center gap-2">
                      <ArrowRight className="h-3 w-3 text-green-600" />
                      {benefit.benefit}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            <Button 
              className="w-full mt-2" 
              onClick={handleUpgrade}
            >
              View Upgrade Options
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <div className={`flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 ${className}`}>
      <AlertCircle className="h-4 w-4" />
      <span>
        {atLimit 
          ? `Using ${currentCount}/${limit} ${limitType === 'integrations' ? 'integrations' : 'Fusion contributors'}`
          : `${currentCount}/${limit} ${limitType === 'integrations' ? 'integrations' : 'Fusion contributors'} used`
        }
      </span>
      <button 
        onClick={handleUpgrade}
        className="underline hover:no-underline"
      >
        Upgrade
      </button>
    </div>
  );
}

interface UpgradeBenefitsPreviewProps {
  className?: string;
}

export function UpgradeBenefitsPreview({ className = '' }: UpgradeBenefitsPreviewProps) {
  const { getUpgradeBenefits } = useEntitlements();
  const navigate = useNavigate();
  
  const benefits = getUpgradeBenefits();
  
  if (benefits.length === 0) {
    return null;
  }
  
  const nextTier = benefits[0]?.to || 'professional';
  
  return (
    <Card className={`bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800 ${className}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-blue-600" />
          Upgrade to {nextTier.charAt(0).toUpperCase() + nextTier.slice(1)}
        </CardTitle>
        <CardDescription>
          Unlock more capacity and deeper intelligence
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 mb-4">
          {benefits.slice(0, 4).map((benefit, idx) => (
            <li key={idx} className="text-sm flex items-start gap-2">
              <ArrowRight className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
              <span>{benefit.benefit}</span>
            </li>
          ))}
        </ul>
        <Button 
          className="w-full" 
          onClick={() => navigate('/settings/billing')}
        >
          View Plans
        </Button>
      </CardContent>
    </Card>
  );
}

interface EntitlementUsageIndicatorProps {
  limitType: 'integrations' | 'fusion';
  currentCount: number;
  showUpgradeLink?: boolean;
  className?: string;
}

export function EntitlementUsageIndicator({
  limitType,
  currentCount,
  showUpgradeLink = true,
  className = '',
}: EntitlementUsageIndicatorProps) {
  const { entitlements, isNearLimit } = useEntitlements();
  const navigate = useNavigate();
  
  const limit = limitType === 'integrations' 
    ? entitlements.max_connected_integrations 
    : entitlements.max_fusion_contributors;
  
  const isUnlimited = limit === -1;
  const nearLimit = isNearLimit(limitType, currentCount);
  const atLimit = !isUnlimited && currentCount >= limit;
  
  const getStatusColor = () => {
    if (isUnlimited) return 'text-muted-foreground';
    if (atLimit) return 'text-amber-600 dark:text-amber-400';
    if (nearLimit) return 'text-blue-600 dark:text-blue-400';
    return 'text-muted-foreground';
  };
  
  const getProgressColor = () => {
    if (isUnlimited) return 'bg-green-500';
    if (atLimit) return 'bg-amber-500';
    if (nearLimit) return 'bg-blue-500';
    return 'bg-green-500';
  };
  
  const percentage = isUnlimited ? 100 : Math.min(100, (currentCount / limit) * 100);
  
  return (
    <div className={`space-y-1 ${className}`}>
      <div className="flex items-center justify-between text-sm">
        <span className={getStatusColor()}>
          {limitType === 'integrations' ? 'Integrations' : 'Fusion Contributors'}
        </span>
        <span className={`font-medium ${getStatusColor()}`}>
          {isUnlimited ? `${currentCount} (unlimited)` : `${currentCount} / ${limit}`}
        </span>
      </div>
      
      {!isUnlimited && (
        <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div 
            className={`h-full ${getProgressColor()} transition-all duration-300`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}
      
      {showUpgradeLink && (nearLimit || atLimit) && (
        <button 
          onClick={() => navigate('/settings/billing')}
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
        >
          Upgrade for more
        </button>
      )}
    </div>
  );
}
