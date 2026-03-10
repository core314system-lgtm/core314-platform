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
  monitor: {
    monthly: 99,
    name: 'Monitor',
    tagline: 'Early warning system for operational issues.',
    description:
      'Core314 continuously monitors connected systems and detects operational signals across sales, finance, and communication activity.',
    features: [
      'Slack Integration',
      'HubSpot Integration',
      'QuickBooks Integration',
      'Operational Health Score',
      'Signals Dashboard',
      'AI Operational Briefs (10 / month)',
      '30 Day Operational Brief Archive',
      'Up to 5 Users',
    ],
    users: 5,
    briefsPerMonth: 10,
    archiveDays: 30,
  },
  intelligence: {
    monthly: 299,
    name: 'Intelligence',
    tagline: 'Understand what is happening inside your business and why.',
    description:
      'Core314 analyzes operational patterns across your business systems and generates AI-powered Operational Briefs explaining what is happening and what actions leadership should take.',
    features: [
      'Everything in Monitor plus:',
      'Unlimited AI Operational Briefs',
      'Command Center Dashboard',
      'Signal Trend Analysis',
      'Executive Brief Delivery (Slack + Email)',
      'Full Operational Brief Archive',
      'Up to 10 Users',
    ],
    users: 10,
    briefsPerMonth: -1, // unlimited
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
      'Unlimited Users',
      'Advanced Signal Analytics',
      'Operational Pattern Detection',
      'Executive Weekly Operational Reports',
      'Integration Event History',
      'Early Access to New Integrations',
    ],
    users: -1, // unlimited
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
      'Dedicated onboarding',
      'Custom integrations',
      'Priority signal processing',
      'Executive operational reporting',
      'Dedicated success manager',
      'SLA uptime guarantees',
    ],
    users: -1,
    briefsPerMonth: -1,
    archiveDays: -1,
  },
} as const;

export type PlanId = keyof typeof PRICING;

// Formatting helpers
export const formatPrice = (amount: number): string => {
  return `$${amount.toLocaleString('en-US')}`;
};

export const formatMonthlyPrice = (amount: number): string => {
  return `${formatPrice(amount)}/mo`;
};
