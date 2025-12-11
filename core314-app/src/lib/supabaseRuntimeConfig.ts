/**
 * Runtime Supabase Configuration
 * 
 * This module fetches Supabase configuration at runtime from a Netlify Function,
 * preventing sensitive values from being embedded in the client-side bundle.
 */

interface SupabaseConfig {
  url: string;
  anon: string;
}

interface SupabaseConfigResponse {
  configured: boolean;
  url?: string;
  anon?: string;
  message?: string;
}

let configPromise: Promise<SupabaseConfig> | null = null;
let cachedConfig: SupabaseConfig | null = null;

async function fetchSupabaseConfig(): Promise<SupabaseConfig> {
  try {
    const res = await fetch('/.netlify/functions/get-supabase-config');
    if (!res.ok) {
      throw new Error(`Failed to load Supabase config: ${res.status}`);
    }
    const data: SupabaseConfigResponse = await res.json();
    if (!data.configured || !data.url || !data.anon) {
      throw new Error(data.message || 'Supabase configuration missing');
    }
    return { url: data.url, anon: data.anon };
  } catch (error) {
    console.error('Error fetching Supabase config:', error);
    throw error;
  }
}

/**
 * Get Supabase configuration (async, cached)
 * This is the primary way to get config - it fetches once and caches the result.
 */
export function getSupabaseConfig(): Promise<SupabaseConfig> {
  if (!configPromise) {
    configPromise = fetchSupabaseConfig().then(config => {
      cachedConfig = config;
      return config;
    });
  }
  return configPromise;
}

/**
 * Get Supabase URL (async)
 */
export async function getSupabaseUrl(): Promise<string> {
  const { url } = await getSupabaseConfig();
  return url;
}

/**
 * Get Supabase anon key (async)
 */
export async function getSupabaseAnonKey(): Promise<string> {
  const { anon } = await getSupabaseConfig();
  return anon;
}

/**
 * Get Supabase URL synchronously (only works after config has been fetched)
 * Returns null if config hasn't been fetched yet.
 */
export function getSupabaseUrlSync(): string | null {
  return cachedConfig?.url ?? null;
}

/**
 * Get Supabase anon key synchronously (only works after config has been fetched)
 * Returns null if config hasn't been fetched yet.
 */
export function getSupabaseAnonKeySync(): string | null {
  return cachedConfig?.anon ?? null;
}

/**
 * Get full URL for a Supabase Edge Function
 * @param functionName - The name of the Edge Function (e.g., 'fusion-analyze')
 * @returns Full URL to the Edge Function
 */
export async function getSupabaseFunctionUrl(functionName: string): Promise<string> {
  const { url } = await getSupabaseConfig();
  return `${url}/functions/v1/${functionName}`;
}

/**
 * Check if config has been loaded
 */
export function isConfigLoaded(): boolean {
  return cachedConfig !== null;
}
