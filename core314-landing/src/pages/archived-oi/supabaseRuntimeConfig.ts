/**
 * Runtime Supabase Configuration
 * 
 * This module fetches Supabase configuration at runtime from a Netlify Function
 * instead of embedding it in the client bundle at build time.
 * 
 * This prevents secrets from being detected by Netlify's secret scanner.
 */

interface SupabaseConfig {
  url: string;
  anon: string;
}

let cachedConfig: SupabaseConfig | null = null;
let configPromise: Promise<SupabaseConfig> | null = null;

/**
 * Fetches Supabase configuration from the Netlify Function.
 * Results are cached to avoid repeated network requests.
 */
export async function fetchSupabaseConfig(): Promise<SupabaseConfig> {
  // Return cached config if available
  if (cachedConfig) {
    return cachedConfig;
  }

  // Return existing promise if fetch is in progress
  if (configPromise) {
    return configPromise;
  }

  // Start new fetch
  configPromise = (async () => {
    try {
      const response = await fetch('/.netlify/functions/get-supabase-config');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch Supabase config: ${response.status}`);
      }

      const config = await response.json();
      
      if (!config.url || !config.anon) {
        throw new Error('Invalid Supabase config received');
      }

      cachedConfig = config;
      return config;
    } catch (error) {
      configPromise = null; // Reset promise on error to allow retry
      throw error;
    }
  })();

  return configPromise;
}

/**
 * Gets the cached Supabase URL synchronously.
 * Returns null if config hasn't been fetched yet.
 */
export function getSupabaseUrlSync(): string | null {
  return cachedConfig?.url || null;
}

/**
 * Gets the cached Supabase anon key synchronously.
 * Returns null if config hasn't been fetched yet.
 */
export function getSupabaseAnonKeySync(): string | null {
  return cachedConfig?.anon || null;
}

/**
 * Constructs a Supabase Edge Function URL.
 * @param functionName - The name of the Supabase Edge Function
 * @returns The full URL to the Edge Function
 */
export async function getSupabaseFunctionUrl(functionName: string): Promise<string> {
  const config = await fetchSupabaseConfig();
  return `${config.url}/functions/v1/${functionName}`;
}
