import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { fetchSupabaseConfig } from './supabaseRuntimeConfig';

/**
 * Supabase client singleton - initialized at runtime from Netlify Function
 * This prevents secrets from being embedded in the client bundle.
 */
let supabaseClient: SupabaseClient | null = null;
let initPromise: Promise<SupabaseClient> | null = null;

/**
 * Initialize the Supabase client by fetching config from Netlify Function.
 * Returns a promise that resolves to the initialized client.
 */
export async function initSupabaseClient(): Promise<SupabaseClient> {
  if (supabaseClient) {
    return supabaseClient;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    const config = await fetchSupabaseConfig();
    supabaseClient = createClient(config.url, config.anon);
    return supabaseClient;
  })();

  return initPromise;
}

/**
 * Get the Supabase client synchronously.
 * Returns null if not yet initialized.
 * Use initSupabaseClient() for async initialization.
 */
export function getSupabaseClient(): SupabaseClient | null {
  return supabaseClient;
}

// Legacy export for backward compatibility - will be null until initialized
// Components should use initSupabaseClient() or the SupabaseClientContext
export const supabase = null as unknown as SupabaseClient;
