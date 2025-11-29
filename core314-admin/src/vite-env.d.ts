/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_STRIPE_PUBLISHABLE_KEY: string;
  readonly VITE_STRIPE_PRICE_STARTER: string;
  readonly VITE_STRIPE_PRICE_PRO: string;
  readonly VITE_STRIPE_PRICE_ENTERPRISE: string;
  readonly VITE_STRIPE_PRICE_INTEGRATION_ADDON: string;
  readonly VITE_STRIPE_PRICE_AI_ADDON: string;
  readonly VITE_EXTERNAL_INTELLIGENCE_API_URL?: string;
  readonly VITE_EXTERNAL_INTELLIGENCE_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
