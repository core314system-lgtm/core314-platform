import { loadStripe } from '@stripe/stripe-js';

const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';

export const stripePromise = loadStripe(stripePublishableKey);

export const STRIPE_PRICE_IDS = {
  starter: import.meta.env.VITE_STRIPE_STARTER_PRICE_ID || '',
  pro: import.meta.env.VITE_STRIPE_PRO_PRICE_ID || '',
  enterprise: import.meta.env.VITE_STRIPE_ENTERPRISE_PRICE_ID || '',
};
