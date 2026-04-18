// ============================================================================
// SINGLE SOURCE OF TRUTH FOR PRICING
// Core314 Operational Intelligence Platform
//
// This file is the ONLY place where pricing amounts are defined.
// Both core314-app and core314-landing must import from this file.
// NO inline price literals ($99, $299, etc.) are allowed in JSX.
//
// To update pricing:
// 1. Change the values in this file
// 2. Update the corresponding Stripe price in the Stripe dashboard
// 3. Rebuild both apps (Netlify will do this automatically on merge)
// ============================================================================

export const PRICING = {
  intelligence: {
    monthly: 299,
    name: 'Intelligence',
    tagline: 'Understand what is happening inside your business and why.',
    description:
      'Core314 analyzes operational patterns across your business systems and generates AI-powered Operational Briefs explaining what is happening and what actions leadership should take.',
    features: [
      'Choose up to 3 integrations from 16 available',
      'Operational Health Score',
      'Signals Dashboard',
      '30 AI Operational Briefs per month',
      'Operational Pattern Detection',
      'Operational Brief Archive',
      '1 User',
    ],
    users: 1,
    briefsPerMonth: 30,
    archiveDays: -1, // unlimited
  },
  commandCenter: {
    monthly: 799,
    name: 'Command Center',
    tagline: 'Continuous operational intelligence for scaling organizations.',
    description:
      'A full operational intelligence command center for leadership teams that need continuous monitoring and deeper signal analytics.',
    features: [
      'Everything in Intelligence plus:',
      'Choose up to 10 integrations from 16 available',
      'Unlimited AI Operational Briefs',
      'Command Center Dashboard',
      'Advanced Signal Analysis',
      'Integration Event History',
      'Up to 5 Users',
    ],
    users: 5,
    briefsPerMonth: -1,
    archiveDays: -1,
  },
  enterprise: {
    custom: true,
    name: 'Enterprise',
    tagline: 'Operational intelligence infrastructure for large organizations.',
    description:
      'For organizations requiring deeper operational intelligence, custom integrations, and dedicated support.',
    features: [
      'Everything in Command Center plus:',
      'Custom integrations',
      'Dedicated onboarding',
      'Executive operational reporting',
      'Priority signal processing',
      'SLA uptime guarantees',
      'Up to 20 Users',
    ],
    users: 20,
    briefsPerMonth: -1,
    archiveDays: -1,
  },
} as const;

export type PlanId = keyof typeof PRICING;

// Plan seat limits for enforcement
export const PLAN_SEAT_LIMITS: Record<string, number> = {
  intelligence: 1,
  Intelligence: 1,
  commandCenter: 5,
  command_center: 5,
  'Command Center': 5,
  enterprise: 20,
  Enterprise: 20,
};

// Formatting helpers
export const formatPrice = (amount: number): string => {
  return `$${amount.toLocaleString('en-US')}`;
};

export const formatMonthlyPrice = (amount: number): string => {
  return `${formatPrice(amount)}/mo`;
};
