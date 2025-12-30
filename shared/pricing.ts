// ============================================================================
// SINGLE SOURCE OF TRUTH FOR PRICING
// Phase 14.1: Pricing Page Source-of-Truth Fix
// 
// This file is the ONLY place where pricing amounts are defined.
// Both core314-app and core314-landing must import from this file.
// NO inline price literals ($99, $199, etc.) are allowed in JSX.
//
// To update pricing:
// 1. Change the values in this file
// 2. Update the corresponding Stripe price in the Stripe dashboard
// 3. Rebuild both apps (Netlify will do this automatically on merge)
// ============================================================================

export const PRICING = {
  starter: {
    monthly: 199,
    annual: 1990,
    name: 'Starter',
    description: 'Serious operational visibility for small teams',
    integrations: 3,
    fusionContributors: 3,
    historyDays: 30,
    refreshMinutes: 60,
  },
  pro: {
    monthly: 999,
    annual: 9990,
    name: 'Pro',
    description: 'Organizational-scale intelligence and operational depth',
    integrations: 10,
    fusionContributors: 7,
    historyDays: 90,
    refreshMinutes: 15,
  },
  enterprise: {
    custom: true,
    name: 'Enterprise',
    description: 'Full operational command for large organizations',
    integrations: -1, // unlimited
    fusionContributors: -1, // unlimited
    historyDays: -1, // unlimited
    refreshMinutes: 5,
  },
} as const;

export const ADDONS = {
  integrations: {
    starter: { monthly: 75, description: 'Additional Integration (Starter)' },
    pro: { monthly: 50, description: 'Additional Integration (Pro)' },
    custom: { setup: 500, description: 'Custom Integration' },
  },
  analytics: {
    premium: { monthly: 199, description: 'Premium Analytics' },
    dataExport: { monthly: 99, description: 'Data Export' },
  },
  ai: {
    advancedFusion: { monthly: 299, description: 'Advanced Fusion AI' },
    predictive: { monthly: 399, description: 'Predictive Analytics' },
  },
} as const;

export type PlanId = keyof typeof PRICING;
export type AddonCategory = keyof typeof ADDONS;

// Formatting helpers
export const formatPrice = (amount: number): string => {
  return `$${amount.toLocaleString('en-US')}`;
};

export const formatMonthlyPrice = (amount: number): string => {
  return `${formatPrice(amount)}/mo`;
};

export const formatAnnualPrice = (amount: number): string => {
  return `${formatPrice(amount)}/year`;
};
